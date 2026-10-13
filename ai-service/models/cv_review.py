import json
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReviewModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class ReviewCv(ReviewModel):
    desiredPosition: str | None = Field(default=None, max_length=255)
    summary: str | None = Field(default=None, max_length=6000)
    skills: list[str] = Field(max_length=100)
    experiences: list[dict] = Field(max_length=30)
    educations: list[dict] = Field(max_length=30)
    projects: list[dict] = Field(max_length=30)
    certifications: list[dict] = Field(default_factory=list, max_length=30)
    languages: list[dict] = Field(default_factory=list, max_length=30)
    awards: list[dict] = Field(default_factory=list, max_length=30)
    activities: list[dict] = Field(default_factory=list, max_length=30)

    @model_validator(mode='after')
    def bounded(self):
        if len(json.dumps(self.model_dump(), ensure_ascii=False)) > 60000:
            raise ValueError('CV content exceeds review budget')
        return self


class ReviewJob(ReviewModel):
    title: str = Field(max_length=255)
    description: str = Field(max_length=40000)
    requirements: str = Field(max_length=40000)
    skills: list[str] = Field(max_length=100)
    experienceLevel: str = Field(max_length=255)


class Target(ReviewModel):
    section: Literal['summary', 'experience', 'project']
    index: int = Field(ge=-1, le=29, strict=True)


class ReviewRequest(ReviewModel):
    resume: ReviewCv
    job: ReviewJob | None = None


class RefineRequest(ReviewRequest):
    target: Target
    answer: str = Field(min_length=1, max_length=3000)


class ReviewItem(Target):
    kind: Literal['ADD', 'CLARIFY', 'REWRITE']
    reason: str = Field(min_length=1, max_length=1000)
    evidence: str = Field(max_length=2000)
    job_evidence: str = Field(max_length=1000)
    question: str = Field(max_length=240)
    suggestion: str = Field(max_length=6000)


class ReviewContent(ReviewModel):
    overview: str = Field(min_length=1, max_length=1400)
    items: list[ReviewItem] = Field(max_length=6)


class ReviewResult(ReviewContent):
    model_name: str
    prompt_version: str


class RefinedContent(ReviewModel):
    suggestion: str = Field(min_length=1, max_length=6000)
    questions: list[str] = Field(max_length=3)


class RefinedResult(RefinedContent):
    model_name: str
    prompt_version: str
