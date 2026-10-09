import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const dir = process.env.DATA_DIR || "/data";
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(dir + "/crosswords.sqlite");
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, document TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
 id TEXT PRIMARY KEY, mime TEXT NOT NULL, content BLOB NOT NULL
);`);

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
const readBody = async (req, limit) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("För stor fil eller projekt."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
const validDocument = (x) =>
  x && x.version === 2 && typeof x.title === "string" &&
  Number.isInteger(x.width) && Number.isInteger(x.height) &&
  x.width > 0 && x.width <= 100 && x.height > 0 && x.height <= 100 &&
  Array.isArray(x.cells) && x.cells.length === x.height &&
  x.cells.every(row => Array.isArray(row) && row.length === x.width) &&
  Array.isArray(x.images);
const projectList = db.prepare("SELECT id, title, created_at AS createdAt, updated_at AS updatedAt FROM projects ORDER BY updated_at DESC");
const findProject = db.prepare("SELECT document FROM projects WHERE id=?");
const insertProject = db.prepare("INSERT INTO projects (id,title,document,created_at,updated_at) VALUES (?,?,?,?,?)");
const updateProject = db.prepare("UPDATE projects SET title=?,document=?,updated_at=? WHERE id=?");
const deleteProject = db.prepare("DELETE FROM projects WHERE id=?");
const insertAsset = db.prepare("INSERT OR REPLACE INTO assets (id,mime,content) VALUES (?,?,?)");
const findAsset = db.prepare("SELECT mime,content FROM assets WHERE id=?");
const deleteAsset = db.prepare("DELETE FROM assets WHERE id=?");

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    if (path === "/api/health" && req.method === "GET") return send(res, 200, { ok: true });
    if (path === "/api/projects" && req.method === "GET") return send(res, 200, projectList.all());
    if (path === "/api/projects" && req.method === "POST") {
      const document = JSON.parse((await readBody(req, 5_000_000)).toString());
      if (!validDocument(document)) return send(res, 400, { error: "Ogiltigt korsord." });
      const id = randomUUID(), now = new Date().toISOString();
      insertProject.run(id, document.title, JSON.stringify(document), now, now);
      return send(res, 201, { id, createdAt: now, updatedAt: now });
    }
    const projectMatch = /^\/api\/projects\/([a-f0-9-]{36})$/.exec(path);
    if (projectMatch) {
      const id = projectMatch[1];
      if (req.method === "GET") {
        const row = findProject.get(id);
        return row ? send(res, 200, JSON.parse(row.document)) : send(res, 404, { error: "Projektet finns inte." });
      }
      if (req.method === "PUT") {
        if (!findProject.get(id)) return send(res, 404, { error: "Projektet finns inte." });
        const document = JSON.parse((await readBody(req, 5_000_000)).toString());
        if (!validDocument(document)) return send(res, 400, { error: "Ogiltigt korsord." });
        const now = new Date().toISOString();
        updateProject.run(document.title, JSON.stringify(document), now, id);
        return send(res, 200, { id, updatedAt: now });
      }
      if (req.method === "DELETE") {
        if (!findProject.get(id)) return send(res, 404, { error: "Projektet finns inte." });
        deleteProject.run(id);
        return send(res, 200, { ok: true });
      }
    }
    const assetMatch = /^\/api\/assets\/([a-f0-9-]{36})$/.exec(path);
    if (assetMatch) {
      const id = assetMatch[1];
      if (req.method === "GET") {
        const row = findAsset.get(id);
        if (!row) return send(res, 404, { error: "Bilden finns inte." });
        res.writeHead(200, { "Content-Type": row.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
        return res.end(row.content);
      }
      if (req.method === "PUT") {
        const mime = (req.headers["content-type"] || "").split(";")[0].toLowerCase();
        if (!["image/jpeg","image/png","image/webp","image/gif"].includes(mime))
          return send(res, 415, { error: "Använd JPEG, PNG, WebP eller GIF." });
        const body = await readBody(req, 10_000_000);
        if (!body.length) return send(res, 400, { error: "Bilden är tom." });
        insertAsset.run(id, mime, body);
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        deleteAsset.run(id);
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { error: "Sökvägen finns inte." });
  } catch (error) {
    console.error(error);
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    return send(res, status, { error: status === 500 ? "Serverfel vid lagring." : error.message });
  }
});
server.listen(3001, "0.0.0.0", () => console.log("Crossword API listening on 3001"));
