"""Two deliberately small, unvalidated packs. Register additional packs here."""
from app.subjects.base_pack import SubjectPack, Concept, Relationship, Item, Rubric


def make_pack(subject: str, name: str, definitions: list[dict]) -> SubjectPack:
    concepts, items, edges = [], [], []
    for index, d in enumerate(definitions):
        cid = f'{subject}.{d["id"]}'
        prerequisites = [f'{subject}.{definitions[index - 1]["id"]}'] if index else []
        concepts.append(Concept(id=cid, name=d['name'], topic=d['topic'], skills=[d['skill']]))
        if prerequisites:
            edges.append(Relationship(source_id=prerequisites[0], target_id=cid))
        rubric = Rubric(required_groups=d['groups'], misconception_terms=d['errors'], misconception=d['misconception'], explanation=d['explanation'])
        stages = ['pre', 'pre', 'verification', 'verification', 'post', 'transfer', 'retention']
        for n, (stage, example) in enumerate(zip(stages, d['examples'], strict=True)):
            prompt, answers, options = example
            items.append(Item(id=f'{cid}.{n+1}', concept_id=cid, skill_tags=[d['skill']], prerequisite_tags=prerequisites,
                              stage=stage, kind='multiple_choice' if options else 'short_answer', prompt=prompt,
                              answers=answers, options=options, rubric=rubric, objective=d['explanation'],
                              difficulty='intermediate' if stage == 'transfer' else 'introductory'))
    return SubjectPack(id=subject, name=name, concepts=concepts, relationships=edges, items=items)


