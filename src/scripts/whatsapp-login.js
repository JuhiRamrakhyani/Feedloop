// One-time WhatsApp pairing for the Baileys provider.
// Run: npm run whatsapp:login   then scan the QR with the phone you'll send from.
// Credentials are saved to BAILEYS_AUTH_DIR (default .baileys_auth, gitignored).

require('dotenv').config();
const path = require('path');
const qrcode = require('qrcode-terminal');

(async () => {
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
  const dir = path.resolve(process.env.BAILEYS_AUTH_DIR || '.baileys_auth');
  const { state, saveCreds } = await useMultiFileAuthState(dir);

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  const sock = makeWASocket({ auth: state, version, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('\nScan the QR above: WhatsApp → Settings → Linked devices → Link a device\n');
    }
    if (connection === 'open') {
      console.log(`✔ WhatsApp connected. Session saved to ${dir}`);
      console.log('Start the app and set DELIVERY_PROVIDER=baileys to send for real.');
      setTimeout(() => process.exit(0), 1500);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason?.loggedOut) {
        console.error('Logged out. Delete the auth folder and run `npm run whatsapp:login` again.');
        process.exit(1);
      }
      console.log('Connection closed — reconnecting… (scan the new QR if prompted)');
    }
  });
})().catch((err) => {
  console.error('WhatsApp login failed:', err.message);
  process.exit(1);
});
