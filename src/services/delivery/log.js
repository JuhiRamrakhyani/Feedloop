// Default provider: writes the message to the server log and reports success.
// Great for local development and CI — no external service required.

const { buildMessage } = require('./message');

module.exports = {
  name: 'log',
  async send({ to, name, link }) {
    console.log(`\n[delivery:log] → ${to || '(no address)'}\n${buildMessage({ name, link })}\n`);
    return { ok: true, simulated: true };
  }
};
