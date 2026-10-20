"""Pydantic models cho tính năng tạo Phiếu phỏng vấn thông minh (Interview Scorecard)."""
from pydantic import BaseModel, ConfigDict, Field


class ScorecardModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class ScorecardQuestion(ScorecardModel):
    id: str = Field(min_length=1, max_length=50)
    question: str = Field(min_length=1, max_length=500)
    target_skill: str = Field(min_length=1, max_length=200)
    context: str = Field(min_length=1, max_length=500)
    rubric_good: str = Field(min_length=1, max_length=500)
    rubric_poor: str = Field(min_length=1, max_length=500)


class ScorecardSection(ScorecardModel):
    title: str = Field(min_length=1, max_length=200)
    questions: list[ScorecardQuestion] = Field(min_length=1, max_length=10)


class ScorecardGenerateRequest(ScorecardModel):
    job_title: str = Field(min_length=1, max_length=255)
    job_requirements: str = Field(default='', max_length=10000)
    candidate_name: str = Field(default='', max_length=255)
    cv_summary: str = Field(default='', max_length=5000)
    cv_skills: list[str] = Field(default_factory=list, max_length=50)
    cv_projects: list[dict] = Field(default_factory=list, max_length=10)
    assessment_missing_skills: list[str] = Field(default_factory=list, max_length=20)
    github_unverified_skills: list[str] = Field(default_factory=list, max_length=20)
    github_vibe_flags: list[str] = Field(default_factory=list, max_length=10)


class ScorecardGenerateResult(ScorecardModel):
    sections: list[ScorecardSection] = Field(min_length=1, max_length=5)
    model_name: str = ''

