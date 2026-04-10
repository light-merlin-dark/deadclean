import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    rmSync(root, { recursive: true, force: true });
  }
});

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "deadclean-init-"));
  tempRoots.push(root);
  return root;
}

describe("init", () => {
  test("creates both templates for language all", async () => {
    const root = makeTempRoot();
    const report = await runInit({
      path: root,
      language: "all",
      force: false,
      output: "json"
    });

    expect(report.artifacts.knipConfig?.created).toBe(true);
    expect(report.artifacts.vultureIgnore?.created).toBe(true);
  });

  test("respects force for existing files", async () => {
    const root = makeTempRoot();
    const knipPath = join(root, "knip.json");
    writeFileSync(knipPath, '{\n  "entry": []\n}\n', "utf8");

    const first = await runInit({
      path: root,
      language: "typescript",
      force: false,
      output: "text"
    });
    expect(first.artifacts.knipConfig?.skipped).toBe(true);

    const second = await runInit({
      path: root,
      language: "typescript",
      force: true,
      output: "text"
    });
    expect(second.artifacts.knipConfig?.overwritten).toBe(true);
  });

  test("creates only knip.json for typescript", async () => {
    const root = makeTempRoot();
    const report = await runInit({
      path: root,
      language: "typescript",
      force: false,
      output: "json"
    });

    expect(report.artifacts.knipConfig?.created).toBe(true);
    expect(report.artifacts.vultureIgnore).toBeNull();
  });

  test("creates only .vulture_ignore for python", async () => {
    const root = makeTempRoot();
    const report = await runInit({
      path: root,
      language: "python",
      force: false,
      output: "json"
    });

    expect(report.artifacts.knipConfig).toBeNull();
    expect(report.artifacts.vultureIgnore?.created).toBe(true);
  });
});
