// ═══════════════════════════════════════════════════════════
// The Path — Public Worker (SuttaCentral fetch only)
// ═══════════════════════════════════════════════════════════
// This Worker has NO API keys and NO AI proxy. Its only job is
// to fetch sutta text from SuttaCentral and return it with CORS
// headers so the site can render it in-page.
//
// Deploy this as its own Cloudflare Worker (free tier). It needs
// no secrets or environment variables.
// ═══════════════════════════════════════════════════════════

const SC_BASE = 'https://suttacentral.net/api';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    if (body.action === 'fetch_sutta') {
      return fetchSutta(body.uid);
    }

    return json({ error: 'Unsupported action' }, 400);
  }
};

async function fetchSutta(uid) {
  if (!uid || !/^[a-z]{1,4}\d/.test(uid)) {
    return json({ error: 'Invalid UID' }, 400);
  }

  // Try Bilara (Sujato) segmented translation first
  try {
    const res = await fetch(`${SC_BASE}/bilarasuttas/${uid}/sujato?lang=en`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ThePath/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.translation_text || data.translation) {
        return json({ type: 'bilara', uid, translation: data.translation_text || data.translation });
      }
    }
  } catch {}

  // Fall back to legacy Bodhi HTML translation
  try {
    const res = await fetch(`${SC_BASE}/suttas/${uid}/en/bodhi`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ThePath/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) return json({ type: 'html', uid, html: data.text });
    }
  } catch {}

  // Fall back to suttaplex metadata
  try {
    const res = await fetch(`${SC_BASE}/suttaplex/${uid}?lang=en`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ThePath/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : data;
      return json({ type: 'unavailable', uid, title: item?.translated_title || uid, blurb: item?.blurb || '' });
    }
  } catch {}

  return json({ error: 'Sutta not found: ' + uid }, 404);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}
