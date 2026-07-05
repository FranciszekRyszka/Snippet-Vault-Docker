# SnipVault (Docker)

A self-hosted prompt/snippet library — save, organize, and find your prompts with
syntax highlighting, tags, and fast SQLite-backed storage. This is the
**containerized web edition** of SnipVault, packaged to run as a single Docker
service with a persistent volume.

Built with **Next.js 16**, **React 19**, and **shadcn/ui**. This fork drops the
Tauri desktop shell and desktop-only features (in-app updater, database-location
picker, one-click backup) in favor of a stateless server + mounted volume.

## Quick start

```bash
docker compose up -d --build
```

Then open **http://localhost:3000**. Your prompts persist in the
`snipvault-data` Docker volume across restarts and rebuilds.

Stop it with `docker compose down` (add `-v` to also delete the data volume).

### Without compose

```bash
docker build -t snipvault:2.0.1 .
docker run -d --name snipvault \
  -p 3000:3000 \
  -v snipvault-data:/app/data \
  snipvault:2.0.1
```

## Authentication & multi-user

SnipVault is a **multi-user** app. Every request is gated by a session, and each
user has their own private library.

- **Sign-in methods:** email + password (hashed with bcrypt), and optionally
  **Google** and **GitHub** OAuth. Each OAuth button appears only when its
  client id/secret are configured, so password login works with zero extra setup.
- **Roles:** the first account created (or the address in `ADMIN_EMAIL`) becomes
  an **admin**. Admins get a dashboard at **`/admin`** to create, edit, disable,
  reset passwords for, and delete users.
- **Registration:** disabled by default (`ALLOW_SELF_REGISTRATION=false`) —
  admins create accounts. Set it to `true` to allow public self-signup.
- **Library sharing:** any user can share their whole library with another
  person by email, granting **read** or **write** access. Shared libraries show
  up under the "Shared with me" tab. Invites to people without an account yet
  apply automatically when they sign up.

### First run

1. Set at least `AUTH_SECRET` (and `AUTH_URL` in production) in `.env` — see
   `.env.example`.
2. Start the app and open `/signin`. Create the first account (temporarily set
   `ALLOW_SELF_REGISTRATION=true`, or set `ADMIN_EMAIL` and register once) — it
   becomes the admin. Any snippets from before auth was added are adopted by
   this admin.
3. From **`/admin`**, create accounts for everyone else.

> **Still add TLS for remote access.** Auth protects the data, but you should
> front the app with a reverse proxy (Caddy, nginx, Traefik) that terminates
> **HTTPS** before exposing it to the internet — sessions and passwords must not
> travel over plain HTTP.

## Data & persistence

- The SQLite database lives at `DATABASE_PATH` (default `/app/data/snippets.db`).
- `/app/data` is a Docker volume, so data survives `up`/`down`/rebuild.
- **Back up** by copying the volume, e.g.:
  ```bash
  docker run --rm -v snipvault-data:/data -v "$PWD":/backup busybox \
    tar czf /backup/snipvault-backup.tar.gz -C /data .
  ```
- To use a **host folder** instead of a named volume, edit `docker-compose.yml`:
  ```yaml
  volumes:
    - ./data:/app/data
  ```

## Configuration

| Variable                  | Default                 | Description                                                      |
| ------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `AUTH_SECRET`             | — (**required**)        | Secret used to sign session JWTs. `openssl rand -base64 32`.     |
| `AUTH_URL`                | `http://localhost:3000` | Public app URL; used to build OAuth callback URLs.               |
| `ADMIN_EMAIL`             | — (unset)               | Email granted admin. If unset, the first account becomes admin.  |
| `ALLOW_SELF_REGISTRATION` | `false`                 | Allow public self-signup of password accounts.                   |
| `AUTH_GOOGLE_ID` / `_SECRET` | — (unset)            | Enable Google login when both are set.                           |
| `AUTH_GITHUB_ID` / `_SECRET` | — (unset)            | Enable GitHub login when both are set.                           |
| `DATABASE_PATH`           | `/app/data/snippets.db` | Absolute path to the SQLite file.                                |
| `PORT`                    | `3000`                  | Port the server listens on inside the container.                 |
| `HOSTNAME`                | `0.0.0.0`               | Bind address (set in the image; leave as-is).                    |

Copy `.env.example` to `.env` to set these via compose.

## Features

- 🔐 Multi-user auth (email/password + optional Google & GitHub), private per-user libraries
- 👥 Library sharing (read/write) and an admin dashboard for user management
- 📝 Create, edit, and delete prompts
- 🎨 Syntax highlighting for 35 languages (highlight.js)
- 🏷️ Tags with autocomplete, search, and filtering
- 📋 One-click copy to clipboard
- ⌨️ Keyboard shortcuts — new prompt (Ctrl/⌘+N), focus search (Ctrl/⌘+K or `/`), close dialogs (Esc)
- ⭐ Favorites, usage tracking, and per-model metadata
- 📥 JSON import / export
- 📊 Library stats — total prompts, languages, and tags
- 🌗 Light / dark theme toggle (follows system by default)
- ⚡ Fast, local SQLite storage

## Tech stack

| Area               | Technology                              |
| ------------------ | --------------------------------------- |
| Framework          | Next.js 16 (App Router, standalone), React 19 |
| UI                 | shadcn/ui, Radix UI, Tailwind CSS       |
| Data               | SQLite via `better-sqlite3`             |
| Forms & validation | React Hook Form + Zod                   |
| Highlighting       | highlight.js                            |
| Runtime image      | `node:22-bookworm-slim`                 |

## Local development (without Docker)

Requires [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/) 9.

```bash
pnpm install
pnpm dev      # http://localhost:3000, DB at ./data/snippets.db
```

Build and run the production server locally:

```bash
pnpm build && pnpm start
```

## How the image is built

A multi-stage `Dockerfile`:

1. **deps** — installs dependencies with pnpm (via Corepack) and compiles the
   native `better-sqlite3` addon.
2. **builder** — runs `next build`, which emits a self-contained server to
   `.next/standalone` (thanks to `output: "standalone"` in `next.config.ts`).
3. **runner** — copies only the standalone server, static assets, and `public/`
   into a slim image that runs as the non-root `node` user.

## Project structure

```
app/            Next.js App Router pages and /api/snippets routes
components/      React components (shadcn/ui in components/ui)
hooks/          Custom React hooks
lib/            Database access, API bridge, and utilities
public/         Static assets (highlight.js themes, images)
Dockerfile      Multi-stage build (deps → builder → runner)
docker-compose.yml
```
