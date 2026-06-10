// Thin BYO-key proxy: browser → here → the user's OpenAI-compatible provider.
// Why a proxy: provider browser-CORS is unreliable (DeepSeek does not document
// it), and this keeps one robust path. The API key is NOT stored here — the
// client sends its own key per request (from localStorage). Same-origin only.

const ALLOWED_HOSTS = [
  'calendar.yiwang.dev',
  'calendar-demo.yiwang.dev',
  'localhost',
  '127.0.0.1'
];

function hostOf(value) {
  if (!value) return '';
  try { return new URL(value).host.split(':')[0]; } catch (e) { return String(value).split(':')[0]; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // Same-origin guard so this can't be used as an open relay.
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin) {
    const oh = hostOf(origin);
    const allowed = ALLOWED_HOSTS.some(h => oh === h || oh.endsWith('.' + h));
    if (!allowed) { res.status(403).json({ error: 'origin not allowed' }); return; }
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.replace(/\/+$/, '') : '';
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const model = typeof body.model === 'string' ? body.model : '';
  const messages = Array.isArray(body.messages) ? body.messages : null;

  if (!baseUrl || !apiKey || !model || !messages) {
    res.status(400).json({ error: 'missing baseUrl, apiKey, model, or messages' });
    return;
  }

  const payload = { model, messages, stream: false };
  if (typeof body.temperature === 'number') payload.temperature = body.temperature;
  if (body.response_format) payload.response_format = body.response_format;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { error: 'upstream returned non-JSON', raw: text.slice(0, 500) }; }
    res.status(upstream.status).json(json);
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? 'upstream timeout' : ('proxy error: ' + (e && e.message)) });
  } finally {
    clearTimeout(timeout);
  }
};
