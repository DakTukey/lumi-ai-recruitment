import logging
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from models.job_creator import ParsedJobDraftResult, GenerateJobBriefRequest
from services.job_creator import parse_jd_content, generate_jd_content
from services.cv_writing_providers import ProviderUnavailable, ProviderRefused

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/jobs/parse-jd", response_model=ParsedJobDraftResult)
async def parse_jd(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
) -> ParsedJobDraftResult:
    file_bytes = None
    filename = None
    if file:
        filename = file.filename or "jd.pdf"
        file_bytes = await file.read(MAX_FILE_SIZE + 1)
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Dung lượng tệp vượt quá giới hạn 10MB.")

    if not file_bytes and (not text or not text.strip()):
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp tệp JD hoặc dán nội dung văn bản.")

    try:
        result = await parse_jd_content(file_bytes, filename, text)
        logger.info("JD parsing completed for: %s", result.title)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ProviderRefused:
        raise HTTPException(status_code=422, detail="Dịch vụ AI từ chối xử lý tài liệu này.")
    except ProviderUnavailable:
        raise HTTPException(status_code=503, detail="Dịch vụ AI phân tích JD tạm thời không khả dụng.")
    except Exception as e:
        logger.error("JD parser failed (%s): %s", type(e).__name__, str(e))
        raise HTTPException(status_code=500, detail="Không thể bóc tách nội dung JD. Vui lòng thử lại sau.")


@router.post("/jobs/generate-jd", response_model=ParsedJobDraftResult)
async def generate_jd(brief: GenerateJobBriefRequest) -> ParsedJobDraftResult:
    if not brief.title.strip():
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp chức danh hoặc vị trí cần tuyển.")

    try:
        result = await generate_jd_content(brief)
        logger.info("JD generation completed for: %s", result.title)
        return result
    except ProviderRefused:
        raise HTTPException(status_code=422, detail="Dịch vụ AI từ chối yêu cầu này.")
    except ProviderUnavailable:
        raise HTTPException(status_code=503, detail="Dịch vụ AI soạn JD tạm thời không khả dụng.")
    except Exception as e:
        logger.error("JD generator failed (%s): %s", type(e).__name__, str(e))
        raise HTTPException(status_code=500, detail="Không thể soạn thảo JD lúc này. Vui lòng thử lại sau.")
