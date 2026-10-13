import logging
from fastapi import APIRouter, HTTPException
from models.cv_writing import CvWritingRequest, CvWritingResult
from services.cv_writing import rewrite

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post('/cv-writing', response_model=CvWritingResult)
async def cv_writing(req: CvWritingRequest) -> CvWritingResult:
    try:
        return await rewrite(req)
    except ValueError:
        logger.warning('Invalid CV writing response')
        raise HTTPException(status_code=422, detail='Chưa tạo được đề xuất hợp lệ.') from None
    except Exception as e:
        # Do not log CV content, prompts or provider response bodies.
        logger.warning('CV writing unavailable (%s)', type(e).__name__)
        raise HTTPException(status_code=503, detail='AI tạm thời không khả dụng.') from None
