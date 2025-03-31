// This script creates required collections
// Run with: bun run create-collections.js

import { Database } from "arangojs";

async function createCollections() {
  // Initialize database connection
  const db = new Database({
    url: 'http://localhost:8529',
    databaseName: 'somap',
    auth: { username: 'root', password: 'asdBGT788' },
  });
  
  try {
    console.log('Connecting to ArangoDB...');
    const collections = await db.collections();
    const existingCollections = collections.map(c => c.name);
    console.log('Existing collections:', existingCollections);
    
    // Create propertyPredictors collection if it doesn't exist
    if (!existingCollections.includes('propertyPredictors')) {
      console.log('Creating propertyPredictors collection...');
      await db.createCollection('propertyPredictors');
      console.log('Collection propertyPredictors created successfully.');
    } else {
      console.log('Collection propertyPredictors already exists.');
    }
    
    // Create properties collection if it doesn't exist
    if (!existingCollections.includes('properties')) {
      console.log('Creating properties collection...');
      await db.createCollection('properties');
      console.log('Collection properties created successfully.');
    } else {
      console.log('Collection properties already exists.');
    }
    
    console.log('All required collections created!');
  } catch (error) {
    console.error('Error creating collections:', error);
  }
}

createCollections();