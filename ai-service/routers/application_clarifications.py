import logging
from fastapi import APIRouter, HTTPException
from models.application_clarifications import ClarificationRequest, ClarificationResult
from services.application_clarifications import run

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post('/application-clarifications', response_model=ClarificationResult)
async def generate(request: ClarificationRequest):
    try:
        return await run(request)
    except Exception as error:
        logger.warning('Application clarification unavailable (%s)', type(error).__name__)
        raise HTTPException(status_code=503, detail='Chưa thể tạo câu hỏi bổ sung. Hồ sơ đã nộp vẫn được giữ nguyên.') from None
