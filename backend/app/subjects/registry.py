from app.subjects.base_pack import SubjectPack, Relationship
from app.subjects.mathematics import MATHEMATICS
from app.subjects.science import SCIENCE
from app.subjects.coding import CODING

PACKS = {p.id: p for p in [MATHEMATICS, SCIENCE, CODING]}

# Illustrative conceptual connection, not a prerequisite or validated dependency.
CROSS_SUBJECT_RELATIONSHIPS = [Relationship(
    source_id='mathematics.ratios', target_id='science.conservation', relationship_type='cross_subject',
    source='LBA sample author: quantitative reasoning can be explored in energy accounting; unvalidated',
    confidence=0.3, version='cross-sample-v1', reviewer_status='unreviewed', evidence_status='author_defined',
)]


def get_pack(subject_id: str) -> SubjectPack:
    return PACKS[subject_id]
