const express = require('express');
const router = express.Router();
const identityService = require('../services/identityService');

// GET /api/identities/search?q=sharda  -> search section
router.get('/search', async (req, res, next) => {
  try {
    const results = await identityService.searchIdentities(req.query.q);
    res.json(results);
  } catch (err) { next(err); }
});

// GET /api/identities/:id  -> full detail once one is picked
router.get('/:id', async (req, res, next) => {
  try {
    const identity = await identityService.getIdentityById(req.params.id);
    if (!identity) return res.status(404).json({ error: 'Identity not found' });
    res.json(identity);
  } catch (err) { next(err); }
});

module.exports = router;
