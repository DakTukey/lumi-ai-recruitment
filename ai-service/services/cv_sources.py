"""Attach page evidence without treating model-supplied verification as trusted."""
import re

EXCLUDED = {'title', 'warnings', 'sources', 'extractedText', 'pageCount'}


def field_values(value, path=''):
    if isinstance(value, dict):
        for key, child in value.items():
            if not path and key in EXCLUDED:
                continue
            yield from field_values(child, f'{path}.{key}' if path else key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from field_values(child, f'{path}.{index}')
    elif isinstance(value, str) and value.strip():
        yield path, value.strip()


def checked_sources(data, text, count):
    parts = re.split(r'--- TRANG (\d+) ---\n?', text)
    pages = {int(parts[i]): parts[i + 1] for i in range(1, len(parts) - 1, 2)}
    if not pages and count == 1:
        pages = {1: text}
    values = dict(field_values(data))
    sources = {}
    # A quote's existence is checked on its claimed page. That does not prove classification.
    for source in data.get('sources', []):
        path, quote, page = source['path'], source['quote'], source['page']
        if path not in values or not quote.strip() or not 1 <= page <= count:
            continue
        sources[path] = dict(path=path, quote=quote, page=page,
                             verified=quote in pages.get(page, ''))
    # Exact values can be grounded in text even when the model omitted evidence.
    for path, value in values.items():
        for page, content in pages.items():
            if value in content:
                sources[path] = dict(path=path, quote=value[:600], page=page, verified=True)
                break
    return list(sources.values())[:80]


def ground_text_fields(data, text, warnings):
    """Clear unsupported contact/summary values; never infer facts from prompt examples."""
    import unicodedata
    def normalized(value):
        return ' '.join(unicodedata.normalize('NFC', value).casefold().split())
    source = normalized(re.sub(r'--- TRANG \d+ ---', '', text))
    labels = {'fullName': 'Họ tên', 'email': 'Email', 'phone': 'Điện thoại', 'location': 'Nơi ở',
              'summary': 'Giới thiệu', 'githubUrl': 'GitHub', 'linkedinUrl': 'LinkedIn', 'portfolioUrl': 'Portfolio'}
    for key, label in labels.items():
        value = data.get(key, '')
        if not value:
            continue
        found = normalized(value) in source
        if key == 'phone':
            digits = re.sub(r'\D', '', value)
            found = len(digits) >= 7 and any(digits in re.sub(r'\D', '', line) for line in text.splitlines())
        if not found:
            data[key] = ''
            warnings.append(f'{label}: AI trả thông tin chưa khớp văn bản PDF; đã để trống để bạn kiểm tra và bổ sung từ bản gốc.')
    kept = []
    for section in data.get('extraSections', []):
        if normalized(section['content']) in source:
            kept.append(section)
        else:
            warnings.append(f"Mục bổ sung '{section['title']}': nội dung chưa khớp văn bản PDF; hãy kiểm tra bản gốc và thêm lại nếu cần.")
    data['extraSections'] = kept
    for group in ('experiences', 'educations', 'projects', 'certifications', 'languages', 'awards', 'activities'):
        for path, value in field_values(data.get(group, []), group):
            if path.endswith(('startDate', 'endDate', 'issuedDate', 'awardedDate')):
                continue  # Date formatting is checked separately and may differ from the source.
            if normalized(value) not in source:
                warnings.append(f'{path}: thông tin chưa khớp nguyên văn PDF; cần đối chiếu trước khi xác nhận.')
