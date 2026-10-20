import logging
from fastapi import APIRouter, HTTPException
from models.interview_scorecard import ScorecardGenerateRequest, ScorecardGenerateResult
from services.interview_scorecard import generate_scorecard
from services import cv_writing_providers as upstream

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post('/interview-scorecard/generate', response_model=ScorecardGenerateResult)
async def generate_interview_scorecard(req: ScorecardGenerateRequest):
    try:
        return await generate_scorecard(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    except upstream.ProviderUnavailable:
        raise HTTPException(status_code=503, detail='Dịch vụ AI tạo phiếu phỏng vấn tạm thời không khả dụng.') from None
    except Exception as error:
        logger.warning('Interview scorecard error (%s)', type(error).__name__)
        raise HTTPException(status_code=503, detail='Không thể tạo phiếu phỏng vấn lúc này. Hãy thử lại sau.') from None

