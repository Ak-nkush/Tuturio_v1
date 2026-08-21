# Tuturio Backend

Express + MongoDB API for Tuturio (Module 1: Auth & Onboarding).

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed:tutor   # requires MongoDB running
npm run dev
```

API runs at `http://localhost:5000`.

## Email delivery

In development, password-reset and invite emails are sent through a temporary
Ethereal account and a preview URL is printed in the backend console.

In production, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, and `EMAIL_FROM` in `.env`. The invite **Send email** action
then delivers the link to the recipient's address.

## Seed tutor

Creates one tutor account and a sample batch (single-tutor deployment model).

Default credentials (override in `.env`):

- Email: `tutor@tuturio.local`
- Password: `ChangeMeNow123456!` (min 16 chars)

## Module 1 endpoints

See [../docs/module-1-auth-decisions.md](../docs/module-1-auth-decisions.md).
