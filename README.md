# Tuturio local development

## One-command local app

Use either MongoDB Atlas or a locally running MongoDB service, and set its
connection string in `backend/.env`. Docker is not required.

From the `backend` directory, run:

```bash
npm run dev:local
```

This starts the API on port 5000 and the React app on port 5173.

To start the application and run the end-to-end API checks in one command, run:

```bash
npm run verify:local
```

Copy `backend/.env.example` to `backend/.env` before first use. Local development uses private local file storage; production requires Cloudinary credentials and `STORAGE_PROVIDER=cloudinary`.

To send invite emails to Gmail, set `SMTP_HOST=smtp.gmail.com`, `SMTP_USER` to the sending Gmail address, and `SMTP_PASSWORD` to a Gmail **App Password** (not the normal Gmail password). Restart the API after saving.

If Docker Desktop is installed, `npm run dev:docker` starts MongoDB from the repo-root `docker-compose.yml`, then runs the API and frontend.

## Production

- Set `NODE_ENV=production`, `STORAGE_PROVIDER=cloudinary`, and Cloudinary credentials.
- Optionally set `FILE_SCAN_URL` so uploads are POSTed to an HTTP scanner and rejected unless that endpoint returns 2xx.
- Serve the frontend build behind HTTPS and point `CLIENT_URL` at the public app origin.
