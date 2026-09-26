const express = require('express');
const router = express.Router();
const identityService = require('../services/identityService');
const feedbackService = require('../services/feedbackService');
const delivery = require('../services/delivery');
const { generateFeedbackToken } = require('../services/tokenService');
const { shortenUrl } = require('../services/shortenService');

const BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// POST /api/feedback/send
// Directory recipient: { identityId, templateId, mobileNumber? }
// Ad-hoc recipient:    { name, mobileNumber, templateId, city?, state?, company? }
// Anyone can send to a raw number — no need to add it to the identities table.
router.post('/send', async (req, res, next) => {
  try {
    const { identityId, templateId, mobileNumber, name, city, state, company } = req.body || {};
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });

    let identity;
    if (identityId !== undefined && identityId !== null && identityId !== '') {
      identity = await identityService.getIdentityById(identityId);
      if (!identity) return res.status(404).json({ error: 'Identity not found' });
    } else {
      if (!name || !mobileNumber) {
        return res.status(400).json({ error: 'Provide an identityId, or a name and mobileNumber.' });
      }
      identity = {
        identityId: null,
        name: String(name).trim(),
        city: city || null,
        state: state || null,
        company: company || null
      };
    }

    const to = mobileNumber || identity.mobileNumber;
    if (!to) return res.status(400).json({ error: 'A mobile number is required.' });

    const template = await feedbackService.getTemplateWithQuestions(templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Snapshot the recipient into PostgreSQL. The short random token IS the
    // request_uuid, so the link carries no identity data and cannot be tampered
    // with to reach anyone else's data.
    const request = await feedbackService.createFeedbackRequest({
      requestUuid: generateFeedbackToken(),
      templateId,
      identity,
      mobileNumber: to,
      software: req.body.software || null
    });

    const link = await shortenUrl(`${BASE_URL}/feedback/${request.request_uuid}`);

    const result = await delivery.send({ to, name: identity.name, link });
    await feedbackService.markSent(request.id);

    res.status(201).json({
      requestId: request.id,
      link,
      status: 'sent',
      provider: result.provider,
      simulated: !!result.simulated
    });
  } catch (err) { next(err); }
});

// GET /api/feedback/sent-log  -> recent sends (in-memory, for the demo UI)
router.get('/sent-log', (req, res) => {
  res.json(delivery.getSentLog());
});

module.exports = router;
