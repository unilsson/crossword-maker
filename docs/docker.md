# Docker deployment

Crossword Maker is currently a **client-only** React/Vite application. The container builds the static site with Node.js and serves it with Nginx; it does not run a Node backend.

## Start

From the repository root:

```bash
docker compose up -d --build
docker compose ps
```

Open http://localhost:8085 (or the Docker host's address on port 8085).

To change the port, copy `.env.example` to `.env` and set `CROSSWORD_PORT`.

## Maintenance

```bash
docker compose logs -f
docker compose pull
docker compose up -d --build
docker compose down
```

An image rebuild is needed after updating the source. `docker compose down` does not delete browser data.

## Reverse proxy

Forward a hostname on your existing reverse proxy to the Docker host on TCP port 8085, or attach the service to your reverse proxy's Docker network and target port 80. Use HTTPS if accessible beyond the trusted LAN. Avoid publicly exposing an unauthenticated editor.

## Data and backup caveat

**Projects are not stored inside the Docker container.** At present, projects and custom words use browser localStorage; image binaries and the optional Swedish dictionary use browser IndexedDB. Consequently:

- There is no persistent server data volume yet.
- Clearing browser storage or changing browser profiles can lose locally saved projects.
- Browsing the app via a different hostname, protocol or port creates a different browser origin, with separate storage.
- Export your crossword projects as JSON before switching URLs or browsers. Browser-stored images may need separate handling; current JSON exports are not guaranteed to include image binaries.
- A Docker volume alone will not back up these browser data.

A later backend with server-side project/image storage and backup is needed for multi-device projects and reliable server backups.
