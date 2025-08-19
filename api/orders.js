// /api/orders.js
import { kv } from '@vercel/kv';

/**
 * 存储结构
 * - 订单详情：key = order:<orderId>  => { ...data }
 * - 全量索引：set  = orders:index     => [orderId, ...]
 * - 手机索引：set  = orders:by_phone:<normalizedPhone> => [orderId, ...]
 *
 * 权限：
 * - 创建/更新/删除/列出所有：需要 X-Admin-Token 与 process.env.ADMIN_TOKEN 一致
 * - 查询（按 orderId / phone）：不需要 token（给前端查询用）
 */

const INDEX_ALL = 'orders:index';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const normPhone = (p = '') => (p || '').toString().replace(/\s+/g, ''); // 去空格
const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export default async function handler(req, res) {
  try {
    const method = req.method;
    const token = req.headers['x-admin-token'];

    // --------- GET：查询 ----------
    if (method === 'GET') {
      const { orderId, phone, list } = req.query || {};

      // 管理员列出所有（可选）
      if (list === 'true') {
        if (token !== ADMIN_TOKEN) {
          return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        const ids = (await kv.smembers(INDEX_ALL)) || [];
        // 你也可以用 kv.mget(ids.map(id => `order:${id}`));
        const items = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
        return res.json({ ok: true, count: items.length, items: items.filter(Boolean) });
      }

      // 按 orderId 查
      if (orderId) {
        const item = await kv.get(`order:${orderId}`);
        return res.json(item ? [item] : []);
      }

      // 按手机号查
      if (phone) {
        const setKey = `orders:by_phone:${normPhone(phone)}`;
        const ids = (await kv.smembers(setKey)) || [];
        const items = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
        return res.json(items.filter(Boolean));
      }

      // 没给查询条件
      return res.status(400).json({ ok: false, error: 'need orderId or phone or list=true' });
    }

    // 下面的操作都需要管理员 token
    if (token !== ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    // 解析 body
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = (body.orderId || '').toString().trim();
    if (!id) return res.status(400).json({ ok: false, error: 'orderId required' });

    // --------- POST/PUT：创建或更新 ----------
    if (method === 'POST' || method === 'PUT') {
      const key = `order:${id}`;

      // 读取老订单，处理更换手机号时的索引清理
      const old = await kv.get(key);

      const data = {
        ...old,
        ...body,
        updatedAt: nowIso(),
      };

      await kv.set(key, data);
      await kv.sadd(INDEX_ALL, id);

      // 维护手机号索引
      if (old?.phone && normPhone(old.phone) !== normPhone(data.phone || '')) {
        await kv.srem(`orders:by_phone:${normPhone(old.phone)}`, id);
      }
      if (data.phone) {
        await kv.sadd(`orders:by_phone:${normPhone(data.phone)}`, id);
      }

      return res.json({ ok: true, orderId: id });
    }

    // --------- DELETE：删除 ----------
    if (method === 'DELETE') {
      const key = `order:${id}`;
      const old = await kv.get(key);

      await kv.del(key);
      await kv.srem(INDEX_ALL, id);
      if (old?.phone) {
        await kv.srem(`orders:by_phone:${normPhone(old.phone)}`, id);
      }

      return res.json({ ok: true, deleted: id });
    }

    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
