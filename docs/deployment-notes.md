# Deployment Notes

Current production frontend:

https://website-umber-xi-40.vercel.app/

Current production backend API:

https://website-ikv5.onrender.com/api

Required production environment values:

- Frontend `VITE_API_URL=https://website-ikv5.onrender.com/api`
- Backend `FRONTEND_URL=https://website-umber-xi-40.vercel.app`
- Backend `PAYSTACK_CALLBACK_URL=https://website-umber-xi-40.vercel.app/order-success`

Admin routing contract:

- `/admin` renders Forbidden.
- `/admin/*` renders Forbidden.
- `/luma-control-room/login` is the admin login route.
- `/luma-control-room/dashboard` is the admin dashboard route.

Supabase notes:

- If Supabase OAuth is enabled, add `https://website-umber-xi-40.vercel.app/account` to allowed redirect URLs.
- Local development may also use `http://localhost:5173/account`.

CORS notes:

- The backend allows `FRONTEND_URL`, optional `FRONTEND_URL_2`, localhost development origins, and Vercel preview deployments.
- Production should still set `FRONTEND_URL` to the current production frontend, even if the Vercel preview regex currently permits the request.
