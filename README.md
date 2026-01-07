# Happy Server Light

Lightweight self-hosted backend for Happy, designed for personal use (e.g. over Tailscale).

Use with [Happy Local](https://github.com/leeroybrun/happy-local) to easily setup and run the whole Happy stack locally on your computer and connect to it from anywhere (including mobile) using Tailscale.

## What this is

`happy-server-light` is a fork of `slopus/happy-server` with a much smaller deployment footprint:

- **SQLite** instead of Postgres (single local file)
- **No Redis**
- **Local file storage** served from the same process under `GET /files/*` (no S3/Minio)

The API surface stays compatible with the Happy mobile app + `happy-cli` (HTTP + Socket.IO at `/v1/updates`).

## What you “lose” vs full happy-server

- **Horizontal scaling** (it’s intended to run as a single instance for one person/small group)
- Operational features that assume managed infrastructure (Redis/S3)

## Quick start

```bash
yarn install
yarn dev
```

The first run will:
- create/update the SQLite schema (`prisma db push`)
- generate `HANDY_MASTER_SECRET` if missing

By default, data is stored under:
- `~/.happy/server-light/happy-server-light.sqlite`
- `~/.happy/server-light/files/*`
- `~/.happy/server-light/handy-master-secret.txt`

## Connecting clients

- **Mobile app**: Settings → Server Configuration → set your server URL (e.g. `http://<tailscale-ip>:3005`)
- **happy-cli**: set `HAPPY_SERVER_URL` to your local server URL

## Dokploy Deployment

1. In Dokploy: **Create Service → Compose**
2. Paste `docker-compose.yml` content
3. Environment tab: set `PUBLIC_URL=https://your-domain.com`
4. Domains tab: add domain, set port `3000`
5. Deploy

The `../files/data` volume persists database and files automatically.

## License

MIT - Use it, modify it, deploy it anywhere.
