# LUMA Website

Production frontend: https://website-umber-xi-40.vercel.app/

Production backend API: https://website-ikv5.onrender.com/api

Admin routes:
- Public `/admin` and `/admin/*` routes must render Forbidden.
- Hidden admin login: `/luma-control-room/login`
- Hidden admin dashboard: `/luma-control-room/dashboard`

Deployment environment notes:
- Frontend `VITE_API_URL` should be `https://website-ikv5.onrender.com/api`.
- Backend `FRONTEND_URL` should be `https://website-umber-xi-40.vercel.app`.
- Backend `PAYSTACK_CALLBACK_URL` should be `https://shopwithluma.com/payment/paystack/callback`.
- Paystack webhook URL: `https://website-ikv5.onrender.com/api/webhooks/paystack`.
- Verified orders open `/order-success/:orderId`; the shareable tracking page is `/track-order/:orderId`.
- Supabase auth redirect URLs should include `https://website-umber-xi-40.vercel.app/account` if Supabase OAuth is enabled.
