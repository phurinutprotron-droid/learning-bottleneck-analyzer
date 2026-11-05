import json
import logging
from contextvars import ContextVar
from datetime import datetime, timezone


request_id_context: ContextVar[str | None] = ContextVar("request_id", default=None)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({'time': datetime.now(timezone.utc).isoformat(), 'level': record.levelname, 'event': record.getMessage(),
                           **{k: getattr(record, k) for k in ('request_id', 'status', 'duration_ms', 'failure_type', 'attempt', 'phase', 'retry_delay_ms', 'route', 'method') if hasattr(record, k)}})


def configure_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger('lba')
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
