import { describe, test, expect } from "@jest/globals";
import {
  asU256Num,
  toBig,
  toU256Num,
  readU256,
  scaleIntegerString,
  toFixed,
  formatU256Dec,
} from "@inshell/utils";

describe("num helpers", () => {
  test("scaleIntegerString pads and inserts decimal correctly", () => {
    expect(scaleIntegerString("0", 18)).toBe("0.000000000000000000");
    expect(scaleIntegerString("1", 18)).toBe("0.000000000000000001");
    expect(scaleIntegerString("123456", 3)).toBe("123.456");
    expect(scaleIntegerString("123", 0)).toBe("123");
  });

  test("toBig accepts integer shapes and rejects invalid ones", () => {
    expect(toBig("0x10")).toBe(16n);
    expect(toBig("42")).toBe(42n);
    expect(() => toBig("-1")).toThrow(/Not an integer/);
    expect(() => toBig("1.1")).toThrow(/Not an integer/);
  });

  test("readU256 handles tuples, structs, nested shapes, and scalars", () => {
    expect(readU256({ low: 1, high: 0 })).toEqual({ low: 1, high: 0 });
    expect(readU256([2, 3])).toEqual({ low: 2, high: 3 });
    expect(readU256({ price: { low: 4, high: 5 } })).toEqual({
      low: 4,
      high: 5,
    });
    expect(readU256(10n)).toEqual({ low: 10n, high: 0n });
  });

  test("toU256Num/asU256Num normalize shapes to consistent dec/raw/value", () => {
    const fromTuple = toU256Num({ low: 1, high: 0 });
    expect(fromTuple.dec).toBe("1");
    expect(fromTuple.value).toBe(1n);

    const fromRaw = asU256Num({ raw: { low: "5", high: "0" } });
    expect(fromRaw.dec).toBe("5");
    expect(fromRaw.value).toBe(5n);

    const fromScalar = asU256Num(20);
    expect(fromScalar.raw).toEqual({ low: "20", high: "0" });
    expect(fromScalar.value).toBe(20n);
  });

  test("toFixed preserves precision for u256 with decimals", () => {
    expect(toFixed({ low: 1, high: 0 }, 18)).toBe("0.000000000000000001");
    expect(toFixed({ low: 1234, high: 0 }, 2)).toBe("12.34");
  });

  test("formatU256Dec pretty-prints small integers and leaves large intact", () => {
    const small = toU256Num({ low: 1234567, high: 0 });
    expect(formatU256Dec(small)).toBe("1,234,567");

    const huge = toU256Num({
      low: "340282366920938463463374607431768211455", // 2^128-1
      high: 0,
    });
    expect(formatU256Dec(huge)).toBe("340282366920938463463374607431768211455");
  });
});
