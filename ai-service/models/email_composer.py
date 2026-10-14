from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EmailTemplateType(str, Enum):
    INTERVIEW = "INTERVIEW"
    REJECTION = "REJECTION"
    OFFER = "OFFER"
    INFO_REQUEST = "INFO_REQUEST"


class GenerateEmailRequest(BaseModel):
    template_type: EmailTemplateType = Field(..., description="Loại thư tuyển dụng")
    candidate_name: str = Field(..., description="Họ và tên ứng viên")
    candidate_email: Optional[str] = Field("", description="Email ứng viên")
    job_title: str = Field(..., description="Vị trí ứng tuyển")
    company_name: Optional[str] = Field("Lumi Studio", description="Tên công ty tuyển dụng")
    interview_time: Optional[str] = Field("", description="Thời gian phỏng vấn dự kiến")
    interview_format: Optional[str] = Field("", description="Hình thức phỏng vấn: Online hoặc Trực tiếp")
    interview_location: Optional[str] = Field("", description="Địa điểm văn phòng hoặc link họp trực tuyến")
    salary_offer: Optional[str] = Field("", description="Mức lương đề xuất (nếu là offer)")
    start_date: Optional[str] = Field("", description="Ngày bắt đầu đi làm dự kiến")
    rejection_reason: Optional[str] = Field("", description="Lý do từ chối (nếu có)")
    additional_notes: Optional[str] = Field("", description="Ghi chú thêm từ nhà tuyển dụng")
    tone: Optional[str] = Field("professional", description="professional | friendly | formal")


class GeneratedEmailResult(BaseModel):
    subject: str = Field(..., description="Tiêu đề thư tuyển dụng chuẩn mực")
    body: str = Field(..., description="Toàn bộ nội dung thư hoàn chỉnh, xuống dòng rõ ràng, đầy đủ lời chào và chữ ký")
