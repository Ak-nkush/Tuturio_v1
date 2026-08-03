# Module 1 — Authentication & Onboarding (Locked Decisions)

This document locks product and engineering decisions for Tuturio Module 1. It merges the original spec, data dictionary, gap analysis, and edge-case handling.

---

## Product decisions

| # | Topic | Decision |
|---|--------|----------|
| 1 | Tutor registration | **No public tutor signup.** One tutor account seeded at deploy (script/env/CLI). Login only. |
| 2 | Invite URL | `/invite/:code` where `code` = `invites.code`. No `inviteId` in URL. |
| 2 | Invite expiry | **Default 7 days.** Tutor may optionally shorten when generating (simple toggle in v1). |
| 2 | Single-use | **One invite per person, single-use** (`used: true` on redeem). Fresh link per student/parent. |
| 3 | Parent–child link | **Encoded on invite** via `linkedStudentId` (parent-role invites). No post-hoc email/name matching. |
| 3 | Parent before student | Tutor creates pending enrollment; generates both invites upfront. |
| 3 | Multiple children | **Same email → same parent account.** Second invite appends to `linkedStudentIds`; prompt login if email exists. |
| 4 | Password | **Min 16 characters**, live client validator + server enforcement. |
| 4 | JWT | **Access (15 min) + refresh (7 days)** in **httpOnly cookies**. |
| 5 | Forgot password | Standard reset flow. **Resend** for production email. Dev: stub UI + log reset link to console. |
| 6 | Post-login routes | Stub `/tutor/dashboard`, `/student/dashboard`, `/parent/dashboard` — role-gated, placeholders until Modules 2/8. |

---

## Schema changes (applied in code)

### `users`

| Field | Type | Notes |
|-------|------|-------|
| `email` | String | **Required**, unique index, stored lowercase/trimmed |
| `status` | String | `active` \| `archived` |
| `tokenVersion` | Number | Increment to revoke all sessions |
| `linkedParentIds` | `[String]` | Replaces singular `linkedParentId` |
| `linkedStudentIds` | `[String]` | Parent → children |
| `failedLoginAttempts` | Number | Optional lockout |
| `lockedUntil` | Date | Optional lockout |
| `passwordResetTokenHash` | String | Hashed reset token |
| `passwordResetExpiresAt` | Date | Reset token expiry |

### `invites`

| Field | Type | Notes |
|-------|------|-------|
| `linkedStudentId` | String | Required when `role = parent` |
| `email` | String | Optional; if set, redeeming email must match |
| `revoked` | Boolean | Set when batch archived |

---

## API contract (Module 1)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | Public | Login; sets httpOnly cookies |
| POST | `/api/auth/logout` | Optional | Clears cookies |
| POST | `/api/auth/refresh` | Cookie | New access token |
| GET | `/api/auth/me` | Cookie | Current user |
| POST | `/api/auth/forgot-password` | Public | Always generic success response |
| POST | `/api/auth/reset-password` | Public | Reset with token |
| GET | `/api/invites/:code` | Public | Validate invite (410 expired, 409 used) |
| POST | `/api/invites/:code/redeem` | Optional | Register or enroll (atomic) |
| POST | `/api/invites` | Tutor | Generate invite link |

---

## Edge cases → implementation

### Invite links

| Case | Response / behavior |
|------|---------------------|
| Expired | `410` `{ reason: "expired" }` |
| Used | `409` `{ reason: "used" }` |
| Revoked / batch inactive | `410` `{ reason: "batch_unavailable" }` |
| Wrong role logged in | UI: prompt logout before redeeming |
| Same role, existing account | Skip register; redeem enrolls only |
| Race on redeem | Atomic `findOneAndUpdate({ used: false, ... })` |

### Registration & login

| Case | Fix |
|------|-----|
| Duplicate email | Unique index; clear role-specific error |
| Archived user | `403` `{ reason: "account_archived" }` after password check |
| Brute force | Rate limit ~5 attempts / 15 min per IP+email |
| Email case | `trim().toLowerCase()` shared helper |

### Password reset

| Case | Fix |
|------|-----|
| Unknown email | Same success message always |
| Token reuse | Clear hash after use; overwrite on new request |
| Expired token | Explicit error + re-request link |

### Session

| Case | Fix |
|------|-----|
| Stolen refresh / password change | Bump `tokenVersion` |
| Logout | Clear httpOnly cookies (v1: no version bump) |

---

## Priority: must-fix vs defer

### Must-fix before Module 1 complete

- Distinct invite states (valid / expired / used / batch unavailable)
- Atomic invite redemption
- Email normalization + unique index
- Archived user login block
- Login rate limiting (basic)
- Password reset privacy + single active token
- httpOnly cookie auth + refresh pair
- Role-gated dashboard stubs
- Landing CTAs: student/parent invite-only; tutor login-only

### Defer

- Age/minor gating
- Cascade-revoke invites on batch archive (check-on-redeem sufficient)
- Co-parent UI (schema supports `linkedParentIds[]`)
- “No parent linked” tutor flag (Module 2 UI)
- Real Resend email (dev console stub OK initially)

---

## Landing page CTA mapping

| CTA | Route |
|-----|-------|
| Student — Join my batch | `/auth/login` (invite link from tutor) |
| Tutor — Set up my batch | `/auth/login` |
| Parent — See progress | `/auth/login` |
| Footer — Create account | `/auth/login` (tutor only; no public register) |

Students/parents receive `/invite/:code` from the tutor directly.

---

## Build order

1. Seed tutor + schema
2. Auth API (login, refresh, logout, me)
3. Invite API (validate + atomic redeem)
4. Register via invite (student/parent only)
5. Forgot/reset password (stub email in dev)
6. Frontend auth pages + protected route stubs
