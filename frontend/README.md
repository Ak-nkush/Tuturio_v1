# Tuturio Frontend

React + Vite + Tailwind CSS frontend for the Tuturio tutor-parent communication platform.

## Stack

- **React 19** with **Vite 8**
- **JavaScript (JSX)**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **React Router** for navigation

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the landing page.

## Project structure (module-based)

```
src/
├── components/       # Shared UI (layout, landing sections)
├── hooks/            # Reusable hooks
├── modules/          # Feature modules aligned with product spec
│   └── auth/         # Module 1: Authentication & Onboarding
├── pages/            # Top-level route pages
├── routes/           # React Router configuration
└── styles/           # Global and page-specific styles
```

### Module roadmap

| Module | Feature |
|--------|---------|
| 1 | Authentication & Onboarding |
| 2 | Batch & Subject Management |
| 3 | Attendance |
| 4 | Communication |
| 5 | Notes & Resource Sharing |
| 6 | Progress Tracking & Analytics |
| 7 | Notifications |
| 8 | Parent Dashboard |

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — run oxlint
