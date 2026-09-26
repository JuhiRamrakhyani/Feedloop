require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pgPool } = require('../config/postgres');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pgPool.query(schema);
  console.log('✔ PostgreSQL schema applied');
  await pgPool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
