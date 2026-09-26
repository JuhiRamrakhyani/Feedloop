const { Pool } = require('pg');

// The single database for this app: feedback_templates / feedback_questions /
// feedback_requests / feedback_answers and the local `identities` table.
const pgPool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'feedloop',
  max: 10,
  idleTimeoutMillis: 30000
});

pgPool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = { pgPool };
