import type { EvalContext } from './condition';
import { readPath } from './condition';

// ─── AST ─────────────────────────────────────────────────────────────────────

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'var'; path: string }
  | { kind: 'unary'; op: '-'; arg: Expr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '%'; lhs: Expr; rhs: Expr }
  | { kind: 'call'; name: BuiltinName; args: Expr[] };

const BUILTIN_ARITY = {
  min: 2,
  max: 2,
  clamp: 3,
  abs: 1,
  round: 1,
  floor: 1,
  ceil: 1,
} as const;
export type BuiltinName = keyof typeof BUILTIN_ARITY;

// ─── Public API ──────────────────────────────────────────────────────────────

export class ExpressionError extends Error {}

/**
 * Parses a small numeric expression into an AST. Throws ExpressionError on
 * syntax errors. The pack loader catches and skips invalid rules.
 */
export function parseExpression(src: string): Expr {
  const tokens = tokenize(src);
  const parser = new Parser(tokens, src);
  const ast = parser.parseExpr();
  parser.expectEnd();
  return ast;
}

/**
 * Evaluates a parsed expression against the eval context. Returns a number.
 * Throws if a variable resolves to a non-numeric value (or is missing) — that
 * indicates a misconfigured rule and should be caught loudly.
 */
export function evaluateExpression(ast: Expr, ctx: EvalContext): number {
  switch (ast.kind) {
    case 'num':
      return ast.value;
    case 'var': {
      const v = readPath(ctx, ast.path);
      if (typeof v !== 'number') {
        throw new ExpressionError(
          `variable "${ast.path}" did not resolve to a number (got ${typeof v})`,
        );
      }
      return v;
    }
    case 'unary': {
      const arg = evaluateExpression(ast.arg, ctx);
      return -arg;
    }
    case 'binary': {
      const lhs = evaluateExpression(ast.lhs, ctx);
      const rhs = evaluateExpression(ast.rhs, ctx);
      switch (ast.op) {
        case '+':
          return lhs + rhs;
        case '-':
          return lhs - rhs;
        case '*':
          return lhs * rhs;
        case '/':
          if (rhs === 0) throw new ExpressionError('division by zero');
          return lhs / rhs;
        case '%':
          if (rhs === 0) throw new ExpressionError('modulo by zero');
          return lhs % rhs;
      }
      break;
    }
    case 'call': {
      const args = ast.args.map((a) => evaluateExpression(a, ctx));
      return callBuiltin(ast.name, args);
    }
  }
}

function callBuiltin(name: BuiltinName, args: number[]): number {
  switch (name) {
    case 'min':
      return Math.min(args[0], args[1]);
    case 'max':
      return Math.max(args[0], args[1]);
    case 'clamp':
      return Math.min(args[2], Math.max(args[1], args[0]));
    case 'abs':
      return Math.abs(args[0]);
    case 'round':
      return Math.round(args[0]);
    case 'floor':
      return Math.floor(args[0]);
    case 'ceil':
      return Math.ceil(args[0]);
  }
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type Token =
  | { kind: 'num'; value: number; at: number }
  | { kind: 'ident'; value: string; at: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%'; at: number }
  | { kind: 'lparen'; at: number }
  | { kind: 'rparen'; at: number }
  | { kind: 'comma'; at: number }
  | { kind: 'dot'; at: number };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i += 1;
      continue;
    }
    if (c === '(') { out.push({ kind: 'lparen', at: i }); i += 1; continue; }
    if (c === ')') { out.push({ kind: 'rparen', at: i }); i += 1; continue; }
    if (c === ',') { out.push({ kind: 'comma', at: i }); i += 1; continue; }
    if (c === '.') { out.push({ kind: 'dot', at: i }); i += 1; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%') {
      out.push({ kind: 'op', value: c, at: i });
      i += 1;
      continue;
    }
    if (isDigit(c)) {
      const start = i;
      while (i < src.length && (isDigit(src[i]) || src[i] === '.')) i += 1;
      const text = src.slice(start, i);
      const n = Number.parseFloat(text);
      if (!Number.isFinite(n)) {
        throw new ExpressionError(`invalid number "${text}" at ${start}`);
      }
      out.push({ kind: 'num', value: n, at: start });
      continue;
    }
    if (isIdentStart(c)) {
      const start = i;
      while (i < src.length && isIdentCont(src[i])) i += 1;
      out.push({ kind: 'ident', value: src.slice(start, i), at: start });
      continue;
    }
    throw new ExpressionError(`unexpected character "${c}" at ${i}`);
  }
  return out;
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}
function isIdentStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}
function isIdentCont(c: string): boolean {
  return isIdentStart(c) || isDigit(c);
}

