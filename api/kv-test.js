import { kv } from '@vercel/kv';

/**
 * 用法：
 * 1) 写入：/api/kv-test?action=set&key=foo&value=bar
 * 2) 读取：/api/kv-test?action=get&key=foo
 * 3) 删除：/api/kv-test?action=delete&key=foo
 * 4) 列表：/api/kv-test?action=list
 *    - 携带 withValues=true 可同时返回值：
 *      /api/kv-test?action=list&withValues=true
 *
 * 说明：
 * - 我们维护了一个索引集合 S（kv-test:index），set 时写入索引，delete 时移除。
 * - list 通过读取该索引集合来列出所有 key，避免使用 KEYS *。
 */
const INDEX_SET = 'kv-test:index';

export default async function handler(req, res) {
  try {
    const { action, key, value, withValues } = req.query;

    // 辅助：标准化 key
    const norm = (k) => (k ?? '').toString().trim();

    if (!action) {
      return res.status(400).json({
        ok: false,
        message:
          'Usage: /api/kv-test?action=set|get|delete|list&key=<k>&value=<v>',
      });
    }

    if (action === 'set') {
      const k = norm(key);
      if (!k) return res.status(400).json({ ok: false, message: 'key required' });

      await kv.set(k, value ?? '');
      await kv.sadd(INDEX_SET, k); // 维护索引
      const got = await kv.get(k);
      return res.json({ ok: true, action: 'set', key: k, saved: value ?? '', got });
    }

    if (action === 'get') {
      const k = norm(key);
      if (!k) return res.status(400).json({ ok: false, message: 'key required' });

      const got = await kv.get(k);
      return res.json({ ok: true, action: 'get', key: k, got: got ?? 'not found' });
    }

    if (action === 'delete') {
      const k = norm(key);
      if (!k) return res.status(400).json({ ok: false, message: 'key required' });

      await kv.del(k);
      await kv.srem(INDEX_SET, k); // 从索引移除
      return res.json({ ok: true, action: 'delete', key: k, deleted: true });
    }

    if (action === 'list') {
      const keys = (await kv.smembers(INDEX_SET)) ?? [];
      if (withValues === 'true') {
        const values = await Promise.all(keys.map((k) => kv.get(k)));
        const items = keys.map((k, i) => ({ key: k, value: values[i] ?? null }));
        return res.json({ ok: true, action: 'list', count: items.length, items });
      }
      return res.json({ ok: true, action: 'list', count: keys.length, keys });
    }

    return res.status(400).json({ ok: false, message: 'unknown action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
