import logging
from fastapi import APIRouter, File, UploadFile, HTTPException
from models.cv_parser import ParsedCvResult
from services.cv_parser import parse_cv_content
from services.cv_writing_providers import ProviderUnavailable, ProviderRefused

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/cv-parser", response_model=ParsedCvResult)
async def parse_cv(file: UploadFile = File(...)) -> ParsedCvResult:
    filename = file.filename or "cv.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Hệ thống hiện chỉ hỗ trợ tệp định dạng PDF.")

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Dung lượng tệp vượt quá giới hạn 10MB.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Tệp tải lên rỗng. Vui lòng chọn tệp có nội dung.")

    try:
        result = await parse_cv_content(content, filename)
        logger.info("CV parsing completed")
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Chưa thể đọc PDF. Kiểm tra tệp không khóa, không hỏng và tối đa 10 trang.")
    except ProviderRefused:
        raise HTTPException(status_code=422, detail="Dịch vụ AI không xử lý tài liệu này.")
    except ProviderUnavailable:
        raise HTTPException(status_code=503, detail="Dịch vụ đọc CV tạm thời không khả dụng.")
    except Exception as e:
        logger.error("CV parser failed (%s)", type(e).__name__)
        raise HTTPException(status_code=500, detail="Không thể bóc tách nội dung tệp CV. Vui lòng thử lại sau.")
