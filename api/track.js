export default async function handler(req, res) {
  const { tracking } = req.query;
  const apiKey = process.env.DHL_API_KEY;
  if (!tracking) return res.status(400).json({ error: 'tracking required' });
  if (!apiKey)  return res.status(500).json({ error: 'DHL_API_KEY missing' });

  try {
    const r = await fetch(
      `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(tracking)}`,
      { headers: { 'DHL-API-Key': apiKey } }
    );
    const json = await r.json();
    return res.status(r.ok ? 200 : r.status).json(json);
  } catch (e) {
    return res.status(500).json({ error: 'dhl fetch failed', detail: String(e) });
  }
}
