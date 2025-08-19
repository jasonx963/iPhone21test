// /api/feed.js
import { kv } from '@vercel/kv';

const INDEX_ALL = 'orders:index';

// 手机号脱敏：保留前3后2
const maskPhone = (p='') => {
  const s = (p || '').replace(/\s+/g, '');
  if (s.length <= 5) return '※'.repeat(s.length);
  return s.slice(0,3) + '※'.repeat(Math.max(0, s.length - 5)) + s.slice(-2);
};
// 运单号脱敏：保留后4
const maskTracking = (t='') => {
  const s = (t || '').toString();
  if (!s) return '';
  const last = s.slice(-4);
  return '※'.repeat(Math.max(0, s.length - 4)) + last;
};

export default async function handler(req, res) {
  try {
    const ids = (await kv.smembers(INDEX_ALL)) || [];
    const items = (await Promise.all(ids.map(id => kv.get(`order:${id}`)))).filter(Boolean);

    // 最新在前，取最近 20 条
    items.sort((a,b)=> (b?.updatedAt||'').localeCompare(a?.updatedAt||''));
    const top = items.slice(0, 20).map(o => ({
      orderId: o.orderId,
      name: o.name || '客户',
      phoneMasked: maskPhone(o.phone),
      product: o.product,
      color: o.color || '',
      qty: Number(o.qty || 1),
      price: o.price,
      status: o.status,
      carrier: o.carrier || '',
      trackingMasked: maskTracking(o.tracking),
      updatedAt: o.updatedAt,
    }));

    res.json({ ok:true, items: top });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
}
