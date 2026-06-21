// BYO-key Whisper proxy: browser → here → OpenAI-compatible /audio/transcriptions.
// Key is NOT stored server-side — client sends per request (localStorage).

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

function apiErrorMessage(json) {
  if (!json) return 'upstream error';
  if (typeof json.error === 'string') return json.error;
  if (json.error && typeof json.error.message === 'string') return json.error.message;
  if (typeof json.message === 'string') return json.message;
  return 'upstream error';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

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
  const model = typeof body.model === 'string' ? body.model : 'whisper-1';
  const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

  if (!baseUrl || !apiKey || !audioBase64) {
    res.status(400).json({ error: 'missing baseUrl, apiKey, or audioBase64' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    form.append('file', blob, mimeType.indexOf('webm') >= 0 ? 'audio.webm' : 'audio.mp4');
    form.append('model', model);

    const upstream = await fetch(baseUrl + '/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: form,
      signal: controller.signal
    });
    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { error: 'upstream returned non-JSON', raw: text.slice(0, 500) }; }
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: apiErrorMessage(json) });
      return;
    }
    res.status(200).json({ text: json.text || '' });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? 'upstream timeout' : ('proxy error: ' + (e && e.message)) });
  } finally {
    clearTimeout(timeout);
  }
};
