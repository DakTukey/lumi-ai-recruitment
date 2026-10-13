import logging
from fastapi import APIRouter, HTTPException
from models.job_summary import JobSummaryRequest, JobSummaryResult
from services.job_summary import summarize

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post('/job-summary', response_model=JobSummaryResult)
async def job_summary(req: JobSummaryRequest) -> JobSummaryResult:
    try:
        return await summarize(req)
    except ValueError:
        logger.warning('Invalid AI summary for job %s', req.job_id)
        raise HTTPException(status_code=422, detail='Kết quả tóm tắt không có căn cứ hợp lệ.') from None
    except Exception as e:
        logger.warning('AI summary unavailable for job %s (%s)', req.job_id, type(e).__name__)
        raise HTTPException(status_code=503, detail='AI tạm thời không khả dụng.') from None
