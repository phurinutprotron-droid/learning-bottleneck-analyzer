from app.subjects.base_pack import SubjectPack


def adjacency(pack: SubjectPack, reverse: bool = False) -> dict[str, set[str]]:
    graph = {c.id: set() for c in pack.concepts}
    for edge in pack.relationships:
        if edge.relationship_type == 'prerequisite':
            a, b = (edge.target_id, edge.source_id) if reverse else (edge.source_id, edge.target_id)
            graph[a].add(b)
    return graph


def traverse(pack: SubjectPack, concept: str, reverse: bool = False) -> list[str]:
    graph = adjacency(pack, reverse)
    if concept not in graph:
        raise ValueError('Unknown concept')
    seen, pending = set(), list(graph[concept])
    while pending:
        current = pending.pop()
        if current not in seen:
            seen.add(current)
            pending.extend(graph[current] - seen)
    return sorted(seen - {concept})


def validate_graph(pack: SubjectPack) -> dict:
    graph = adjacency(pack)
    active, done = set(), set()

    def visit(node):
        if node in active:
            raise ValueError('Prerequisite cycle detected')
        if node in done:
            return
        active.add(node)
        for child in graph[node]:
            visit(child)
        active.remove(node)
        done.add(node)

    for node in graph:
        visit(node)
    return {'valid': True, 'version': pack.graph_version, 'nodes': len(graph), 'edges': len(pack.relationships),
            'interpretation': 'Relationships guide exploration; they do not establish causality.'}


def validate_cross_subject(packs: dict, edges: list) -> dict:
    known = {c.id for pack in packs.values() for c in pack.concepts}
    for edge in edges:
        if edge.source_id not in known or edge.target_id not in known:
            raise ValueError('Unknown cross-subject relationship endpoint')
        if edge.relationship_type != 'cross_subject' or edge.source_id.split('.')[0] == edge.target_id.split('.')[0]:
            raise ValueError('Cross-subject links must connect distinct subject namespaces')
    return {'valid': True, 'version': 'cross-sample-v1', 'interpretation': 'Illustrative cross-subject connections are unreviewed and do not establish causality.'}
