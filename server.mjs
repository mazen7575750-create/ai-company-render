// ============================================================================
//  server.mjs — شركة الذكاء المستقلة على Render (مجاني، بدون كارت)
//
//  الفكرة: سيرفر حقيقي على النت، بيفضل شغال، بيعمل الحلقة بنفسه،
//  وبيخليك تفتح الشركة 3D من أي جهاز.  قفل جهازك = مفيش أي تأثير.
//
//  حماية: قبل ما المستخدم يفتح الشركة، بنضرب /api/ping كل 10 دقايق
//  عشان السيرفر مينامش.  وكمان أي زيارة منك بتصحّيه تلقائيًا.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { CompanyEngine, freshDb } from "./core.mjs";

// ---- المسارات ----
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "company.json");
const ART_DIR = path.join(DATA_DIR, "artifacts");
const PORT = Number(process.env.PORT || 10000);      // Render يحقن PORT
const HOST = "0.0.0.0";
const SELF_URL = (process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || "").replace(/\/$/, "");

fs.mkdirSync(ART_DIR, { recursive: true });

// ---------------------------------------------------------------------------
//  مخزن دائم: ملف على القرص (Render بيدي قرص مؤقت بس داخل نفس التشغيل)
//  + نسخة احتياطية على Cloudinary لو المفاتيح موجودة (اختياري تمامًا)
// ---------------------------------------------------------------------------
class DiskStore {
  constructor(dir) {
    this.dir = dir;
    this.db = null;
    this.dirty = false;
    this.snapshots = { collections: new Map(), runs: new Map(), artifacts: new Map() };
    this._cache = new Map();
    this._writes = 0;
  }
  load() {
    if (this.db) return this.db;
    if (fs.existsSync(DB_FILE)) {
      try {
        this.db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      } catch {
        fs.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
        this.db = freshDb();
        this.dirty = true;
      }
    } else {
      this.db = freshDb();
      this.dirty = true;
    }
    return this.db;
  }
  save() { this.dirty = true; }
  flush() { if (this.dirty) this.saveNow(); }
  saveNow() {
    if (!this.db) this.load();
    if (!this.dirty) return;
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, DB_FILE);   // كتابة ذرّية — مايتلفش الملف
    this.dirty = false;
    this._writes++;
  }
  _p(id) { return path.join(ART_DIR, encodeURIComponent(id) + ".bin"); }
  writeArtifact(id, _e, d) {
    const b = d instanceof Uint8Array ? d : new TextEncoder().encode(String(d ?? ""));
    this._cache.set(id, b);
    fs.writeFileSync(this._p(id), Buffer.from(b));
  }
  writeArtifactText(id, t) { this.writeArtifact(id, "md", new TextEncoder().encode(String(t ?? ""))); }
  writeArtifactBase64(id, x) { this.writeArtifact(id, "bin", Buffer.from(String(x || ""), "base64")); }
  hasArtifact(id) { return this._cache.has(id) || fs.existsSync(this._p(id)); }
  readArtifact(id) {
    if (this._cache.has(id)) return this._cache.get(id);
    const p = this._p(id);
    if (!fs.existsSync(p)) return null;
    const b = new Uint8Array(fs.readFileSync(p));
    this._cache.set(id, b);
    return b;
  }
  readArtifactText(id) { const b = this.readArtifact(id); return b ? new TextDecoder().decode(b) : ""; }
  replaceDb(next, contents = []) {
    this.db = next; this.dirty = true; this.saveNow();
    for (const it of contents || []) {
      if (!it?.id) continue;
      if (it.contentBase64) this.writeArtifactBase64(it.id, it.contentBase64);
      else if (it.contentText !== undefined) this.writeArtifactText(it.id, it.contentText);
    }
    return this.db;
  }
  getOrCreateInternalSecret() {
    if (!this.db) this.load();
    const m = (this.db.storeMeta = this.db.storeMeta || {});
    if (m.secret) return m.secret;
    m.secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
    this.dirty = true; this.saveNow();
    return m.secret;
  }
  stats() {
    let bytes = 0;
    try { bytes = fs.statSync(DB_FILE).size; } catch {}
    return { runs: (this.db?.runs || []).length, artifacts: (this.db?.artifacts || []).length, dbBytes: bytes };
  }
}

