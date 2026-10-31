import os
import re
import sqlite3
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

DATA_DIR = Path(os.getenv("DOROZHKA_DATA_DIR", "/data"))
AUDIO_DIR = DATA_DIR / "audio"
DB_PATH = DATA_DIR / "catalog.sqlite3"
ADMIN_TOKEN = os.getenv("DOROZHKA_ADMIN_TOKEN", "")
MAX_UPLOAD_BYTES = int(os.getenv("DOROZHKA_MAX_UPLOAD_BYTES", str(150 * 1024 * 1024)))
ALLOWED_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wav"}
ALLOWED_TYPES = {
    "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg",
    "audio/opus", "audio/flac", "audio/wav", "audio/x-wav",
    "application/octet-stream",
}

app = FastAPI(title="Doroshka Music API", version="0.1.0")
origins = [x.strip() for x in os.getenv("DOROZHKA_CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Range"],
)


def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            genre TEXT NOT NULL DEFAULT '',
            duration REAL NOT NULL DEFAULT 0,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            cover_url TEXT NOT NULL DEFAULT '',
            license TEXT NOT NULL DEFAULT '',
            attribution TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()
    return db


def track_json(row):
    item = dict(row)
    item["stream_url"] = f"/api/v1/tracks/{item['id']}/stream"
    return item


def require_admin(authorization: Optional[str]):
    if not ADMIN_TOKEN:
        raise HTTPException(503, "Server admin token is not configured")
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(401, "Invalid admin token")


@app.on_event("startup")
def startup():
    db = connect()
    db.close()


@app.get("/api/v1/health")
def health():
    return {"ok": True, "service": "Doroshka Music API", "version": "0.1.0"}


@app.get("/api/v1/search")
def search(q: str = "", limit: int = 40, offset: int = 0):
    q = q.strip()[:160]
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    db = connect()
    try:
        if q:
            pattern = "%" + q.replace("%", r"\%").replace("_", r"\_") + "%"
            rows = db.execute(
                """SELECT * FROM tracks
                   WHERE title LIKE ? ESCAPE '\\'
                      OR artist LIKE ? ESCAPE '\\'
                      OR album LIKE ? ESCAPE '\\'
                      OR genre LIKE ? ESCAPE '\\'
                   ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?""",
                (pattern, pattern, pattern, pattern, limit, offset),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM tracks ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        total = db.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
        return {"items": [track_json(r) for r in rows], "total": total, "limit": limit, "offset": offset}
    finally:
        db.close()


@app.get("/api/v1/tracks/{track_id}")
def get_track(track_id: str):
    db = connect()
    try:
        row = db.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Track not found")
        return track_json(row)
    finally:
        db.close()


@app.get("/api/v1/tracks/{track_id}/stream")
def stream_track(track_id: str, range_header: Optional[str] = Header(None, alias="Range")):
    db = connect()
    try:
        row = db.execute("SELECT filename, mime_type FROM tracks WHERE id = ?", (track_id,)).fetchone()
    finally:
        db.close()
    if not row:
        raise HTTPException(404, "Track not found")
    path = AUDIO_DIR / row["filename"]
    if not path.is_file():
        raise HTTPException(404, "Audio file is missing")
    size = path.stat().st_size
    start, end = 0, size - 1
    status = 200
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600"}
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match:
            raise HTTPException(416, "Invalid byte range", headers={"Content-Range": f"bytes */{size}"})
        left, right = match.groups()
        if left:
            start = int(left)
            end = min(int(right), size - 1) if right else size - 1
        elif right:
            length = min(int(right), size)
            start = size - length
        if start >= size or end < start:
            raise HTTPException(416, "Range not satisfiable", headers={"Content-Range": f"bytes */{size}"})
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    length = end - start + 1
    headers["Content-Length"] = str(length)

    def chunks():
        with path.open("rb") as audio:
            audio.seek(start)
            remaining = length
            while remaining:
                chunk = audio.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(chunks(), status_code=status, media_type=row["mime_type"], headers=headers)


@app.post("/api/v1/admin/tracks", status_code=201)
async def upload_track(
    file: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form(""),
    album: str = Form(""),
    genre: str = Form(""),
    duration: float = Form(0),
    cover_url: str = Form(""),
    license: str = Form(...),
    attribution: str = Form(""),
    authorization: Optional[str] = Header(None),
):
    require_admin(authorization)
    original_name = Path(file.filename or "audio").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Unsupported audio extension")
    mime = (file.content_type or "application/octet-stream").lower()
    if mime not in ALLOWED_TYPES:
        raise HTTPException(415, "Unsupported audio content type")
    if not title.strip() or not license.strip():
        raise HTTPException(400, "Title and license are required")

    track_id = uuid.uuid4().hex
    stored_name = track_id + extension
    destination = AUDIO_DIR / stored_name
    written = 0
    try:
        with destination.open("wb") as target:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "Audio file exceeds upload limit")
                target.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    db = connect()
    try:
        db.execute(
            """INSERT INTO tracks
               (id,title,artist,album,genre,duration,filename,mime_type,cover_url,license,attribution)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (track_id, title.strip(), artist.strip(), album.strip(), genre.strip(),
             max(0, duration), stored_name, mime, cover_url.strip(), license.strip(), attribution.strip()),
        )
        db.commit()
        row = db.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
        return track_json(row)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        db.close()
