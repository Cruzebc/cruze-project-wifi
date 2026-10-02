# CRUZE Wi-Fi Billing System

Premium MikroTik hotspot billing platform for Cruze networks.

## Included
- Admin dashboard and customer captive portal
- Package management: price, duration, data quota, speed, purchase limits
- Customer/account management
- M-Pesa Daraja STK Push integration hooks
- M-Pesa callback/webhook endpoint
- MikroTik RouterOS API integration
- Automatic package activation and expiry worker
- Speed control via MikroTik queues
- Voucher support
- Payments, transactions, sessions and audit logs
- System settings and maintenance controls
- Docker + PostgreSQL
- RouterOS setup and rollback scripts
- Health endpoint and API authentication
- Development SQLite fallback through Prisma

## Architecture

Customer -> Captive Portal -> Billing API -> M-Pesa
                                      |
                                      +-> MikroTik RouterOS API
                                      |
                                      +-> PostgreSQL

## Quick start

1. Copy `.env.example` to `.env`.
2. Put real secrets only in `.env` (never commit them).
3. Run:
   docker compose up -d --build
4. Open `http://YOUR_SERVER:8080`.
5. Default bootstrap admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
6. Run `mikrotik/setup.rsc` on a test router after reviewing the values at the top of the file.
7. Configure the captive portal redirect to the billing server.
8. Configure M-Pesa Daraja credentials and callback URL.
9. Verify `/health` and the Admin > System checks before accepting live payments.

## Production notes

- Use HTTPS/reverse proxy for the billing server.
- Use a dedicated MikroTik API user; do not use the main admin account.
- Restrict the RouterOS API to the billing server IP with firewall rules.
- Use PostgreSQL in production.
- Rotate JWT and M-Pesa secrets if they are ever exposed.
- The M-Pesa implementation is designed for Daraja and must be tested with your shortcode/till/paybill setup before production.
- Existing ISPMan/Cruze rules should be reviewed before applying `setup.rsc`; the script is intentionally conservative and does not delete existing hotspot configuration.

## API

Authentication:
`POST /api/auth/login`

Health:
`GET /health`

Packages:
`GET /api/packages`
`POST /api/packages`
`PATCH /api/packages/:id`
`DELETE /api/packages/:id`

Customers:
`GET /api/customers`
`POST /api/customers`

Payments:
`POST /api/payments/stk`
`POST /api/payments/callback`

MikroTik:
`GET /api/mikrotik/status`

System:
`GET /api/settings`
`PATCH /api/settings`

## Important

This repository is a complete deployable foundation and integration layer, but payment credentials, callback URL, exact MikroTik hotspot naming, and ISPMan/RADIUS policy are environment-specific and must be configured and tested on the actual network.

## MikroTik integration
The application uses the RouterOS 7 REST API over HTTPS. RouterOS documents REST as a JSON wrapper around its console API, with CRUD support for resources and POST support for console commands. The billing adapter uses HotSpot users, HotSpot active sessions and per-session HotSpot profiles for speed control. Review the generated profile strategy against your ISPMan/RADIUS policy before production.
