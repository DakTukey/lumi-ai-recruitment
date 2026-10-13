import logging
from fastapi import APIRouter, HTTPException
from models.cv_review import ReviewRequest, RefineRequest, ReviewResult, RefinedResult
from services.cv_review import run

router = APIRouter()
logger = logging.getLogger(__name__)

async def handle(req, refine=False):
    try:
        return await run(req, refine)
    except ValueError:
        raise HTTPException(status_code=422, detail='Mục CV hoặc đề xuất chưa hợp lệ.') from None
    except Exception as error:
        logger.warning('CV review unavailable (%s)', type(error).__name__)
        raise HTTPException(status_code=503, detail='AI rà soát tạm thời không khả dụng.') from None

@router.post('/cv-review', response_model=ReviewResult)
async def review(req: ReviewRequest):
    return await handle(req)

@router.post('/cv-review/refine', response_model=RefinedResult)
async def refine(req: RefineRequest):
    return await handle(req, True)
