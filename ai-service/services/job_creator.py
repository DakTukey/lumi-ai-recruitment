import asyncio
import io
import json
import logging
import os
import re
from dataclasses import replace
from pypdf import PdfReader

from models.job_creator import ParsedJobDraftResult, GenerateJobBriefRequest
from services import cv_writing_providers as upstream
from services.grounded_generation import strict_schema

logger = logging.getLogger(__name__)

SYSTEM_PARSE_PROMPT = """Bạn là chuyên gia nhân sự và phân tích tin tuyển dụng công nghệ cao tại Việt Nam.
Nhiệm vụ của bạn là đọc kỹ nội dung bản mô tả công việc (Job Description - JD) và trích xuất thành đối tượng JSON chính xác:

- title: Tên chức danh công việc chuẩn (ví dụ: Senior Frontend Developer, Backend Developer (Java / Spring Boot)...)
- category: Lĩnh vực công việc (ví dụ: 'Công nghệ', 'Thiết kế', 'Dữ liệu & AI')
- headcount: Số lượng nhân sự cần tuyển (chuỗi số, ví dụ '1', '2'...)
- location: Địa điểm làm việc (ví dụ: 'Đà Nẵng' hoặc 'Làm việc từ xa')
- level: Cấp độ kinh nghiệm: chọn 1 trong ['Intern', 'Junior', 'Middle', 'Senior']
- mode: Hình thức làm việc: chọn 1 trong ['Tại văn phòng', 'Hybrid', 'Remote']
- employmentType: Loại hình: chọn 1 trong ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT']
- salaryMode: Chế độ lương: chọn 1 trong ['NEGOTIABLE', 'RANGE', 'FROM', 'UP_TO']
- salaryMin, salaryMax: Mức lương bằng VNĐ dạng chuỗi số không dấu chấm (ví dụ: '15000000', '25000000'). Để rỗng "" nếu lương Thỏa thuận.
- deadline: Ngày hết hạn (định dạng YYYY-MM-DD nếu có, hoặc để trống "")
- description: Đoạn mô tả chi tiết trách nhiệm, nhiệm vụ của vị trí
- requirements: Danh sách các yêu cầu về kỹ năng, kinh nghiệm, học vấn (gạch đầu dòng)
- benefits: Quyền lợi, chế độ đãi ngộ, lương thưởng, bảo hiểm (gạch đầu dòng)
- skills: Danh sách kỹ năng công nghệ chính ({name: string, required: boolean})
- criteria: Danh sách 3 đến 6 tiêu chí đánh giá trọng tâm ({id: string, type: 'EXPERIENCE'|'EDUCATION'|'LANGUAGE'|'OTHER', description: string, required: boolean, weight: float})
- suggestedDepartment: Phòng ban phù hợp: 'IT', 'Thiết kế', hoặc 'Dữ liệu & AI'

QUY TẮC:
1. Trung thực với nội dung JD gốc.
2. Nếu JD không ghi rõ lương, đặt salaryMode là 'NEGOTIABLE'.
3. Điểm weight của criteria nên có tổng khoảng 100.0.
"""

SYSTEM_GENERATE_PROMPT = """Bạn là Giám đốc Tuyển dụng và Thu hút Nhân tài (Head of Talent Acquisition) chuyên nghiệp.
Dựa vào các thông tin tóm tắt ban đầu do HR cung cấp (tên vị trí, cấp độ, hình thức, kỹ năng, yêu cầu, giọng văn), hãy soạn thảo một bản Tin tuyển dụng (JD) hoàn chỉnh, hấp dẫn, chuẩn mực cho công ty công nghệ theo đúng schema JSON:

- title: Tiêu đề tuyển dụng chuẩn và chuyên nghiệp
- category: Lĩnh vực (mặc định 'Công nghệ')
- headcount: Số lượng cần tuyển (chuỗi '1')
- location: Địa điểm ('Đà Nẵng' nếu Onsite/Hybrid, 'Làm việc từ xa' nếu Remote)
- level: Cấp độ kinh nghiệm ('Intern', 'Junior', 'Middle', hoặc 'Senior')
- mode: 'Tại văn phòng', 'Hybrid', hoặc 'Remote'
- employmentType: 'FULL_TIME'
- salaryMode: 'NEGOTIABLE'
- salaryMin: ""
- salaryMax: ""
- deadline: ""
- description: Mô tả chi tiết vai trò, đóng góp và trách nhiệm chính (ít nhất 2 đoạn văn mạch lạc)
- requirements: Danh sách yêu cầu kỹ thuật và kỹ năng mềm rõ ràng, chuyên nghiệp
- benefits: Gói đãi ngộ hấp dẫn (lương cạnh tranh, thưởng dự án, bảo hiểm cao cấp, đào tạo...)
- skills: Danh sách 4-8 kỹ năng then chốt ({name: string, required: boolean})
- criteria: Danh sách 3-5 tiêu chí đánh giá đo lường được ({id: string, type: 'EXPERIENCE'|'EDUCATION'|'LANGUAGE'|'OTHER', description: string, required: boolean, weight: float})
- suggestedDepartment: 'IT', 'Thiết kế', hoặc 'Dữ liệu & AI'

Hãy viết bằng tiếng Việt chuẩn mực, chuyên nghiệp và cuốn hút ứng viên tài năng.
"""


