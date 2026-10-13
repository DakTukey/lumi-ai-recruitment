import logging
from fastapi import APIRouter, HTTPException
from models.schemas import AssessRequest, AssessResult
from services.gemini_service import assess

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/assess", response_model=AssessResult)
async def assess_application(req: AssessRequest) -> AssessResult:
    """
    Đánh giá mức độ phù hợp giữa CV ứng viên và tin tuyển dụng.
    Spring Boot gọi endpoint này sau khi HR bấm "Phân tích AI".
    """
    try:
        result = await assess(req)
        logger.info(
            "Assessment done: application_id=%s score=%d",
            req.application_id,
            result.score,
        )
        return result
    except ValueError as e:
        logger.warning("Invalid AI response for application %s", req.application_id)
        raise HTTPException(status_code=422, detail="Kết quả AI không hợp lệ hoặc thiếu tiêu chí.")
    except Exception as e:
        logger.warning("AI unavailable for application %s (%s)", req.application_id, type(e).__name__)
        raise HTTPException(status_code=503, detail="AI service tạm thời không khả dụng.")
