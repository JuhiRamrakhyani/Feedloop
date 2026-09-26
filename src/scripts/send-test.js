require('dotenv').config();
const { pgPool } = require('../config/postgres');
const feedbackService = require('../services/feedbackService');
const delivery = require('../services/delivery');
const { generateFeedbackToken } = require('../services/tokenService');
const { shortenUrl } = require('../services/shortenService');

const BASE_URL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Quick CLI to exercise the whole send path against the configured provider.
//   npm run send:test -- 6398899337
//   npm run send:test -- 6398899337 "Priya Sharma"
async function main() {
  const number = process.argv[2];
  const name = process.argv[3] || 'Test Recipient';
  if (!number) {
    console.error('Usage: npm run send:test -- <phone> [name]');
    process.exit(1);
  }

  const templates = await feedbackService.listTemplates();
  if (!templates.length) {
    console.error('No templates found — run `npm run seed` first.');
    process.exit(1);
  }
  const templateId = templates[0].id;

  const request = await feedbackService.createFeedbackRequest({
    requestUuid: generateFeedbackToken(),
    templateId,
    identity: { identityId: null, name, city: null, state: null, company: null },
    mobileNumber: number,
    software: null
  });

  const link = await shortenUrl(`${BASE_URL}/feedback/${request.request_uuid}`);

  console.log(`\nProvider : ${delivery.providerName()}`);
  console.log(`Template : ${templates[0].name}`);
  console.log(`Recipient: ${name} <${number}>`);
  console.log(`Link     : ${link}\n`);

  const result = await delivery.send({ to: number, name, link });
  await feedbackService.markSent(request.id);

  if (result.simulated) {
    console.log('Logged only (DELIVERY_PROVIDER=log). Set DELIVERY_PROVIDER=baileys or webhook to send for real.');
  } else {
    console.log(`Sent via ${result.provider}.`);
  }
  console.log('Open the link to test the form, then check the Review tab.\n');

  await pgPool.end();
}

main().catch(async (err) => {
  console.error('Test send failed:', err.message);
  try { await pgPool.end(); } catch { /* already closed */ }
  process.exit(1);
});
