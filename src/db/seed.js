require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pgPool } = require('../config/postgres');

// ---------------------------------------------------------------------
// Dummy identities for the personal/demo flow. One row per contact, already
// in the shape the Send tab shows (state/city/company + one mobile number).
// ---------------------------------------------------------------------
const IDENTITIES = [
  [4821, 'Sharda Book Traders',        'Uttar Pradesh', 'Lucknow',  'Sharda Book Traders Pvt Ltd', '+919839000001', 'Retail bookseller'],
  [1193, 'Ramesh & Sons Distributors', 'Uttar Pradesh', 'Kanpur',   'Ramesh & Sons Distributors',  '+919876500002', 'Wholesale distributor'],
  [7740, 'Vidya Book Depot',           'Uttar Pradesh', 'Varanasi', 'Vidya Book Depot',            '+919123400003', 'Retail bookseller'],
  [2054, 'Gupta Educational Store',    'Uttar Pradesh', 'Agra',     'Gupta Educational Store',     '+919810200004', 'Retail bookseller'],
  [3312, 'Sunrise Publishers',         'Rajasthan',     'Jaipur',   'Sunrise Publishers & Co',     '+919414300005', 'Wholesale distributor'],
  [5907, 'National Book House',        'Delhi',         'New Delhi','National Book House',         '+919811200006', 'Wholesale distributor'],
  [6120, 'Modern Stationers',          'Madhya Pradesh','Indore',   'Modern Stationers',           '+919826100007', 'Retail bookseller'],
  [8455, 'Knowledge Point',            'Bihar',         'Patna',    'Knowledge Point Educare',     '+919943100008', 'Wholesale distributor'],
  [9001, 'Test Recipient',             'Uttar Pradesh', 'Lucknow',  'Test Contact',                '+916398899337', 'Test']
];

const REMARKS = [
  'Great service overall, will order again.',
  'Delivery was prompt but packaging could be better.',
  'Titles were exactly as ordered, very satisfied.',
  'Invoice matched, team was responsive over phone.',
  'Minor delay but the support team kept us informed.'
];

