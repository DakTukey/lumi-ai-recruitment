"""Live test tạo phiếu phỏng vấn AI."""
import asyncio
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / '.env')
sys.path.insert(0, str(root))

from models.interview_scorecard import ScorecardGenerateRequest
from services.interview_scorecard import generate_scorecard

async def main():
    req = ScorecardGenerateRequest(
        job_title='Senior Backend Engineer (Java / Spring Boot)',
        job_requirements='Yêu cầu 3+ năm Java, Spring Boot, Microservices, PostgreSQL, Docker, CI/CD. Ưu tiên có kinh nghiệm tối ưu hóa hiệu năng và bảo mật.',
        candidate_name='Trần Minh Tuấn',
        cv_summary='Kỹ sư phần mềm 2 năm kinh nghiệm làm Java và Spring Boot. Đã phát triển API cho ứng dụng bán hàng.',
        cv_skills=['Java', 'Spring Boot', 'MySQL', 'Git', 'Docker'],
        assessment_missing_skills=['PostgreSQL', 'Microservices', 'CI/CD'],
        github_unverified_skills=['Docker'],
        github_vibe_flags=['Chỉ có 1 commit duy nhất']
    )
    print("=== Đang gọi AI tạo Phiếu phỏng vấn... ===")
    try:
        res = await generate_scorecard(req)
        print("-> KẾT QUẢ TẠO PHIẾU PHỎNG VẤN THÀNH CÔNG:")
        print(json.dumps(res.model_dump(), ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"[X] Lỗi: {type(e).__name__}: {e}")

if __name__ == '__main__':
    asyncio.run(main())

