const { pgPool } = require('../config/postgres');

// =====================================================================
// Identity source: the local PostgreSQL `identities` table.
// This is a self-contained personal project — there is no external
// identity API or SQL Server to talk to. Run `npm run seed` to load the
// dummy identities, then search / send / review all work offline.
// =====================================================================

const SEARCH_COLUMNS = `
  identity_id    AS "identityId",
  name,
  state,
  city,
  company,
  mobile_number  AS "mobileNumber",
  category
`;

// Expands a search/detail row into the shape the UI expects, including a
// `numbers[]` list so the Send tab's number picker has something to show.
function toIdentity(row) {
  if (!row) return null;
  const numbers = row.mobileNumber
    ? [{ label: null, value: row.mobileNumber, type: 'mobile' }]
    : [];
  return {
    identityId: row.identityId,
    name: row.name,
    state: row.state,
    city: row.city,
    company: row.company,
    category: row.category,
    mobileNumber: row.mobileNumber,
    numbers,
    address: null,
    emails: []
  };
}

// Search by name (partial, case-insensitive) or exact numeric ID.
async function searchIdentities(query) {
  const q = (query || '').trim();
  const params = [];
  let sql = `SELECT ${SEARCH_COLUMNS} FROM identities`;
  if (q) {
    params.push(`%${q}%`);
    sql += ` WHERE name ILIKE $1 OR CAST(identity_id AS TEXT) LIKE $1`;
  }
  sql += ` ORDER BY name LIMIT 20`;
  const { rows } = await pgPool.query(sql, params);
  return rows;
}

async function getIdentityById(identityId) {
  const { rows } = await pgPool.query(
    `SELECT ${SEARCH_COLUMNS} FROM identities WHERE identity_id = $1`,
    [identityId]
  );
  return toIdentity(rows[0]);
}

module.exports = { searchIdentities, getIdentityById };
