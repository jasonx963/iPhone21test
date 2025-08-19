# iPhone PDD Starter (Vercel)

## Quick start
1. Import this repo to Vercel.
2. In Vercel → **Storage**: create **KV** and attach to this project.
3. In Vercel → **Environment Variables** add:
   - `ADMIN_TOKEN` = your strong password (used by admin.html)
   - `DHL_API_KEY` = your DHL API key
   - `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` (from step 2)
4. Deploy.

## Use
- Open `/admin.html`, enter Admin Token once, create or update orders.
- Frontend `/` (index.html) → Centro de pedidos → query by orderId or phone.
- If order has `carrier=DHL` and `tracking`, it will fetch `/api/track` for live events.
