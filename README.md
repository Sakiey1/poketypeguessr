## PoketypeGuessr

Real-time 2-player Pokemon dual-type guessing game built with Next.js + Socket.io on a custom Node server.

## Local Development

Install dependencies and run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Node.js `20.9+` is required.

## Railway Deployment (One-Click Ready)

This repo includes Railway-ready config:

- `railway.json` with build and start commands
- `Procfile` fallback process definition
- production start script (`npm run start`)

### Deploy Steps

1. Push this repo to GitHub.
2. In Railway, click **New Project** -> **Deploy from GitHub Repo**.
3. Select this repository.
4. Railway should auto-detect Node and use:
   - Build: `npm install && npm run build`
   - Start: `npm run start`
5. Once deployed, open the generated Railway domain.

### Notes

- The server binds to Railway's `PORT` automatically via `server.js`.
- Room/game state is in-memory, so it resets on redeploy or restart.
- For production multiplayer reliability, run a single instance (or add shared state/adapter later).
