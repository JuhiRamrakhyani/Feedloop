// Generic HTTP webhook provider. POSTs the message to any URL you control,
// so you can plug in WAHA, Evolution API, a Baileys microservice, Twilio,
// Zapier, n8n — anything that accepts a JSON body.

const { buildMessage, formatPhoneNumber } = require('./message');

module.exports = {
  name: 'webhook',
  async send({ to, name, link }) {
    const url = process.env.WEBHOOK_URL;
    if (!url) throw new Error('DELIVERY_PROVIDER=webhook requires WEBHOOK_URL to be set');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({
        to,
        phone: formatPhoneNumber(to),
        name,
        link,
        message: buildMessage({ name, link })
      }),
      signal: AbortSignal.timeout(Number(process.env.WEBHOOK_TIMEOUT) || 15000)
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status} ${res.statusText}`);
    const gateway = await res.json().catch(() => ({}));
    return { ok: true, gateway };
  }
};
