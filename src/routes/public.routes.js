const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyFeedbackToken } = require('../services/tokenService');
const feedbackService = require('../services/feedbackService');

// Throttle the public endpoints — this is what the party's browser calls,
// so it's the one surface reachable by anyone with a link.
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
router.use(publicLimiter);

// GET /api/public/feedback/:token
// The token carries ONLY an opaque request_uuid — never identity fields.
// Everything returned here is resolved server-side from that uuid.
router.get('/feedback/:token', async (req, res, next) => {
  try {
    const verified = verifyFeedbackToken(req.params.token);
    if (!verified.valid) {
      return res.status(410).json({ error: verified.reason === 'expired' ? 'This link has expired.' : 'This link is invalid.' });
    }

    const request = await feedbackService.getRequestByUuid(verified.requestUuid);
    if (!request) return res.status(404).json({ error: 'This feedback link is invalid.' });
    if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'This link has expired.' });
    }
    if (request.status === 'completed') {
      return res.status(409).json({ error: 'This feedback has already been submitted.' });
    }

    await feedbackService.markViewed(request.id);
    const template = await feedbackService.getTemplateWithQuestions(request.template_id);

    // Only what the party's own header needs — nothing more, nothing tied to
    // the URL itself. Their mobile number, e.g., is deliberately NOT returned.
    res.json({
      requestId: request.id,
      identity: { name: request.name, company: request.company, city: request.city, state: request.state },
      template: { name: template.name, questions: template.questions }
    });
  } catch (err) { next(err); }
});

// POST /api/public/feedback/:token/submit
router.post('/feedback/:token/submit', async (req, res, next) => {
  try {
    const verified = verifyFeedbackToken(req.params.token);
    if (!verified.valid) {
      return res.status(410).json({ error: 'This link is invalid or has expired.' });
    }

    const request = await feedbackService.getRequestByUuid(verified.requestUuid);
    if (!request) return res.status(404).json({ error: 'This feedback link is invalid.' });
    if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'This link has expired.' });
    }

    const template = await feedbackService.getTemplateWithQuestions(request.template_id);
    const { answers } = req.body; // [{ questionId, value }]

    // Server-side validation — never trust the client, even though the
    // browser form already validates this.
    for (const q of template.questions) {
      if (!q.is_required) continue;
      const a = (answers || []).find((x) => x.questionId === q.id);
      const empty = !a || a.value === '' || a.value === null || a.value === undefined ||
        (Array.isArray(a.value) && a.value.length === 0);
      if (empty) {
        return res.status(400).json({ error: `"${q.label}" is required.` });
      }
    }

    const result = await feedbackService.submitAnswers(request.id, answers);
    if (!result.ok) return res.status(409).json({ error: 'This feedback has already been submitted.' });

    res.json({ message: 'Feedback received.' });
  } catch (err) { next(err); }
});

module.exports = router;
