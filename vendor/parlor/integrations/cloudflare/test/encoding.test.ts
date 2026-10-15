import { compareValues, type Value } from "convex/values";
import { describe, expect, it } from "vitest";
import { decodeId, encodeId, MAX_TABLE_NUMBER, newId } from "../src/ids.js";
import { encodeKey, keySuccessor, prefixEnd } from "../src/keys.js";

describe("Convex document IDs", () => {
  // Minted by a real Convex backend (precompiled-2026-08-25) for tables 10001 and 10002.
  const minted = [
    ["j573aqe158tjyq1zra2jxrxg998ga0wy", 10001],
    ["j57cwhsce30cdcvj8esca92c258gbk2n", 10001],
    ["j9773hjp1exsq22nj2y65pmvxx8ga4sb", 10002],
    ["j97d8kkq16bk10wmnt7rfjqhsd8ga07j", 10002],
  ] as const;

  it("decodes backend-minted IDs and re-encodes them byte for byte", () => {
    for (const [id, table] of minted) {
      const decoded = decodeId(id);
      expect(decoded?.tableNumber).toBe(table);
      expect(encodeId(table, decoded!.internalId)).toBe(id);
    }
  });

  it("rejects corrupted, truncated and non-canonical IDs", () => {
    const [id] = minted[0];
    expect(decodeId(`${id.slice(0, -1)}${id.endsWith("y") ? "z" : "y"}`)).toBeNull();
    expect(decodeId(id.slice(0, -2))).toBeNull();
    expect(decodeId(id.toUpperCase())).toBeNull();
    expect(decodeId("not-an-id")).toBeNull();
  });

  it("mints fresh IDs that decode to their table", () => {
    for (const table of [1, 127, 128, 539, 10001, 2 ** 31, MAX_TABLE_NUMBER]) {
      expect(decodeId(newId(table))?.tableNumber).toBe(table);
    }
    expect(() => newId(MAX_TABLE_NUMBER + 1)).toThrow("Invalid table number 4294967296");
  });

  it("rejects an ID whose table number does not fit 32 bits instead of throwing", () => {
    // A well-formed v6 layout whose five-byte vint encodes 2^32.
    const body = [0x80, 0x80, 0x80, 0x80, 0x10, ...Array.from({ length: 16 }, () => 7)];
    let sum1 = 0;
    let sum2 = 0;
    for (const byte of body) {
      sum1 = (sum1 + byte) & 0xff;
      sum2 = (sum2 + sum1) & 0xff;
    }
    let text = "";
    let buffer = 0;
    let bits = 0;
    for (const byte of [...body, sum1, sum2]) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        text += "0123456789abcdefghjkmnpqrstvwxyz".charAt((buffer >> bits) & 31);
      }
      buffer &= (1 << bits) - 1;
    }
    if (bits > 0) text += "0123456789abcdefghjkmnpqrstvwxyz".charAt((buffer << (5 - bits)) & 31);
    expect(decodeId(text)).toBeNull();
  });
});

function randomValue(depth = 0): Value | undefined {
  const pick = Math.floor(Math.random() * (depth > 1 ? 7 : 9));
  const strings = ["", "a", "a\u0000", "a\u0000b", "ab", "b", "é", "\u{1F600}", "a\u0001"];
  switch (pick) {
    case 0:
      return undefined;
    case 1:
      return null;
    case 2:
      return [-3n, 0n, 7n, -(2n ** 63n), 2n ** 63n - 1n][Math.floor(Math.random() * 5)]!;
    case 3:
      return [-Infinity, -1.5, -0, 0, 1, 2.25, Infinity, Number.MIN_VALUE][
        Math.floor(Math.random() * 8)
      ]!;
    case 4:
      return Math.random() < 0.5;
    case 5:
      return strings[Math.floor(Math.random() * strings.length)]!;
    case 6:
      return new Uint8Array([0, 1, 255].slice(0, Math.floor(Math.random() * 4))).buffer;
    case 7:
      return Array.from(
        { length: Math.floor(Math.random() * 3) },
        () => randomValue(depth + 1) ?? null,
      );
    default:
      return Object.fromEntries(
        ["a", "b", "aa"]
          .slice(0, Math.floor(Math.random() * 4))
          .map((key) => [key, randomValue(depth + 1) ?? null]),
      );
  }
}

describe("index keys", () => {
  it("sort exactly like compareValues", () => {
    const values = Array.from({ length: 400 }, () => randomValue());
    for (let index = 0; index < 4000; index += 1) {
      const left = values[Math.floor(Math.random() * values.length)];
      const right = values[Math.floor(Math.random() * values.length)];
      const expected = Math.sign(compareValues(left, right));
      const a = encodeKey([left]);
      const b = encodeKey([right]);
      expect(a < b ? -1 : a > b ? 1 : 0, `${a} vs ${b}`).toBe(expected);
    }
  });

  it("bound prefixes without capturing longer strings", () => {
    const prefix = encodeKey(["a"]);
    const end = prefixEnd(prefix)!;
    const inside = encodeKey(["a", 5]);
    const longer = encodeKey(["a\u0000"]);
    expect(inside >= prefix && inside < end).toBe(true);
    expect(longer >= prefix && longer < end).toBe(false);
    expect(keySuccessor(inside) > inside).toBe(true);
  });
});
