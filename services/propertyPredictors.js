"use strict";
const createRouter = require("@arangodb/foxx/router");
const router = createRouter();

module.exports = router;

router.tag("PropertyPredictors");

const joi = require("joi");
const db = require("@arangodb").db;
const errors = require("@arangodb").errors;
const aql = require("@arangodb").aql;
const propertyPredictors = db._collection("propertyPredictors");

// Ensure the collection exists
if (!propertyPredictors) {
  db._createDocumentCollection("propertyPredictors");
}

// Schema validation for property predictor creation
const predictorSchema = joi.object().required().keys({
  name: joi.string().required(),
  formula: joi.string().required(),
  inputs: joi.array().items(joi.string()).required(),
  output: joi.object({
    name: joi.string().required(),
    unit: joi.string().optional(),
    dataType: joi.string().required()
  }).required(),
  applicableTo: joi.array().items(joi.string()).required(),
  confidence: joi.number().min(0).max(1).required()
});

// Get all property predictors
router.get("/", function (req, res) {
  res.send(db._collection("propertyPredictors").all().toArray());
}).response(joi.array().items(joi.object().required()), "A list of property predictors.")
  .summary("Retrieve all property predictors")
  .description("Returns a list of all property predictors in the database.");

// Add a new property predictor
router.post("/", function (req, res) {
  const predictor = req.body;
  const meta = db._collection("propertyPredictors").save(predictor);
  res.send(Object.assign(predictor, meta));
}).body(predictorSchema, "The property predictor to create.")
  .response(joi.object().required(), "The created property predictor.")
  .summary("Create a new property predictor")
  .description("Creates a new property predictor from the request body.");

// Get a specific property predictor
router.get("/:key", function (req, res) {
  const key = req.pathParams.key;
  try {
    const predictor = db._collection("propertyPredictors").document(key);
    res.send(predictor);
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, `Property predictor not found: ${e.message}`);
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Property predictor key")
  .response(joi.object().required(), "The retrieved property predictor.")
  .summary("Get a property predictor")
  .description("Returns the property predictor identified by key.");

// Apply a property predictor
router.post("/:key/apply", function (req, res) {
  const key = req.pathParams.key;
  const { entityId } = req.body;
  
  try {
    // Get the predictor
    const predictor = db._collection("propertyPredictors").document(key);
    
    // Get the entity
    const entity = db._collection("entities").document(entityId);
    
    // Check if the predictor is applicable to this entity type
    if (!predictor.applicableTo.includes(entity.type)) {
      res.throw(400, `Predictor ${predictor.name} is not applicable to entity type ${entity.type}`);
    }
    
    // Get the input property values
    const inputValues = {};
    for (const inputProp of predictor.inputs) {
      if (!entity.props[inputProp]) {
        res.throw(400, `Entity is missing required property ${inputProp} for predictor ${predictor.name}`);
      }
      inputValues[inputProp] = entity.props[inputProp];
    }
    
    // Evaluate the formula (simplified version - in production would need a safe formula parser)
    // This is just a placeholder for the concept
    let result;
    try {
      // In a real implementation, this would use a safe formula evaluator
      const formulaContext = { ...inputValues };
      const mathRegex = /Math\.(sin|cos|tan|sqrt|pow|abs|min|max|floor|ceil|round)/g;
      let sanitizedFormula = predictor.formula.replace(mathRegex, (match) => match);
      
      // Very simple and limited formula evaluation - for demonstration only
      // In production, use a proper math expression evaluator
      const keys = Object.keys(formulaContext);
      const values = Object.values(formulaContext);
      const evalFn = new Function(...keys, `return ${sanitizedFormula};`);
      result = evalFn(...values);
    } catch (error) {
      res.throw(400, `Failed to evaluate formula: ${error.message}`);
    }
    
    // Update the entity with the computed property
    const update = {
      props: {
        ...entity.props,
        [predictor.output.name]: result
      }
    };
    
    const updatedEntity = db._collection("entities").update(entityId, update, { returnNew: true }).new;
    
    res.send({
      success: true,
      predictor: predictor.name,
      inputValues,
      result,
      entity: updatedEntity
    });
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, `Resource not found: ${e.message}`);
    }
    throw e;
  }
}).pathParam("key", joi.string().required(), "Property predictor key")
  .body(joi.object({
    entityId: joi.string().required()
  }).required(), "The entity to apply the predictor to")
  .response(joi.object().required(), "The result of applying the predictor")
  .summary("Apply a property predictor to an entity")
  .description("Applies the predictor's formula to calculate a derived property for the entity");

// Bulk apply - apply predictor to all applicable entities
router.post("/:key/bulk-apply", function (req, res) {
  const key = req.pathParams.key;
  const { perspectiveId } = req.body || {};
  
  try {
    // Get the predictor
    const predictor = db._collection("propertyPredictors").document(key);
    
    // Find all applicable entities
    let query;
    if (perspectiveId) {
      query = aql`
        FOR e IN entities
        FILTER e.type IN ${predictor.applicableTo} AND e.perspective == ${perspectiveId}
        RETURN e
      `;
    } else {
      query = aql`
        FOR e IN entities
        FILTER e.type IN ${predictor.applicableTo}
        RETURN e
      `;
    }
    
    const entities = db._query(query).toArray();
    const results = [];
    const errors = [];
    
    // Process each entity
    for (const entity of entities) {
      try {
        // Check if entity has all required input properties
        const inputValues = {};
        let missingInputs = false;
        
        for (const inputProp of predictor.inputs) {
          if (!entity.props || !entity.props[inputProp]) {
            missingInputs = true;
            errors.push({
              entityId: entity._id,
              error: `Missing required property: ${inputProp}`
            });
            break;
          }
          inputValues[inputProp] = entity.props[inputProp];
        }
        
        if (missingInputs) continue;
        
        // Evaluate formula
        const keys = Object.keys(inputValues);
        const values = Object.values(inputValues);
        const evalFn = new Function(...keys, `return ${predictor.formula};`);
        const result = evalFn(...values);
        
        // Update entity
        const update = {
          props: {
            ...entity.props,
            [predictor.output.name]: result
          }
        };
        
        const updated = db._collection("entities").update(entity._key, update, { returnNew: true }).new;
        
        results.push({
          entityId: entity._id,
          result,
          inputValues
        });
      } catch (error) {
        errors.push({
          entityId: entity._id,
          error: error.message
        });
      }
    }
    
    res.send({
      success: true,
      predictor: predictor.name,
      processed: entities.length,
      results,
      errors
    });
  } catch (e) {
    if (e.isArangoError && e.errorNum === errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND) {
      res.throw(404, `Predictor not found: ${e.message}`);
    }
    res.throw(500, `Error applying predictor: ${e.message}`);
  }
}).pathParam("key", joi.string().required(), "Property predictor key")
  .body(joi.object({
    perspectiveId: joi.string().optional()
  }).optional(), "Optional parameters for bulk application")
  .response(joi.object().required(), "Results of bulk application")
  .summary("Bulk apply a property predictor")
  .description("Applies the predictor to all applicable entities, optionally filtered by perspective");