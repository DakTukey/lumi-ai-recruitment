from typing import Optional, List
from pydantic import BaseModel, Field


class JobSkillItem(BaseModel):
    name: str = ""
    required: bool = True


class JobCriterionItem(BaseModel):
    id: str = ""
    type: str = "EXPERIENCE"  # EXPERIENCE, EDUCATION, LANGUAGE, OTHER
    description: str = ""
    required: bool = True
    weight: float = 20.0


class ParsedJobDraftResult(BaseModel):
    title: str = ""
    category: str = "Công nghệ"
    headcount: str = "1"
    location: str = "Đà Nẵng"
    level: str = "Middle"  # Intern, Junior, Middle, Senior
    mode: str = "Hybrid"   # Tại văn phòng, Hybrid, Remote
    employmentType: str = "FULL_TIME"  # FULL_TIME, PART_TIME, INTERNSHIP, CONTRACT
    salaryMode: str = "NEGOTIABLE"     # NEGOTIABLE, RANGE, FROM, UP_TO
    salaryMin: str = ""
    salaryMax: str = ""
    deadline: str = ""
    description: str = ""
    requirements: str = ""
    benefits: str = ""
    skills: List[JobSkillItem] = Field(default_factory=list)
    criteria: List[JobCriterionItem] = Field(default_factory=list)
    suggestedDepartment: str = "IT"


class GenerateJobBriefRequest(BaseModel):
    title: str = ""
    level: str = "Middle"
    location: str = "Đà Nẵng"
    mode: str = "Hybrid"
    skills: str = ""
    requirements: str = ""
    tone: str = "professional"
