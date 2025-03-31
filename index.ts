import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Database, aql } from "arangojs";
import { DocumentCollection, EdgeCollection } from "arangojs/collection";
import { setCookie, getCookie } from "hono/cookie";

const app = new Hono();

// Environment variables with defaults
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "8529";
const DB_USER = process.env.DB_USER || "root";
const DB_PASS = process.env.DB_PASS || "asdBGT788";
const SERVER_PORT = parseInt(process.env.PORT || "3000");
const SERVER_HOST = process.env.HOST || "0.0.0.0";

// Sanitize username for collection names
function sanitizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Add these utility functions at the top
async function waitForDatabase(
  db: Database,
  maxRetries = 5,
  delay = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const version = await db.version();
      console.log("Database connection successful, version:", version);
      return true;
    } catch (err) {
      console.warn(
        `Database connection attempt ${i + 1}/${maxRetries} failed:`,
        err.message
      );
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

async function ensureDatabase(
  systemDb: Database,
  dbName: string
): Promise<void> {
  try {
    const dbs = await systemDb.listDatabases();
    if (!dbs.includes(dbName)) {
      await systemDb.createDatabase(dbName);
      console.log(`Database ${dbName} created`);
    } else {
      console.log(`Database ${dbName} exists`);
    }
  } catch (err) {
    throw new Error(`Failed to ensure database ${dbName}: ${err.message}`);
  }
}

// Modify the startServer function
async function startServer() {
  let systemDb: Database;
  let db: Database;

  try {
    // Initialize system database connection with retry
    systemDb = new Database({
      url: `http://${DB_HOST}:${DB_PORT}`,
      databaseName: "_system",
      auth: { username: DB_USER, password: DB_PASS },
    });

    // Test connection with retry
    const connected = await waitForDatabase(systemDb);
    if (!connected) {
      throw new Error("Failed to connect to ArangoDB after multiple attempts");
    }

    // Ensure somap database exists
    await ensureDatabase(systemDb, "somap");

    // Initialize somap database connection
    db = new Database({
      url: `http://${DB_HOST}:${DB_PORT}`,
      databaseName: "somap",
      auth: { username: DB_USER, password: DB_PASS },
    });

    // Test somap database connection
    const somapConnected = await waitForDatabase(db);
    if (!somapConnected) {
      throw new Error(
        "Failed to connect to somap database after multiple attempts"
      );
    }

    // Get existing collections
    const existing = await db.collections();
    const names = existing.map((c) => c.name);
    console.log("Existing collections:", names);

    // Create collections if they don't exist
    const requiredCollections = ["users", "types", "entities"];
    for (const name of requiredCollections) {
      if (!names.includes(name)) {
        console.log(`Creating collection ${name}...`);
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      } else {
        console.log(`Collection ${name} exists`);
      }
    }

    // Create edge collection if it doesn't exist
    if (!names.includes("relations")) {
      console.log("Creating edge collection relations...");
      await db.createEdgeCollection("relations");
      console.log("Created edge collection: relations");
    } else {
      console.log("Edge collection relations exists");
    }

    // Create indices
    console.log("Creating indices...");
    try {
      await db.collection("users").ensureIndex({
        type: "persistent",
        fields: ["username"],
        unique: true,
        name: "idx_username",
      });
      console.log("Created username index");

      await db.collection("entities").ensureIndex({
        type: "persistent",
        fields: ["perspective"],
        name: "idx_perspective",
      });
      console.log("Created perspective index");
    } catch (err) {
      console.warn("Failed to create some indices:", err);
    }

    // Store database in app locals
    app.locals = { db };
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }

  // Add after app initialization
  app.use("*", async (c, next) => {
    const { db } = app.locals || {};

    if (!db) {
      console.error("Database not initialized");
      return c.json({ error: "Service unavailable" }, 503);
    }

    try {
      // Quick check if database is responsive
      await db.version();
    } catch (err) {
      console.error("Database connection error:", err);
      return c.json({ error: "Service unavailable" }, 503);
    }

    await next();
  });

  // User Signup
  app.post("/api/users/signup", async (c) => {
    const { username, password } = await c.req.json();

    // Input validation
    if (!username || typeof username !== "string") {
      return c.json({ error: "Username is required" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return c.json(
        { error: "Password must be at least 6 characters long" },
        400
      );
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return c.json(
        { error: "Username must contain only letters and numbers" },
        400
      );
    }

    const { db } = app.locals;
    const sanitizedUsername = sanitizeUsername(username);

    try {
      console.log("Attempting to create user:", sanitizedUsername);

      // Check if username exists using AQL query
      const cursor = await db.query(aql`
        FOR u IN users
        FILTER u.username == ${sanitizedUsername}
        LIMIT 1
        RETURN u
      `);
      const existingUsers = await cursor.all();

      if (existingUsers.length > 0) {
        console.log("Username already exists:", sanitizedUsername);
        return c.json({ error: "Username already exists" }, 409);
      }

      // Create user document
      const user = {
        username: sanitizedUsername,
        password, // In production, this should be hashed
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      // Save user using the collection directly
      console.log("Saving user document:", { ...user, password: "[REDACTED]" });
      const result = await db.collection("users").save(user);
      console.log("User document saved:", result);

      if (!result || !result._key) {
        throw new Error("Failed to create user document");
      }

      // Set session cookie
      setCookie(c, "userId", sanitizedUsername, {
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      });

      return c.json({
        userId: sanitizedUsername,
        username: sanitizedUsername,
        createdAt: user.createdAt,
      });
    } catch (err) {
      console.error("Signup failed:", err);
      return c.json(
        {
          error: "Signup failed",
          details:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        },
        500
      );
    }
  });

  // User Login
  app.post("/api/users/login", async (c) => {
    const { username, password } = await c.req.json();

    // Input validation
    if (!username || !password) {
      return c.json({ error: "Username and password are required" }, 400);
    }

    const { db } = app.locals;
    const sanitizedUsername = sanitizeUsername(username);

    try {
      // Find user by username and password
      const user = await db.collection("users").firstExample({
        username: sanitizedUsername,
        password, // In production, this should be hashed and compared securely
      });

      if (!user) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      // Update last login time
      await db.collection("users").update(user._key, {
        lastLogin: new Date(),
      });

      // Set session cookie
      setCookie(c, "userId", sanitizedUsername, {
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      });

      return c.json({
        userId: sanitizedUsername,
        username: sanitizedUsername,
        lastLogin: new Date(),
      });
    } catch (err) {
      console.error("Login failed:", err);
      return c.json(
        {
          error: "Login failed",
          details:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        },
        500
      );
    }
  });

  // User Logout
  app.post("/api/users/logout", async (c) => {
    // Clear the session cookie
    setCookie(c, "userId", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    return c.json({ success: true, message: "Logged out successfully" });
  });

  // Entity Creation
  app.post("/api/entities", async (c) => {
    const { name, typeId, color, creatorId, perspective, kind, props } =
      await c.req.json();

    if (!name || !typeId || !creatorId || !kind || !props) {
      return c.json(
        {
          error: "Missing required fields",
          details: "Required: name, typeId, creatorId, kind, props",
        },
        400
      );
    }

    const { db } = app.locals;

    try {
      // Create entity using Foxx service
      const entity = {
        label: name,
        type: typeId,
        kind,
        props,
        perspective: perspective || "default",
        createdAt: new Date(),
        createdBy: creatorId,
      };

      // Call Foxx service
      const response = await fetch(
        `http://${DB_HOST}:${DB_PORT}/_db/somap/_api/entity-service/entities`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${DB_USER}:${DB_PASS}`
            ).toString("base64")}`,
          },
          body: JSON.stringify(entity),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Entity creation failed:", error);
        return c.json(
          {
            error: "Entity creation failed",
            details: error.message || "Unknown error",
          },
          response.status
        );
      }

      const result = await response.json();
      console.log("Entity created:", result);

      // Create creator relation
      const relation = {
        _from: `users/${creatorId}`,
        _to: result.entity._id,
        predicate: "created",
        createdAt: new Date(),
      };

      // Call Foxx service for relation creation
      const relationResponse = await fetch(
        `http://${DB_HOST}:${DB_PORT}/_db/somap/_api/entity-service/relations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${DB_USER}:${DB_PASS}`
            ).toString("base64")}`,
          },
          body: JSON.stringify(relation),
        }
      );

      if (!relationResponse.ok) {
        console.warn(
          "Failed to create creator relation:",
          await relationResponse.json()
        );
      }

      return c.json({
        id: result.entity._id,
        success: true,
        entity: result.entity,
      });
    } catch (err) {
      console.error("Entity creation failed:", err);
      return c.json(
        {
          error: "Entity creation failed",
          details:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        },
        500
      );
    }
  });

  // Get all entities
  app.get("/api/entities", async (c) => {
    try {
      const perspective = c.req.query("perspective") || "default";
      const allEntities = await db
        .query(
          aql`
        FOR e IN entities
        FILTER e.perspective == ${perspective}
        RETURN e
      `
        )
        .then((cursor) => cursor.all());

      return c.json(allEntities);
    } catch (err) {
      console.error("Error fetching entities:", err);
      return c.json(
        { error: "Failed to fetch entities", details: err.message },
        500
      );
    }
  });

  // Update entity
  app.patch("/api/entities/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const { name } = await c.req.json();
      if (!name) {
        return c.json({ error: "Name is required" }, 400);
      }

      const docId = id.includes("/") ? id : `entities/${id}`;
      console.log(`Updating entity ${docId} with name: ${name}`);
      const result = await db.collection("entities").update(docId, { name });
      console.log(`Entity ${docId} updated:`, result);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating entity:", err);
      return c.json(
        { error: "Failed to update entity", details: err.message },
        500
      );
    }
  });

  // Delete entity
  app.delete("/api/entities/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const docId = id.includes("/") ? id : `entities/${id}`;
      console.log(`Deleting entity ${docId}`);

      // Optionally remove associated relations
      await db.query(aql`
        FOR r IN relations
        FILTER r._from == ${docId} OR r._to == ${docId}
        REMOVE r IN relations
      `);

      const result = await db.collection("entities").remove(docId);
      console.log(`Entity ${docId} deleted:`, result);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting entity:", err);
      return c.json(
        { error: "Failed to delete entity", details: err.message },
        500
      );
    }
  });

  // Type Creation
  app.post("/api/types", async (c) => {
    const { name, color, symbol } = await c.req.json();
    try {
      const types = db.collection("types");
      const type = { name, color, symbol, createdAt: new Date() };
      const result = await types.save(type);
      return c.json({ id: result._id });
    } catch (err) {
      console.error("Type creation failed:", err);
      return c.json(
        { error: "Type creation failed", details: err.message },
        500
      );
    }
  });

  // Get all types
  app.get("/api/types", async (c) => {
    try {
      const allTypes = await db
        .query(aql`FOR t IN types RETURN t`)
        .then((cursor) => cursor.all());
      return c.json(allTypes);
    } catch (err) {
      console.error("Error fetching types:", err);
      return c.json(
        { error: "Failed to fetch types", details: err.message },
        500
      );
    }
  });

  // Update type
  app.patch("/api/types/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const { name, color, symbol } = await c.req.json();
      const updateData = {};
      if (name) updateData.name = name;
      if (color) updateData.color = color;
      if (symbol) updateData.symbol = symbol;
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No update data provided" }, 400);
      }
      const docId = id.includes("/") ? id : `types/${id}`;
      const result = await db.collection("types").update(docId, updateData);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating type:", err);
      return c.json(
        { error: "Failed to update type", details: err.message },
        500
      );
    }
  });

  // Delete type
  app.delete("/api/types/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const docId = id.includes("/") ? id : `types/${id}`;
      const result = await db.collection("types").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting type:", err);
      return c.json(
        { error: "Failed to delete type", details: err.message },
        500
      );
    }
  });

  // Relation Creation
  app.post("/api/relations", async (c) => {
    console.log("Relation creation endpoint called");
    const { name, from, to, lineType } = await c.req.json();
    console.log("Relation request data:", { name, from, to, lineType });

    if (!name || !from || !to) {
      return c.json({ error: "Missing required fields: name, from, to" }, 400);
    }

    try {
      const _from = from.includes("/") ? from : `entities/${from}`;
      const _to = to.includes("/") ? to : `entities/${to}`;

      // Check if documents exist using direct document access
      const fromDoc = await db
        .collection(_from.split("/")[0])
        .document(_from.split("/")[1])
        .catch(() => null);
      const toDoc = await db
        .collection(_to.split("/")[0])
        .document(_to.split("/")[1])
        .catch(() => null);

      if (!fromDoc || !toDoc) {
        return c.json(
          {
            error: `One or both documents (${_from}, ${_to}) do not exist`,
            details: `From: ${fromDoc ? "exists" : "missing"}, To: ${
              toDoc ? "exists" : "missing"
            }`,
          },
          404
        );
      }

      const relation = {
        name,
        _from,
        _to,
        lineType: lineType || "solid",
        createdAt: new Date(),
      };

      console.log("Creating relation:", relation);
      const result = await db.collection("relations").save(relation);
      console.log("Relation created:", result);
      return c.json({
        id: result._id,
        success: true,
        relation: result,
      });
    } catch (err) {
      console.error("Relation creation failed:", err);
      return c.json(
        { error: "Relation creation failed", details: err.message },
        500
      );
    }
  });

  // Update relation
  app.patch("/api/relations/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const { name, lineType } = await c.req.json();
      const updateData = {};
      if (name) updateData.name = name;
      if (lineType) updateData.lineType = lineType;
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No update data provided" }, 400);
      }
      const docId = id.includes("/") ? id : `relations/${id}`;
      const result = await db.collection("relations").update(docId, updateData);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating relation:", err);
      return c.json(
        { error: "Failed to update relation", details: err.message },
        500
      );
    }
  });

  // Delete relation
  app.delete("/api/relations/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const docId = id.includes("/") ? id : `relations/${id}`;
      const result = await db.collection("relations").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting relation:", err);
      return c.json(
        { error: "Failed to delete relation", details: err.message },
        500
      );
    }
  });

  // Get all relations
  app.get("/api/relations", async (c) => {
    try {
      const allRelations = await db
        .query(aql`FOR r IN relations RETURN r`)
        .then((cursor) => cursor.all());
      return c.json(allRelations);
    } catch (err) {
      console.error("Error fetching relations:", err);
      return c.json(
        { error: "Failed to fetch relations", details: err.message },
        500
      );
    }
  });

  // Perspective Creation
  app.post("/api/perspectives", async (c) => {
    try {
      const { name } = await c.req.json();
      if (!name) {
        return c.json({ error: "Name is required" }, 400);
      }
      const existingPerspective = await db
        .query(
          aql`
        FOR e IN entities
        FILTER e.perspective == ${name} AND e.is_perspective == true
        RETURN e
      `
        )
        .then((cursor) => cursor.all());
      if (existingPerspective.length > 0) {
        return c.json({ error: "Perspective already exists" }, 409);
      }
      const perspective = {
        name,
        is_perspective: true,
        perspective: name,
        createdAt: new Date(),
      };
      const result = await db.collection("entities").save(perspective);
      return c.json({ id: result._id, success: true, perspective: result });
    } catch (err) {
      console.error("Perspective creation failed:", err);
      return c.json(
        { error: "Perspective creation failed", details: err.message },
        500
      );
    }
  });

  // Get all perspectives
  app.get("/api/perspectives", async (c) => {
    try {
      const perspectives = await db
        .query(
          aql`
        FOR e IN entities
        FILTER e.is_perspective == true
        RETURN e
      `
        )
        .then((cursor) => cursor.all());
      if (!perspectives.some((p) => p.name === "default")) {
        perspectives.unshift({ name: "default", is_perspective: true });
      }
      return c.json(perspectives);
    } catch (err) {
      console.error("Error fetching perspectives:", err);
      return c.json(
        { error: "Failed to fetch perspectives", details: err.message },
        500
      );
    }
  });

  // Update perspective
  app.patch("/api/perspectives/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const { name } = await c.req.json();
      if (!name) {
        return c.json({ error: "Name is required" }, 400);
      }
      const docId = id.includes("/") ? id : `entities/${id}`;
      const perspective = await db
        .query(
          aql`
        FOR e IN DOCUMENT(${docId})
        FILTER e.is_perspective == true
        RETURN e
      `
        )
        .then((cursor) => cursor.all());
      if (perspective.length === 0) {
        return c.json({ error: "Not a perspective" }, 404);
      }
      const result = await db.collection("entities").update(docId, { name });
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating perspective:", err);
      return c.json(
        { error: "Failed to update perspective", details: err.message },
        500
      );
    }
  });

  // Delete perspective
  app.delete("/api/perspectives/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const docId = id.includes("/") ? id : `entities/${id}`;
      const perspective = await db
        .query(
          aql`
        FOR e IN DOCUMENT(${docId})
        FILTER e.is_perspective == true
        RETURN e
      `
        )
        .then((cursor) => cursor.all());
      if (perspective.length === 0) {
        return c.json({ error: "Not a perspective" }, 404);
      }
      const result = await db.collection("entities").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting perspective:", err);
      return c.json(
        { error: "Failed to delete perspective", details: err.message },
        500
      );
    }
  });

  // SOM Data Endpoint
  app.get("/api/som", async (c) => {
    try {
      const userId = getCookie(c, "userId") || c.req.query("userId") || null;
      const perspective = c.req.query("perspective") || "default";
      if (!userId) {
        return c.json({ entities: [], types: [], relations: [], user: null });
      }
      const allEntities = await db
        .query(
          aql`
        FOR e IN entities
        FILTER e.perspective == ${perspective}
        RETURN e
      `
        )
        .then((cursor) => cursor.all())
        .catch(() => []);
      const allTypes = await db
        .query(aql`FOR t IN types RETURN t`)
        .then((cursor) => cursor.all())
        .catch(() => []);
      const userRelations = await db
        .query(
          aql`
        FOR r IN relations
        FILTER r._from == ${`users/${userId}`} OR r.type == 'material'
        RETURN r
      `
        )
        .then((cursor) => cursor.all())
        .catch(() => []);
      const user = await db
        .query(aql`FOR u IN users FILTER u.username == ${userId} RETURN u`)
        .then((cursor) => cursor.all())
        .then((res) => res[0] || null);

      if (user) setCookie(c, "userId", userId, { path: "/", maxAge: 604800 });

      return c.json({
        entities: allEntities,
        types: allTypes,
        relations: userRelations,
        user: { username: user?.username, entityCount: userRelations.length },
        perspective,
      });
    } catch (err) {
      console.error("Error fetching SOM data:", err);
      return c.json(
        { error: "Internal Server Error", details: err.message },
        500
      );
    }
  });

  // Debug route
  app.get("/api/debug", async (c) => {
    try {
      const collectionStats = {};
      for (const collName of ["users", "types", "entities", "relations"]) {
        try {
          const collection = db.collection(collName);
          const count = await collection.count();
          const sample = await db
            .query(
              aql`
            FOR doc IN ${collection}
            LIMIT 5
            RETURN doc
          `
            )
            .then((cursor) => cursor.all());
          collectionStats[collName] = { count, sample };
        } catch (err) {
          collectionStats[collName] = { error: err.message };
        }
      }

      return c.json({
        message: "Server is running",
        timestamp: new Date().toISOString(),
        collections: collectionStats,
        routes: [
          "/api/users/signup",
          "/api/users/login",
          "/api/users/logout",
          "/api/entities",
          "/api/types",
          "/api/relations",
          "/api/perspectives",
          "/api/som",
        ],
      });
    } catch (err) {
      return c.json({
        message: "Server is running but debug info collection failed",
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Serve static files AFTER defining all API routes
  app.use("/*", serveStatic({ root: "./public" }));

  console.log(`Started server on ${SERVER_HOST}:${SERVER_PORT}`);
}

startServer().catch((err) => console.error("Server startup failed:", err));

// Handle graceful shutdown and hot reloading
process.on("SIGINT", () => {
  console.log("Received SIGINT signal. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM signal. Shutting down gracefully...");
  process.exit(0);
});

export default {
  port: SERVER_PORT,
  fetch: app.fetch,
};
