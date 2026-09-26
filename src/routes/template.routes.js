const express = require('express');
const router = express.Router();
const feedbackService = require('../services/feedbackService');

// GET /api/templates?includeInactive=true  -> template picker in the send flow
// (admin list can pass includeInactive=true to see every template built)
router.get('/', async (req, res, next) => {
  try {
    res.json(await feedbackService.listTemplates({
      includeInactive: req.query.includeInactive === 'true'
    }));
  } catch (err) { next(err); }
});

// GET /api/templates/:id  -> full question set (used for both preview and the public form)
router.get('/:id', async (req, res, next) => {
  try {
    const template = await feedbackService.getTemplateWithQuestions(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) { next(err); }
});

// POST /api/templates  -> create a new template, freely defined questions
router.post('/', async (req, res, next) => {
  try {
    const { name, description, questions } = req.body;
    if (!name || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'name and at least one question are required' });
    }
    const id = await feedbackService.createTemplate({ name, description, questions });
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

// PUT /api/templates/:id  -> update name/description and replace the question set
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, questions } = req.body;
    if (!name || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'name and at least one question are required' });
    }
    const id = await feedbackService.updateTemplate(req.params.id, { name, description, questions });
    if (id === null) return res.status(404).json({ error: 'Template not found' });
    res.json({ id });
  } catch (err) { next(err); }
});

// DELETE /api/templates/:id  -> hard delete if unused, else deactivate (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await feedbackService.deleteTemplate(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
