// /api/orders.js
import { kv } from '@vercel/kv';

const INDEX_ALL = 'orders:index';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const normPhone = (p = '') => (p || '').toString().replace(/\s+/g, '');
const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// 生成不重复订单号：ORD20250819-000123
async function genOrderId() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  const counter = await kv.incr(`orders:counter:${y}${m}${da}`);
  return `ORD${y}${m}${da}-${String(counter).padStart(6,'0')}`;
}

export default async function handler(req, res) {
  try {
    const method = req.method;
    const token = req.headers['x-admin-token'];

    // ------- GET：前端查询 -------
    if (method === 'GET') {
      const { orderId, phone, list } = req.query || {};
      if (list === 'true') {
        if (token !== ADMIN_TOKEN) return res.status(401).json({ ok:false, error:'unauthorized' });
        const ids = (await kv.smembers(INDEX_ALL)) || [];
        const items = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
        return res.json({ ok:true, count: items.length, items: items.filter(Boolean) });
      }
      if (orderId) {
        const item = await kv.get(`order:${orderId}`);
        return res.json(item ? [item] : []);
      }
      if (phone) {
        const setKey = `orders:by_phone:${normPhone(phone)}`;
        const ids = (await kv.smembers(setKey)) || [];
        const items = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
        return res.json(items.filter(Boolean));
      }
      return res.status(400).json({ ok:false, error:'need orderId or phone or list=true' });
    }

    // 下面操作需管理员
    if (token !== ADMIN_TOKEN) return res.status(401).json({ ok:false, error:'unauthorized' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let id = (body.orderId || '').toString().trim();

    // ------- POST/PUT：新建或更新 -------
    if (method === 'POST' || method === 'PUT') {
      // 若未传订单号，则系统生成
      if (!id) id = await genOrderId();
      const key = `order:${id}`;

      const old = await kv.get(key);
      const data = { ...old, ...body, orderId: id, updatedAt: nowIso() };

      await kv.set(key, data);
      await kv.sadd(INDEX_ALL, id);

      if (old?.phone && normPhone(old.phone) !== normPhone(data.phone || '')) {
        await kv.srem(`orders:by_phone:${normPhone(old.phone)}`, id);
      }
      if (data.phone) {
        await kv.sadd(`orders:by_phone:${normPhone(data.phone)}`, id);
      }

      return res.json({ ok:true, orderId:id });
    }

    // ------- DELETE：删除 -------
    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ ok:false, error:'orderId required' });
      const key = `order:${id}`;
      const old = await kv.get(key);

      await kv.del(key);
      await kv.srem(INDEX_ALL, id);
      if (old?.phone) {
        await kv.srem(`orders:by_phone:${normPhone(old.phone)}`, id);
      }
      return res.json({ ok:true, deleted:id });
    }

    return res.status(405).json({ ok:false, error:'method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok:false, error:String(err?.message ?? err) });
  }
}
