import json
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Target(StrictModel):
    criterion_key: str = Field(min_length=1, max_length=100)
    requirement: str = Field(min_length=1, max_length=20000)
    match_level: Literal['PARTIAL', 'NO_EVIDENCE']
    evidence: str = Field(max_length=20000)


def contains(source, quote):
    if isinstance(source, str):
        return quote in source
    if isinstance(source, dict):
        return any(contains(v, quote) for v in source.values())
    if isinstance(source, list):
        return any(contains(v, quote) for v in source)
    return False


class ClarificationRequest(StrictModel):
    job: dict
    resume: dict
    targets: list[Target] = Field(min_length=1, max_length=3)

    @model_validator(mode='after')
    def validate_context(self):
        if len(json.dumps(self.model_dump(), ensure_ascii=False)) > 180000:
            raise ValueError('Context exceeds budget')
        allowed = {'skill:' + str(s.get('id')): s.get('name') for s in self.job.get('skills', [])}
        allowed.update({'criterion:' + str(c.get('id')): c.get('description') for c in self.job.get('criteria', [])})
        seen = set()
        for target in self.targets:
            if target.criterion_key in seen or allowed.get(target.criterion_key) != target.requirement:
                raise ValueError('Unknown or duplicate requirement')
            seen.add(target.criterion_key)
            if target.match_level == 'NO_EVIDENCE' and target.evidence:
                raise ValueError('No-evidence target cannot contain a quote')
            if target.match_level == 'PARTIAL' and (not target.evidence or not contains(self.resume, target.evidence)):
                raise ValueError('Evidence is not an exact CV quote')
        return self


class GeneratedQuestion(StrictModel):
    criterion_key: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=1200)


class GeneratedContent(StrictModel):
    questions: list[GeneratedQuestion] = Field(min_length=1, max_length=3)


class ClarificationResult(GeneratedContent):
    model_name: str = ''
    prompt_version: Literal['clarifications-v1'] = 'clarifications-v1'
