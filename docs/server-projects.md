# Sprint 5: server projects

Crossword Maker now supports named projects saved on the server in SQLite, and image binaries stored in SQLite. The optional word list and custom user dictionary remain browser-local.

## Startup
```bash
docker compose up -d --build
docker compose ps
```
The app is available on the Docker host at port 8085. The API runs only on the internal Compose network behind Nginx at `/api/`.

## Working on projects
- Click **Nytt** to create a new server project.
- Choose a saved crossword from **Sparade korsord**.
- Edits autosave after roughly one second of inactivity; **Spara nu** forces a save.
- **Spara som nytt projekt** makes a separate copy of the current crossword.
- **Ta bort** deletes the selected project, not the image assets. Old image assets may require later garbage collection.
- **Ladda JSON** imports an existing project and saves it as a new server project.

**Important for migration:** Existing browser localStorage work initially opens as a *lokalt utkast*. Use **Spara som nytt projekt** to preserve it on the server. Existing browser images are copied to the server if present in IndexedDB. Avoid clearing browser storage before verifying the imported project. The old JSON export may not include binary images.

## Persistent data and backup
Docker volume `crossword-data` stores `/data/crosswords.sqlite`; SQLite WAL mode may create `-wal` and `-shm` files. Do not back up only the main SQLite file while the API is running: use the SQLite online backup API, or stop the stack before archiving the named volume. Example offline backup (with Docker compose project name adapted to your environment):

```bash
docker compose down
docker run --rm -v "$(basename "$PWD")_crossword-data:/data:ro" -v "$PWD:/backup" alpine \
  tar czf /backup/crossword-data-backup.tar.gz -C /data .
docker compose up -d
```

Treat the app as a **trusted-LAN single-user service**. Authentication, simultaneous edit conflict detection, image cleanup and per-user permissions are not implemented. Do not expose the unauthenticated API directly to the public internet.
