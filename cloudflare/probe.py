"""Local compatibility probe only. This does not implement the LBA API."""
import hashlib
import importlib
import time
from workers import WorkerEntrypoint, Response

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        imports = {}
        for name in ("fastapi", "pydantic_settings", "sqlalchemy", "pg8000", "httpx", "google.genai"):
            try:
                importlib.import_module(name)
                imports[name] = "ok"
            except Exception as exc:
                imports[name] = type(exc).__name__
        started = time.perf_counter()
        try:
            from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
            digest = Scrypt(salt=b"synthetic-salt", length=64, n=16384, r=8, p=1).derive(b"synthetic-password")
            password_check = len(digest) == 64
        except Exception as exc:
            password_check = type(exc).__name__
        return Response.json({
            "imports": imports, "scrypt": password_check,
            "scrypt_duration_ms": round((time.perf_counter() - started) * 1000, 2),
        })
