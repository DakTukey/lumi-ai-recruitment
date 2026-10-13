from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import assess, job_summary, cv_writing, cv_review

app = FastAPI(
    title="Lumi AI Service",
    description="AI Assessment service cho hệ thống tuyển dụng Lumi Studio",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(assess.router, prefix="/api")
app.include_router(job_summary.router, prefix="/api")
app.include_router(cv_writing.router, prefix="/api")
app.include_router(cv_review.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "lumi-ai"}
