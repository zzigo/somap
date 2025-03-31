// This is a simple script to test entity creation
// Run with: bun run test-entity.js

// First create a type if none exists
async function createTestType() {
  const testType = {
    name: "Chordophone",
    color: "#3498db",
    symbol: "circle",
    category: "instrument"
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testType)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create type:', errorData);
      return null;
    }
    
    const result = await response.json();
    console.log('Type created successfully:', result);
    return result.type._id || result.type._key;
  } catch (error) {
    console.error('Error creating type:', error);
    return null;
  }
}

// Then create an entity with that type
async function createTestEntity(typeId) {
  const testEntity = {
    name: "Test Violin",
    typeId: typeId,
    kind: "object",
    creatorId: "admin",
    perspective: "default",
    props: {
      stringCount: 4,
      tuning: ["G3", "D4", "A4", "E5"]
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/entities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEntity)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create entity:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('Entity created successfully:', result);
  } catch (error) {
    console.error('Error creating entity:', error);
  }
}

// Run the test
async function runTest() {
  // First check if any types exist
  try {
    const typesResponse = await fetch('http://localhost:3000/api/types');
    const types = await typesResponse.json();
    
    let typeId;
    if (types.length > 0) {
      typeId = types[0]._id || types[0]._key;
      console.log('Using existing type:', typeId);
    } else {
      typeId = await createTestType();
      if (!typeId) {
        console.error('Could not create or find a type.');
        return;
      }
    }
    
    await createTestEntity(typeId);
    console.log('Test completed.');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

runTest();