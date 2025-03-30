'use strict';
const db = require('@arangodb').db;

// Drop collections in correct order (relations first to avoid edge constraints)
if (db._collection('relations')) {
  db._drop('relations');
}

if (db._collection('entities')) {
  db._drop('entities');
}

if (db._collection('types')) {
  db._drop('types');
} 