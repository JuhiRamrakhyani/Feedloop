// Optional URL shortener — turned OFF by default so the WhatsApp link opens
// directly in the browser (a shortened URL first bounces through the
// shortener's site before reaching the form). Set URL_SHORTENER=tinyurl
// (or isgd) to enable. Best-effort: any failure falls back to the full link.

const SHORTENER = (process.env.URL_SHORTENER || 'off').toLowerCase();
const SHORTENER_TIMEOUT = Number(process.env.URL_SHORTENER_TIMEOUT) || 5000;

const PROVIDERS = {
  isgd: (url) => ({ url: 'https://is.gd/create.php', params: { format: 'simple', url } }),
  tinyurl: (url) => ({ url: 'https://tinyurl.com/api-create.php', params: { url } })
};

async function shortenUrl(longUrl) {
  if (SHORTENER === 'off' || !/^https?:\/\//.test(String(longUrl || ''))) return longUrl;
  const provider = PROVIDERS[SHORTENER];
  if (!provider) return longUrl;

  try {
    const { url, params } = provider(longUrl);
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`, { signal: AbortSignal.timeout(SHORTENER_TIMEOUT) });
    if (!res.ok) return longUrl;
    const text = (await res.text()).trim();
    if (!/^https?:\/\//.test(text)) return longUrl;
    return text;
  } catch (err) {
    console.warn(`[shorten] ${SHORTENER} failed (${err.message}); sending the full link.`);
    return longUrl;
  }
}

module.exports = { shortenUrl };