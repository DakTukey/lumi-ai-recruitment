"""Script kiểm tra thực tế (live test) tính năng GitHub verification."""
import asyncio
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / '.env')
sys.path.insert(0, str(root))

from models.github_verification import GithubVerifyRequest
from services.github_fetcher import fetch_github_summary
from services.github_verifier import verify_github

async def main():
    test_user = sys.argv[1] if len(sys.argv) > 1 else 'octocat'
    print(f"=== BƯỚC 1: Lấy dữ liệu GitHub của '{test_user}' ===")
    try:
        summary = await fetch_github_summary(f'https://github.com/{test_user}')
        print(f"-> Username: {summary.username}")
        print(f"-> Số public repos: {summary.public_repos}")
        print(f"-> Tuổi tài khoản: {summary.account_age_days} ngày")
        print(f"-> Tổng stars: {summary.total_stars}")
        print(f"-> Danh sách repos quét được: {[r.name for r in summary.repos]}")
    except Exception as e:
        print(f"[X] Lỗi khi cào dữ liệu GitHub: {type(e).__name__}: {e}")
        return

    print(f"\n=== BƯỚC 2: Đối chiếu với CV mẫu và gọi AI ===")
    req = GithubVerifyRequest(
        github_url=f'https://github.com/{test_user}',
        cv_skills=['Ruby', 'Git', 'Docker', 'Python', 'React', 'Java'],
        cv_projects=[
            {'name': 'Spoon-Knife', 'description': 'Dự án thực hành Git và fork repository.'},
            {'name': 'Ecommerce App', 'description': 'Hệ thống bán hàng trực tuyến xây dựng bằng Java Spring Boot.'}
        ]
    )
    try:
        result = await verify_github(req)
        print("-> KẾT QUẢ ĐỐI CHIẾU THÀNH CÔNG:")
        print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"[X] Lỗi khi AI phân tích: {type(e).__name__}: {e}")

if __name__ == '__main__':
    asyncio.run(main())

