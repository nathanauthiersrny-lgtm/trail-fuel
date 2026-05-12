import {
  evaluateExpression,
  ExpressionError,
  parseExpression,
} from '../../rules/expression';

const ctx = {
  temperature_c: 22,
  duration_min: 200,
  next_window: { startMin: 60, slope: 0.05 },
  humidity_high: true,
};

function evalSrc(src: string, c = ctx): number {
  return evaluateExpression(parseExpression(src), c);
}

describe('parseExpression — literals and arithmetic', () => {
  it('parses a single integer', () => {
    expect(evalSrc('42')).toBe(42);
  });
  it('parses a decimal', () => {
    expect(evalSrc('1.5')).toBeCloseTo(1.5, 6);
  });
  it('handles + and - with correct precedence', () => {
    expect(evalSrc('1 + 2 - 3')).toBe(0);
  });
  it('handles * and / with correct precedence', () => {
    expect(evalSrc('2 + 3 * 4')).toBe(14);
    expect(evalSrc('(2 + 3) * 4')).toBe(20);
  });
  it('handles modulo', () => {
    expect(evalSrc('10 % 3')).toBe(1);
  });
  it('handles unary minus', () => {
    expect(evalSrc('-5')).toBe(-5);
    expect(evalSrc('--5')).toBe(5);
    expect(evalSrc('3 - -2')).toBe(5);
  });
  it('handles deep parenthesisation', () => {
    expect(evalSrc('((1 + 2) * (3 + 4))')).toBe(21);
  });
});

describe('parseExpression — variables', () => {
  it('reads a top-level variable', () => {
    expect(evalSrc('temperature_c')).toBe(22);
  });
  it('reads a dotted variable', () => {
    expect(evalSrc('next_window.startMin')).toBe(60);
  });
  it('throws when variable resolves to non-number', () => {
    expect(() => evalSrc('humidity_high')).toThrow(ExpressionError);
  });
  it('throws when variable is missing', () => {
    expect(() => evalSrc('foo.bar')).toThrow(ExpressionError);
  });
  it('uses variables in arithmetic', () => {
    expect(evalSrc('(temperature_c - 20) * 50')).toBe(100);
  });
});

describe('parseExpression — builtins', () => {
  it('min and max', () => {
    expect(evalSrc('min(5, 3)')).toBe(3);
    expect(evalSrc('max(5, 3)')).toBe(5);
  });
  it('clamp', () => {
    expect(evalSrc('clamp(temperature_c, 0, 25)')).toBe(22);
    expect(evalSrc('clamp(temperature_c, 25, 30)')).toBe(25);
    expect(evalSrc('clamp(temperature_c, 0, 20)')).toBe(20);
  });
  it('abs, round, floor, ceil', () => {
    expect(evalSrc('abs(-3.5)')).toBeCloseTo(3.5, 6);
    expect(evalSrc('round(3.6)')).toBe(4);
    expect(evalSrc('floor(3.9)')).toBe(3);
    expect(evalSrc('ceil(3.1)')).toBe(4);
  });
  it('throws on unknown function', () => {
    expect(() => parseExpression('frobnicate(1, 2)')).toThrow(/unknown function/);
  });
  it('throws on wrong arity', () => {
    expect(() => parseExpression('min(1)')).toThrow(/2 args/);
    expect(() => parseExpression('clamp(1, 2)')).toThrow(/3 args/);
  });
  it('allows nesting calls', () => {
    expect(evalSrc('max(min(10, 5), abs(-3))')).toBe(5);
  });
});

describe('parseExpression — errors', () => {
  it('throws on empty input', () => {
    expect(() => parseExpression('')).toThrow(ExpressionError);
  });
  it('throws on unmatched parenthesis', () => {
    expect(() => parseExpression('(1 + 2')).toThrow(/\)/);
  });
  it('throws on unexpected trailing tokens', () => {
    expect(() => parseExpression('1 + 2 3')).toThrow(/trailing/);
  });
  it('throws on illegal character', () => {
    expect(() => parseExpression('1 @ 2')).toThrow(/unexpected character/);
  });
  it('throws on division by zero at eval time', () => {
    expect(() => evalSrc('1 / 0')).toThrow(/division by zero/);
  });
});

describe('evaluateExpression — realistic rule values', () => {
  it('linear fluid boost above 20°C : (temp - 20) * 50', () => {
    expect(evalSrc('(temperature_c - 20) * 50')).toBe(100);
  });

  it('clamped duration-based bonus : max(0, (duration_min - 180) * 0.5)', () => {
    expect(evalSrc('max(0, (duration_min - 180) * 0.5)')).toBe(10);
    const short = { ...ctx, duration_min: 60 };
    expect(evalSrc('max(0, (duration_min - 180) * 0.5)', short)).toBe(0);
  });

  it('linear above hot threshold but capped : min(300, max(0, (temperature_c - 25) * 50))', () => {
    const hot = { ...ctx, temperature_c: 30 };
    expect(evalSrc('min(300, max(0, (temperature_c - 25) * 50))', hot)).toBe(250);
    expect(evalSrc('min(300, max(0, (temperature_c - 25) * 50))', ctx)).toBe(0);
  });
});
