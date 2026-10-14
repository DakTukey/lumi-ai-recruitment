from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class SnapshotModel(BaseModel):
    # Spring snapshots use camelCase; also accept snake_case for internal callers.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SkillInput(SnapshotModel):
    id: str
    name: str
    required: bool = True


class CriterionInput(SnapshotModel):
    id: str
    type: str
    description: str
    required: bool = True
    weight: float = Field(default=0, ge=0, le=100, allow_inf_nan=False)


class JobInput(SnapshotModel):
    title: str
    description: str
    requirements: str
    benefits: str
    location: str
    employment_type: str
    work_mode: str
    experience_level: str
    skills: list[SkillInput] = Field(default_factory=list, max_length=100)
    criteria: list[CriterionInput] = Field(default_factory=list, max_length=100)


class ResumeInput(SnapshotModel):
    full_name: str | None = None
    desired_position: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experiences: list[dict] = Field(default_factory=list)
    educations: list[dict] = Field(default_factory=list)
    projects: list[dict] = Field(default_factory=list)
    certifications: list[dict] = Field(default_factory=list)
    languages: list[dict] = Field(default_factory=list)
    awards: list[dict] = Field(default_factory=list)
    activities: list[dict] = Field(default_factory=list)
    extra_sections: list[dict] = Field(default_factory=list)
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None


class AssessRequest(BaseModel):
    application_id: str
    job: JobInput
    resume: ResumeInput


class CriterionResult(BaseModel):
    criterion_key: str
    skill: str = Field(min_length=1, max_length=2000)
    match_level: Literal['MATCHED', 'PARTIAL', 'NO_EVIDENCE']
    evidence: str = Field(max_length=20000)
    reason: str = Field(min_length=1, max_length=20000)
    points: int = Field(ge=0, le=100, strict=True)
    weight: float = Field(ge=0, le=100, allow_inf_nan=False)


class GapItem(BaseModel):
    skill: str = Field(min_length=1, max_length=2000)
    current_level: str = Field(min_length=1, max_length=2000)
    target_level: str = Field(min_length=1, max_length=2000)
    roadmap: str = Field(min_length=1, max_length=2000)


class InterviewQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    reason: str = Field(min_length=1, max_length=2000)
    target_skill: str = Field(min_length=1, max_length=2000)


class AssessResult(BaseModel):
    application_id: str
    model_name: str
    prompt_version: str
    score: int = Field(ge=0, le=100, strict=True)
    summary: str = Field(min_length=1, max_length=10000)
    matched_skills: list[str]
    missing_skills: list[str]
    criteria: list[CriterionResult]
    gaps: list[GapItem]
    interview_questions: list[InterviewQuestion]
