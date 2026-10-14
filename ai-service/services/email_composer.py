import json
import logging
import re
from dataclasses import replace

from models.email_composer import GenerateEmailRequest, GeneratedEmailResult
from services import cv_writing_providers as upstream
from services.grounded_generation import strict_schema

logger = logging.getLogger(__name__)

SYSTEM_EMAIL_PROMPT = """Bạn là Chuyên gia Tuyển dụng và Thu hút Nhân tài (Talent Acquisition Lead) chuyên nghiệp.
Nhiệm vụ của bạn là soạn thảo một bức thư (email) gửi cho ứng viên theo đúng thông tin đầu vào và loại thư yêu cầu.

Yêu cầu định dạng đầu ra là một đối tượng JSON chính xác:
- subject: Tiêu đề email ngắn gọn, rõ ràng, chuyên nghiệp (ví dụ: "[Lumi Studio] Thư mời phỏng vấn vị trí Senior React Developer", "[Lumi Studio] Thư cảm ơn và thông báo kết quả ứng tuyển vị trí...", "[Lumi Studio] Thư mời nhận việc - Vị trí...")
- body: Nội dung email hoàn chỉnh bằng tiếng Việt, được định dạng với các đoạn văn ngắt dòng (\\n\\n) rõ ràng, lịch sự, bao gồm:
  1. Lời chào trang trọng với họ tên ứng viên (ví dụ: "Kính gửi bạn [Họ tên]," hoặc "Chào bạn [Họ tên],")
  2. Đoạn mở đầu: Cảm ơn sự quan tâm của ứng viên đối với vị trí tại công ty
  3. Đoạn nội dung chính (tùy theo loại thư):
     - INTERVIEW (Mời phỏng vấn):
       * Nêu rõ vị trí phỏng vấn.
       * Thời gian phỏng vấn (dựa trên interview_time).
       * Hình thức phỏng vấn (Online hoặc Trực tiếp tại văn phòng).
       * Địa điểm / Link họp (dựa trên interview_location).
       * Những điểm cần chuẩn bị hoặc tài liệu mang theo (nếu có).
       * Đề nghị ứng viên phản hồi email để xác nhận sự tham gia trước thời hạn hợp lý.
     - REJECTION (Thư từ chối / Cảm ơn):
       * Cảm ơn chân thành vì ứng viên đã dành thời gian ứng tuyển và quan tâm tới công ty.
       * Khéo léo, tinh tế thông báo rằng sau khi xem xét kỹ lưỡng, công ty đã lựa chọn ứng viên có độ phù hợp cao hơn với các yêu cầu cụ thể ở thời điểm hiện tại.
       * Đánh giá cao năng lực và tiềm năng của ứng viên.
       * Xin phép lưu giữ thông tin hồ sơ vào cơ sở dữ liệu nhân tài (Talent Pool) để ưu tiên liên hệ cho các cơ hội phù hợp hơn trong tương lai.
       * Lời chúc chân thành cho sự nghiệp của ứng viên.
     - OFFER (Mời nhận việc):
       * Lời chúc mừng nồng nhiệt vì ứng viên đã xuất sắc vượt qua các vòng tuyển dụng.
       * Vị trí làm việc chính thức.
       * Mức đãi ngộ / lương (dựa trên salary_offer nếu có).
       * Ngày bắt đầu nhận việc dự kiến (dựa trên start_date nếu có).
       * Các bước tiếp theo để hoàn tất thủ tục và hạn phản hồi xác nhận nhận việc.
     - INFO_REQUEST (Yêu cầu bổ sung thông tin):
       * Thông báo hồ sơ đang trong quá trình xem xét.
       * Nêu rõ những thông tin/tài liệu cần ứng viên bổ sung (portfolio, chứng chỉ, thời gian làm việc...).
       * Thời hạn và cách thức gửi lại thông tin.
  4. Lời cảm ơn và chữ ký chuyên nghiệp của Bộ phận Tuyển dụng (Bộ phận Tuyển dụng - Lumi Studio).

VĂN PHONG (tone):
- Nếu tone là 'formal': Trang trọng, chuẩn mực công sở truyền thống.
- Nếu tone là 'friendly': Thân thiện, cởi mở, ấm áp nhưng vẫn lịch thiệp.
- Mặc định 'professional': Chuyên nghiệp, hiện đại, tôn trọng và rõ ràng.

QUY TẮC BẮT BUỘC:
1. Đảm bảo ngôn từ tiếng Việt tự nhiên, không rập khuôn máy móc, không lỗi chính tả.
2. Trả về định dạng JSON thuần khớp với schema, không bọc markdown giải thích ngoài JSON.
"""


def clean_json_text(text: str) -> str:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    return cleaned.strip()


async def generate_recruitment_email(request: GenerateEmailRequest) -> GeneratedEmailResult:
    prompt = SYSTEM_EMAIL_PROMPT + "\n<INPUT_JSON>\n" + json.dumps(request.model_dump(), ensure_ascii=False)
    schema = strict_schema(GeneratedEmailResult.model_json_schema())

    for provider in sorted(upstream.providers(), key=lambda p: p.name != "gemini"):
        if not upstream.available(provider):
            continue
        try:
            raw = await upstream.generate(replace(provider, timeout=25), prompt, schema=schema, max_tokens=4096)
            parsed_dict = json.loads(clean_json_text(raw))
            result = GeneratedEmailResult.model_validate(parsed_dict)
            upstream.succeeded(provider)
            return result
        except upstream.ProviderRefused:
            raise
        except Exception as error:
            upstream.failed(provider, getattr(error, "retry_after", 15))
            logger.warning("Email generator provider failed (%s): %s", type(error).__name__, str(error))

    raise upstream.ProviderUnavailable("Dịch vụ AI chưa tạo được email lúc này. Vui lòng thử lại sau.")
