"use strict";
const createRouter = require("@arangodb/foxx/router");
const router = createRouter();

module.exports = router;

router.tag("Properties");

const joi = require("joi");
const db = require("@arangodb").db;
const errors = require("@arangodb").errors;
const properties = db._collection("properties");

// Schema validation for property creation
const propertySchema = joi
  .object()
  .required()
  .keys({
    name: joi.string().required(),
    dataType: joi
      .string()
      .required()
      .valid("number", "string", "boolean", "parameterSpace", "enum"),
    min: joi.number().when("dataType", {
      is: "number",
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    max: joi.number().when("dataType", {
      is: "number",
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    unit: joi.string().optional(),
    distribution: joi
      .string()
      .optional()
      .valid("uniform", "gaussian", "exponential"),
    mean: joi.number().optional(),
    options: joi.array().when("dataType", {
      is: "enum",
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    applicableTo: joi.array().items(joi.string()).required(),
    culturalVariation: joi.object().optional(),
  });

// Get all properties
router
  .get("/", function (req, res) {
    res.send(properties.all().toArray());
  })
  .response(joi.array().items(joi.object().required()), "A list of properties.")
  .summary("Retrieve all properties")
  .description("Returns a list of all properties in the database.");

// Add a new property
router
  .post("/", function (req, res) {
    const property = req.body;
    const meta = properties.save(property);
    res.send(Object.assign(property, meta));
  })
  .body(propertySchema, "The property to create.")
  .response(joi.object().required(), "The created property.")
  .summary("Create a new property")
  .description("Creates a new property from the request body.");

// Get a specific property
router
  .get("/:key", function (req, res) {
    const key = req.pathParams.key;
    try {
      const property = properties.document(key);
      res.send(property);
    } catch (e) {
      if (
        e.isArangoError &&
        e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND
      ) {
        throw httpError(404, `Property not found: ${e.message}`);
      }
      throw e;
    }
  })
  .pathParam("key", joi.string().required(), "Property key")
  .response(joi.object().required(), "The retrieved property.")
  .summary("Get a property")
  .description("Returns the property identified by key.");
