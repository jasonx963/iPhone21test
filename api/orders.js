import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const method = req.method;
  const adminToken = process.env.ADMIN_TOKEN;
  const normalizePhone = (p = '') => p.replace(/\s+/g, '');

  if (method === 'POST') {
    if (req.headers['x-admin-token'] !== adminToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!data.orderId) return res.status(400).json({ error: 'orderId required' });
    data.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await kv.hset(`order:${data.orderId}`, data);
    if (data.phone) await kv.sadd(`orders_by_phone:${normalizePhone(data.phone)}`, data.orderId);
    return res.json({ ok: true, orderId: data.orderId });
  }

  if (method === 'PUT') {
    if (req.headers['x-admin-token'] !== adminToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const id = req.query.orderId;
    const patch = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    patch.orderId = id;
    patch.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const prev = await kv.hgetall(`order:${id}`) || {};
    const next = { ...prev, ...patch };
    await kv.hset(`order:${id}`, next);
    if (next.phone) await kv.sadd(`orders_by_phone:${normalizePhone(next.phone)}`, id);
    return res.json({ ok: true, orderId: id });
  }

  if (method === 'GET') {
    const { orderId, phone } = req.query;
    let ids = [];
    if (orderId) {
      ids = [orderId];
    } else if (phone) {
      ids = await kv.smembers(`orders_by_phone:${normalizePhone(phone)}`);
    } else {
      return res.json([]); // 避免全表扫描
    }
    const orders = [];
    for (const id of ids) {
      const o = await kv.hgetall(`order:${id}`);
      if (o) orders.push(o);
    }
    return res.json(orders);
  }

  res.setHeader('Allow', 'GET,POST,PUT');
  return res.status(405).json({ error: 'method not allowed' });
}
