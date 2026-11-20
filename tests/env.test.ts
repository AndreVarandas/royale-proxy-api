import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "../src/env.js";

const KEY = "ROYALE_TEST_DOTENV_VAR";
let dir: string | undefined;

function tempEnvFile(content: string): string {
  dir = mkdtempSync(join(tmpdir(), "royale-env-"));
  const file = join(dir, ".env");
  writeFileSync(file, content);
  return file;
}

afterEach(() => {
  delete process.env[KEY];
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("loadEnvFile", () => {
  it("loads values from a .env file (quotes stripped)", () => {
    const file = tempEnvFile(`${KEY}="from-file"\n`);
    loadEnvFile(file);
    expect(process.env[KEY]).toBe("from-file");
  });

  it("does not override real environment variables", () => {
    process.env[KEY] = "from-env";
    const file = tempEnvFile(`${KEY}=from-file\n`);
    loadEnvFile(file);
    expect(process.env[KEY]).toBe("from-env");
  });

  it("ignores a missing file", () => {
    const d = mkdtempSync(join(tmpdir(), "royale-env-"));
    dir = d;
    expect(() => loadEnvFile(join(d, "does-not-exist.env"))).not.toThrow();
  });

  it("propagates non-ENOENT I/O errors (e.g. path is a directory)", () => {
    dir = mkdtempSync(join(tmpdir(), "royale-env-"));
    const d = dir;
    expect(() => loadEnvFile(d)).toThrow();
  });
});
