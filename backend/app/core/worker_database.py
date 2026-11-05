"""Request-owned Hyperdrive connections; never retain sockets between invocations."""
from contextvars import ContextVar

hyperdrive_context = ContextVar('lba_hyperdrive', default=None)


def connect():
    import pg8000.dbapi
    binding = hyperdrive_context.get()
    if binding is None:
        raise RuntimeError('Database binding requires an active Worker request')
    return pg8000.dbapi.connect(user=str(binding.user), password=str(binding.password),
        host=str(binding.host), port=int(binding.port), database=str(binding.database),
        timeout=5, ssl_context=False)

