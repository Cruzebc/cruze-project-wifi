# Production checklist

## Security
- [ ] Set a long random JWT_SECRET.
- [ ] Change ADMIN_PASSWORD immediately.
- [ ] Use HTTPS.
- [ ] Restrict RouterOS API to the billing server IP.
- [ ] Do not expose PostgreSQL publicly.
- [ ] Rotate M-Pesa credentials if exposed.
- [ ] Back up PostgreSQL.

## MikroTik
- [ ] Confirm RouterOS 7.24.2.
- [ ] Confirm hotspot and ISPMan/RADIUS ownership.
- [ ] Confirm the billing server can reach API port.
- [ ] Test with one customer before mass rollout.
- [ ] Confirm speed enforcement and expiry.

## M-Pesa
- [ ] Configure Daraja production credentials.
- [ ] Register a public HTTPS callback URL.
- [ ] Test successful payment.
- [ ] Test cancelled payment.
- [ ] Test duplicate callback.
- [ ] Verify amount/package cannot be manipulated by the client.

## Operations
- [ ] Configure daily database backup.
- [ ] Monitor `/health`.
- [ ] Review audit logs.
- [ ] Test rollback.
