"""Pydantic models cho tính năng xác minh GitHub."""
from pydantic import BaseModel, ConfigDict, Field


class GithubModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class GithubVerifyRequest(GithubModel):
    github_url: str = Field(min_length=1, max_length=2048)
    cv_skills: list[str] = Field(default_factory=list, max_length=100)
    cv_projects: list[dict] = Field(default_factory=list, max_length=30)


class VerifiedSkill(GithubModel):
    skill: str = Field(min_length=1, max_length=200)
    evidence: str = Field(min_length=1, max_length=500)


class UnverifiedSkill(GithubModel):
    skill: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=500)


class MatchedProject(GithubModel):
    cv_project: str = Field(min_length=1, max_length=200)
    github_repo: str = Field(min_length=1, max_length=200)
    confidence: str = Field(min_length=1, max_length=100)  # 'cao', 'trung bình', 'thấp'


class GithubVerificationResult(GithubModel):
    github_username: str
    verified_skills: list[VerifiedSkill] = Field(default_factory=list)
    unverified_skills: list[UnverifiedSkill] = Field(default_factory=list)
    matched_projects: list[MatchedProject] = Field(default_factory=list)
    code_quality_score: int = Field(ge=1, le=10, strict=True)
    technical_summary: str = Field(min_length=1, max_length=1000)
    interview_suggestions: list[str] = Field(default_factory=list, max_length=5)
    vibe_coding_flags: list[str] = Field(default_factory=list, max_length=5)
    has_tests: bool
    has_docker: bool
    has_ci: bool
    top_languages: dict = Field(default_factory=dict)  # {'Python': 45.2, 'Java': 30.1, ...}
    model_name: str = ''
