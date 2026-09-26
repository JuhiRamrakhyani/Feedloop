require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const identityRoutes = require('./routes/identity.routes');
const templateRoutes = require('./routes/template.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const publicRoutes = require('./routes/public.routes');
const reviewRoutes = require('./routes/review.routes');
const delivery = require('./services/delivery');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } })); // don't leak tokens via Referer
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/identities', identityRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/review', reviewRoutes);

// Pretty URL for the link the party actually opens — serves the SPA page,
// which then calls /api/public/feedback/:token for data.
app.get('/feedback/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'form.html'));
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Public runtime config the UI reads (app name + active delivery provider).
app.get('/api/config', (req, res) => {
  res.json({ appName: process.env.APP_NAME || 'FeedLoop', provider: delivery.providerName() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AGP feedback service running on http://localhost:${PORT}`));
