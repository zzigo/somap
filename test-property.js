// This is a simple script to test property creation using fetch
// Run with: bun run test-property.js

const testProperty = {
  name: "String Tension",
  dataType: "parameterSpace",
  min: 10,
  max: 80,
  unit: "N",
  distribution: "gaussian",
  mean: 45,
  applicableTo: ["types/chordophone"]
};

async function createProperty() {
  try {
    const response = await fetch('http://localhost:3000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testProperty)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create property:', errorData);
      return;
    }
    
    const result = await response.json();
    console.log('Property created successfully:', result);
  } catch (error) {
    console.error('Error creating property:', error);
  }
}

// Run the test
createProperty();