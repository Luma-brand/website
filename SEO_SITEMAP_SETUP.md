# LUMA sitemap and indexing setup

## Production URLs

- Sitemap: `https://shopwithluma.com/sitemap.xml`
- Robots: `https://shopwithluma.com/robots.txt`

The frontend build generates both files in `frontend/public`. Vite copies them
into the production deployment root, so they are served directly by Vercel.
The backend `/sitemap.xml` and `/robots.txt` endpoints remain available as a
fallback, but the frontend no longer depends on a cross-service rewrite for
these two critical crawl files.

## What is indexed

Verified public routes included in the sitemap:

- `/`
- `/products`
- `/products/:slug` (one URL for each public active product returned by the API)
- `/about`
- `/contact`
- `/privacy-policy`
- `/terms-and-conditions`

The homepage FAQ is an on-page section rather than a standalone route, so it
uses the homepage URL and is not duplicated in the sitemap.

Transactional, authentication, customer, callback, admin, and unknown routes
are excluded from the sitemap and receive `noindex, nofollow` metadata in the
React application. `robots.txt` also discourages crawling those route groups.

## Generation

From the frontend directory:

```powershell
npm.cmd run generate:sitemap
npm.cmd run build
```

The normal build already runs sitemap generation first. The generator:

1. Uses `SITE_URL`, `PUBLIC_SITE_URL`, `APP_URL`, or `VITE_SITE_URL` when valid.
2. Falls back to `https://shopwithluma.com` and rejects localhost/non-HTTPS sitemap origins.
3. Fetches the public products endpoint using `SITEMAP_API_URL`, `API_URL`,
   `BACKEND_URL`, `VITE_API_URL`, or `VITE_API_BASE_URL`.
4. Falls back to the backend URL already used by this project.
5. Includes only active public products, using the existing `/products/:slug`
   route with product ID as the API-supported fallback.
6. Continues with verified static routes if the product API is unavailable.

Recommended Vercel environment values:

```text
VITE_SITE_URL=https://shopwithluma.com
SITEMAP_API_URL=https://website-ikv5.onrender.com/api
```

Keep the backend `FRONTEND_URL=https://shopwithluma.com` so its fallback SEO
endpoints and product feed use the same canonical domain.

## Verification

After deployment, open both production URLs and confirm:

- The sitemap response begins with the XML declaration.
- Every `<loc>` uses `https://shopwithluma.com`.
- Product URLs open successfully and contain no admin/draft products.
- `robots.txt` points to `https://shopwithluma.com/sitemap.xml`.
- Neither file is returning the React `index.html` shell.

If `/sitemap.xml` returns 404, confirm `frontend/public/sitemap.xml` exists in
the build output and that Vercel deployed from the `frontend` directory. If the
generator reports a product fetch failure, confirm `SITEMAP_API_URL` is a
reachable backend API base ending in `/api`. Static routes will still be
generated. Duplicate canonical tags indicate that another SEO component was
added outside the existing `PageSeo` implementation.

## Google Search Console

1. Verify the `shopwithluma.com` domain property.
2. Open **Indexing → Sitemaps**.
3. Submit `sitemap.xml`.
4. Inspect the homepage, products page, and several product URLs.
5. Request indexing after confirming each URL reports the intended canonical.

