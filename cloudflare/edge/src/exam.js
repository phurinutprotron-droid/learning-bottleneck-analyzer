// The supported 32-bit seed has the same MT19937 initialization and draws as Python Random.
class PythonRandom {
  constructor(seed) {
    this.state = new Uint32Array(624); this.state[0] = 19650218;
    for (let i = 1; i < 624; i++) this.state[i] = (Math.imul(1812433253, this.state[i - 1] ^ (this.state[i - 1] >>> 30)) + i) >>> 0;
    let i = 1;
    for (let k = 0; k < 624; k++) {
      this.state[i] = ((this.state[i] ^ Math.imul(this.state[i - 1] ^ (this.state[i - 1] >>> 30), 1664525)) + seed) >>> 0;
      if (++i >= 624) { this.state[0] = this.state[623]; i = 1; }
    }
    for (let k = 0; k < 623; k++) {
      this.state[i] = ((this.state[i] ^ Math.imul(this.state[i - 1] ^ (this.state[i - 1] >>> 30), 1566083941)) - i) >>> 0;
      if (++i >= 624) { this.state[0] = this.state[623]; i = 1; }
    }
    this.state[0] = 0x80000000; this.index = 624;
  }
  uint32() {
    if (this.index >= 624) {
      for (let i = 0; i < 624; i++) {
        const y = (this.state[i] & 0x80000000) | (this.state[(i + 1) % 624] & 0x7fffffff);
        this.state[i] = this.state[(i + 397) % 624] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let y = this.state[this.index++]; y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  }
  below(n) {
    const bits = Math.floor(Math.log2(n)) + 1;
    let result;
    do { result = this.uint32() >>> (32 - bits); } while (result >= n);
    return result;
  }
  sample(count) {
    let setSize = 21;
    if (count > 5) setSize += 4 ** Math.ceil(Math.log(count * 3) / Math.log(4));
    const result = [];
    if (68 <= setSize) {
      const pool = Array.from({length: 68}, (_, i) => i + 12);
      for (let i = 0; i < count; i++) { const j = this.below(68 - i); result.push(pool[j]); pool[j] = pool[67 - i]; }
    } else {
      const selected = new Set();
      while (result.length < count) { const j = this.below(68); if (!selected.has(j)) { selected.add(j); result.push(j + 12); } }
    }
    return result;
  }
  shuffle(values) { for (let i = values.length - 1; i > 0; i--) { const j = this.below(i + 1); [values[i], values[j]] = [values[j], values[i]]; } }
}
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
const fraction = (n, d) => { const divisor = gcd(n, d); return d / divisor === 1 ? String(n / divisor) : `${n / divisor}/${d / divisor}`; };
export function generateExam(indicatorId, count, seed, content) {
  seed ??= crypto.getRandomValues(new Uint32Array(1))[0];
  const rng = new PythonRandom(seed), numbers = rng.sample(count);
  const items = numbers.map(n => {
    const factor = rng.below(7) + 2, offset = rng.below(9) + 1;
    let answer, prompt, explanation, options;
    if (indicatorId === 'rational') {
      const denominator = [3, 4, 5, 8][rng.below(4)]; answer = fraction(n - offset, denominator);
      prompt = `มีน้ำ ${n}/${denominator} ลิตร ใช้ไป ${offset}/${denominator} ลิตร เหลือน้ำกี่ลิตร`;
      explanation = `ตัวส่วนเท่ากัน จึงลบตัวเศษ: (${n} − ${offset})/${denominator} = ${answer} ลิตร`;
      options = [0, 1, 2, -1].map(shift => fraction(n - offset + shift, denominator));
    } else if (indicatorId === 'ratio') {
      answer = String(offset * n);
      prompt = `ผสมน้ำหวานกับน้ำเปล่าในอัตราส่วน ${factor}:${offset} ถ้าใช้น้ำหวาน ${factor * n} แก้ว ต้องใช้น้ำเปล่ากี่แก้ว`;
      explanation = `น้ำหวานเพิ่มเป็น ${n} เท่า จึงต้องใช้น้ำเปล่า ${offset} × ${n} = ${answer} แก้ว`;
      options = [0, 1, 2, -1].map(shift => String(offset * n + offset * shift));
    } else {
      answer = String(n); const total = factor * n + offset;
      prompt = `ซื้อสมุดราคาเท่ากัน ${factor} เล่ม และจ่ายค่าถุง ${offset} บาท รวม ${total} บาท สมุดราคาเล่มละกี่บาท`;
      explanation = `ให้ x เป็นราคาสมุดหนึ่งเล่ม จะได้ ${factor}x + ${offset} = ${total} ดังนั้น x = (${total} − ${offset}) ÷ ${factor} = ${answer}`;
      options = [0, 1, 2, -1].map(shift => String(n + shift));
    }
    rng.shuffle(options);
    return {prompt, options, answer_index: options.indexOf(answer), explanation};
  });
  return {indicator: content.indicators.find(i => i.id === indicatorId), status: 'draft', seed, template_version: 'obec-math-m1-v1', items};
}

