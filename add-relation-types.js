// This script adds the interactWith relation type
// Run with: bun run add-relation-types.js

import { Database } from "arangojs";

async function addRelationTypes() {
  // Initialize database connection
  const db = new Database({
    url: 'http://localhost:8529',
    databaseName: 'somap',
    auth: { username: 'root', password: 'asdBGT788' },
  });
  
  try {
    console.log('Connecting to ArangoDB...');
    
    // First check for perspectives collection
    const collections = await db.collections();
    const existingCollections = collections.map(c => c.name);
    
    if (!existingCollections.includes('perspectives')) {
      console.log('Creating perspectives collection...');
      await db.createCollection('perspectives');
    }
    
    // Get the default perspective
    let defaultPerspective;
    try {
      const perspectiveCursor = await db.query(`
        FOR p IN perspectives
        FILTER p.name == "default"
        RETURN p
      `);
      const perspectives = await perspectiveCursor.all();
      defaultPerspective = perspectives[0];
    } catch (e) {
      console.log('Error fetching default perspective:', e.message);
    }
    
    // If no default perspective exists, create one
    if (!defaultPerspective) {
      console.log('Creating default perspective...');
      defaultPerspective = {
        name: "default",
        description: "Default perspective with all kinds",
        kinds: ["object", "agent", "material", "environment", "interaction"],
        relKinds: ["connectedTo", "builtBy", "resonatesIn", "partOf", "subTypeOf", "inCategory"]
      };
      
      try {
        await db.collection('perspectives').save(defaultPerspective);
        console.log('Default perspective created');
      } catch (e) {
        console.error('Error creating default perspective:', e);
      }
    }
    
    // Add interactWith to the relKinds if it doesn't exist
    if (!defaultPerspective.relKinds.includes('interactWith')) {
      console.log('Adding interactWith to default perspective relKinds...');
      defaultPerspective.relKinds.push('interactWith');
      
      try {
        await db.collection('perspectives').update(defaultPerspective._key, {
          relKinds: defaultPerspective.relKinds
        });
        console.log('interactWith relation type added successfully');
      } catch (e) {
        console.error('Error updating perspective:', e);
      }
    } else {
      console.log('interactWith relation type already exists in default perspective');
    }
    
    // Create a test relation with interactWith predicate
    console.log('Creating a test interactWith relation...');
    
    // First check if we have at least two entities
    const entitiesCursor = await db.query(`
      FOR e IN entities
      LIMIT 2
      RETURN e
    `);
    const entities = await entitiesCursor.all();
    
    if (entities.length >= 2) {
      const relationData = {
        _from: entities[0]._id,
        _to: entities[1]._id,
        predicate: "interactWith",
        name: "interacts with",
        lineType: "dashed"
      };
      
      try {
        const result = await db.collection('relations').save(relationData);
        console.log('Test relation created:', result);
      } catch (e) {
        console.log('Error creating test relation:', e.message);
      }
    } else {
      console.log('Not enough entities to create a test relation');
    }
    
    console.log('Script completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

addRelationTypes();