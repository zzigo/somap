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
    console.log(`Connecting to ArangoDB at ${DB_HOST}:${DB_PORT}...`);
    // Initialize system database connection with retry
    systemDb = new Database({
      url: `http://${DB_HOST}:${DB_PORT}`,
      databaseName: "_system",
      auth: { username: DB_USER, password: DB_PASS },
    });

    // Test connection with retry
    const connected = await waitForDatabase(systemDb, 10, 3000);
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
    const somapConnected = await waitForDatabase(db, 10, 3000);
    if (!somapConnected) {
      throw new Error(
        "Failed to connect to somap database after multiple attempts"
      );
    }
    
    console.log("Successfully connected to ArangoDB");

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
      // Find user by username and password using AQL
      const cursor = await db.query(aql`
        FOR u IN users
        FILTER u.username == ${sanitizedUsername} AND u.password == ${password}
        LIMIT 1
        RETURN u
      `);
      
      const users = await cursor.all();
      const user = users.length > 0 ? users[0] : null;

      if (!user) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      // Update last login time
      await db.collection("users").update(user._key, {
        lastLogin: new Date(),
      });

      // Set session cookie with better persistence
      setCookie(c, "userId", sanitizedUsername, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: false, // Set to false so client-side JS can read it
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
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('entities')) {
        // Create entities collection if it doesn't exist
        console.log("Creating entities collection...");
        await db.createCollection('entities');
      }
      
      if (!collectionNames.includes('relations')) {
        // Create relations collection if it doesn't exist
        console.log("Creating relations collection...");
        await db.createEdgeCollection('relations');
      }
      
      // Create entity directly instead of using Foxx service (which might not be available)
      const entity = {
        label: name,
        type: typeId,
        kind,
        props,
        perspective: perspective || "default",
        createdAt: new Date(),
        createdBy: creatorId,
      };

      console.log("Creating entity:", entity);
      
      // Save entity directly
      const result = await db.collection("entities").save(entity);
      console.log("Entity created:", result);

      // Create creator relation
      if (collectionNames.includes('relations')) {
        try {
          const relation = {
            _from: `users/${creatorId}`,
            _to: `entities/${result._key}`,
            predicate: "created",
            createdAt: new Date(),
          };
  
          console.log("Creating relation:", relation);
          const relationResult = await db.collection("relations").save(relation);
          console.log("Relation created:", relationResult);
        } catch (relationErr) {
          console.warn("Failed to create relation:", relationErr);
        }
      }

      return c.json({
        id: result._id,
        success: true,
        entity: result,
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
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('entities')) {
        console.log("Entities collection doesn't exist yet, returning empty array");
        return c.json([]);
      }
      
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
      // Return empty array instead of error
      return c.json([]);
    }
  });
  
  // Get a single entity by ID
  app.get("/api/entities/:id", async (c) => {
    try {
      const id = c.req.param("id");
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('entities')) {
        return c.json({ error: "Entities collection does not exist" }, 404);
      }
      
      // Handle the ID format
      const docId = id.includes("/") ? id : `entities/${id}`;
      console.log(`Fetching entity ${docId}`);
      
      try {
        const entity = await db.collection("entities").document(docId);
        console.log("Found entity:", entity);
        return c.json(entity);
      } catch (e) {
        console.error(`Entity ${docId} not found:`, e);
        return c.json({ 
          error: "Entity not found", 
          details: `Document ${docId} does not exist` 
        }, 404);
      }
    } catch (err) {
      console.error("Error fetching entity:", err);
      return c.json(
        { error: "Failed to fetch entity", details: err.message },
        500
      );
    }
  });

  // Update entity
  app.patch("/api/entities/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const updateData = await c.req.json();
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('entities')) {
        return c.json({ error: "Entities collection does not exist" }, 404);
      }
      
      // Make sure we have something to update
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No update data provided" }, 400);
      }

      const docId = id.includes("/") ? id : `entities/${id}`;
      console.log(`Updating entity ${docId} with data:`, updateData);
      
      // Make sure the document exists first
      try {
        const doc = await db.collection("entities").document(docId);
        console.log("Found document to update:", doc);
      } catch (e) {
        console.error(`Document ${docId} not found:`, e);
        return c.json({ 
          error: "Entity not found", 
          details: `Document ${docId} does not exist` 
        }, 404);
      }
      
      // Perform the update
      const result = await db.collection("entities").update(docId, updateData);
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
      console.log("Delete entity request for ID:", id);
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('entities')) {
        return c.json({ error: "Entities collection does not exist" }, 404);
      }
      
      const docId = id.includes("/") ? id : `entities/${id}`;
      console.log(`Deleting entity with formatted docId: ${docId}`);
      
      // First check if the document exists
      try {
        const doc = await db.collection("entities").document(docId);
        console.log("Found document to delete:", doc);
      } catch (e) {
        // If collection exists but document doesn't, try other ID formats
        console.warn(`Document ${docId} not found, trying alternative formats...`);

        // Try with just the ID (no collection prefix)
        try {
          if (id.includes("/")) {
            const parts = id.split("/");
            if (parts.length > 1) {
              const altDocId = `entities/${parts[1]}`;
              console.log(`Trying alternate docId: ${altDocId}`);
              await db.collection("entities").document(altDocId);
              console.log(`Found document with alternate docId: ${altDocId}`);
              
              // Use this ID for deletion
              return c.json(await deleteEntityWithRelations(db, altDocId));
            }
          }
        } catch (altErr) {
          console.warn(`Alternative document format not found either:`, altErr);
        }
        
        // If we reach here, all attempts failed
        console.error(`Document not found for deletion:`, e);
        return c.json({ 
          error: "Entity not found", 
          details: `Document "${id}" does not exist in any format`
        }, 404);
      }

      // If we get here, document exists and we can delete it
      return c.json(await deleteEntityWithRelations(db, docId));
    } catch (err) {
      console.error("Error deleting entity:", err);
      return c.json(
        { error: "Failed to delete entity", details: err.message },
        500
      );
    }
  });
  
  // Helper function to delete entity and its relations
  async function deleteEntityWithRelations(db, docId) {
    console.log(`Removing relations for entity ${docId}`);
    try {
      // Remove associated relations - both directions
      await db.query(aql`
        FOR r IN relations
        FILTER r._from == ${docId} OR r._to == ${docId}
        REMOVE r IN relations
      `);
      
      console.log(`Removing entity ${docId}`);
      const result = await db.collection("entities").remove(docId);
      console.log(`Entity ${docId} deleted:`, result);
      return { success: true, deleted: result };
    } catch (err) {
      console.error(`Error in deleteEntityWithRelations:`, err);
      throw err;
    }
  }

  // Type Creation
  app.post("/api/types", async (c) => {
    const { name, color, symbol } = await c.req.json();
    try {
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('types')) {
        // Create types collection if it doesn't exist
        console.log("Creating types collection...");
        await db.createCollection('types');
      }
      
      const types = db.collection("types");
      // Add schema for type (based on CLAUDE.md requirements)
      const type = { 
        name, 
        color, 
        symbol, 
        category: 'custom', // Default category
        schema: {}, // Empty schema to start with
        createdAt: new Date() 
      };
      const result = await types.save(type);
      console.log("Type created:", result);
      return c.json({ id: result._id, success: true, type: result });
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
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('types')) {
        console.log("Types collection doesn't exist yet, returning empty array");
        return c.json([]);
      }
      
      const allTypes = await db
        .query(aql`FOR t IN types RETURN t`)
        .then((cursor) => cursor.all());
      return c.json(allTypes);
    } catch (err) {
      console.error("Error fetching types:", err);
      // Return empty array instead of error
      return c.json([]);
    }
  });

  // Update type
  app.patch("/api/types/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const { name, color, symbol, category, schema } = await c.req.json();
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('types')) {
        return c.json({ error: "Types collection does not exist" }, 404);
      }
      
      // Build update data
      const updateData = {};
      if (name) updateData.name = name;
      if (color) updateData.color = color;
      if (symbol) updateData.symbol = symbol;
      if (category) updateData.category = category;
      if (schema) updateData.schema = schema;
      
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No update data provided" }, 400);
      }
      
      // Handle ID formatting
      const docId = id.includes("/") ? id : `types/${id}`;
      console.log(`Updating type ${docId} with data:`, updateData);
      
      // Make sure the document exists first
      try {
        const doc = await db.collection("types").document(docId);
        console.log("Found document to update:", doc);
      } catch (e) {
        console.error(`Document ${docId} not found:`, e);
        return c.json({ 
          error: "Type not found", 
          details: `Document ${docId} does not exist` 
        }, 404);
      }
      
      // Perform the update
      const result = await db.collection("types").update(docId, updateData);
      console.log("Update result:", result);
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
    const { name, from, to, lineType, predicate } = await c.req.json();
    console.log("Relation request data:", { name, from, to, lineType, predicate });

    if (!name || !from || !to) {
      return c.json({ error: "Missing required fields: name, from, to" }, 400);
    }

    try {
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('relations')) {
        // Create relations collection if it doesn't exist
        console.log("Creating relations collection...");
        await db.createEdgeCollection('relations');
      }
      
      const _from = from.includes("/") ? from : `entities/${from}`;
      const _to = to.includes("/") ? to : `entities/${to}`;
      
      // Only check if documents exist if the collections exist
      let fromExists = true;
      let toExists = true;
      
      const fromColl = _from.split("/")[0];
      const toColl = _to.split("/")[0];
      
      if (collectionNames.includes(fromColl)) {
        try {
          await db.collection(fromColl).document(_from.split("/")[1]);
        } catch (e) {
          fromExists = false;
        }
      }
      
      if (collectionNames.includes(toColl)) {
        try {
          await db.collection(toColl).document(_to.split("/")[1]);
        } catch (e) {
          toExists = false;
        }
      }

      if (!fromExists || !toExists) {
        return c.json(
          {
            error: `One or both documents (${_from}, ${_to}) do not exist`,
            details: `From: ${fromExists ? "exists" : "missing"}, To: ${toExists ? "exists" : "missing"}`,
          },
          404
        );
      }

      const relation = {
        name,
        _from,
        _to,
        predicate: predicate || name, // Use name as predicate if not provided
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
      // Get update data with all possible fields
      const { name, lineType, predicate, _from, _to } = await c.req.json();
      
      // Create update object with all provided fields
      const updateData = {};
      if (name) updateData.name = name;
      if (lineType) updateData.lineType = lineType;
      if (predicate) updateData.predicate = predicate;
      
      // For edge endpoints, we need special handling
      if (_from || _to) {
        // Check if collection exists
        const collections = await db.collections();
        const collectionNames = collections.map(coll => coll.name);
        
        if (!collectionNames.includes('relations')) {
          return c.json({ error: "Relations collection does not exist" }, 404);
        }
        
        // Verify that the document exists
        const docId = id.includes("/") ? id : `relations/${id}`;
        
        try {
          // Get the current relation to maintain values for any fields not being updated
          const currentRelation = await db.collection("relations").document(docId);
          
          // Handle _from endpoint
          if (_from) {
            // Use provided _from or keep existing
            const fromId = _from.includes("/") ? _from : `entities/${_from}`;
            const fromColl = fromId.split("/")[0];
            
            // Check if from document exists
            if (collectionNames.includes(fromColl)) {
              try {
                await db.collection(fromColl).document(fromId.split("/")[1]);
                updateData._from = fromId;
              } catch (e) {
                return c.json({ 
                  error: "Source document not found", 
                  details: `Document ${fromId} does not exist` 
                }, 404);
              }
            } else {
              return c.json({ 
                error: "Source collection not found", 
                details: `Collection ${fromColl} does not exist` 
              }, 404);
            }
          }
          
          // Handle _to endpoint
          if (_to) {
            // Use provided _to or keep existing
            const toId = _to.includes("/") ? _to : `entities/${_to}`;
            const toColl = toId.split("/")[0];
            
            // Check if to document exists
            if (collectionNames.includes(toColl)) {
              try {
                await db.collection(toColl).document(toId.split("/")[1]);
                updateData._to = toId;
              } catch (e) {
                return c.json({ 
                  error: "Target document not found", 
                  details: `Document ${toId} does not exist` 
                }, 404);
              }
            } else {
              return c.json({ 
                error: "Target collection not found", 
                details: `Collection ${toColl} does not exist` 
              }, 404);
            }
          }
        } catch (e) {
          console.error(`Relation ${docId} not found:`, e);
          return c.json({ 
            error: "Relation not found", 
            details: `Document ${docId} does not exist` 
          }, 404);
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No update data provided" }, 400);
      }
      
      const docId = id.includes("/") ? id : `relations/${id}`;
      console.log(`Updating relation ${docId} with:`, updateData);
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
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('relations')) {
        console.log("Relations collection doesn't exist yet, returning empty array");
        return c.json([]);
      }
      
      const allRelations = await db
        .query(aql`FOR r IN relations RETURN r`)
        .then((cursor) => cursor.all());
      return c.json(allRelations);
    } catch (err) {
      console.error("Error fetching relations:", err);
      // Return empty array instead of error
      return c.json([]);
    }
  });

  // Perspective endpoints - using the dedicated perspectives collection
  app.post("/api/perspectives", async (c) => {
    try {
      const { name, description, kinds, types, rules, relKinds, origin } = await c.req.json();
      
      if (!name) {
        return c.json({ error: "Name is required" }, 400);
      }
      
      if (!kinds || !Array.isArray(kinds) || kinds.length === 0) {
        return c.json({ error: "At least one kind is required" }, 400);
      }
      
      // Check if collection exists
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('perspectives')) {
        // Create perspectives collection if it doesn't exist
        console.log("Creating perspectives collection...");
        await db.createCollection('perspectives');
      }
      
      // Check if perspective already exists
      let existingPerspective = [];
      try {
        existingPerspective = await db
          .query(aql`
            FOR p IN perspectives
            FILTER p.name == ${name}
            RETURN p
          `)
          .then((cursor) => cursor.all());
      } catch (e) {
        console.warn("Error checking for existing perspective:", e.message);
      }
      
      if (existingPerspective.length > 0) {
        return c.json({ error: "Perspective already exists" }, 409);
      }
      
      // Create perspective
      const perspective = {
        name,
        description,
        kinds,
        types: types || [],
        rules: rules || {},
        relKinds: relKinds || ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"],
        origin: origin || "user-created",
        createdAt: new Date(),
      };
      
      // Save to perspectives collection
      const result = await db.collection("perspectives").save(perspective);
      console.log("Perspective created:", result);
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
      // Get perspectives from the dedicated collection
      // Check if collection exists first to avoid errors
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      let perspectives = [];
      if (collectionNames.includes('perspectives')) {
        perspectives = await db
          .query(aql`
            FOR p IN perspectives
            RETURN p
          `)
          .then((cursor) => cursor.all());
      } else {
        console.log("perspectives collection doesn't exist yet, using default only");
      }
      
      // Check if default perspective exists, if not add it in the response
      if (!perspectives.some(p => p.name === "default")) {
        perspectives.unshift({
          name: "default",
          description: "Default perspective with all kinds",
          kinds: ["object", "agent", "material", "environment", "interaction"],
          relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"],
          _key: "default"
        });
      }
      
      return c.json(perspectives);
    } catch (err) {
      console.error("Error fetching perspectives:", err);
      // Return default perspective instead of error
      return c.json([{
        name: "default",
        description: "Default perspective with all kinds",
        kinds: ["object", "agent", "material", "environment", "interaction"],
        relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"],
        _key: "default"
      }]);
    }
  });

  // Get a specific perspective
  app.get("/api/perspectives/:key", async (c) => {
    try {
      const key = c.req.param("key");
      
      if (key === "default") {
        // Return the default perspective
        return c.json({
          _key: "default",
          name: "default",
          description: "Default perspective with all kinds",
          kinds: ["object", "agent", "material", "environment", "interaction"],
          relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"]
        });
      }
      
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const perspective = await db.collection("perspectives").document(docId);
      
      return c.json(perspective);
    } catch (err) {
      console.error("Error fetching perspective:", err);
      return c.json(
        { error: "Failed to fetch perspective", details: err.message },
        500
      );
    }
  });

  // Update perspective
  app.patch("/api/perspectives/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const update = await c.req.json();
      
      if (key === "default") {
        return c.json({ error: "Cannot modify default perspective" }, 400);
      }
      
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const result = await db.collection("perspectives").update(docId, update);
      
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
  app.delete("/api/perspectives/:key", async (c) => {
    try {
      const key = c.req.param("key");
      
      if (key === "default") {
        return c.json({ error: "Cannot delete default perspective" }, 400);
      }
      
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const result = await db.collection("perspectives").remove(docId);
      
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting perspective:", err);
      return c.json(
        { error: "Failed to delete perspective", details: err.message },
        500
      );
    }
  });
  
  // Get entities in a perspective
  app.get("/api/perspectives/:key/entities", async (c) => {
    try {
      const key = c.req.param("key");
      let perspectiveName;
      
      if (key === "default") {
        perspectiveName = "default";
      } else {
        const docId = key.includes("/") ? key : `perspectives/${key}`;
        const perspective = await db.collection("perspectives").document(docId);
        perspectiveName = perspective.name;
      }
      
      const entities = await db
        .query(aql`
          FOR e IN entities
          FILTER e.perspective == ${perspectiveName}
          RETURN e
        `)
        .then((cursor) => cursor.all());
      
      return c.json(entities);
    } catch (err) {
      console.error("Error fetching perspective entities:", err);
      return c.json(
        { error: "Failed to fetch perspective entities", details: err.message },
        500
      );
    }
  });

  // Properties endpoints
  app.get("/api/properties", async (c) => {
    try {
      const allProperties = await db
        .query(aql`FOR p IN properties RETURN p`)
        .then((cursor) => cursor.all());
      return c.json(allProperties);
    } catch (err) {
      console.error("Error fetching properties:", err);
      return c.json(
        { error: "Failed to fetch properties", details: err.message },
        500
      );
    }
  });

  app.post("/api/properties", async (c) => {
    try {
      const property = await c.req.json();
      const result = await db.collection("properties").save(property);
      return c.json({ id: result._id, success: true, property: result });
    } catch (err) {
      console.error("Property creation failed:", err);
      return c.json(
        { error: "Property creation failed", details: err.message },
        500
      );
    }
  });

  app.get("/api/properties/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const docId = key.includes("/") ? key : `properties/${key}`;
      const property = await db.collection("properties").document(docId);
      return c.json(property);
    } catch (err) {
      console.error("Error fetching property:", err);
      return c.json(
        { error: "Failed to fetch property", details: err.message },
        500
      );
    }
  });

  app.patch("/api/properties/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const update = await c.req.json();
      const docId = key.includes("/") ? key : `properties/${key}`;
      const result = await db.collection("properties").update(docId, update);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating property:", err);
      return c.json(
        { error: "Failed to update property", details: err.message },
        500
      );
    }
  });

  app.delete("/api/properties/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const docId = key.includes("/") ? key : `properties/${key}`;
      const result = await db.collection("properties").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting property:", err);
      return c.json(
        { error: "Failed to delete property", details: err.message },
        500
      );
    }
  });

  // Property Predictors endpoints
  app.get("/api/propertyPredictors", async (c) => {
    try {
      // Check if collection exists first to avoid errors
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      
      if (!collectionNames.includes('propertyPredictors')) {
        console.log("propertyPredictors collection doesn't exist yet, returning empty array");
        return c.json([]);
      }
      
      const allPredictors = await db
        .query(aql`FOR p IN propertyPredictors RETURN p`)
        .then((cursor) => cursor.all());
      return c.json(allPredictors);
    } catch (err) {
      console.error("Error fetching property predictors:", err);
      // Return empty array instead of error for better client experience
      return c.json([]);
    }
  });

  app.post("/api/propertyPredictors", async (c) => {
    try {
      const predictor = await c.req.json();
      const result = await db.collection("propertyPredictors").save(predictor);
      return c.json({ id: result._id, success: true, predictor: result });
    } catch (err) {
      console.error("Property predictor creation failed:", err);
      return c.json(
        { error: "Property predictor creation failed", details: err.message },
        500
      );
    }
  });

  app.get("/api/propertyPredictors/:key", async (c) => {
    try {
      const key = c.req.param("key");
      const docId = key.includes("/") ? key : `propertyPredictors/${key}`;
      const predictor = await db.collection("propertyPredictors").document(docId);
      return c.json(predictor);
    } catch (err) {
      console.error("Error fetching property predictor:", err);
      return c.json(
        { error: "Failed to fetch property predictor", details: err.message },
        500
      );
    }
  });

  app.post("/api/propertyPredictors/:key/apply", async (c) => {
    try {
      const key = c.req.param("key");
      const { entityId } = await c.req.json();
      
      // Call the Foxx service
      const response = await fetch(
        `http://${DB_HOST}:${DB_PORT}/_db/somap/_api/entity-service/propertyPredictors/${key}/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${DB_USER}:${DB_PASS}`).toString("base64")}`,
          },
          body: JSON.stringify({ entityId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return c.json(
          { error: "Failed to apply property predictor", details: error.message },
          response.status
        );
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      console.error("Error applying property predictor:", err);
      return c.json(
        { error: "Failed to apply property predictor", details: err.message },
        500
      );
    }
  });

  app.post("/api/propertyPredictors/:key/bulk-apply", async (c) => {
    try {
      const key = c.req.param("key");
      const { perspectiveId } = await c.req.json();
      
      // Call the Foxx service
      const response = await fetch(
        `http://${DB_HOST}:${DB_PORT}/_db/somap/_api/entity-service/propertyPredictors/${key}/bulk-apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${DB_USER}:${DB_PASS}`).toString("base64")}`,
          },
          body: JSON.stringify({ perspectiveId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return c.json(
          { error: "Failed to bulk apply property predictor", details: error.message },
          response.status
        );
      }

      const result = await response.json();
      return c.json(result);
    } catch (err) {
      console.error("Error bulk applying property predictor:", err);
      return c.json(
        { error: "Failed to bulk apply property predictor", details: err.message },
        500
      );
    }
  });

  // SOM Data Endpoint
  app.get("/api/som", async (c) => {
    try {
      const userId = getCookie(c, "userId") || c.req.query("userId") || null;
      const perspective = c.req.query("perspective") || "default";
      
      console.log(`SOM API called with userId: ${userId}, perspective: ${perspective}`);
      
      // Always fetch data regardless of login status - we'll filter relations by user later
      // Use BatchTool approach - run all queries in parallel
      const [
        entitiesResult,
        typesResult,
        relationsResult,
        userResult,
        propertiesResult,
        predictorsResult,
        perspectiveResult
      ] = await Promise.all([
        // Always fetch entities for the current perspective
        db.query(aql`
          FOR e IN entities
          FILTER e.perspective == ${perspective}
          RETURN e
        `).then(cursor => cursor.all()).catch(() => []),
        
        // Always fetch all types
        db.query(aql`
          FOR t IN types 
          RETURN t
        `).then(cursor => cursor.all()).catch(() => []),
        
        // Fetch relations - if logged in, only get user's relations, otherwise get public ones
        db.query(aql`
          FOR r IN relations
          FILTER ${userId ? aql`r._from == ${"users/" + userId} OR r.type == 'material' OR r.predicate == 'interactWith'` : aql`r.predicate == 'interactWith' OR r.type == 'material' OR r.predicate == 'connectsTo'`}
          RETURN r
        `).then(cursor => cursor.all()).catch(() => []),
        
        // Fetch user info if logged in
        userId ? db.query(aql`
          FOR u IN users 
          FILTER u.username == ${userId} 
          RETURN u
        `).then(cursor => cursor.all()).catch(() => []) : Promise.resolve([]),
        
        // Always fetch all properties
        db.query(aql`
          FOR p IN properties
          RETURN p
        `).then(cursor => cursor.all()).catch(() => []),
        
        // Always fetch all predictors
        db.query(aql`
          FOR p IN propertyPredictors
          RETURN p
        `).then(cursor => cursor.all()).catch(() => []),
        
        // Always fetch perspective info
        db.query(aql`
          FOR p IN perspectives
          FILTER p.name == ${perspective}
          RETURN p
        `).then(cursor => cursor.all()).catch(() => [])
      ]);
      
      const user = userResult[0] || null;
      const currentPerspective = perspectiveResult[0] || {
        name: "default",
        description: "Default perspective with all kinds",
        kinds: ["object", "agent", "material", "environment", "interaction"],
        relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory", "interactWith"]
      };

      if (user) {
        setCookie(c, "userId", userId, { path: "/", maxAge: 604800 });
        console.log(`User ${userId} found, cookie set`);
      }

      console.log(`SOM API returning: ${entitiesResult.length} entities, ${typesResult.length} types, ${relationsResult.length} relations`);
      
      return c.json({
        entities: entitiesResult,
        types: typesResult,
        relations: relationsResult,
        properties: propertiesResult,
        propertyPredictors: predictorsResult,
        user: user ? { 
          username: user.username, 
          entityCount: relationsResult.length 
        } : null,
        perspective: currentPerspective
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
      const collections = [
        "users", 
        "types", 
        "entities", 
        "relations", 
        "properties", 
        "propertyPredictors", 
        "perspectives"
      ];
      
      for (const collName of collections) {
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
          "/api/properties",
          "/api/propertyPredictors",
          "/api/som",
        ],
        version: "SOMAP v2 - Ontology with Dynamic Perspectives"
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
