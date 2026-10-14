import logging
from fastapi import APIRouter, HTTPException, status

from models.email_composer import GenerateEmailRequest, GeneratedEmailResult
from services.email_composer import generate_recruitment_email
from services import cv_writing_providers as upstream

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emails", tags=["emails"])


@router.post("/generate", response_model=GeneratedEmailResult)
async def generate_email_endpoint(request: GenerateEmailRequest):
    """
    Sinh email tuyển dụng (mời phỏng vấn, từ chối, offer, bổ sung thông tin) bằng AI.
    """
    try:
        return await generate_recruitment_email(request)
    except upstream.ProviderUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except upstream.ProviderRefused as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate email")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi tạo email: {str(e)}",
        )
