declare module 'fast-formula-parser' {
  export interface CellRef {
    sheet: string;
    row: number;
    col: number;
  }
  export interface RangeRef {
    sheet: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
  }
  /** Argumen fungsi buatan sendiri dibungkus: `value` berisi nilai skalar, atau matriks 2D untuk rentang. */
  export interface FnArg {
    value: unknown;
    isArray: boolean;
    isRangeRef: boolean;
    isCellRef: boolean;
  }
  export class FormulaError extends Error {
    constructor(error: string, msg?: string);
    error: string;
    static DIV0: FormulaError;
    static NA: FormulaError;
    static NAME: FormulaError;
    static NUM: FormulaError;
    static REF: FormulaError;
    static VALUE: FormulaError;
  }
  export interface Config {
    onCell?: (ref: CellRef) => unknown;
    onRange?: (ref: RangeRef) => unknown[][] | FormulaError;
    functions?: Record<string, (...args: FnArg[]) => unknown>;
  }
  export default class FormulaParser {
    static FormulaError: typeof FormulaError;
    constructor(config?: Config);
    parse(formula: string, position: { sheet: string; row: number; col: number }): unknown;
    supportedFunctions(): string[];
  }
}
