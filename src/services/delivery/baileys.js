// WhatsApp provider using Baileys (https://github.com/WhiskeySockets/Baileys),
// an open-source WhatsApp Web client. Free, no official API key required.
//
// Pair once with `npm run whatsapp:login` (scan the QR), then this provider
// reuses the saved session in BAILEYS_AUTH_DIR to send messages.
//
// NOTE: Baileys is an unofficial WhatsApp client. Use a dedicated number and
// respect WhatsApp's terms — mass/unsolicited messaging can get a number banned.

const path = require('path');
const { buildMessage, formatPhoneNumber } = require('./message');

let socketPromise = null;
let isOpen = false;
let openWaiters = [];

function authDir() {
  return path.resolve(process.env.BAILEYS_AUTH_DIR || '.baileys_auth');
}

function printQr(qr) {
  try {
    require('qrcode-terminal').generate(qr, { small: true });
  } catch {
    console.log('(install qrcode-terminal for a scannable QR)\n' + qr);
  }
  console.log('\nScan the QR above: WhatsApp → Settings → Linked devices → Link a device\n');
}

async function createSocket() {
  let baileys;
  try {
    baileys = require('baileys');
  } catch {
    throw new Error('DELIVERY_PROVIDER=baileys requires the optional dependency — run `npm install baileys qrcode-terminal`');
  }
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

  const dir = authDir();
  const { state, saveCreds } = await useMultiFileAuthState(dir);

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  const sock = makeWASocket({ auth: state, version, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) printQr(qr);
    if (connection === 'open') {
      isOpen = true;
      openWaiters.forEach((resolve) => resolve());
      openWaiters = [];
      console.log('[delivery:baileys] Connected to WhatsApp.');
    }
    if (connection === 'close') {
      isOpen = false;
      socketPromise = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason?.loggedOut) {
        console.error(`[delivery:baileys] Logged out. Delete ${dir} and run \`npm run whatsapp:login\` again.`);
      } else {
        console.warn('[delivery:baileys] Connection closed — it will reconnect on the next send.');
      }
    }
  });
  return sock;
}

function getSocket() {
  if (!socketPromise) socketPromise = createSocket();
  return socketPromise;
}

function waitUntilOpen(timeoutMs) {
  if (isOpen) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('WhatsApp is not connected yet — run `npm run whatsapp:login` and scan the QR, then retry.')),
      timeoutMs
    );
    openWaiters.push(() => { clearTimeout(timer); resolve(); });
  });
}

module.exports = {
  name: 'baileys',
  async send({ to, name, link }) {
    const phone = formatPhoneNumber(to);
    if (!phone) throw new Error('The baileys provider needs a phone number to send to');

    const sock = await getSocket();
    await waitUntilOpen(Number(process.env.BAILEYS_CONNECT_TIMEOUT) || 60000);

    const jid = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: buildMessage({ name, link }) });
    return { ok: true, jid };
  }
};
