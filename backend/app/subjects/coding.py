"""Author-written code tracing items. Learner input is never executed."""
from app.subjects.builder import make_pack


CODING = make_pack('coding', 'Computational Thinking', [
    {
        'id': 'state',
        'name': 'Variable state',
        'topic': 'Python tracing',
        'skill': 'Track variable updates',
        'groups': [['assigned', 'set', 'updated'], ['value', 'variable']],
        'errors': ['never changes'],
        'misconception': 'Treating assignment as a permanent equality.',
        'explanation': 'Trace how assignment changes a variable’s current value.',
        'examples': [
            ('What does this print?\nx = 2\nx = x + 3\nprint(x)', ['5'], []),
            ('What does this print?\nx = 4\nx = 7\nprint(x)', ['7'], []),
            ('What does this print?\nx = 8\nx = x - 2\nprint(x)', ['6'], []),
            ('What does this print?\nx = 3\nx = x * 2\nprint(x)', ['6'], []),
            ('What does this print?\nx = 9\nx = x + 1\nprint(x)', ['10'], []),
            ('What does this print?\nx = 3\ny = x\nx = 8\nprint(y)', ['3'], []),
            ('What does this print?\nx = 12\nx = x - 5\nprint(x)', ['7'], []),
        ],
    },
    {
        'id': 'iteration',
        'name': 'Loop boundaries',
        'topic': 'Python tracing',
        'skill': 'Count iterations and trace an accumulator',
        'groups': [['iteration', 'iterations', 'loop', 'loops'], ['range', 'stop', 'exclusive']],
        'errors': ['includes the stop value'],
        'misconception': 'Counting the stop value of range as an iteration.',
        'explanation': 'Trace each iteration and account for the exclusive stop of range.',
        'examples': [
            ('How many times does print run?\nfor i in range(3):\n    print(i)', ['3'], []),
            ('How many times does print run?\nfor i in range(2, 5):\n    print(i)', ['3'], []),
            ('What is the last printed number?\nfor i in range(4):\n    print(i)', ['3'], []),
            ('How many times does print run?\nfor i in range(3, 3):\n    print(i)', ['0'], []),
            ('How many times does print run?\nfor i in range(1, 5):\n    print(i)', ['4'], []),
            ('What is the final output?\ns = 0\nfor i in range(4):\n    s = s + i\nprint(s)', ['6'], []),
            ('How many times does print run?\nfor i in range(4, 7):\n    print(i)', ['3'], []),
        ],
    },
])
