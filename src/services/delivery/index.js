// Delivery layer — picks a provider from DELIVERY_PROVIDER and forwards sends.
// Providers: `log` (default), `webhook`, `baileys`.

const { formatPhoneNumber } = require('./message');

const sentLog = [];
let cached = null;
let cachedName = null;

function getProvider() {
  const name = (process.env.DELIVERY_PROVIDER || 'log').toLowerCase();
  if (cached && cachedName === name) return cached;
  if (name === 'webhook') cached = require('./webhook');
  else if (name === 'baileys' || name === 'whatsapp') cached = require('./baileys');
  else cached = require('./log');
  cachedName = name;
  return cached;
}

function providerName() {
  return getProvider().name;
}

async function send({ to, name, link }) {
  const provider = getProvider();
  const result = await provider.send({ to, name, link });
  sentLog.unshift({ to, name, link, provider: provider.name, sentAt: new Date().toISOString(), result });
  return { provider: provider.name, ...result };
}

function getSentLog() {
  return sentLog.slice(0, 20);
}

module.exports = { send, getSentLog, providerName, formatPhoneNumber };
