// Simple script to view all data from our collections
// Run with: bun run view-data.js

async function fetchData() {
  try {
    // Fetch and display entities
    console.log("\n=== ENTITIES ===");
    const entitiesResponse = await fetch('http://localhost:3000/api/entities');
    if (entitiesResponse.ok) {
      const entities = await entitiesResponse.json();
      console.log(`Found ${entities.length} entities:`);
      entities.forEach(entity => {
        console.log(`- ${entity.label || entity.name || 'Unnamed'} (${entity.kind}), type: ${entity.type}`);
        console.log(`  Properties:`, entity.props);
      });
    } else {
      console.log('Failed to fetch entities:', entitiesResponse.statusText);
    }
    
    // Fetch and display types
    console.log("\n=== TYPES ===");
    const typesResponse = await fetch('http://localhost:3000/api/types');
    if (typesResponse.ok) {
      const types = await typesResponse.json();
      console.log(`Found ${types.length} types:`);
      types.forEach(type => {
        console.log(`- ${type.name} (${type._id}), category: ${type.category}`);
      });
    } else {
      console.log('Failed to fetch types:', typesResponse.statusText);
    }
    
    // Fetch and display properties
    console.log("\n=== PROPERTIES ===");
    const propertiesResponse = await fetch('http://localhost:3000/api/properties');
    if (propertiesResponse.ok) {
      const properties = await propertiesResponse.json();
      console.log(`Found ${properties.length} properties:`);
      properties.forEach(property => {
        console.log(`- ${property.name} (${property.dataType}), range: ${property.min} to ${property.max} ${property.unit || ''}`);
        console.log(`  Applicable to: ${property.applicableTo?.join(', ')}`);
      });
    } else {
      console.log('Failed to fetch properties:', propertiesResponse.statusText);
    }
    
    // Fetch and display predictors
    console.log("\n=== PROPERTY PREDICTORS ===");
    const predictorsResponse = await fetch('http://localhost:3000/api/propertyPredictors');
    if (predictorsResponse.ok) {
      const predictors = await predictorsResponse.json();
      console.log(`Found ${predictors.length} predictors:`);
      predictors.forEach(predictor => {
        console.log(`- ${predictor.name}, formula: ${predictor.formula}`);
        console.log(`  Inputs: ${predictor.inputs?.join(', ')}`);
        console.log(`  Output: ${predictor.output?.name} (${predictor.output?.dataType}) ${predictor.output?.unit || ''}`);
      });
    } else {
      console.log('Failed to fetch predictors:', predictorsResponse.statusText);
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();