// ─── Recursive descent parser ────────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[], private readonly src: string) {}

  parseExpr(): Expr {
    let lhs = this.parseTerm();
    while (this.matchOp('+', '-')) {
      const op = this.previous() as { kind: 'op'; value: '+' | '-' };
      const rhs = this.parseTerm();
      lhs = { kind: 'binary', op: op.value, lhs, rhs };
    }
    return lhs;
  }

  private parseTerm(): Expr {
    let lhs = this.parseFactor();
    while (this.matchOp('*', '/', '%')) {
      const op = this.previous() as { kind: 'op'; value: '*' | '/' | '%' };
      const rhs = this.parseFactor();
      lhs = { kind: 'binary', op: op.value, lhs, rhs };
    }
    return lhs;
  }

  private parseFactor(): Expr {
    if (this.matchOp('-')) {
      const arg = this.parseFactor();
      return { kind: 'unary', op: '-', arg };
    }
    const tok = this.peek();
    if (!tok) throw this.errEOF('expected expression');
    if (tok.kind === 'num') {
      this.pos += 1;
      return { kind: 'num', value: tok.value };
    }
    if (tok.kind === 'lparen') {
      this.pos += 1;
      const inner = this.parseExpr();
      this.consume('rparen', 'expected ")"');
      return inner;
    }
    if (tok.kind === 'ident') {
      this.pos += 1;
      // call vs variable
      if (this.peek()?.kind === 'lparen') {
        return this.parseCallTail(tok.value, tok.at);
      }
      // variable path : ident ('.' ident)*
      const segments = [tok.value];
      while (this.peek()?.kind === 'dot') {
        this.pos += 1;
        const next = this.peek();
        if (!next || next.kind !== 'ident') {
          throw this.errAt(this.pos, 'expected identifier after "."');
        }
        this.pos += 1;
        segments.push(next.value);
      }
      return { kind: 'var', path: segments.join('.') };
    }
    throw this.errAt(this.pos, `unexpected token "${tokenLabel(tok)}"`);
  }

  private parseCallTail(name: string, at: number): Expr {
    if (!(name in BUILTIN_ARITY)) {
      throw this.errAt(at, `unknown function "${name}"`);
    }
    const expectedArity = BUILTIN_ARITY[name as BuiltinName];
    this.consume('lparen', 'expected "("');
    const args: Expr[] = [];
    if (this.peek()?.kind !== 'rparen') {
      args.push(this.parseExpr());
      while (this.peek()?.kind === 'comma') {
        this.pos += 1;
        args.push(this.parseExpr());
      }
    }
    this.consume('rparen', 'expected ")"');
    if (args.length !== expectedArity) {
      throw this.errAt(at, `function "${name}" expects ${expectedArity} args, got ${args.length}`);
    }
    return { kind: 'call', name: name as BuiltinName, args };
  }

  expectEnd(): void {
    if (this.pos !== this.tokens.length) {
      throw this.errAt(this.pos, 'unexpected trailing tokens');
    }
  }

  private matchOp(...ops: ('+' | '-' | '*' | '/' | '%')[]): boolean {
    const tok = this.peek();
    if (tok && tok.kind === 'op' && (ops as string[]).includes(tok.value)) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private consume(kind: Token['kind'], msg: string): void {
    const tok = this.peek();
    if (!tok || tok.kind !== kind) throw this.errAt(this.pos, msg);
    this.pos += 1;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private errAt(tokenIdx: number, msg: string): ExpressionError {
    const tok = this.tokens[tokenIdx];
    const at = tok ? tok.at : this.src.length;
    return new ExpressionError(`${msg} (at ${at}: "${this.src}")`);
  }

  private errEOF(msg: string): ExpressionError {
    return new ExpressionError(`${msg} (unexpected end of expression: "${this.src}")`);
  }
}

function tokenLabel(t: Token): string {
  switch (t.kind) {
    case 'num':
      return String(t.value);
    case 'ident':
      return t.value;
    case 'op':
      return t.value;
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'comma':
      return ',';
    case 'dot':
      return '.';
  }
}
