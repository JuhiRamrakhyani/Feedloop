const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');

// GET /api/review?status=&templateId=&from=&to=&limit=&offset=
router.get('/', async (req, res, next) => {
  try {
    const rows = await feedbackService.listReviewRows({
      status: req.query.status,
      templateId: req.query.templateId,
      from: req.query.from,
      to: req.query.to,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/review/summary  -> counts for the dashboard cards
router.get('/summary', async (req, res, next) => {
  try {
    res.json(await feedbackService.getDashboardSummary());
  } catch (err) { next(err); }
});

// GET /api/review/dashboard  -> full stats: sent/completed/awaiting, templates
// built, questions configured, identities contacted, and recent activity
router.get('/dashboard', async (req, res, next) => {
  try {
    res.json(await feedbackService.getDashboardStats());
  } catch (err) { next(err); }
});

// GET /api/review/:requestId/answers  -> drill-down detail
router.get('/:requestId/answers', async (req, res, next) => {
  try {
    res.json(await feedbackService.getResponseDetail(req.params.requestId));
  } catch (err) { next(err); }
});

module.exports = router;
