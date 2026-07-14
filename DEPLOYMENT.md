# Komerzio - Deployment & Secrets (example)

This file explains how to configure secrets and generate the sitemap safely. Do NOT commit secret keys into the repository.

1) Remove embedded secrets
- The repository previously contained Supabase keys in source files. Those have been removed from the code and replaced by runtime configuration.

2) Client-side config (public ANON key)
- Create a file on your server `/js/komerzio-config.js` (not committed to the repo) with the following content:

```js
window.KOMERZIO_CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key'
}
```

- Add `/js/komerzio-config.js` to `.gitignore` so it is never committed.

3) Server-side scripts (generate-sitemap.js)
- `generate-sitemap.js` now reads `SUPABASE_URL` and `SUPABASE_KEY` from environment variables.
- Locally you can create a `.env` file with the variables (see `.env.example`) and run:

```
node generate-sitemap.js
```

- In CI (GitHub Actions) or Cloudflare Jobs, add the secret `SUPABASE_KEY` and `SUPABASE_URL` to the secrets store.

4) Cloudflare Pages / Functions
- The serverless handler `functions/producto.html.js` reads Supabase credentials from the function environment bindings (e.g. `env.SUPABASE_URL`, `env.SUPABASE_ANON_KEY`).
- Configure those bindings in the Cloudflare Pages dashboard under "Environment Variables".

5) Rotate keys
- After removing keys from the repo, rotate/revoke the old keys in Supabase and create new ones.
- For client usage, use the ANON key with limited privileges and enable Row Level Security (RLS) on Supabase tables.
- For server scripts, use a Service Role key stored in CI/CD secrets (never in the repo).

If you want, I can prepare a GitHub Actions workflow to run `generate-sitemap.js` on a schedule and commit the resulting `sitemap.xml` to the repo (requires a secret `SUPABASE_KEY` in Actions).