// ---------------------------------------------------------------------------
//  تشغيل
// ---------------------------------------------------------------------------
const store = new DiskStore(DATA_DIR);
let timer = null;
let engine = null;

function bootEngine() {
  const env = { ...process.env, OWNER_OPEN_MODE: process.env.OWNER_TOKEN ? "false" : "true" };
  engine = new CompanyEngine({
    store,
    env,
    setAlarm: () => {},       // المؤقّت عندنا، مش عند المحرّك
    getAlarm: () => null,
    deleteAlarm: () => {}
  });
  return engine;
}
bootEngine();

// الحلقة: كل 30 ثانية خطوة، لحد ما الشغل يخلص
let loopRunning = false;
async function tick() {
  if (loopRunning) return;
  loopRunning = true;
  try {
    if (!store.db) store.load();
    const db = store.db;
    const pending = engine.ownerWorkPending ? engine.ownerWorkPending() : engine.hasPendingWork();
    if (db.loop?.enabled && pending) {
      const step = engine.advanceLoopOnce ? engine.advanceLoopOnce.bind(engine) : engine.advanceLoop.bind(engine);
      const r = await step("server");
      if (r?.worked) console.log("step:", r.operation);
    }
  } catch (e) {
    console.log("loop error:", String(e?.message || e).slice(0, 200));
  } finally {
    loopRunning = false;
  }
}
timer = setInterval(tick, Number(process.env.LOOP_MS || 30000));

// ---------------------------------------------------------------------------
//  خادم HTTP
// ---------------------------------------------------------------------------
const INDEX_HTML = fs.readFileSync(path.join(import.meta.dirname, "index.html"), "utf8");
const IMPORT_HTML = fs.existsSync(path.join(import.meta.dirname, "import.html"))
  ? fs.readFileSync(path.join(import.meta.dirname, "import.html"), "utf8")
  : "<h1>import</h1>";

const server = http.createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host || "localhost"}${req.url}`;
    const p = new URL(url).pathname;

    if (p === "/" || p === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(INDEX_HTML);
    }
    if (p === "/import" || p === "/import.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(IMPORT_HTML);
    }
    if (p === "/__status") {
      const d = store.load();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        ok: true,
        uptimeMin: Math.round(process.uptime() / 60),
        selfUrl: SELF_URL || null,
        agents: (d.agents || []).length,
        configured: (d.agents || []).filter((a) => a.connectionId && a.model).length,
        projects: (d.projects || []).length,
        tasks: (d.tasks || []).length,
        loop: d.loop?.enabled ? "on" : "off",
        writes: store._writes
      }, null, 2));
    }
    if (!p.startsWith("/api/") && p !== "/__loop/wake") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("الصفحة الرئيسية على /");
    }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body
    });

    const response = await engine.handleFetch(request);
    const out = {};
    response.headers.forEach((v, k) => { out[k] = v; });
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error("req error:", e);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: String(e?.message || e) }));
  }
});

server.listen(PORT, HOST, () => {
  const d = store.load();
  console.log("");
  console.log("  ╔═══════════════════════════════════════════════════╗");
  console.log("  ║   شركة الذكاء المستقلة — تعمل على Render           ║");
  console.log("  ╚═══════════════════════════════════════════════════╝");
  console.log(`  🌐  المنفذ: ${PORT}`);
  console.log(`  🔗  الرابط: ${SELF_URL || "(سيظهر بعد النشر)"}`);
  console.log(`  👥  الوكلاء: ${(d.agents || []).length} • مهيأ: ${(d.agents || []).filter((a) => a.connectionId && a.model).length}`);
  console.log(`  🔁  الحلقة: ${d.loop?.enabled ? "تعمل" : "موقوفة"}   •  المهام: ${(d.tasks || []).length}`);
  console.log("");

  // منع النوم: كل 10 دقايق نضرب نفسنا
  if (SELF_URL) {
    setInterval(async () => {
      try {
        await fetch(`${SELF_URL}/api/ping`, { signal: AbortSignal.timeout(20000) });
        console.log("💓 keep-alive ok");
      } catch (e) {
        console.log("💓 keep-alive fail:", String(e?.message || e).slice(0, 80));
      }
    }, 10 * 60 * 1000);
  }
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    try { store.flush(); } catch {}
    process.exit(0);
  });
}
