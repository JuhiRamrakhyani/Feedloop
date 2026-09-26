const { pgPool } = require('../config/postgres');

async function listTemplates({ includeInactive = false } = {}) {
  const { rows } = await pgPool.query(
    `SELECT t.id, t.name, t.description, t.is_active, t.created_at,
            (SELECT COUNT(*) FROM feedback_questions q WHERE q.template_id = t.id)::int AS question_count
     FROM feedback_templates t
     ${includeInactive ? '' : 'WHERE t.is_active = true'}
     ORDER BY t.id`
  );
  return rows;
}

async function getTemplateWithQuestions(templateId) {
  const template = await pgPool.query(
    `SELECT id, name, description FROM feedback_templates WHERE id = $1`,
    [templateId]
  );
  if (!template.rows[0]) return null;

  const questions = await pgPool.query(
    `SELECT id, label, help_text, field_type, options, is_required,
            min_length, max_length, min_value, max_value, sort_order
     FROM feedback_questions
     WHERE template_id = $1
     ORDER BY sort_order`,
    [templateId]
  );
  return { ...template.rows[0], questions: questions.rows };
}

// Radio/checkbox options can arrive as plain strings ("On time") or as
// {value,label} objects. Normalize to objects so the public form renderer
// (which expects o.value / o.label) always works.
function normalizeOptions(options) {
  if (!Array.isArray(options)) return null;
  return options.map((o) =>
    typeof o === 'string'
      ? { value: o.trim().toLowerCase().replace(/\s+/g, '_'), label: o.trim() }
      : o
  );
}

async function createTemplate({ name, description, questions }) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(
      `INSERT INTO feedback_templates (name, description) VALUES ($1, $2) RETURNING id`,
      [name, description || null]
    );
    const templateId = t.rows[0].id;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const opts = normalizeOptions(q.options);
      await client.query(
        `INSERT INTO feedback_questions
           (template_id, label, help_text, field_type, options, is_required, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [templateId, q.label, q.helpText || null, q.fieldType,
         opts ? JSON.stringify(opts) : null, !!q.isRequired, i]
      );
    }
    await client.query('COMMIT');
    return templateId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Parses LINK_EXPIRY ("14d", "7d", "2h", "30m", "90s") into a Date; 14d default.
function parseExpiry(raw) {
  const m = String(raw || '14d').trim().match(/^(\d+)([dhms])$/);
  if (!m) return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const mult = { d: 86400, h: 3600, m: 60, s: 1 }[m[2]];
  return new Date(Date.now() + Number(m[1]) * mult * 1000);
}

// Creates the request row with a SNAPSHOT of identity data (see architecture
// note in schema.sql) — this is what makes review never need to re-query the
// identity API / SQL Server again. requestUuid is the short link token itself,
// and expires_at is derived from LINK_EXPIRY.
async function createFeedbackRequest({ requestUuid, templateId, identity, mobileNumber, software }) {
  const { rows } = await pgPool.query(
    `INSERT INTO feedback_requests
       (request_uuid, template_id, identity_id, name, state, city, company, mobile_number, software, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
     RETURNING id, request_uuid`,
    [requestUuid, templateId, identity.identityId, identity.name, identity.state,
     identity.city, identity.company, mobileNumber, software || null, parseExpiry(process.env.LINK_EXPIRY)]
  );
  return rows[0]; // { id, request_uuid }
}

async function markSent(requestId) {
  await pgPool.query(
    `UPDATE feedback_requests SET status = 'sent', sent_at = now() WHERE id = $1`,
    [requestId]
  );
}

async function getRequestByUuid(requestUuid) {
  const { rows } = await pgPool.query(
    `SELECT r.*, t.name AS template_name
     FROM feedback_requests r
     JOIN feedback_templates t ON t.id = r.template_id
     WHERE r.request_uuid = $1`,
    [requestUuid]
  );
  return rows[0] || null;
}

async function markViewed(requestId) {
  await pgPool.query(
    `UPDATE feedback_requests
     SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
         viewed_at = COALESCE(viewed_at, now())
     WHERE id = $1`,
    [requestId]
  );
}

async function submitAnswers(requestId, answers) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      `SELECT status FROM feedback_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );
    if (!check.rows[0] || check.rows[0].status === 'completed') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already_submitted_or_invalid' };
    }

    for (const a of answers) {
      const value = Array.isArray(a.value) ? JSON.stringify(a.value) : String(a.value);
      await client.query(
        `INSERT INTO feedback_answers (request_id, question_id, answer_value)
         VALUES ($1,$2,$3)`,
        [requestId, a.questionId, value]
      );
    }
    await client.query(
      `UPDATE feedback_requests SET status = 'completed', completed_at = now() WHERE id = $1`,
      [requestId]
    );
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listReviewRows({ status, templateId, from, to, limit = 50, offset = 0 }) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (status) { conditions.push(`status = $${i++}`); params.push(status); }
  if (templateId) { conditions.push(`template_id = $${i++}`); params.push(templateId); }
  if (from) { conditions.push(`created_at >= $${i++}`); params.push(from); }
  if (to) { conditions.push(`created_at <= $${i++}`); params.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await pgPool.query(
    `SELECT * FROM vw_feedback_review ${where}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );
  return rows;
}

async function getResponseDetail(requestId) {
  const { rows } = await pgPool.query(
    `SELECT a.answer_value, q.label, q.field_type
     FROM feedback_answers a
     JOIN feedback_questions q ON q.id = a.question_id
     WHERE a.request_id = $1
     ORDER BY q.sort_order`,
    [requestId]
  );
  return rows;
}

async function getDashboardSummary() {
  const { rows } = await pgPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status IN ('pending','sent','viewed')) AS awaiting,
      COUNT(*) AS total
    FROM feedback_requests
  `);
  return rows[0];
}

