// This is a simple script to test property predictor creation
// Run with: bun run test-predictor.js

async function getProperties() {
  try {
    const response = await fetch('http://localhost:3000/api/properties');
    if (!response.ok) {
      console.error('Failed to fetch properties');
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching properties:', error);
    return [];
  }
}

async function getTypes() {
  try {
    const response = await fetch('http://localhost:3000/api/types');
    if (!response.ok) {
      console.error('Failed to fetch types');
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching types:', error);
    return [];
  }
}

async function createPredictor(propertyKeys, typeIds) {
  const testPredictor = {
    name: "String Resonance Frequency",
    formula: "Math.sqrt(string_tension / 2) * 10",
    inputs: propertyKeys,
    output: {
      name: "fundamental_frequency",
      unit: "Hz",
      dataType: "number"
    },
    applicableTo: typeIds,
    confidence: 0.95
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/propertyPredictors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPredictor)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create predictor:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('Predictor created successfully:', result);
    return result.predictor?._id || result.id;
  } catch (error) {
    console.error('Error creating predictor:', error);
  }
}

async function testApplyPredictor(predictorId) {
  try {
    // First get entities
    const entitiesResponse = await fetch('http://localhost:3000/api/entities');
    const entities = await entitiesResponse.json();
    
    if (entities.length === 0) {
      console.log('No entities available to test the predictor.');
      return;
    }
    
    // Use first entity
    const entity = entities[0];
    console.log('Testing predictor on entity:', entity.label || entity.name);
    
    // Apply predictor
    const response = await fetch(`http://localhost:3000/api/propertyPredictors/${predictorId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entityId: entity._id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to apply predictor:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('Predictor applied successfully:', result);
  } catch (error) {
    console.error('Error applying predictor:', error);
  }
}

// Run tests
async function runTest() {
  const properties = await getProperties();
  const types = await getTypes();
  
  if (properties.length === 0) {
    console.error('No properties found. Please create at least one property first.');
    return;
  }
  
  if (types.length === 0) {
    console.error('No types found. Please create at least one type first.');
    return;
  }
  
  // Extract property keys and type IDs
  const propertyKeys = properties.map(p => p._key);
  const typeIds = types.map(t => t._id || t._key);
  
  console.log('Using properties:', propertyKeys);
  console.log('Using types:', typeIds);
  
  const predictorId = await createPredictor(propertyKeys, typeIds);
  if (predictorId) {
    console.log('Testing predictor application...');
    await testApplyPredictor(predictorId);
  }
}

runTest();