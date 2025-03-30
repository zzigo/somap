'use strict';
const createRouter = require('@arangodb/foxx/router');
const router = createRouter();
const joi = require('joi');
const db = require('@arangodb').db;
const aql = require('@arangodb').aql;
const errors = require('@arangodb').errors;

// Error definitions
const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;

// Schema definitions
const typeSchema = joi.object({
  name: joi.string().required(),
  category: joi.string().required(),
  schema: joi.object().required(),
  extends: joi.string().optional()
}).required();

const entitySchema = joi.object({
  label: joi.string().required(),
  type: joi.string().required(),
  kind: joi.string().required(),
  props: joi.object().required(),
  description: joi.string().optional(),
  perspective: joi.string().default('default')
}).required();

// Collection initialization
const entities = db._collection('entities');
const types = db._collection('types');
const relations = db._collection('relations');

if (!entities) {
  db._createDocumentCollection('entities');
}
if (!types) {
  db._createDocumentCollection('types');
}
if (!relations) {
  db._createEdgeCollection('relations');
}

// Type validation middleware
const validateType = (req, res, next) => {
  const type = types.firstExample({ _key: req.body.type });
  if (!type) {
    res.throw(400, `Type ${req.body.type} does not exist`);
  }
  
  // Validate props against type schema
  const schema = type.schema;
  const props = req.body.props;
  
  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.required && !props.hasOwnProperty(key)) {
      res.throw(400, `Missing required property: ${key}`);
    }
    if (props.hasOwnProperty(key)) {
      // Type checking
      const value = props[key];
      switch (descriptor.type) {
        case 'number':
          if (typeof value !== 'number') {
            res.throw(400, `Property ${key} must be a number`);
          }
          break;
        case 'string':
          if (typeof value !== 'string') {
            res.throw(400, `Property ${key} must be a string`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            res.throw(400, `Property ${key} must be an array`);
          }
          if (descriptor.itemType) {
            value.forEach((item, index) => {
              if (typeof item !== descriptor.itemType) {
                res.throw(400, `Array item at index ${index} must be of type ${descriptor.itemType}`);
              }
            });
          }
          break;
      }
    }
  }
  
  next();
};

// Entity creation endpoint
router.post('/entities', validateType, (req, res) => {
  const entity = req.body;
  try {
    const meta = entities.save(entity, { returnNew: true });
    res.send({ entity: meta.new, success: true });
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      res.throw(409, 'Entity already exists');
    }
    res.throw(500, 'Failed to create entity');
  }
});

// Batch entity creation
router.post('/entities/batch', (req, res) => {
  const { entities: entitiesToCreate } = req.body;
  const maxBatch = module.context.configuration.maxEntitiesPerBatch;
  
  if (entitiesToCreate.length > maxBatch) {
    res.throw(400, `Cannot create more than ${maxBatch} entities at once`);
  }
  
  const results = [];
  const errors = [];
  
  try {
    db._executeTransaction({
      collections: {
        write: ['entities']
      },
      action: function() {
        entitiesToCreate.forEach((entity, index) => {
          try {
            // Validate type
            const type = types.firstExample({ _key: entity.type });
            if (!type) {
              throw new Error(`Type ${entity.type} does not exist`);
            }
            
            // Create entity
            const meta = entities.save(entity, { returnNew: true });
            results.push({ index, entity: meta.new });
          } catch (e) {
            errors.push({ index, error: e.message });
          }
        });
      }
    });
    
    res.send({ results, errors });
  } catch (e) {
    res.throw(500, 'Batch creation failed');
  }
});

// Entity retrieval
router.get('/entities/:key', (req, res) => {
  try {
    const entity = entities.document(req.pathParams.key);
    res.send(entity);
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      res.throw(404, 'Entity not found');
    }
    res.throw(500, 'Failed to retrieve entity');
  }
});

// Entity update
router.patch('/entities/:key', (req, res) => {
  const key = req.pathParams.key;
  const update = req.body;
  
  try {
    const meta = entities.update(key, update, { returnNew: true });
    res.send({ entity: meta.new, success: true });
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      res.throw(404, 'Entity not found');
    }
    res.throw(500, 'Failed to update entity');
  }
});

// Entity deletion
router.delete('/entities/:key', (req, res) => {
  const key = req.pathParams.key;
  
  try {
    // First delete all relations
    const query = aql`
      FOR r IN relations
      FILTER r._from == ${entities.name() + '/' + key} OR r._to == ${entities.name() + '/' + key}
      REMOVE r IN relations
    `;
    db._query(query);
    
    // Then delete the entity
    entities.remove(key);
    res.send({ success: true });
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      res.throw(404, 'Entity not found');
    }
    res.throw(500, 'Failed to delete entity');
  }
});

// Query entities by type
router.get('/entities/by-type/:type', (req, res) => {
  const type = req.pathParams.type;
  const perspective = req.queryParams.perspective || 'default';
  
  try {
    const query = aql`
      FOR e IN entities
      FILTER e.type == ${type} AND e.perspective == ${perspective}
      RETURN e
    `;
    const entities = db._query(query).toArray();
    res.send(entities);
  } catch (e) {
    res.throw(500, 'Failed to query entities');
  }
});

// Query entities by kind
router.get('/entities/by-kind/:kind', (req, res) => {
  const kind = req.pathParams.kind;
  const perspective = req.queryParams.perspective || 'default';
  
  try {
    const query = aql`
      FOR e IN entities
      FILTER e.kind == ${kind} AND e.perspective == ${perspective}
      RETURN e
    `;
    const entities = db._query(query).toArray();
    res.send(entities);
  } catch (e) {
    res.throw(500, 'Failed to query entities');
  }
});

// Mount router
module.context.use(router); 