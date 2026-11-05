"""Serve the existing FastAPI routes with request-owned database I/O."""
import asyncio
from contextlib import asynccontextmanager

from workers import WorkerEntrypoint, asgi

from app.core.worker_database import hyperdrive_context
from app.main import app

_database_lock = asyncio.Lock()
_initialized = False
_server_lifespan = app.router.lifespan_context


@asynccontextmanager
async def worker_lifespan(application):
    global _initialized
    async with _database_lock:
        if not _initialized:
            async with _server_lifespan(application):
                pass
            _initialized = True
    yield


app.router.lifespan_context = worker_lifespan


class SerializedApplication:
    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http':
            # Keep the lock through dependency cleanup and transaction commit.
            async with _database_lock:
                await app(scope, receive, send)
        else:
            await app(scope, receive, send)


application = SerializedApplication()


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        token = hyperdrive_context.set(self.env.HYPERDRIVE)
        try:
            return await asgi.fetch(application, request, self.env, self.ctx)
        finally:
            hyperdrive_context.reset(token)