// Dummy requests so the dashboard has something meaningful to show. Each
// token is fixed, which makes the seed idempotent (safe to run repeatedly).
const DEMO_REQUESTS = [
  { token: 'demotoken001', identityId: 4821, template: 'Retail bookseller feedback',    status: 'completed', createdDaysAgo: 12, software: 'adc' },
  { token: 'demotoken002', identityId: 1193, template: 'Wholesale distributor feedback', status: 'completed', createdDaysAgo: 10, software: 'sanchar' },
  { token: 'demotoken003', identityId: 7740, template: 'Retail bookseller feedback',    status: 'completed', createdDaysAgo: 8,  software: 'adc' },
  { token: 'demotoken004', identityId: 3312, template: 'Wholesale distributor feedback', status: 'completed', createdDaysAgo: 6,  software: 'tdc' },
  { token: 'demotoken005', identityId: 2054, template: 'Retail bookseller feedback',    status: 'completed', createdDaysAgo: 4,  software: 'adc' },
  { token: 'demotoken006', identityId: 5907, template: 'Wholesale distributor feedback', status: 'viewed',    createdDaysAgo: 3,  software: 'sanchar' },
  { token: 'demotoken007', identityId: 6120, template: 'Retail bookseller feedback',    status: 'viewed',    createdDaysAgo: 3,  software: 'adc' },
  { token: 'demotoken008', identityId: 8455, template: 'Wholesale distributor feedback', status: 'sent',      createdDaysAgo: 2,  software: 'tdc' },
  { token: 'demotoken009', identityId: 4821, template: 'Retail bookseller feedback',    status: 'sent',      createdDaysAgo: 2,  software: 'adc' },
  { token: 'demotoken010', identityId: 7740, template: 'Wholesale distributor feedback', status: 'sent',      createdDaysAgo: 1,  software: 'sanchar' },
  { token: 'demotoken011', identityId: 1193, template: 'Retail bookseller feedback',    status: 'pending',   createdDaysAgo: 1,  software: 'adc' },
  { token: 'demotoken012', identityId: 3312, template: 'Wholesale distributor feedback', status: 'pending',   createdDaysAgo: 0,  software: 'tdc' }
];

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function ensureSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS identities (
      identity_id   INT PRIMARY KEY,
      name          VARCHAR(200) NOT NULL,
      state         VARCHAR(100),
      city          VARCHAR(100),
      company       VARCHAR(200),
      mobile_number VARCHAR(20),
      category      VARCHAR(100)
    )
  `);
  await pgPool.query(`ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS software VARCHAR(20)`);
  // Ad-hoc recipients (raw phone numbers) have no identity_id.
  await pgPool.query(`ALTER TABLE feedback_requests ALTER COLUMN identity_id DROP NOT NULL`);
  // request_uuid moved from UUID to a short random token (VARCHAR) — no-op on
  // fresh installs, converts existing rows' UUIDs to strings. Drop the review
  // view first because it references the column.
  await pgPool.query(`DROP VIEW IF EXISTS vw_feedback_review`);
  await pgPool.query(`ALTER TABLE feedback_requests ALTER COLUMN request_uuid TYPE VARCHAR(40)`);
  await pgPool.query(`
    CREATE OR REPLACE VIEW vw_feedback_review AS
    SELECT
      r.id, r.request_uuid, r.identity_id, r.name, r.company, r.state, r.city,
      r.mobile_number, r.software, r.status, r.created_at, r.completed_at,
      t.name AS template_name,
      (SELECT COUNT(*) FROM feedback_answers a WHERE a.request_id = r.id) AS answer_count
    FROM feedback_requests r
    JOIN feedback_templates t ON t.id = r.template_id
  `);
}

async function seedIdentities() {
  for (const [id, name, state, city, company, mobile, category] of IDENTITIES) {
    await pgPool.query(
      `INSERT INTO identities (identity_id, name, state, city, company, mobile_number, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (identity_id) DO UPDATE
         SET name = EXCLUDED.name, state = EXCLUDED.state, city = EXCLUDED.city,
             company = EXCLUDED.company, mobile_number = EXCLUDED.mobile_number,
             category = EXCLUDED.category`,
      [id, name, state, city, company, mobile, category]
    );
  }
  console.log(`✔ Identities seeded (${IDENTITIES.length} records)`);
}

async function seedTemplates() {
  const existing = await pgPool.query('SELECT COUNT(*)::int AS n FROM feedback_templates');
  if (existing.rows[0].n > 0) {
    console.log('• Templates already exist — skipping starter template seed.');
    return;
  }
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await pgPool.query(seedSql);
  console.log('✔ Starter templates inserted (2 templates)');
}

async function seedDemoRequests() {
  const templates = await pgPool.query('SELECT id, name FROM feedback_templates');
  const byName = new Map(templates.rows.map((t) => [t.name, t]));
  const identities = new Map(IDENTITIES.map((r) => [r[0], r]));

  let inserted = 0;
  for (let i = 0; i < DEMO_REQUESTS.length; i++) {
    const spec = DEMO_REQUESTS[i];
    const tpl = byName.get(spec.template);
    const idn = identities.get(spec.identityId);
    if (!tpl || !idn) continue;

    const created = new Date(Date.now() - spec.createdDaysAgo * DAY);
    const sentAt = spec.status === 'pending' ? null : new Date(created.getTime() + HOUR);
    const viewedAt = ['viewed', 'completed'].includes(spec.status) ? new Date(created.getTime() + 2 * HOUR) : null;
    const completedAt = spec.status === 'completed' ? new Date(created.getTime() + 3 * HOUR) : null;
    const expiresAt = new Date(created.getTime() + 14 * DAY);

    const res = await pgPool.query(
      `INSERT INTO feedback_requests
         (request_uuid, template_id, identity_id, name, state, city, company,
          mobile_number, software, status, created_at, sent_at, viewed_at, completed_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (request_uuid) DO NOTHING
       RETURNING id`,
      [spec.token, tpl.id, idn[0], idn[1], idn[2], idn[3], idn[4], idn[5],
       spec.software, spec.status, created, sentAt, viewedAt, completedAt, expiresAt]
    );

    if (!res.rows[0]) continue; // already seeded
    inserted++;

    if (spec.status !== 'completed') continue;

    const questions = await pgPool.query(
      `SELECT id, field_type, options, max_value FROM feedback_questions
       WHERE template_id = $1 ORDER BY sort_order`,
      [tpl.id]
    );
    for (const q of questions.rows) {
      await pgPool.query(
        `INSERT INTO feedback_answers (request_id, question_id, answer_value) VALUES ($1,$2,$3)`,
        [res.rows[0].id, q.id, buildAnswer(q, i)]
      );
    }
  }
  console.log(`✔ Demo requests seeded (${inserted} new, ${DEMO_REQUESTS.length} total)`);
}

function buildAnswer(q, i) {
  switch (q.field_type) {
    case 'rating': {
      const max = q.max_value || 5;
      return String(Math.max(1, max - (i % 3)));
    }
    case 'radio': {
      const opts = q.options || [];
      return opts.length ? opts[i % opts.length].value : 'yes';
    }
    case 'checkbox': {
      const opts = (q.options || []).slice(0, Math.max(1, (i % 2) + 1));
      return JSON.stringify(opts.map((o) => o.value));
    }
    case 'number':
      return String(i % 4);
    default:
      return REMARKS[i % REMARKS.length];
  }
}

async function seed() {
  await ensureSchema();
  await seedIdentities();
  await seedTemplates();
  await seedDemoRequests();
  await pgPool.end();
  console.log('✔ Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
