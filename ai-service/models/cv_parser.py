from typing import Optional
from pydantic import BaseModel, Field


class ParsedExperience(BaseModel):
    company: str = ""
    position: str = ""
    startDate: str = ""
    endDate: str = ""
    current: bool = False
    description: str = ""


class ParsedEducation(BaseModel):
    school: str = ""
    degree: str = ""
    field: str = ""
    startDate: str = ""
    endDate: str = ""
    description: str = ""
    gpa: Optional[float] = None
    gpaScale: Optional[int] = None


class ParsedProject(BaseModel):
    name: str = ""
    role: str = ""
    url: str = ""
    description: str = ""
    startDate: str = ""
    endDate: str = ""
    current: bool = False
    technologies: list[str] = Field(default_factory=list)


class ParsedCertification(BaseModel):
    name: str = ""
    issuer: str = ""
    issuedDate: str = ""
    credentialUrl: str = ""


class ParsedLanguage(BaseModel):
    name: str = ""
    proficiency: str = ""
    certification: str = ""


class ParsedAward(BaseModel):
    title: str = ""
    issuer: str = ""
    awardedDate: str = ""
    description: str = ""


class ParsedActivity(BaseModel):
    name: str = ""
    organization: str = ""
    role: str = ""
    startDate: str = ""
    endDate: str = ""
    current: bool = False
    description: str = ""


class ParsedExtraSection(BaseModel):
    title: str = Field(max_length=255)
    content: str = Field(max_length=12000)


class FieldSource(BaseModel):
    path: str = Field(max_length=150)
    quote: str = Field(max_length=600)
    page: int = Field(ge=1, le=10)
    verified: bool = False


class ParsedCvResult(BaseModel):
    title: str = "CV từ tệp tải lên"
    fullName: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    desiredPosition: str = ""
    summary: str = ""
    githubUrl: str = ""
    linkedinUrl: str = ""
    portfolioUrl: str = ""
    skills: list[str] = Field(default_factory=list)
    experiences: list[ParsedExperience] = Field(default_factory=list)
    educations: list[ParsedEducation] = Field(default_factory=list)
    projects: list[ParsedProject] = Field(default_factory=list)
    certifications: list[ParsedCertification] = Field(default_factory=list)
    languages: list[ParsedLanguage] = Field(default_factory=list)
    awards: list[ParsedAward] = Field(default_factory=list)
    activities: list[ParsedActivity] = Field(default_factory=list)

    extraSections: list[ParsedExtraSection] = Field(default_factory=list, max_length=30)
    warnings: list[str] = Field(default_factory=list, max_length=50)
    extractedText: str = ""
    pageCount: int = 0
    sources: list[FieldSource] = Field(default_factory=list, max_length=80)
