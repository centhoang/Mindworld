// The scope rule (docs/RESTRUCTURE.md step 4): rules never reach into drawing, and a view reaches only the ports.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? files(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
});
const imports = (file: string): string[] => [...readFileSync(file, "utf8").matchAll(/^import (?!type )[^;]*?from "(\.[^"]+)"/gm)]
  .map((m) => relative(SRC, resolve(dirname(file), m[1]!)).replaceAll("\\", "/"));

describe("scopes", () => {
  for (const scope of ["mind", "life", "sim", "world"]) it(`${scope} never imports drawing code`, () => {
    const bad = files(join(SRC, scope)).flatMap((f) => imports(f).filter((i) => /^(pixel|view)\//.test(i)));
    expect(bad).toEqual([]);
  });

  it("a view imports only itself, the ports and the tile map", () => {
    const bad = files(join(SRC, "view")).flatMap((f) => imports(f).filter((i) => !/^(view\/|game\/ports|world\/tilemap)/.test(i)));
    expect(bad).toEqual([]);
  });
});
