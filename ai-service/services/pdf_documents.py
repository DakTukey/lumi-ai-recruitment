"""Bounded PDF inspection and page rendering shared by CV and JD imports."""
import base64
import io
import re

from pypdf import PdfReader


def inspect_document(file_bytes: bytes, label: str) -> tuple[str, int, bool]:
    if not file_bytes.startswith(b'%PDF-'):
        raise ValueError('Nội dung tệp không phải PDF.')
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            raise ValueError('PDF có mật khẩu. Hãy tải bản PDF không khóa.')
        count = len(reader.pages)
        if not 1 <= count <= 10:
            raise ValueError(f'{label} cần từ 1 đến 10 trang.')
        pages, visual, total = [], False, 0
        for index, page in enumerate(reader.pages):
            text = (page.extract_text(extraction_mode='layout') or '') if page.get_contents() is not None else ''
            total += len(text)
            if total > 100000:
                raise ValueError(f'PDF có quá nhiều nội dung. Hãy dùng bản {label} ngắn hơn.')
            if len(text.strip()) < 50 or any(re.search(r'\S {8,}\S', line) for line in text.splitlines()):
                visual = True
            pages.append(f'--- TRANG {index + 1} ---\n{text}')
        return '\n\n'.join(pages), count, visual
    except ValueError:
        raise
    except Exception:
        raise ValueError('PDF bị hỏng hoặc không đọc được. Hãy xuất lại tệp.') from None


def render_pdf_images(file_bytes: bytes) -> list[str]:
    from pypdfium2 import PdfDocument

    images = []
    document = PdfDocument(file_bytes)
    try:
        if not 1 <= len(document) <= 10:
            raise ValueError('PDF cần từ 1 đến 10 trang.')
        for page in document:
            try:
                width, height = page.get_size()
                bitmap = page.render(scale=min(1.5, 1600 / max(width, height, 1)))
                try:
                    output = io.BytesIO()
                    with bitmap.to_pil() as source, source.convert('RGB') as rgb:
                        rgb.save(output, format='JPEG', quality=82)
                    images.append(base64.b64encode(output.getvalue()).decode('ascii'))
                finally:
                    bitmap.close()
            finally:
                page.close()
    finally:
        document.close()
    return images
