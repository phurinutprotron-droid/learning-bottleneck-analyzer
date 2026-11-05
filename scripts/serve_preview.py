"""Loopback-only production-build preview with a same-origin backend proxy."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

DIST = Path(__file__).resolve().parents[1] / 'frontend/dist'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def proxy(self):
        if not self.path.startswith('/api/') and self.path != '/health':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_error(400)
            return
        if length < 0 or length > 1_048_576:
            self.send_error(413)
            return
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() in ('authorization', 'content-type')}
        request = Request('http://127.0.0.1:8000' + self.path, data=body, headers=headers, method=self.command)
        try:
            try:
                response = urlopen(request, timeout=75)
            except HTTPError as exc:
                response = exc
            with response:
                data = response.read()
                self.send_response(response.status)
                self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                if response.headers.get('Content-Disposition'):
                    self.send_header('Content-Disposition', response.headers['Content-Disposition'])
                self.end_headers()
                self.wfile.write(data)
        except OSError:
            self.send_error(502, 'Backend unavailable')

    def do_GET(self):
        if self.path.startswith('/api/') or self.path == '/health':
            self.proxy()
        else:
            if not (DIST / self.path.split('?')[0].lstrip('/')).exists():
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        self.proxy()

    do_PATCH = do_POST
    do_DELETE = do_POST

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    if not (DIST / 'index.html').exists():
        raise SystemExit('Build frontend first: cd frontend; npm run build')
    print('LBA preview: http://127.0.0.1:5173/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 5173), Handler).serve_forever()
