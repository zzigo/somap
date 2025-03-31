#!/usr/bin/env node
/**
 * This script updates the database schema to match the latest structure
 * - Adds perspective field to existing entities if missing
 * - Creates the perspectives collection if missing
 * - Creates properties and propertyPredictors collections if missing
 */

const { Database, aql } = require('arangojs');

// Environment variables with defaults
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '8529';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'asdBGT788';
const DB_NAME = process.env.DB_NAME || 'somap';

async function updateSchema() {
  console.log(`Connecting to ArangoDB at ${DB_HOST}:${DB_PORT}...`);
  
  // Connect to ArangoDB
  const db = new Database({
    url: `http://${DB_HOST}:${DB_PORT}`,
    databaseName: DB_NAME,
    auth: { username: DB_USER, password: DB_PASS },
  });

  try {
    const dbInfo = await db.get();
    console.log(`Connected to database: ${dbInfo.name}`);
    
    // Get list of collections
    const collections = await db.collections();
    const collectionNames = collections.map(c => c.name);
    console.log('Existing collections:', collectionNames);
    
    // Create missing collections
    const requiredCollections = [
      { name: 'properties', type: 'document' },
      { name: 'propertyPredictors', type: 'document' },
      { name: 'perspectives', type: 'document' }
    ];
    
    for (const coll of requiredCollections) {
      if (!collectionNames.includes(coll.name)) {
        console.log(`Creating ${coll.name} collection...`);
        if (coll.type === 'edge') {
          await db.createEdgeCollection(coll.name);
        } else {
          await db.createCollection(coll.name);
        }
        console.log(`Created ${coll.name} collection`);
      }
    }
    
    // Update entities to have perspective field
    if (collectionNames.includes('entities')) {
      console.log('Updating entities to have perspective field...');
      const entitiesNeedingUpdate = await db.query(aql`
        FOR e IN entities
        FILTER !HAS(e, "perspective")
        RETURN e
      `).then(cursor => cursor.all());
      
      console.log(`Found ${entitiesNeedingUpdate.length} entities missing perspective field`);
      
      for (const entity of entitiesNeedingUpdate) {
        await db.collection('entities').update(entity._key, { perspective: 'default' });
      }
      console.log(`Updated ${entitiesNeedingUpdate.length} entities with default perspective`);
    }
    
    // Create default perspective if it doesn't exist
    if (collectionNames.includes('perspectives')) {
      const defaultPerspective = await db.query(aql`
        FOR p IN perspectives
        FILTER p._key == "default"
        RETURN p
      `).then(cursor => cursor.all());
      
      if (defaultPerspective.length === 0) {
        console.log('Creating default perspective...');
        await db.collection('perspectives').save({
          _key: 'default',
          name: 'default',
          description: 'Default perspective with all kinds',
          kinds: ['object', 'agent', 'material', 'environment', 'interaction'],
          relKinds: ['connectedTo', 'builtBy', 'resonatesIn', 'partOf', 'subTypeOf', 'inCategory'],
          createdAt: new Date()
        });
        console.log('Created default perspective');
      }
    }

    console.log('Schema update completed successfully');
  } catch (err) {
    console.error('Error updating schema:', err);
    process.exit(1);
  }
}

updateSchema().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});