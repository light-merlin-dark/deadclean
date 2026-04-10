import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "bun:test";
import { detectProjectLanguage } from "../src/language";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) continue;
    rmSync(root, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "deadclean-lang-"));
  tempRoots.push(root);
  return root;
}

describe("language", () => {
  test("returns explicit language when not auto", async () => {
    const result = await detectProjectLanguage("/tmp", "python");
    expect(result).toBe("python");
  });

  test("returns typescript when not auto", async () => {
    const result = await detectProjectLanguage("/tmp", "typescript");
    expect(result).toBe("typescript");
  });

  test("detects python from pyproject.toml", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "pyproject.toml"), "[project]\nname = 'test'\n");
    const result = await detectProjectLanguage(root, "auto");
    expect(result).toBe("python");
  });

  test("detects typescript from package.json", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "package.json"), '{"name":"test"}');
    const result = await detectProjectLanguage(root, "auto");
    expect(result).toBe("typescript");
  });

  test("detects python from requirements.txt", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "requirements.txt"), "ruff\n");
    const result = await detectProjectLanguage(root, "auto");
    expect(result).toBe("python");
  });

  test("detects python from setup.py", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "setup.py"), "from setuptools import setup\nsetup()\n");
    const result = await detectProjectLanguage(root, "auto");
    expect(result).toBe("python");
  });

  test("defaults to python when no markers", async () => {
    const root = makeTempRoot();
    const result = await detectProjectLanguage(root, "auto");
    expect(result).toBe("python");
  });

  test("handles 'all' by falling back to auto detection", async () => {
    const root = makeTempRoot();
    writeFileSync(join(root, "package.json"), '{"name":"test"}');
    const result = await detectProjectLanguage(root, "all");
    expect(result).toBe("typescript");
  });
});
