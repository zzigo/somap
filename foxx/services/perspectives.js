"use strict";
const createRouter = require("@arangodb/foxx/router");
const router = createRouter();

module.exports = router;

router.tag("Perspectives");

const joi = require("joi");
const db = require("@arangodb").db;
const errors = require("@arangodb").errors;
const aql = require("@arangodb").aql;

// Ensure perspectives collection exists
const perspectives = db._collection("perspectives");
if (!perspectives) {
  db._createDocumentCollection("perspectives");
}

// Schema validation for perspective creation
const perspectiveSchema = joi.object().required().keys({
  name: joi.string().required(),
  description: joi.string().optional(),
  kinds: joi.array().items(joi.string()).required(),
  types: joi.array().items(joi.string()).optional(),
  rules: joi.object().optional(),
  relKinds: joi.array().items(joi.string()).optional(),
  origin: joi.string().optional()
});

// Get all perspectives
router.get("/", function (req, res) {
  res.send(db._collection("perspectives").all().toArray());
}).response(joi.array().items(joi.object().required()), "A list of perspectives.")
  .summary("Retrieve all perspectives")
  .description("Returns a list of all perspectives in the database.");

// Add a new perspective
router.post("/", function (req, res) {
  const perspective = req.body;
  const meta = db._collection("perspectives").save(perspective);
  res.send(Object.assign(perspective, meta));
}).body(perspectiveSchema, "The perspective to create.")
  .response(joi.object().required(), "The created perspective.")
  .summary("Create a new perspective")
  .description("Creates a new perspective from the request body.");

// Get a specific perspective
router.get("/:key", function (req, res) {
  const key = req.pathParams.key;
  try {
    const perspective = db._collection("perspectives").document(key);
    res.send(perspective);
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, `Perspective not found: ${e.message}`);
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Perspective key")
  .response(joi.object().required(), "The retrieved perspective.")
  .summary("Get a perspective")
  .description("Returns the perspective identified by key.");

// Update a perspective
router.patch("/:key", function (req, res) {
  const key = req.pathParams.key;
  const update = req.body;
  try {
    const meta = db._collection("perspectives").update(key, update, { returnNew: true });
    res.send({ perspective: meta.new, success: true });
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, "Perspective not found");
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Perspective key")
  .body(joi.object().required(), "The perspective update data")
  .response(joi.object().required(), "The updated perspective")
  .summary("Update a perspective")
  .description("Updates a perspective with the given data");

// Delete a perspective
router.delete("/:key", function (req, res) {
  const key = req.pathParams.key;
  try {
    db._collection("perspectives").remove(key);
    res.send({ success: true });
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, "Perspective not found");
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Perspective key")
  .response(joi.object().required(), "Result")
  .summary("Delete a perspective")
  .description("Deletes a perspective");

// Get entities by perspective
router.get("/:key/entities", function (req, res) {
  const key = req.pathParams.key;
  try {
    const perspective = db._collection("perspectives").document(key);
    
    const query = aql`
      FOR e IN entities
      FILTER e.perspective == ${perspective.name}
      RETURN e
    `;
    
    const entities = db._query(query).toArray();
    res.send(entities);
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, "Perspective not found");
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Perspective key")
  .response(joi.array().items(joi.object()), "Entities in the perspective")
  .summary("Get entities by perspective")
  .description("Returns all entities in the specified perspective");

// Create a default perspective if none exists
(function() {
  try {
    const count = db._query(aql`
      RETURN LENGTH(FOR p IN perspectives RETURN p)
    `).toArray()[0];
    
    if (count === 0) {
      const defaultPerspective = {
        _key: "default",
        name: "default",
        description: "Default perspective with all kinds",
        kinds: ["object", "agent", "material", "environment", "interaction"],
        relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"]
      };
      
      db._collection("perspectives").save(defaultPerspective);
      console.log("Created default perspective");
    }
  } catch (e) {
    console.error("Error checking/creating default perspective:", e.message);
  }
})();