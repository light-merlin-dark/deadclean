import { describe, expect, test } from "bun:test";
import { mergeOutput } from "../src/process";

describe("process", () => {
  test("mergeOutput returns stderr when stdout is empty", () => {
    expect(mergeOutput("", "error message")).toBe("error message");
  });

  test("mergeOutput returns stdout when stderr is empty", () => {
    expect(mergeOutput("output", "")).toBe("output");
  });

  test("mergeOutput combines both streams", () => {
    const result = mergeOutput("stdout content", "stderr content");
    expect(result).toContain("stdout content");
    expect(result).toContain("stderr content");
  });

  test("mergeOutput handles both empty", () => {
    expect(mergeOutput("", "")).toBe("");
  });

  test("mergeOutput trims whitespace", () => {
    expect(mergeOutput("  hello  ", "  ")).toBe("hello");
  });
});
