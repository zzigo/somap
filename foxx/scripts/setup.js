'use strict';
const db = require('@arangodb').db;
const errors = require('@arangodb').errors;

// Create collections if they don't exist
const collections = [
  { name: 'entities', type: 'document' },
  { name: 'types', type: 'document' },
  { name: 'relations', type: 'edge' },
  { name: 'properties', type: 'document' },
  { name: 'propertyPredictors', type: 'document' },
  { name: 'perspectives', type: 'document' },
  { name: 'users', type: 'document' }
];

collections.forEach(coll => {
  if (!db._collection(coll.name)) {
    if (coll.type === 'edge') {
      db._createEdgeCollection(coll.name);
      console.log(`Created edge collection: ${coll.name}`);
    } else {
      db._createDocumentCollection(coll.name);
      console.log(`Created document collection: ${coll.name}`);
    }
  } else {
    console.log(`Collection ${coll.name} already exists`);
  }
});

// Create indices
try {
  if (db._collection('entities')) {
    db._collection('entities').ensureIndex({
      type: 'persistent',
      fields: ['type'],
      unique: false,
      name: 'idx_entity_type'
    });
    
    db._collection('entities').ensureIndex({
      type: 'persistent',
      fields: ['kind'],
      unique: false,
      name: 'idx_entity_kind'
    });
    
    db._collection('entities').ensureIndex({
      type: 'persistent',
      fields: ['perspective'],
      unique: false,
      name: 'idx_entity_perspective'
    });
    
    console.log('Created indices for entities collection');
  }
  
  if (db._collection('types')) {
    db._collection('types').ensureIndex({
      type: 'persistent',
      fields: ['name'],
      unique: true,
      name: 'idx_type_name'
    });
    
    db._collection('types').ensureIndex({
      type: 'persistent',
      fields: ['category'],
      name: 'idx_type_category'
    });
    
    console.log('Created indices for types collection');
  }
  
  if (db._collection('relations')) {
    db._collection('relations').ensureIndex({
      type: 'persistent',
      fields: ['predicate'],
      name: 'idx_relation_predicate'
    });
    
    console.log('Created indices for relations collection');
  }
  
  if (db._collection('properties')) {
    db._collection('properties').ensureIndex({
      type: 'persistent',
      fields: ['name'],
      unique: true,
      name: 'idx_property_name'
    });
    
    console.log('Created indices for properties collection');
  }
  
} catch (err) {
  console.warn('Error creating indices:', err.message);
}

// Create the default perspective if it doesn't exist
try {
  const perspectives = db._collection('perspectives');
  if (perspectives && !perspectives.firstExample({ _key: 'default' })) {
    perspectives.save({
      _key: 'default',
      name: 'default',
      description: 'Default perspective with all kinds',
      kinds: ['object', 'agent', 'material', 'environment', 'interaction'],
      relKinds: ['connectedTo', 'builtBy', 'resonatesIn', 'partOf', 'subTypeOf', 'inCategory']
    });
    console.log('Created default perspective');
  }
} catch (err) {
  console.warn('Error creating default perspective:', err.message);
}

// Create basic types if they don't exist
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
  },
  {
    _key: 'performer',
    name: 'Performer',
    category: 'agent',
    schema: {
      skills: { type: 'array', itemType: 'string', optional: true },
      experience: { type: 'number', optional: true }
    }
  },
  {
    _key: 'luthier',
    name: 'Luthier',
    category: 'agent',
    schema: {
      specialty: { type: 'string', optional: true },
      workshop: { type: 'string', optional: true }
    }
  },
  {
    _key: 'wood',
    name: 'Wood',
    category: 'material',
    schema: {
      density: { type: 'number', required: true },
      elasticity: { type: 'number', required: true },
      source: { type: 'string', optional: true }
    }
  },
  {
    _key: 'resonant_space',
    name: 'Resonant Space',
    category: 'environment',
    schema: {
      volume: { type: 'number', required: true },
      reverbTime: { type: 'number', required: true },
      shape: { type: 'string', optional: true }
    }
  }
];

const types = db._collection('types');
defaultTypes.forEach(type => {
  if (!types.firstExample({ _key: type._key })) {
    types.save(type);
    console.log(`Created type: ${type.name}`);
  }
});

// Create some basic properties
try {
  const properties = db._collection('properties');
  if (properties) {
    const basicProperties = [
      {
        _key: 'string_tension',
        name: 'String Tension',
        dataType: 'parameterSpace',
        min: 10,
        max: 80,
        unit: 'N',
        distribution: 'gaussian',
        mean: 45,
        applicableTo: ['chordophone'],
        culturalVariation: {
          'western-classical': { mean: 55, distribution: 'gaussian' },
          'folk-traditions': { mean: 35, distribution: 'uniform' }
        }
      },
      {
        _key: 'wood_density',
        name: 'Wood Density',
        dataType: 'parameterSpace',
        min: 300,
        max: 1200,
        unit: 'kg/m³',
        distribution: 'uniform',
        applicableTo: ['wood'],
      },
      {
        _key: 'acoustical_efficiency',
        name: 'Acoustical Efficiency',
        dataType: 'parameterSpace',
        min: 0,
        max: 1,
        distribution: 'gaussian',
        mean: 0.6,
        applicableTo: ['chordophone', 'resonant_space'],
      }
    ];
    
    // Add properties if they don't exist
    for (const propData of basicProperties) {
      if (!properties.firstExample({ _key: propData._key })) {
        properties.save(propData);
        console.log(`Created property: ${propData.name}`);
      }
    }
  }
} catch (err) {
  console.warn('Error creating basic properties:', err.message);
}

// Create some example property predictors
try {
  const predictors = db._collection('propertyPredictors');
  if (predictors) {
    const basicPredictors = [
      {
        _key: 'string_resonance',
        name: 'String Resonance Frequency',
        formula: 'Math.sqrt(tension/mass) * length / 2',
        inputs: ['string_tension', 'string_mass', 'string_length'],
        output: {
          name: 'fundamental_frequency',
          unit: 'Hz',
          dataType: 'number'
        },
        applicableTo: ['chordophone'],
        confidence: 0.95
      },
      {
        _key: 'sound_quality',
        name: 'Sound Quality Index',
        formula: 'wood_density * acoustical_efficiency / 1000',
        inputs: ['wood_density', 'acoustical_efficiency'],
        output: {
          name: 'quality_index',
          dataType: 'number'
        },
        applicableTo: ['chordophone'],
        confidence: 0.8
      }
    ];
    
    // Add predictors if they don't exist
    for (const predData of basicPredictors) {
      if (!predictors.firstExample({ _key: predData._key })) {
        predictors.save(predData);
        console.log(`Created property predictor: ${predData.name}`);
      }
    }
  }
} catch (err) {
  console.warn('Error creating basic property predictors:', err.message);
}

console.log('Foxx service setup completed successfully'); 