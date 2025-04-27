import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Database, aql } from "arangojs";
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

// Utility function to wait for database connection
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

// Utility function to ensure database exists
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

// Start server and initialize database
async function startServer() {
  let systemDb: Database;
  let db: Database;

  try {
    console.log(`Connecting to ArangoDB at ${DB_HOST}:${DB_PORT}...`);
    systemDb = new Database({
      url: `http://${DB_HOST}:${DB_PORT}`,
      databaseName: "_system",
      auth: { username: DB_USER, password: DB_PASS },
    });

    const connected = await waitForDatabase(systemDb, 10, 3000);
    if (!connected) {
      throw new Error("Failed to connect to ArangoDB after multiple attempts");
    }

    await ensureDatabase(systemDb, "somap");

    db = new Database({
      url: `http://${DB_HOST}:${DB_PORT}`,
      databaseName: "somap",
      auth: { username: DB_USER, password: DB_PASS },
    });

    const somapConnected = await waitForDatabase(db, 10, 3000);
    if (!somapConnected) {
      throw new Error("Failed to connect to somap database after multiple attempts");
    }

    console.log("Successfully connected to ArangoDB");

    const existing = await db.collections();
    const names = existing.map((c) => c.name);
    console.log("Existing collections:", names);

    const requiredCollections = ["users", "types", "entities", "relations", "properties", "propertyPredictors", "perspectives"];
    for (const name of requiredCollections) {
      if (!names.includes(name)) {
        console.log(`Creating collection ${name}...`);
        if (name === "relations") {
          await db.createEdgeCollection(name);
        } else {
          await db.createCollection(name);
        }
        console.log(`Created collection: ${name}`);
      } else {
        console.log(`Collection ${name} exists`);
      }
    }

    console.log("Creating indices...");
    try {
      await db.collection("users").ensureIndex({
        type: "persistent",
        fields: ["username"],
        unique: true,
        name: "idx_username",
      });
      await db.collection("entities").ensureIndex({
        type: "persistent",
        fields: ["perspective"],
        name: "idx_perspective",
      });
      console.log("Indices created");
    } catch (err) {
      console.warn("Failed to create some indices:", err);
    }

    app.locals = { db };
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }

  // Middleware to check database availability
  app.use("*", async (c, next) => {
    const { db } = app.locals || {};
    if (!db) {
      console.error("Database not initialized");
      return c.json({ error: "Service unavailable" }, 503);
    }
    try {
      await db.version();
    } catch (err) {
      console.error("Database connection error:", err);
      return c.json({ error: "Service unavailable" }, 503);
    }
    await next();
  });

  // Serve static files
  app.use("/vendor/*", serveStatic({ root: "./public/vendor" }));
  app.use("/css/*", serveStatic({ root: "./public/css" }));
  app.use("/*", serveStatic({ root: "./public" }));

  // API Routes (unchanged except for db reference)
  app.post("/api/users/signup", async (c) => {
    const { username, password } = await c.req.json();
    if (!username || typeof username !== "string") return c.json({ error: "Username is required" }, 400);
    if (!password || typeof password !== "string" || password.length < 6) return c.json({ error: "Password must be at least 6 characters long" }, 400);
    if (!/^[a-zA-Z0-9]+$/.test(username)) return c.json({ error: "Username must contain only letters and numbers" }, 400);

    const { db } = app.locals;
    const sanitizedUsername = sanitizeUsername(username);

    try {
      const cursor = await db.query(aql`FOR u IN users FILTER u.username == ${sanitizedUsername} LIMIT 1 RETURN u`);
      if ((await cursor.all()).length > 0) return c.json({ error: "Username already exists" }, 409);

      const user = { username: sanitizedUsername, password, createdAt: new Date(), lastLogin: new Date() };
      const result = await db.collection("users").save(user);
      setCookie(c, "userId", sanitizedUsername, { path: "/", maxAge: 7 * 24 * 60 * 60, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Lax" });
      return c.json({ userId: sanitizedUsername, username: sanitizedUsername, createdAt: user.createdAt });
    } catch (err) {
      console.error("Signup failed:", err);
      return c.json({ error: "Signup failed", details: process.env.NODE_ENV === "development" ? err.message : undefined }, 500);
    }
  });

  app.post("/api/users/login", async (c) => {
    const { username, password } = await c.req.json();
    if (!username || !password) return c.json({ error: "Username and password are required" }, 400);

    const { db } = app.locals;
    const sanitizedUsername = sanitizeUsername(username);

    try {
      const cursor = await db.query(aql`FOR u IN users FILTER u.username == ${sanitizedUsername} AND u.password == ${password} LIMIT 1 RETURN u`);
      const users = await cursor.all();
      if (users.length === 0) return c.json({ error: "Invalid credentials" }, 401);

      const user = users[0];
      await db.collection("users").update(user._key, { lastLogin: new Date() });
      setCookie(c, "userId", sanitizedUsername, { path: "/", maxAge: 30 * 24 * 60 * 60, httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "Lax" });
      return c.json({ userId: sanitizedUsername, username: sanitizedUsername, lastLogin: new Date() });
    } catch (err) {
      console.error("Login failed:", err);
      return c.json({ error: "Login failed", details: process.env.NODE_ENV === "development" ? err.message : undefined }, 500);
    }
  });

  app.post("/api/users/logout", async (c) => {
    setCookie(c, "userId", "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Lax" });
    return c.json({ success: true, message: "Logged out successfully" });
  });

  app.post("/api/entities", async (c) => {
    const { name, typeId, color, creatorId, perspective, kind, props } = await c.req.json();
    if (!name || !typeId || !creatorId || !kind || !props) return c.json({ error: "Missing required fields", details: "Required: name, typeId, creatorId, kind, props" }, 400);

    const { db } = app.locals;
    try {
      const collections = await db.collections();
      const collectionNames = collections.map(coll => coll.name);
      if (!collectionNames.includes('entities')) await db.createCollection('entities');
      if (!collectionNames.includes('relations')) await db.createEdgeCollection('relations');

      const entity = { label: name, type: typeId, kind, props, perspective: perspective || "default", createdAt: new Date(), createdBy: creatorId };
      const result = await db.collection("entities").save(entity);

      if (collectionNames.includes('relations')) {
        try {
          const relation = { _from: `users/${creatorId}`, _to: `entities/${result._key}`, predicate: "created", createdAt: new Date() };
          await db.collection("relations").save(relation);
        } catch (relationErr) {
          console.warn("Failed to create relation:", relationErr);
        }
      }
      return c.json({ id: result._id, success: true, entity: result });
    } catch (err) {
      console.error("Entity creation failed:", err);
      return c.json({ error: "Entity creation failed", details: process.env.NODE_ENV === "development" ? err.message : undefined }, 500);
    }
  });

  app.get("/api/entities", async (c) => {
    const perspective = c.req.query("perspective") || "default";
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('entities')) return c.json([]);
      const allEntities = await db.query(aql`FOR e IN entities FILTER e.perspective == ${perspective} RETURN e`).then(cursor => cursor.all());
      return c.json(allEntities);
    } catch (err) {
      console.error("Error fetching entities:", err);
      return c.json([]);
    }
  });

  app.get("/api/entities/:id", async (c) => {
    const id = c.req.param("id");
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('entities')) return c.json({ error: "Entities collection does not exist" }, 404);
      const docId = id.includes("/") ? id : `entities/${id}`;
      try {
        const entity = await db.collection("entities").document(docId);
        return c.json(entity);
      } catch (e) {
        return c.json({ error: "Entity not found", details: `Document ${docId} does not exist` }, 404);
      }
    } catch (err) {
      console.error("Error fetching entity:", err);
      return c.json({ error: "Failed to fetch entity", details: err.message }, 500);
    }
  });

  app.patch("/api/entities/:id", async (c) => {
    const id = c.req.param("id");
    const updateData = await c.req.json();
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('entities')) return c.json({ error: "Entities collection does not exist" }, 404);
      if (Object.keys(updateData).length === 0) return c.json({ error: "No update data provided" }, 400);
      const docId = id.includes("/") ? id : `entities/${id}`;
      await db.collection("entities").document(docId); // Check existence
      const result = await db.collection("entities").update(docId, updateData);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating entity:", err);
      return c.json({ error: "Failed to update entity", details: err.message }, 500);
    }
  });

  app.delete("/api/entities/:id", async (c) => {
    const id = c.req.param("id");
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('entities')) return c.json({ error: "Entities collection does not exist" }, 404);
      const docId = id.includes("/") ? id : `entities/${id}`;
      try {
        await db.collection("entities").document(docId);
      } catch (e) {
        return c.json({ error: "Entity not found", details: `Document "${id}" does not exist` }, 404);
      }
      await db.query(aql`FOR r IN relations FILTER r._from == ${docId} OR r._to == ${docId} REMOVE r IN relations`);
      const result = await db.collection("entities").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting entity:", err);
      return c.json({ error: "Failed to delete entity", details: err.message }, 500);
    }
  });

  app.post("/api/types", async (c) => {
    const { name, color, symbol } = await c.req.json();
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('types')) await db.createCollection('types');
      const type = { name, color, symbol, category: 'custom', schema: {}, createdAt: new Date() };
      const result = await db.collection("types").save(type);
      return c.json({ id: result._id, success: true, type: result });
    } catch (err) {
      console.error("Type creation failed:", err);
      return c.json({ error: "Type creation failed", details: err.message }, 500);
    }
  });

  app.get("/api/types", async (c) => {
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('types')) return c.json([]);
      const allTypes = await db.query(aql`FOR t IN types RETURN t`).then(cursor => cursor.all());
      return c.json(allTypes);
    } catch (err) {
      console.error("Error fetching types:", err);
      return c.json([]);
    }
  });

  app.patch("/api/types/:id", async (c) => {
    const id = c.req.param("id");
    const { name, color, symbol, category, schema } = await c.req.json();
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('types')) return c.json({ error: "Types collection does not exist" }, 404);
      const updateData = { ...(name && { name }), ...(color && { color }), ...(symbol && { symbol }), ...(category && { category }), ...(schema && { schema }) };
      if (Object.keys(updateData).length === 0) return c.json({ error: "No update data provided" }, 400);
      const docId = id.includes("/") ? id : `types/${id}`;
      await db.collection("types").document(docId);
      const result = await db.collection("types").update(docId, updateData);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating type:", err);
      return c.json({ error: "Failed to update type", details: err.message }, 500);
    }
  });

  app.delete("/api/types/:id", async (c) => {
    const id = c.req.param("id");
    const { db } = app.locals;
    try {
      const docId = id.includes("/") ? id : `types/${id}`;
      const result = await db.collection("types").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting type:", err);
      return c.json({ error: "Failed to delete type", details: err.message }, 500);
    }
  });

  app.post("/api/relations", async (c) => {
    const { name, from, to, lineType, predicate } = await c.req.json();
    if (!name || !from || !to) return c.json({ error: "Missing required fields: name, from, to" }, 400);
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('relations')) await db.createEdgeCollection('relations');
      const _from = from.includes("/") ? from : `entities/${from}`;
      const _to = to.includes("/") ? to : `entities/${to}`;
      const fromColl = _from.split("/")[0];
      const toColl = _to.split("/")[0];
      if (collections.map(coll => coll.name).includes(fromColl)) await db.collection(fromColl).document(_from.split("/")[1]);
      if (collections.map(coll => coll.name).includes(toColl)) await db.collection(toColl).document(_to.split("/")[1]);
      const relation = { name, _from, _to, predicate: predicate || name, lineType: lineType || "solid", createdAt: new Date() };
      const result = await db.collection("relations").save(relation);
      return c.json({ id: result._id, success: true, relation: result });
    } catch (err) {
      console.error("Relation creation failed:", err);
      return c.json({ error: "Relation creation failed", details: err.message }, 500);
    }
  });

  app.patch("/api/relations/:id", async (c) => {
    const id = c.req.param("id");
    const { name, lineType, predicate, _from, _to } = await c.req.json();
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('relations')) return c.json({ error: "Relations collection does not exist" }, 404);
      const updateData = { ...(name && { name }), ...(lineType && { lineType }), ...(predicate && { predicate }) };
      if (_from || _to) {
        const docId = id.includes("/") ? id : `relations/${id}`;
        const currentRelation = await db.collection("relations").document(docId);
        if (_from) {
          const fromId = _from.includes("/") ? _from : `entities/${_from}`;
          await db.collection(fromId.split("/")[0]).document(fromId.split("/")[1]);
          updateData._from = fromId;
        }
        if (_to) {
          const toId = _to.includes("/") ? _to : `entities/${_to}`;
          await db.collection(toId.split("/")[0]).document(toId.split("/")[1]);
          updateData._to = toId;
        }
      }
      if (Object.keys(updateData).length === 0) return c.json({ error: "No update data provided" }, 400);
      const docId = id.includes("/") ? id : `relations/${id}`;
      const result = await db.collection("relations").update(docId, updateData);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating relation:", err);
      return c.json({ error: "Failed to update relation", details: err.message }, 500);
    }
  });

  app.delete("/api/relations/:id", async (c) => {
    const id = c.req.param("id");
    const { db } = app.locals;
    try {
      const docId = id.includes("/") ? id : `relations/${id}`;
      const result = await db.collection("relations").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting relation:", err);
      return c.json({ error: "Failed to delete relation", details: err.message }, 500);
    }
  });

  app.get("/api/relations", async (c) => {
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('relations')) return c.json([]);
      const allRelations = await db.query(aql`FOR r IN relations RETURN r`).then(cursor => cursor.all());
      return c.json(allRelations);
    } catch (err) {
      console.error("Error fetching relations:", err);
      return c.json([]);
    }
  });

  app.post("/api/perspectives", async (c) => {
    const { name, description, kinds, types, rules, relKinds, origin } = await c.req.json();
    if (!name || !kinds || !Array.isArray(kinds) || kinds.length === 0) return c.json({ error: "Name and at least one kind are required" }, 400);
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('perspectives')) await db.createCollection('perspectives');
      const existing = await db.query(aql`FOR p IN perspectives FILTER p.name == ${name} RETURN p`).then(cursor => cursor.all());
      if (existing.length > 0) return c.json({ error: "Perspective already exists" }, 409);
      const perspective = { name, description, kinds, types: types || [], rules: rules || {}, relKinds: relKinds || ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"], origin: origin || "user-created", createdAt: new Date() };
      const result = await db.collection("perspectives").save(perspective);
      return c.json({ id: result._id, success: true, perspective: result });
    } catch (err) {
      console.error("Perspective creation failed:", err);
      return c.json({ error: "Perspective creation failed", details: err.message }, 500);
    }
  });

  app.get("/api/perspectives", async (c) => {
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      let perspectives = collections.map(coll => coll.name).includes('perspectives') ? await db.query(aql`FOR p IN perspectives RETURN p`).then(cursor => cursor.all()) : [];
      if (!perspectives.some(p => p.name === "default")) {
        perspectives.unshift({ name: "default", description: "Default perspective with all kinds", kinds: ["object", "agent", "material", "environment", "interaction"], relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"], _key: "default" });
      }
      return c.json(perspectives);
    } catch (err) {
      console.error("Error fetching perspectives:", err);
      return c.json([{ name: "default", description: "Default perspective with all kinds", kinds: ["object", "agent", "material", "environment", "interaction"], relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"], _key: "default" }]);
    }
  });

  app.get("/api/perspectives/:key", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      if (key === "default") return c.json({ _key: "default", name: "default", description: "Default perspective with all kinds", kinds: ["object", "agent", "material", "environment", "interaction"], relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"] });
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const perspective = await db.collection("perspectives").document(docId);
      return c.json(perspective);
    } catch (err) {
      console.error("Error fetching perspective:", err);
      return c.json({ error: "Failed to fetch perspective", details: err.message }, 500);
    }
  });

  app.patch("/api/perspectives/:key", async (c) => {
    const key = c.req.param("key");
    const update = await c.req.json();
    const { db } = app.locals;
    try {
      if (key === "default") return c.json({ error: "Cannot modify default perspective" }, 400);
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const result = await db.collection("perspectives").update(docId, update);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating perspective:", err);
      return c.json({ error: "Failed to update perspective", details: err.message }, 500);
    }
  });

  app.delete("/api/perspectives/:key", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      if (key === "default") return c.json({ error: "Cannot delete default perspective" }, 400);
      const docId = key.includes("/") ? key : `perspectives/${key}`;
      const result = await db.collection("perspectives").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting perspective:", err);
      return c.json({ error: "Failed to delete perspective", details: err.message }, 500);
    }
  });

  app.get("/api/perspectives/:key/entities", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      let perspectiveName = key === "default" ? "default" : (await db.collection("perspectives").document(key.includes("/") ? key : `perspectives/${key}`)).name;
      const entities = await db.query(aql`FOR e IN entities FILTER e.perspective == ${perspectiveName} RETURN e`).then(cursor => cursor.all());
      return c.json(entities);
    } catch (err) {
      console.error("Error fetching perspective entities:", err);
      return c.json({ error: "Failed to fetch perspective entities", details: err.message }, 500);
    }
  });

  app.get("/api/properties", async (c) => {
    const { db } = app.locals;
    try {
      const allProperties = await db.query(aql`FOR p IN properties RETURN p`).then(cursor => cursor.all());
      return c.json(allProperties);
    } catch (err) {
      console.error("Error fetching properties:", err);
      return c.json({ error: "Failed to fetch properties", details: err.message }, 500);
    }
  });

  app.post("/api/properties", async (c) => {
    const property = await c.req.json();
    const { db } = app.locals;
    try {
      const result = await db.collection("properties").save(property);
      return c.json({ id: result._id, success: true, property: result });
    } catch (err) {
      console.error("Property creation failed:", err);
      return c.json({ error: "Property creation failed", details: err.message }, 500);
    }
  });

  app.get("/api/properties/:key", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      const docId = key.includes("/") ? key : `properties/${key}`;
      const property = await db.collection("properties").document(docId);
      return c.json(property);
    } catch (err) {
      console.error("Error fetching property:", err);
      return c.json({ error: "Failed to fetch property", details: err.message }, 500);
    }
  });

  app.patch("/api/properties/:key", async (c) => {
    const key = c.req.param("key");
    const update = await c.req.json();
    const { db } = app.locals;
    try {
      const docId = key.includes("/") ? key : `properties/${key}`;
      const result = await db.collection("properties").update(docId, update);
      return c.json({ success: true, updated: result });
    } catch (err) {
      console.error("Error updating property:", err);
      return c.json({ error: "Failed to update property", details: err.message }, 500);
    }
  });

  app.delete("/api/properties/:key", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      const docId = key.includes("/") ? key : `properties/${key}`;
      const result = await db.collection("properties").remove(docId);
      return c.json({ success: true, deleted: result });
    } catch (err) {
      console.error("Error deleting property:", err);
      return c.json({ error: "Failed to delete property", details: err.message }, 500);
    }
  });

  app.get("/api/propertyPredictors", async (c) => {
    const { db } = app.locals;
    try {
      const collections = await db.collections();
      if (!collections.map(coll => coll.name).includes('propertyPredictors')) return c.json([]);
      const allPredictors = await db.query(aql`FOR p IN propertyPredictors RETURN p`).then(cursor => cursor.all());
      return c.json(allPredictors);
    } catch (err) {
      console.error("Error fetching property predictors:", err);
      return c.json([]);
    }
  });

  app.post("/api/propertyPredictors", async (c) => {
    const predictor = await c.req.json();
    const { db } = app.locals;
    try {
      const result = await db.collection("propertyPredictors").save(predictor);
      return c.json({ id: result._id, success: true, predictor: result });
    } catch (err) {
      console.error("Property predictor creation failed:", err);
      return c.json({ error: "Property predictor creation failed", details: err.message }, 500);
    }
  });

  app.get("/api/propertyPredictors/:key", async (c) => {
    const key = c.req.param("key");
    const { db } = app.locals;
    try {
      const docId = key.includes("/") ? key : `propertyPredictors/${key}`;
      const predictor = await db.collection("propertyPredictors").document(docId);
      return c.json(predictor);
    } catch (err) {
      console.error("Error fetching property predictor:", err);
      return c.json({ error: "Failed to fetch property predictor", details: err.message }, 500);
    }
  });

  app.post("/api/propertyPredictors/:key/apply", async (c) => {
    const key = c.req.param("key");
    const { entityId } = await c.req.json();
    try {
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
        return c.json({ error: "Failed to apply property predictor", details: error.message }, response.status);
      }
      const result = await response.json();
      return c.json(result);
    } catch (err) {
      console.error("Error applying property predictor:", err);
      return c.json({ error: "Failed to apply property predictor", details: err.message }, 500);
    }
  });

  app.post("/api/propertyPredictors/:key/bulk-apply", async (c) => {
    const key = c.req.param("key");
    const { perspectiveId } = await c.req.json();
    try {
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
        return c.json({ error: "Failed to bulk apply property predictor", details: error.message }, response.status);
      }
      const result = await response.json();
      return c.json(result);
    } catch (err) {
      console.error("Error bulk applying property predictor:", err);
      return c.json({ error: "Failed to bulk apply property predictor", details: err.message }, 500);
    }
  });

  app.get("/api/som", async (c) => {
    const userId = getCookie(c, "userId") || c.req.query("userId") || null;
    const perspective = c.req.query("perspective") || "default";
    const { db } = app.locals;
    try {
      const [
        entitiesResult,
        typesResult,
        relationsResult,
        userResult,
        propertiesResult,
        predictorsResult,
        perspectiveResult
      ] = await Promise.all([
        db.query(aql`FOR e IN entities FILTER e.perspective == ${perspective} RETURN e`).then(cursor => cursor.all()).catch(() => []),
        db.query(aql`FOR t IN types RETURN t`).then(cursor => cursor.all()).catch(() => []),
        db.query(aql`FOR r IN relations FILTER ${userId ? aql`r._from == ${"users/" + userId} OR r.type == 'material' OR r.predicate == 'interactWith'` : aql`r.predicate == 'interactWith' OR r.type == 'material' OR r.predicate == 'connectsTo'`} RETURN r`).then(cursor => cursor.all()).catch(() => []),
        userId ? db.query(aql`FOR u IN users FILTER u.username == ${userId} RETURN u`).then(cursor => cursor.all()).catch(() => []) : Promise.resolve([]),
        db.query(aql`FOR p IN properties RETURN p`).then(cursor => cursor.all()).catch(() => []),
        db.query(aql`FOR p IN propertyPredictors RETURN p`).then(cursor => cursor.all()).catch(() => []),
        db.query(aql`FOR p IN perspectives FILTER p.name == ${perspective} RETURN p`).then(cursor => cursor.all()).catch(() => [])
      ]);

      const user = userResult[0] || null;
      const currentPerspective = perspectiveResult[0] || {
        name: "default",
        description: "Default perspective with all kinds",
        kinds: ["object", "agent", "material", "environment", "interaction"],
        relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory", "interactWith"]
      };

      if (user) setCookie(c, "userId", userId, { path: "/", maxAge: 604800 });
      return c.json({
        entities: entitiesResult,
        types: typesResult,
        relations: relationsResult,
        properties: propertiesResult,
        propertyPredictors: predictorsResult,
        user: user ? { username: user.username, entityCount: relationsResult.length } : null,
        perspective: currentPerspective
      });
    } catch (err) {
      console.error("Error fetching SOM data:", err);
      return c.json({ error: "Internal Server Error", details: err.message }, 500);
    }
  });

  app.get("/api/debug", async (c) => {
    const { db } = app.locals;
    try {
      const collectionStats = {};
      const collections = ["users", "types", "entities", "relations", "properties", "propertyPredictors", "perspectives"];
      for (const collName of collections) {
        try {
          const collection = db.collection(collName);
          const count = await collection.count();
          const sample = await db.query(aql`FOR doc IN ${collection} LIMIT 5 RETURN doc`).then(cursor => cursor.all());
          collectionStats[collName] = { count, sample };
        } catch (err) {
          collectionStats[collName] = { error: err.message };
        }
      }
      return c.json({
        message: "Server is running",
        timestamp: new Date().toISOString(),
        collections: collectionStats,
        routes: ["/api/users/signup", "/api/users/login", "/api/users/logout", "/api/entities", "/api/types", "/api/relations", "/api/perspectives", "/api/properties", "/api/propertyPredictors", "/api/som"],
        version: "SOMAP v2 - Ontology with Dynamic Perspectives"
      });
    } catch (err) {
      return c.json({ message: "Server is running but debug info collection failed", error: err.message, timestamp: new Date().toISOString() });
    }
  });

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