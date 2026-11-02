"""Serve the standalone game on loopback. Python standard library only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8767)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent / 'dist'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def guess_type(self, path):
        return 'application/manifest+json' if path.endswith('.webmanifest') else super().guess_type(path)

with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
    print(f'Sudoku: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
