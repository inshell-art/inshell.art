import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Load qs through its real Cypress consumer, not an independently selected copy.
const require = createRequire(new URL("../node_modules/.pnpm/@cypress+request@4.0.1/node_modules/@cypress/request/package.json", import.meta.url));
const qs = require("qs");
const { Querystring } = require("./lib/querystring.js");
const adapter = (options = {}) => {
  const instance = new Querystring({});
  instance.init(options);
  return instance;
};

test("Cypress request resolves the reviewed qs release", () => {
  assert.equal(require("qs/package.json").version, "6.16.0");
});

for (const [name, input, expected, options] of [
  ["simple", "a=1&b=two", { a: "1", b: "two" }],
  ["repeated", "a=1&a=2", { a: ["1", "2"] }],
  ["indexed", "a[0]=one&a[1]=two", { a: ["one", "two"] }],
  ["brackets", "a[]=one&a[]=two", { a: ["one", "two"] }],
  ["nested", "a[b][c]=one", { a: { b: { c: "one" } } }],
  ["unicode", "a=%E4%B8%AD%E6%96%87", { a: "中文" }],
  ["space", "a=hello+world&b=a%2Bb", { a: "hello world", b: "a+b" }],
  ["equals", "a=b%3Dc", { a: "b=c" }],
  ["empty", "a=&b", { a: "", b: "" }],
  ["prototype", "a[__proto__][polluted]=yes&constructor[prototype][polluted]=yes", {}],
  ["comma default", "a=1,2,3", { a: "1,2,3" }],
  ["comma option", "a=1,2,3", { a: ["1", "2", "3"] }, { qsParseOptions: { comma: true } }],
  ["dots", "a.b=c", { a: { b: "c" } }, { qsParseOptions: { allowDots: true } }],
  ["null", "a&b=", { a: null, b: "" }, { qsParseOptions: { strictNullHandling: true } }],
  ["sentinel", "utf8=%E2%9C%93&a=%C3%B8", { a: "ø" }, { qsParseOptions: { charsetSentinel: true } }],
  ["duplicates", "a=1&a=2", { a: "1" }, { qsParseOptions: { duplicates: "first" } }],
]) {
  test(`Cypress Querystring parse: ${name}`, () => assert.deepEqual(adapter(options).parse(input), expected));
}

for (const [name, input, expected, options] of [
  ["null-skip", { a: null, b: undefined, c: "" }, "a=&c="],
  ["nested", { a: { b: "c" }, n: 2 }, "a%5Bb%5D=c&n=2"],
  ["array", { a: ["one", "two"] }, "a%5B0%5D=one&a%5B1%5D=two"],
  ["date-buffer", { date: new Date("2026-10-27T00:00:00Z"), bytes: Buffer.from("abc") }, "date=2026-10-27T00%3A00%3A00.000Z&bytes=abc"],
  ["rfc3986", { a: "!'()*" }, "a=%21%27%28%29%2A", { useQuerystring: true }],
  ["repeat", { a: ["one", "two"] }, "a=one&a=two", { qsStringifyOptions: { arrayFormat: "repeat" } }],
]) {
  test(`Cypress Querystring stringify: ${name}`, () => assert.equal(adapter(options).stringify(input), expected));
}

test("default array limit retains indexed object behavior", () => {
  const pairs = Array.from({ length: 24 }, (_, i) => [String(i), String(i)]);
  assert.deepEqual(adapter().parse(pairs.map(([, v]) => `a[]=${v}`).join("&")), { a: Object.fromEntries(pairs) });
});
test("bracket/comma parsing cannot bypass the configured array limit", () => {
  const options = { comma: true, arrayLimit: 3, throwOnLimitExceeded: true };
  assert.throws(() => qs.parse("a[]=1,2,3,4", options), RangeError);
  assert.deepEqual(qs.parse("a[]=1,2,3", options), { a: [["1", "2", "3"]] });
});
for (const options of [{ plainObjects: true }, { allowPrototypes: true }]) {
  test(`attacker-controlled isBuffer is not invoked: ${JSON.stringify(options)}`, () => {
    assert.equal(qs.stringify(qs.parse("x[constructor][isBuffer]=y", options)), "x%5Bconstructor%5D%5BisBuffer%5D=y");
  });
}
