// This script creates a test interactWith relation
// Run with: bun run create-test-relation.js

async function createTestRelation() {
  try {
    // First get entities
    const entitiesResponse = await fetch('http://localhost:3000/api/entities');
    if (!entitiesResponse.ok) {
      console.error('Failed to fetch entities:', entitiesResponse.statusText);
      return;
    }
    
    const entities = await entitiesResponse.json();
    console.log(`Found ${entities.length} entities`);
    
    if (entities.length < 2) {
      console.log('Not enough entities to create a relation');
      return;
    }
    
    // Create a relation between the first two entities
    const relationData = {
      name: "interacts with",
      from: entities[0]._id,
      to: entities[1]._id,
      predicate: "interactWith",
      lineType: "dashed"
    };
    
    console.log('Creating relation:', relationData);
    
    const response = await fetch('http://localhost:3000/api/relations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(relationData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create relation:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('Relation created:', result);
  } catch (error) {
    console.error('Error creating test relation:', error);
  }
}

createTestRelation();