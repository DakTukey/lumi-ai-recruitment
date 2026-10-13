from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class WritingModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class CvWritingRequest(WritingModel):
    section: Literal['summary', 'experience', 'project']
    action: Literal['polish', 'shorten', 'bullets']
    text: str = Field(min_length=1, max_length=6000)
    context: str = Field(default='', max_length=1000)


class CvWritingContent(WritingModel):
    suggestion: str = Field(min_length=1, max_length=6000)
    questions: list[str] = Field(max_length=3)


class CvWritingResult(CvWritingContent):
    model_name: str
    prompt_version: str
