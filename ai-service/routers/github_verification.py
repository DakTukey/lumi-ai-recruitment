import logging
from fastapi import APIRouter, HTTPException
from models.github_verification import GithubVerifyRequest, GithubVerificationResult
from services.github_verifier import verify_github
from services import cv_writing_providers as upstream

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post('/github-verify', response_model=GithubVerificationResult)
async def github_verify(req: GithubVerifyRequest):
    try:
        return await verify_github(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    except PermissionError:
        raise HTTPException(status_code=503, detail='GitHub API tạm thời bị giới hạn. Hãy thêm GITHUB_TOKEN vào .env.') from None
    except upstream.ProviderUnavailable:
        raise HTTPException(status_code=503, detail='AI tạm thời không khả dụng. Hãy thử lại sau.') from None
    except Exception as error:
        logger.warning('GitHub verify error (%s)', type(error).__name__)
        raise HTTPException(status_code=503, detail='Không thể kiểm tra GitHub lúc này. Hãy thử lại sau.') from None
