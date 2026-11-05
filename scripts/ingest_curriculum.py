"""Archive an official OBEC PDF and stage page-linked text for human review."""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener

from pypdf import PdfReader
from pypdf.errors import PdfReadError


class DirectDownload(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('--title', required=True)
    parser.add_argument('--year-be', type=int, required=True)
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    source = urlsplit(args.url)
    if source.scheme != 'https' or source.netloc not in {'academic.obec.go.th', 'www.academic.obec.go.th'}:
        parser.error('Use a direct HTTPS link on the official OBEC academic domain.')

    archive = Path(__file__).resolve().parents[1] / 'curriculum_archive'
    archive.mkdir(exist_ok=True)
    record = {
        'source_url': args.url, 'title': args.title, 'year_be': args.year_be,
        'revision': args.revision, 'publisher': 'OBEC Bureau of Academic Affairs and Educational Standards',
        'verified_indicators': 0,
    }
    key = hashlib.sha256(args.url.encode()).hexdigest()[:16]
    try:
        with build_opener(DirectDownload).open(args.url, timeout=20) as response:
            limit = 30 * 1024 * 1024
            original = response.read(limit + 1)
        if len(original) > limit or not original.startswith(b'%PDF-'):
            raise ValueError('Source did not return a PDF within the 30 MiB limit.')
        digest = hashlib.sha256(original).hexdigest()
        (archive / f'{digest}.pdf').write_bytes(original)
        record['sha256'] = digest
        pages = []
        for number, page in enumerate(PdfReader(io.BytesIO(original)).pages, 1):
            text = page.extract_text() or ''
            normalized = text.translate(str.maketrans('๐๑๒๓๔๕๖๗๘๙', '0123456789'))
            codes = sorted(set(re.findall(r'ม\s*\.\s*[1-6]\s*/\s*\d+', normalized)))
            pages.append({
                'page': number, 'text': text, 'indicator_candidates': codes,
                'status': 'needs_review' if text.strip() else 'needs_ocr',
            })
        record.update(status='needs_review', pages=pages)
    except (OSError, ValueError, PdfReadError) as exc:
        record.update(status='extraction_failed' if 'sha256' in record else 'unavailable', error=str(exc))

    # A failed retry does not overwrite a previous successful extraction.
    suffix = record['sha256'] if record['status'] == 'needs_review' else record['status']
    destination = archive / f'{key}-{suffix}.json'
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(destination)
    print(f"{record['status']}: {len(record.get('pages', []))} pages, 0 verified indicators")


if __name__ == '__main__':
    main()
