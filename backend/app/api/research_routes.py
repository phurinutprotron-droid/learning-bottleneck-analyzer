import csv
import io
from fastapi import APIRouter, Depends, Response as HTTPResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import Field, model_validator
from app.core.database import get_db
from app.core.security import researcher
from app.models.entities import User, Student, Assessment, Response, LearningResult, Verification, DiagnosticRun
from app.repositories.records import responses_for, audit
from app.analytics.evaluation_metrics import descriptive, reliability, agreement
from app.schemas.contracts import StrictModel

router = APIRouter(prefix='/research', tags=['Research'])


def dataset_summary(db, include_demo: bool = False):
    student_ids = select(Student.id).join(User, Student.user_id == User.id)
    if not include_demo:
        student_ids = student_ids.where(User.is_demo.is_(False))
    assessment_ids = select(Assessment.id).where(Assessment.student_id.in_(student_ids))
    results = list(db.scalars(select(LearningResult).where(LearningResult.assessment_id.in_(assessment_ids))))
    baselines = list(db.scalars(select(Assessment).where(Assessment.stage == 'pre', Assessment.status == 'completed', Assessment.student_id.in_(student_ids))))
    grouped = {}
    for a in baselines:
        grouped.setdefault(a.subject_version, []).append([int(r.correct) for r in sorted(responses_for(db, a.id), key=lambda r: r.item_id)])
    verifications = list(db.scalars(select(Verification).where(Verification.result.is_not(None), Verification.assessment_id.in_(assessment_ids))))
    contradictions = sum(any(u['verification_status'] == 'contradicted' for u in v.result['updates']) for v in verifications)
    stages = {stage: {'performance': descriptive([r.payload['followup_performance'] for r in results if r.payload['stage'] == stage]),
                      'descriptive_difference': descriptive([r.payload['descriptive_difference'] for r in results if r.payload['stage'] == stage and r.payload['descriptive_difference'] is not None])}
              for stage in ('post', 'transfer', 'retention')}
    return {'data_status': 'Includes demonstration records; software testing only' if include_demo else 'Demonstration accounts excluded; locally collected records are not validated research results',
            'include_demo': include_demo,
            'students': db.scalar(select(func.count()).select_from(Student).where(Student.id.in_(student_ids))),
            'responses': db.scalar(select(func.count()).select_from(Response).where(Response.assessment_id.in_(assessment_ids))), 'completed_baselines': len(baselines),
            'diagnostic_runs': db.scalar(select(func.count()).select_from(DiagnosticRun).where(DiagnosticRun.assessment_id.in_(assessment_ids))),
            'verification': {'evaluated': len(verifications), 'with_contradictions': contradictions,
                             'interpretation': 'Frequency of contradictory observations, not diagnostic accuracy.'},
            'stages': stages, 'reliability': [{'subject_version': key, 'n': len(rows), 'cronbach_alpha': reliability(rows),
                                            'interpretation': 'Exploratory internal consistency on this sample; not validity.'} for key, rows in grouped.items()],
            'expert_agreement': None, 'usability': None,
            'interpretation': 'Descriptive statistics only. Repeated observations are not independent participants. No causal effect established.'}


@router.get('/summary')
def summary(include_demo: bool = False, user: User = Depends(researcher), db: Session = Depends(get_db)):
    return dataset_summary(db, include_demo)


@router.get('/export')
def export(include_demo: bool = False, user: User = Depends(researcher), db: Session = Depends(get_db)):
    data = dataset_summary(db, include_demo)
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    writer.writerow(['metric', 'stage', 'n', 'value', 'interpretation', 'dataset'])
    for stage, group in data['stages'].items():
        for name, metric in group.items():
            writer.writerow([name, stage, metric['n'], metric['mean'], 'descriptive; uncalibrated sample content; no causal claim', data['data_status']])
    writer.writerow(['verification_contradictions', '', data['verification']['evaluated'], data['verification']['with_contradictions'], 'not accuracy', data['data_status']])
    audit(db, user, 'research.aggregate_exported')
    return HTTPResponse(stream.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename=lba-aggregate-report.csv'})


class EvaluationInput(StrictModel):
    reference_labels: list[str] = Field(min_length=1, max_length=500)
    predicted_labels: list[str] = Field(min_length=1, max_length=500)
    sus_responses: list[list[int]] = Field(default_factory=list, max_length=500)

    @model_validator(mode='after')
    def validate_pairs(self):
        if len(self.reference_labels) != len(self.predicted_labels):
            raise ValueError('Label lists must be paired')
        if any(len(x) != 10 or any(type(v) is not int or not 1 <= v <= 5 for v in x) for x in self.sus_responses):
            raise ValueError('SUS responses require ten integer ratings from 1 to 5')
        if any(len(v) > 80 for v in self.reference_labels + self.predicted_labels):
            raise ValueError('Use short deidentified category labels')
        return self


@router.post('/evaluate')
def evaluate(body: EvaluationInput, user: User = Depends(researcher), db: Session = Depends(get_db)):
    usability = [sum(v - 1 if i % 2 == 0 else 5 - v for i, v in enumerate(row)) * 2.5 for row in body.sus_responses]
    audit(db, user, 'research.metrics_computed')
    return {'agreement': agreement(body.reference_labels, body.predicted_labels), 'sus': descriptive(usability),
            'provenance': 'User-supplied paired labels and ratings; not independently validated or persisted.',
            'interpretation': 'Reference agreement is not causal effectiveness. SUS is a usability score, not a percent correct.'}
