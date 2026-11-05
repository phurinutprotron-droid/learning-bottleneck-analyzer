from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Concept(BaseModel):
    id: str
    name: str
    topic: str
    skills: list[str]


class Relationship(BaseModel):
    source_id: str
    target_id: str
    relationship_type: Literal['prerequisite', 'related', 'cross_subject'] = 'prerequisite'
    source: str = 'LBA sample content author; no expert review'
    evidence_status: Literal['author_defined', 'expert_defined', 'statistical_association', 'experimental'] = 'author_defined'
    confidence: float = Field(default=0.5, ge=0, le=1)
    version: str = 'sample-v1'
    reviewer_status: str = 'unreviewed'


class Rubric(BaseModel):
    required_groups: list[list[str]]
    misconception_terms: list[str]
    misconception: str
    explanation: str


class Item(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str
    version: str = 'sample-v1'
    concept_id: str
    skill_tags: list[str]
    prerequisite_tags: list[str] = []
    stage: Literal['pre', 'verification', 'post', 'transfer', 'retention']
    kind: Literal['multiple_choice', 'short_answer']
    prompt: str
    options: list[str] = []
    answers: list[str]
    rubric: Rubric
    difficulty: Literal['introductory', 'intermediate'] = 'introductory'
    objective: str
    discriminates: list[str] = ['knowledge_gap', 'reasoning_gap', 'misconception']

    @model_validator(mode='after')
    def validate_item(self):
        if not self.answers or not self.objective or not self.rubric.required_groups:
            raise ValueError('Answer, objective, and rubric required')
        if self.kind == 'multiple_choice' and (len(self.options) < 2 or any(a not in self.options for a in self.answers)):
            raise ValueError('Multiple choice keys must be approved options')
        return self


class SubjectPack(BaseModel):
    id: str
    name: str
    version: str = 'sample-v1'
    graph_version: str = 'sample-v1'
    grade_levels: list[int] = [7, 8]
    review_status: str = 'Unvalidated sample content — software demonstration only'
    concepts: list[Concept]
    relationships: list[Relationship]
    items: list[Item]

    @model_validator(mode='after')
    def validate_references(self):
        ids = {c.id for c in self.concepts}
        if len(ids) != len(self.concepts) or len({i.id for i in self.items}) != len(self.items):
            raise ValueError('Duplicate concept or item ID')
        if any(i.concept_id not in ids or any(p not in ids for p in i.prerequisite_tags) for i in self.items):
            raise ValueError('Unknown concept reference')
        if any(r.source_id not in ids or r.target_id not in ids for r in self.relationships):
            raise ValueError('Unknown relationship endpoint')
        return self

    def item(self, item_id: str) -> Item:
        return next(i for i in self.items if i.id == item_id)


def public_item(item: Item) -> dict:
    return item.model_dump(exclude={'answers', 'rubric', 'discriminates'})
