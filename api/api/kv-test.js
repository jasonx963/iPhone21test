import { kv } from '@vercel/kv';

// /api/kv-test?action=set&key=foo&value=bar
// /api/kv-test?action=get&key=foo
export default async function handler(req, res) {
  try {
    const { action, key, value } = req.query;

    if (!action || !key) {
      return res.status(400).json({
        ok: false,
        message: 'Usage: /api/kv-test?action=set|get&key=<k>&value=<v>',
      });
    }

    if (action === 'set') {
      await kv.set(key, value ?? '');
      const got = await kv.get(key);
      return res.status(200).json({ ok: true, action, key, saved: value ?? '', got });
    }

    if (action === 'get') {
      const got = await kv.get(key);
      return res.status(200).json({ ok: true, action, key, got });
    }

    return res.status(400).json({ ok: false, message: 'action must be set or get' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
