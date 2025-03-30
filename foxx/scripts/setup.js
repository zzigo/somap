'use strict';
const db = require('@arangodb').db;

// Create collections if they don't exist
if (!db._collection('entities')) {
  const entities = db._createDocumentCollection('entities');
  entities.ensureIndex({
    type: 'persistent',
    fields: ['type'],
    name: 'idx_entity_type'
  });
  entities.ensureIndex({
    type: 'persistent',
    fields: ['kind'],
    name: 'idx_entity_kind'
  });
  entities.ensureIndex({
    type: 'persistent',
    fields: ['perspective'],
    name: 'idx_entity_perspective'
  });
}

if (!db._collection('types')) {
  const types = db._createDocumentCollection('types');
  types.ensureIndex({
    type: 'persistent',
    fields: ['name'],
    unique: true,
    name: 'idx_type_name'
  });
  types.ensureIndex({
    type: 'persistent',
    fields: ['category'],
    name: 'idx_type_category'
  });
}

if (!db._collection('relations')) {
  const relations = db._createEdgeCollection('relations');
  relations.ensureIndex({
    type: 'persistent',
    fields: ['predicate'],
    name: 'idx_relation_predicate'
  });
}

// Create default types if they don't exist
const defaultTypes = [
  {
    _key: 'chordophone',
    name: 'Chordophone',
    category: 'instrument',
    schema: {
      stringCount: { type: 'number', required: true },
      tuning: { type: 'array', itemType: 'string', optional: true },
      material: { type: 'string' },
      bridgeType: { type: 'string', optional: true }
    }
  },
  {
    _key: 'violin',
    name: 'Violin',
    category: 'instrument',
    extends: 'chordophone',
    schema: {
      bowType: { type: 'string' }
    }
  }
];

const types = db._collection('types');
defaultTypes.forEach(type => {
  if (!types.firstExample({ _key: type._key })) {
    types.save(type);
  }
}); 