from app.subjects.builder import make_pack

SCIENCE = make_pack('science', 'Science', [
    dict(id='particles', name='Particle model', topic='Matter', skill='Explain particle motion',
         groups=[['particle', 'molecule'], ['motion', 'move', 'energy']], errors=['particles get larger', 'particles stop existing'],
         misconception='Treating heating as growth of individual particles', explanation='Use particle motion and energy to describe heating.',
         examples=[('Heating a gas mainly increases particle…', ['motion'], ['motion', 'size', 'number']), ('Do individual particles get larger when heated? Enter yes or no.', ['no'], []),
                   ('A warmer gas has particles moving…', ['faster'], ['faster', 'slower', 'not at all']), ('Does cooling reduce average particle motion? Enter yes or no.', ['yes'], []),
                   ('A heated gas has greater average particle motion. Enter true or false.', ['true'], []), ('A sealed syringe of air is warmed. Do its individual particles grow? Enter yes or no.', ['no'], []),
                   ('Does warming usually increase average particle motion? Enter yes or no.', ['yes'], [])]),
    dict(id='heat', name='Thermal energy transfer', topic='Energy', skill='Predict thermal transfer',
         groups=[['hot', 'warm', 'higher'], ['cold', 'cool', 'lower'], ['transfer', 'flow', 'energy']], errors=['cold flows into', 'cold is a substance'],
         misconception='Describing cold as a flowing substance', explanation='Net thermal energy transfers from higher to lower temperature.',
         examples=[('Net thermal energy flows from…', ['hot to cold'], ['hot to cold', 'cold to hot', 'neither']), ('A cool spoon touches hot soup. Does the spoon gain thermal energy? Enter yes or no.', ['yes'], []),
                   ('Ice in warm water receives thermal energy. Enter true or false.', ['true'], ['true', 'false']), ('Equal-temperature objects exchange net heat? Enter yes or no.', ['no'], []),
                   ('A warm mug in a cool room loses thermal energy. Enter true or false.', ['true'], []), ('A metal handle touching a hot pan warms. Does energy flow toward the handle? Enter yes or no.', ['yes'], []),
                   ('Net heat flows from lower to higher temperature spontaneously. Enter true or false.', ['false'], [])]),
    dict(id='conservation', name='Energy conservation', topic='Energy', skill='Track energy transfers',
         groups=[['energy'], ['transfer', 'transform', 'conserv', 'account']], errors=['energy disappears', 'energy is destroyed'],
         misconception='Treating dissipated energy as destroyed', explanation='Account for energy transfers and transformations within a stated system.',
         examples=[('Friction transforms motion energy mainly into…', ['thermal energy'], ['thermal energy', 'nothing', 'mass']), ('Is energy destroyed when a ball stops? Enter yes or no.', ['no'], []),
                   ('A battery lamp transforms chemical energy. Enter true or false.', ['true'], ['true', 'false']), ('Can dissipated energy be accounted for in surroundings? Enter yes or no.', ['yes'], []),
                   ('Total energy in an isolated system is conserved. Enter true or false.', ['true'], []), ('A bicycle brakes. Is the lost motion energy transferred to brakes and surroundings? Enter yes or no.', ['yes'], []),
                   ('Does an isolated system create energy from nothing? Enter yes or no.', ['no'], [])]),
])

