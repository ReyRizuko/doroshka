const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}
function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = (env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim()).filter(Boolean);
  const allowed = configured.includes("*") ? "*" : (configured.includes(origin) ? origin : "null");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length",
    "Vary": "Origin"
  };
}
function response(request, env, body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...cors(request, env), ...headers } });
}
function publicTrack(row) {
  return {
    id: row.id, title: row.title, artist: row.artist, album: row.album,
    genre: row.genre, duration: row.duration, cover_url: row.cover_url,
    license: row.license, attribution: row.attribution,
    stream_url: "/api/v1/tracks/" + encodeURIComponent(row.id) + "/stream",
    created_at: row.created_at
  };
}
function admin(request, env) {
  const token = env.ADMIN_TOKEN;
  return Boolean(token && request.headers.get("Authorization") === "Bearer " + token);
}
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") return response(request, env, null, 204);
  if (request.method === "GET" && path === "/api/v1/health") {
    return response(request, env, JSON.stringify({ ok: true, service: "Doroshka Music API", version: "0.2.0" }), 200, JSON_HEADERS);
  }
  if (request.method === "GET" && path === "/api/v1/search") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 160);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 40, 100));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    let query = "SELECT id,title,artist,album,genre,duration,cover_url,license,attribution,created_at FROM tracks";
    let count = "SELECT COUNT(*) AS total FROM tracks";
    const args = [];
    if (q) {
      query += " WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\' OR genre LIKE ? ESCAPE '\\'";
      count += " WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\' OR genre LIKE ? ESCAPE '\\'";
      const pattern = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
      args.push(pattern, pattern, pattern, pattern);
    }
    const [items, total] = await Promise.all([
      env.DB.prepare(query + " ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?").bind(...args, limit, offset).all(),
      env.DB.prepare(count).bind(...args).first()
    ]);
    return response(request, env, JSON.stringify({ items: (items.results || []).map(publicTrack), total: total.total, limit, offset }), 200, JSON_HEADERS);
  }
  const streamMatch = path.match(/^\/api\/v1\/tracks\/([a-f0-9-]+)\/stream$/i);
  if (request.method === "GET" && streamMatch) {
    const row = await env.DB.prepare("SELECT object_key,mime_type FROM tracks WHERE id=?").bind(streamMatch[1]).first();
    if (!row) return response(request, env, JSON.stringify({ error: "Track not found" }), 404, JSON_HEADERS);
    const head = await env.AUDIO.head(row.object_key);
    if (!head) return response(request, env, JSON.stringify({ error: "Audio file is missing" }), 404, JSON_HEADERS);
    const size = head.size;
    if (!size) return response(request, env, JSON.stringify({ error: "Audio file is empty" }), 404, JSON_HEADERS);
    const range = request.headers.get("Range");
    let object, status = 200;
    const headers = { "Content-Type": row.mime_type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600" };
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) return response(request, env, null, 416, { "Content-Range": "bytes */" + size });
      let start, end;
      if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
      else { const suffix = Math.min(Number(match[2]), size); start = size - suffix; end = size - 1; }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
        return response(request, env, null, 416, { "Content-Range": "bytes */" + size });
      }
      object = await env.AUDIO.get(row.object_key, { range: { offset: start, length: end - start + 1 } });
      status = 206;
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
      headers["Content-Length"] = String(end - start + 1);
    } else {
      object = await env.AUDIO.get(row.object_key);
      headers["Content-Length"] = String(size);
    }
    if (!object) return response(request, env, null, 404);
    return response(request, env, object.body, status, headers);
  }
  const trackMatch = path.match(/^\/api\/v1\/tracks\/([a-f0-9-]+)$/i);
  if (request.method === "GET" && trackMatch) {
    const row = await env.DB.prepare("SELECT id,title,artist,album,genre,duration,cover_url,license,attribution,created_at FROM tracks WHERE id=?").bind(trackMatch[1]).first();
    return row ? response(request, env, JSON.stringify(publicTrack(row)), 200, JSON_HEADERS) : response(request, env, JSON.stringify({ error: "Track not found" }), 404, JSON_HEADERS);
  }
  if (request.method === "POST" && path === "/api/v1/admin/tracks") {
    if (!admin(request, env)) return response(request, env, JSON.stringify({ error: "Unauthorized" }), env.ADMIN_TOKEN ? 401 : 503, JSON_HEADERS);
    const title = (url.searchParams.get("title") || "").trim();
    const license = (url.searchParams.get("license") || "").trim();
    if (!title || !license || !request.body) return response(request, env, JSON.stringify({ error: "title, license and raw audio body are required" }), 400, JSON_HEADERS);
    const mime = (request.headers.get("Content-Type") || "application/octet-stream").split(";")[0].toLowerCase();
    const extensions = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/opus": "opus", "audio/flac": "flac", "audio/wav": "wav", "audio/x-wav": "wav" };
    if (!extensions[mime]) return response(request, env, JSON.stringify({ error: "Unsupported audio content type" }), 415, JSON_HEADERS);
    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    const maxBytes = Number(env.MAX_UPLOAD_BYTES || 104857600);
    if (declaredLength > maxBytes) return response(request, env, JSON.stringify({ error: "Upload exceeds configured limit" }), 413, JSON_HEADERS);
    const id = crypto.randomUUID();
    const objectKey = id + "." + extensions[mime];
    const artist = url.searchParams.get("artist") || "";
    const album = url.searchParams.get("album") || "";
    const genre = url.searchParams.get("genre") || "";
    const duration = Math.max(0, Number(url.searchParams.get("duration")) || 0);
    const cover = url.searchParams.get("cover_url") || "";
    const attribution = url.searchParams.get("attribution") || "";
    await env.AUDIO.put(objectKey, request.body, { httpMetadata: { contentType: mime } });
    try {
      await env.DB.prepare("INSERT INTO tracks (id,title,artist,album,genre,duration,object_key,mime_type,cover_url,license,attribution) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,title,artist,album,genre,duration,objectKey,mime,cover,license,attribution).run();
    } catch (error) {
      await env.AUDIO.delete(objectKey);
      throw error;
    }
    return response(request, env, JSON.stringify({ id, title, artist, album, genre, duration, cover_url: cover, license, attribution, stream_url: "/api/v1/tracks/" + id + "/stream" }), 201, JSON_HEADERS);
  }
  return response(request, env, JSON.stringify({ error: "Not found" }), 404, JSON_HEADERS);
}
export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) { return response(request, env, JSON.stringify({ error: "Internal server error" }), 500, JSON_HEADERS); }
  }
};
