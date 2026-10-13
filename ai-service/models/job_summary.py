from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal['responsibilities', 'required', 'preferred', 'notes']


class SummaryModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class SummarySource(SummaryModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=30000)
    categories: list[Category] = Field(min_length=1, max_length=4)


class JobSummaryRequest(SummaryModel):
    job_id: str = Field(min_length=1, max_length=36)
    source_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    sources: list[SummarySource] = Field(min_length=1, max_length=220)

    @model_validator(mode='after')
    def bounded_unique_sources(self):
        if len({s.id for s in self.sources}) != len(self.sources):
            raise ValueError('Duplicate source ID')
        if sum(len(s.text) for s in self.sources) > 100000:
            raise ValueError('Job content is too large')
        return self


class SummaryItem(SummaryModel):
    category: Category
    text: str = Field(min_length=1, max_length=350)
    source_id: str = Field(min_length=1, max_length=100)
    quote: str = Field(min_length=1, max_length=800)


class JobSummaryResult(SummaryModel):
    job_id: str
    source_hash: str
    prompt_version: str
    model_name: str
    items: list[SummaryItem] = Field(min_length=1, max_length=16)
