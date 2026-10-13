"""Opt-in live demo rehearsal. Synthetic input only; uses configured API quota."""
import asyncio
import json
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / '.env')
sys.path.insert(0, str(root))
from models.cv_writing import CvWritingRequest
from services.cv_writing import rewrite

SAMPLES = [
    ('summary', 'Giới thiệu', 'Sinh viên công nghệ thông tin, đã làm website bán hàng bằng React và Spring Boot. Muốn ứng tuyển thực tập lập trình web.', 'Thực tập sinh lập trình web'),
    ('experience', 'Kinh nghiệm', 'Thực tập tại công ty phần mềm. Viết giao diện React, kết nối REST API, sửa lỗi hiển thị trên điện thoại và dùng Git để làm việc cùng nhóm.', 'Thực tập sinh Frontend'),
    ('project', 'Dự án', 'Làm website quản lý thư viện trong nhóm 3 người. Phụ trách API mượn trả sách bằng Java và Spring Boot, lưu dữ liệu PostgreSQL.', 'Quản lý thư viện · Backend Developer'),
]

async def main():
    count = min(20, max(1, int(sys.argv[1]) if len(sys.argv) > 1 else 3))
    results = []
    failures = 0
    for i in range(count):
        section, label, text, context = SAMPLES[i % len(SAMPLES)]
        action = ['polish', 'shorten', 'bullets'][(i // 3) % 3]
        req = CvWritingRequest(section=section, action=action, text=text, context=context)
        started = time.monotonic()
        try:
            result = await rewrite(req)
            item = {'label': label, 'request': req.model_dump(), 'result': result.model_dump(),
                    'seconds': round(time.monotonic() - started, 2), 'ok': True}
            failures = 0
        except Exception as error:
            item = {'label': label, 'ok': False, 'error_type': type(error).__name__,
                    'seconds': round(time.monotonic() - started, 2)}
            failures += 1
        results.append(item)
        print(json.dumps({k: v for k, v in item.items() if k not in ('request', 'result')}) , flush=True)
        Path('/tmp/lumi-cv-rehearsal.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
        if failures >= 2:
            break
        if i + 1 < count:
            await asyncio.sleep(2)
    print(json.dumps({'attempted': len(results), 'passed': sum(r['ok'] for r in results)}), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
