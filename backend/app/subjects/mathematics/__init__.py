from app.subjects.builder import make_pack

MATHEMATICS = make_pack('mathematics', 'Mathematics', [
    dict(id='fractions', name='Equivalent fractions', topic='Number', skill='Scale numerator and denominator',
         groups=[['numerator', 'top'], ['denominator', 'bottom'], ['same', 'both']], errors=['add to both', 'only the numerator'],
         misconception='Adding rather than scaling to form equivalent fractions', explanation='Scale numerator and denominator by the same nonzero factor.',
         examples=[('Which fraction equals 1/2?', ['2/4'], ['2/4', '2/3', '1/4']), ('Complete: 2/3 = ?/9. Enter the numerator.', ['6'], []),
                   ('Which equals 3/4?', ['6/8'], ['6/8', '4/5', '3/8']), ('Complete: 1/3 = ?/12. Enter the numerator.', ['4'], []),
                   ('Complete: 3/5 = ?/20. Enter the numerator.', ['12'], []), ('A recipe uses 2/3 cup. A cup has 12 equal marks. How many marks?', ['8'], []),
                   ('Complete: 4/7 = ?/21. Enter the numerator.', ['12'], [])]),
    dict(id='ratios', name='Proportional reasoning', topic='Number', skill='Preserve unit rate',
         groups=[['ratio', 'rate', 'per'], ['multiply', 'scale', 'same']], errors=['add the same number', 'always add'],
         misconception='Using an additive rule in a multiplicative relationship', explanation='Preserve the same ratio by scaling both quantities.',
         examples=[('3 notebooks cost 12 units. What do 6 cost?', ['24'], ['24', '15', '18']), ('2 tickets cost 10 units. What do 5 cost?', ['25'], []),
                   ('4 pens cost 8 units. What do 8 cost?', ['16'], ['16', '12', '10']), ('3 kg cost 18 units. What do 2 kg cost?', ['12'], []),
                   ('5 books cost 30 units. What do 3 cost?', ['18'], []), ('A map scale is 2 cm per 5 km. How many km does 6 cm represent?', ['15'], []),
                   ('4 tickets cost 28 units. What do 2 cost?', ['14'], [])]),
    dict(id='equations', name='One-step equations', topic='Algebra', skill='Preserve equality',
         groups=[['both sides', 'each side'], ['subtract', 'divide', 'inverse']], errors=['move without changing', 'only one side'],
         misconception='Changing one side without maintaining equality', explanation='Use inverse operations on both sides to preserve equality.',
         examples=[('Solve x + 4 = 9.', ['5'], ['5', '13', '4']), ('Solve 3x = 18.', ['6'], []),
                   ('Solve x + 7 = 11.', ['4'], ['4', '18', '7']), ('Solve 4x = 20.', ['5'], []),
                   ('Solve x + 8 = 14.', ['6'], []), ('A fixed fee of 5 plus a ticket costs 17. What is the ticket price?', ['12'], []),
                   ('Solve 6x = 42.', ['7'], [])]),
])

