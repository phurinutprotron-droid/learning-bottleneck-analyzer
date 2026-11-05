"""Synthetic password compatibility probe. No LBA records or credentials."""
import time
from workers import WorkerEntrypoint, Response
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        samples = []
        for _ in range(3):
            started = time.perf_counter()
            digest = Scrypt(salt=b"synthetic-salt", length=64, n=16384, r=8, p=1).derive(b"synthetic-password")
            samples.append(round((time.perf_counter() - started)*1000, 2))
        return Response.json({"service":"lba-compatibility-probe","production_api":False,"scrypt_ok":len(digest)==64,"synthetic_digest":digest.hex(),"wall_ms":samples})
