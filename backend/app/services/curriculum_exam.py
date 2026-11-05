"""Generate original Thai mathematics items against a reviewed indicator mapping."""
from fractions import Fraction
from random import Random
from secrets import randbelow

SOURCE_URL = 'https://www.academic.obec.go.th/web/images/document/1580786277_d_1.pdf'
TEMPLATE_VERSION = 'obec-math-m1-v1'
INDICATORS = {
    'rational': {'code': 'ค 1.1 ม.1/1', 'topic': 'การบวกและลบจำนวนตรรกยะในสถานการณ์จริง'},
    'ratio': {'code': 'ค 1.1 ม.1/3', 'topic': 'การใช้อัตราส่วนและสัดส่วนในสถานการณ์จริง'},
    'equation': {'code': 'ค 1.3 ม.1/1', 'topic': 'การแก้ปัญหาด้วยสมการเชิงเส้นตัวแปรเดียว'},
}


def indicator_catalog():
    return [
        {'id': key, **indicator, 'grade': 'ม.1', 'subject': 'คณิตศาสตร์',
         'source_url': SOURCE_URL, 'curriculum_revision_be': 2560}
        for key, indicator in INDICATORS.items()
    ]


def make_item(indicator_id: str, n: int, rng: Random):
    factor = rng.randint(2, 8)
    offset = rng.randint(1, 9)
    if indicator_id == 'rational':
        denominator = rng.choice((3, 4, 5, 8))
        answer = Fraction(n - offset, denominator)
        prompt = f'มีน้ำ {n}/{denominator} ลิตร ใช้ไป {offset}/{denominator} ลิตร เหลือน้ำกี่ลิตร'
        explanation = f'ตัวส่วนเท่ากัน จึงลบตัวเศษ: ({n} − {offset})/{denominator} = {answer} ลิตร'
        step = Fraction(1, denominator)
    elif indicator_id == 'ratio':
        answer = offset * n
        prompt = f'ผสมน้ำหวานกับน้ำเปล่าในอัตราส่วน {factor}:{offset} ถ้าใช้น้ำหวาน {factor * n} แก้ว ต้องใช้น้ำเปล่ากี่แก้ว'
        explanation = f'น้ำหวานเพิ่มเป็น {n} เท่า จึงต้องใช้น้ำเปล่า {offset} × {n} = {answer} แก้ว'
        step = offset
    else:
        answer = n
        total = factor * n + offset
        prompt = f'ซื้อสมุดราคาเท่ากัน {factor} เล่ม และจ่ายค่าถุง {offset} บาท รวม {total} บาท สมุดราคาเล่มละกี่บาท'
        explanation = f'ให้ x เป็นราคาสมุดหนึ่งเล่ม จะได้ {factor}x + {offset} = {total} ดังนั้น x = ({total} − {offset}) ÷ {factor} = {answer}'
        step = 1

    options = [str(answer + step * shift) for shift in (0, 1, 2, -1)]
    rng.shuffle(options)
    return {'prompt': prompt, 'options': options, 'answer_index': options.index(str(answer)),
            'explanation': explanation}


def generate_exam(indicator_id: str, count: int, seed: int | None):
    seed = randbelow(2**32) if seed is None else seed
    rng = Random(seed)
    indicator = next(entry for entry in indicator_catalog() if entry['id'] == indicator_id)
    return {
        'indicator': indicator, 'status': 'draft', 'seed': seed, 'template_version': TEMPLATE_VERSION,
        'items': [make_item(indicator_id, n, rng) for n in rng.sample(range(12, 80), count)],
    }