def clean_json_text(text: str) -> str:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    return cleaned.strip()


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                pages_text.append(t.strip())
        return "\n\n".join(pages_text)
    elif lower_name.endswith((".txt", ".md")):
        return file_bytes.decode("utf-8", errors="replace")
    elif lower_name.endswith(".docx"):
        # Simple extraction for docx xml if needed, or plain text
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                xml_content = zf.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                texts = [node.text for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n\n".join(paragraphs)
        except Exception:
            return file_bytes.decode("utf-8", errors="replace")
    return file_bytes.decode("utf-8", errors="replace")


async def parse_jd_content(file_bytes: bytes | None, filename: str | None, text_content: str | None) -> ParsedJobDraftResult:
    extracted = ""
    if file_bytes and filename:
        extracted = extract_text_from_file(file_bytes, filename)
    elif text_content:
        extracted = text_content.strip()

    if not extracted or len(extracted.strip()) < 10:
        raise ValueError("Nội dung tài liệu JD quá ngắn hoặc không đọc được chữ.")

    prompt = SYSTEM_PARSE_PROMPT + "\n<INPUT_JSON>\n" + json.dumps({"jd_text": extracted[:50000]}, ensure_ascii=False)
    schema = strict_schema(ParsedJobDraftResult.model_json_schema())

    for provider in sorted(upstream.providers(), key=lambda p: p.name != "gemini"):
        if not upstream.available(provider):
            continue
        try:
            raw = await upstream.generate(replace(provider, timeout=25), prompt, schema=schema, max_tokens=8192)
            parsed_dict = json.loads(clean_json_text(raw))
            # Assign ids to criteria if missing
            for idx, crit in enumerate(parsed_dict.get("criteria", [])):
                if not crit.get("id"):
                    crit["id"] = f"crit-{idx + 1}"
            result = ParsedJobDraftResult.model_validate(parsed_dict)
            upstream.succeeded(provider)
            return result
        except upstream.ProviderRefused:
            raise
        except Exception as error:
            upstream.failed(provider, getattr(error, "retry_after", 15))
            logger.warning("JD parser provider failed (%s): %s", type(error).__name__, str(error))

    raise upstream.ProviderUnavailable("Dịch vụ AI chưa phân tích được JD lúc này. Vui lòng thử lại sau.")


async def generate_jd_content(brief: GenerateJobBriefRequest) -> ParsedJobDraftResult:
    prompt = SYSTEM_GENERATE_PROMPT + "\n<INPUT_JSON>\n" + json.dumps(brief.model_dump(), ensure_ascii=False)
    schema = strict_schema(ParsedJobDraftResult.model_json_schema())

    for provider in sorted(upstream.providers(), key=lambda p: p.name != "gemini"):
        if not upstream.available(provider):
            continue
        try:
            raw = await upstream.generate(replace(provider, timeout=25), prompt, schema=schema, max_tokens=8192)
            parsed_dict = json.loads(clean_json_text(raw))
            for idx, crit in enumerate(parsed_dict.get("criteria", [])):
                if not crit.get("id"):
                    crit["id"] = f"crit-{idx + 1}"
            result = ParsedJobDraftResult.model_validate(parsed_dict)
            upstream.succeeded(provider)
            return result
        except upstream.ProviderRefused:
            raise
        except Exception as error:
            upstream.failed(provider, getattr(error, "retry_after", 15))
            logger.warning("JD generator provider failed (%s): %s", type(error).__name__, str(error))

    raise upstream.ProviderUnavailable("Dịch vụ AI chưa tạo được JD lúc này. Vui lòng thử lại sau.")
