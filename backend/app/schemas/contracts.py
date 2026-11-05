from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Credentials(StrictModel):
    handle: str = Field(min_length=3, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    grade: int = Field(default=7, ge=1, le=12)


class ConsentInput(StrictModel):
    granted: bool


class AssessmentInput(StrictModel):
    subject_id: str
    stage: Literal['pre', 'post', 'transfer', 'retention'] = 'pre'
    intervention_id: str | None = None


class AnswerInput(StrictModel):
    item_id: str
    answer: str = Field(min_length=1, max_length=2000)
    reasoning: str = Field(min_length=1, max_length=4000)
    confidence: int = Field(ge=1, le=5)


class InterventionInput(StrictModel):
    student_id: str
    subject_id: str
    baseline_assessment_id: str
    concept_id: str
    activity: str = Field(min_length=10, max_length=2000)
    expected_outcome: str = Field(min_length=10, max_length=1000)
    review_note: str = Field(min_length=5, max_length=1000)


class InterventionUpdate(StrictModel):
    status: Literal['assigned', 'completed', 'cancelled']
    review_note: str = Field(min_length=5, max_length=1000)


class AIInput(StrictModel):
    operation: Literal['reasoning_analysis', 'misconception_suggestions', 'verification_candidate', 'student_explanation', 'intervention_suggestions']
    model_id: str | None = Field(default=None, max_length=200)
    allow_paid: bool = False
    auto_model: bool = False
    gemini_analysis: bool = False


class AISuggestion(StrictModel):
    explanation: str = Field(min_length=1, max_length=3000)
    source_response_ids: list[str] = Field(min_length=1, max_length=50)
    suggestions: list[str] = Field(max_length=8)
    candidate: dict | None = None

    @field_validator('suggestions')
    @classmethod
    def bounded_suggestions(cls, values):
        if any(len(v) > 1000 for v in values):
            raise ValueError('Suggestion too long')
        return values