async function getDashboardStats() {
  const { rows } = await pgPool.query(`
    SELECT
      (SELECT COUNT(*) FROM feedback_requests)::int                                       AS total_requests,
      (SELECT COUNT(*) FROM feedback_requests WHERE status = 'pending')::int               AS pending,
      (SELECT COUNT(*) FROM feedback_requests WHERE status = 'sent')::int                  AS sent,
      (SELECT COUNT(*) FROM feedback_requests WHERE status = 'viewed')::int                AS viewed,
      (SELECT COUNT(*) FROM feedback_requests WHERE status = 'completed')::int             AS completed,
      (SELECT COUNT(DISTINCT identity_id) FROM feedback_requests)::int                     AS identities_contacted,
      (SELECT COUNT(*) FROM feedback_templates)::int                                       AS total_templates,
      (SELECT COUNT(*) FROM feedback_templates WHERE is_active = true)::int                AS active_templates,
      (SELECT COUNT(*) FROM feedback_questions)::int                                       AS total_questions,
      (SELECT COUNT(*) FROM feedback_answers)::int                                         AS total_answers
  `);
  const s = rows[0];
  s.awaiting = s.pending + s.sent + s.viewed;
  s.response_rate = s.total_requests ? Math.round((s.completed / s.total_requests) * 100) : 0;

  const recent = await pgPool.query(`
    SELECT r.id, r.name, r.company, r.city, r.state, r.mobile_number,
           r.status, r.created_at, t.name AS template_name
    FROM feedback_requests r
    JOIN feedback_templates t ON t.id = r.template_id
    ORDER BY r.created_at DESC
    LIMIT 8
  `);
  return { ...s, recent: recent.rows };
}

async function updateTemplate(templateId, { name, description, questions }) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(
      `UPDATE feedback_templates SET name = $1, description = $2, is_active = true WHERE id = $3 RETURNING id`,
      [name, description || null, templateId]
    );
    if (!t.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    // Replace the whole question set — add/edit/remove/reorder in one call.
    await client.query(`DELETE FROM feedback_questions WHERE template_id = $1`, [templateId]);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const opts = normalizeOptions(q.options);
      await client.query(
        `INSERT INTO feedback_questions
           (template_id, label, help_text, field_type, options, is_required, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [templateId, q.label, q.helpText || null, q.fieldType,
         opts ? JSON.stringify(opts) : null, !!q.isRequired, i]
      );
    }
    await client.query('COMMIT');
    return templateId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Templates that already have feedback requests are soft-deleted (is_active=false)
// so historical review rows stay intact; unused ones are removed for real.
async function deleteTemplate(templateId) {
  const used = await pgPool.query(
    `SELECT COUNT(*)::int AS n FROM feedback_requests WHERE template_id = $1`,
    [templateId]
  );
  if (used.rows[0].n > 0) {
    await pgPool.query(`UPDATE feedback_templates SET is_active = false WHERE id = $1`, [templateId]);
    return { hardDeleted: false, deactivated: true };
  }
  await pgPool.query(`DELETE FROM feedback_templates WHERE id = $1`, [templateId]);
  return { hardDeleted: true, deactivated: false };
}

module.exports = {
  listTemplates, getTemplateWithQuestions, createTemplate, updateTemplate, deleteTemplate,
  createFeedbackRequest, markSent, getRequestByUuid, markViewed,
  submitAnswers, listReviewRows, getResponseDetail,
  getDashboardSummary, getDashboardStats
};
