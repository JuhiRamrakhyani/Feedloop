// Shared helpers for every delivery provider.

const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';

// Normalizes any phone shape ("+91 98xxx", "098xxx", "9198xxx") to bare
// international digits, defaulting to the configured country code.
function formatPhoneNumber(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits) return null;
  if (COUNTRY_CODE && !digits.startsWith(COUNTRY_CODE)) digits = COUNTRY_CODE + digits;
  return digits;
}

function buildMessage({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `${greeting}\n\nWe'd love to hear your feedback — it takes about a minute:\n${link}`;
}

module.exports = { formatPhoneNumber, buildMessage, COUNTRY_CODE };
