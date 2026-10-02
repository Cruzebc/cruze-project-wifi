# Cruze Wi-Fi Billing — Vercel deployment

This project is prepared to keep the source code in GitHub while Vercel hosts the web/API application. Vercel supports Express deployments, and this project keeps `src/server.js` as the local launcher while `src/app.js` exports the Express app for the hosted runtime.

## 1. Push this folder to GitHub

Commit the whole project, including `package.json`, `prisma/`, `src/`, `public/`, and `vercel.json`. Do **not** commit `.env` or real credentials.

## 2. Import the repository into Vercel

In Vercel: **Add New → Project → Import Git Repository**, select the GitHub repository, and deploy. Vercel can deploy Express apps without a custom framework adapter.

## 3. Add the database

Vercel does not run the `docker-compose.yml` PostgreSQL container. Use a hosted PostgreSQL database (for example Prisma Postgres, Neon, Supabase, or another PostgreSQL provider) and add its `DATABASE_URL` to Vercel Environment Variables.

After the first install/build, run the Prisma schema against that database from a trusted development machine or CI: `npx prisma db push`. Then seed once with `npm run db:seed` if desired.

## 4. Add Vercel environment variables

Add every variable in `.env.example` to **Project → Settings → Environment Variables**. Never put passwords or M-Pesa secrets in GitHub.

## 5. M-Pesa callback

Set `MPESA_CALLBACK_URL` to the deployed HTTPS URL ending in `/api/payments/callback`. The callback route is public because Safaricom must reach it.

## 6. MikroTik connectivity

A Vercel function runs outside your LAN. It cannot directly connect to `10.x.x.x`, `192.168.x.x`, or other private MikroTik addresses. For production, use one of these designs:

- a secure VPN/tunnel between the Vercel-accessible service and the router; or
- a small always-on **Cruze MikroTik Agent** inside the LAN that polls the billing backend and performs RouterOS API operations; or
- a carefully secured public RouterOS REST endpoint with a valid certificate and restricted firewall rules.

Do not expose RouterOS REST to the entire internet.

## 7. Expiry

The MikroTik hotspot user created by the billing engine receives `limit-uptime` and optional `limit-bytes-total`, so the router itself enforces package expiry/data limits. The `/api/cron/expire` endpoint is available for database cleanup.

Vercel Hobby cron jobs are limited to once per day. For minute-level cleanup, use Vercel Pro or an external scheduler to call `/api/cron/expire` with `Authorization: Bearer $CRON_SECRET`.

## 8. If Vercel still shows 500

Open **Vercel → Project → Deployments → Functions/Runtime Logs** and inspect the first exception. The previous package had a missing `dotenv` dependency; this Vercel-ready version includes it and moves the server listener out of the hosted app module.
