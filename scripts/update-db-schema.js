// update-db-schema.js

/**
 * Schema updater for ArangoDB SOMAP project.
 * - Ensures essential collections exist
 * - Adds missing `perspective` field to entities
 * - Creates default perspective document
 * 
 * Compatible with ESM modules and robust to environment misconfigurations
 */

import { Database, aql } from 'arangojs';

// Set default environment variables
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '8529';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'asdBGT788';
const DB_NAME = process.env.DB_NAME || 'somap';

// Create database connection
const db = new Database({
  url: `http://${DB_HOST}:${DB_PORT}`,
  databaseName: DB_NAME,
  auth: { username: DB_USER, password: DB_PASS },
});

async function updateSchema() {
  console.log(`🔄 Connecting to ArangoDB at http://${DB_HOST}:${DB_PORT}...`);

  try {
    const dbInfo = await db.get();
    console.log(`✅ Connected to database: ${dbInfo.name}`);

    const collections = await db.collections();
    const collectionNames = collections.map(c => c.name);
    console.log('📚 Existing collections:', collectionNames);

    // Ensure required collections exist
    const requiredCollections = [
      { name: 'properties', type: 'document' },
      { name: 'propertyPredictors', type: 'document' },
      { name: 'perspectives', type: 'document' }
    ];

    for (const coll of requiredCollections) {
      if (!collectionNames.includes(coll.name)) {
        console.log(`➕ Creating ${coll.name} collection...`);
        if (coll.type === 'edge') {
          await db.createEdgeCollection(coll.name);
        } else {
          await db.createCollection(coll.name);
        }
        console.log(`✅ Created ${coll.name} collection`);
      }
    }

    // Add "perspective" field to existing entities if missing
    if (collectionNames.includes('entities')) {
      console.log('🔍 Checking entities for missing perspective field...');
      const entitiesNeedingUpdate = await db.query(aql`
        FOR e IN entities
        FILTER !HAS(e, "perspective")
        RETURN e
      `).then(cursor => cursor.all());

      console.log(`🛠 Found ${entitiesNeedingUpdate.length} entities needing update`);
      for (const entity of entitiesNeedingUpdate) {
        await db.collection('entities').update(entity._key, { perspective: 'default' });
      }
      console.log(`✅ Updated ${entitiesNeedingUpdate.length} entities`);
    }

    // Create default perspective if missing
    if (collectionNames.includes('perspectives')) {
      const defaultPerspective = await db.query(aql`
        FOR p IN perspectives
        FILTER p._key == "default"
        RETURN p
      `).then(cursor => cursor.all());

      if (defaultPerspective.length === 0) {
        console.log('➕ Creating default perspective...');
        await db.collection('perspectives').save({
          _key: 'default',
          name: 'default',
          description: 'Default perspective with all kinds',
          kinds: ['object', 'agent', 'material', 'environment', 'interaction'],
          relKinds: ['connectedTo', 'builtBy', 'resonatesIn', 'partOf', 'subTypeOf', 'inCategory'],
          createdAt: new Date()
        });
        console.log('✅ Default perspective created');
      }
    }

    console.log('🎉 Schema update completed successfully');
  } catch (err) {
    console.error('❌ Error updating schema:', err);
    process.exit(1);
  }
}

// Entry point
updateSchema().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});