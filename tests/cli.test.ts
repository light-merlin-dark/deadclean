import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli";

describe("cli", () => {
  test("--help returns 0", async () => {
    const code = await runCli(["--help"]);
    expect(code).toBe(0);
  });

  test("-h returns 0", async () => {
    const code = await runCli(["-h"]);
    expect(code).toBe(0);
  });

  test("help subcommand returns 0", async () => {
    const code = await runCli(["help"]);
    expect(code).toBe(0);
  });

  test("--version returns 0", async () => {
    const code = await runCli(["--version"]);
    expect(code).toBe(0);
  });

  test("-v returns 0", async () => {
    const code = await runCli(["-v"]);
    expect(code).toBe(0);
  });

  test("scan --help returns 0", async () => {
    const code = await runCli(["scan", "--help"]);
    expect(code).toBe(0);
  });

  test("doctor --help returns 0", async () => {
    const code = await runCli(["doctor", "--help"]);
    expect(code).toBe(0);
  });

  test("init --help returns 0", async () => {
    const code = await runCli(["init", "--help"]);
    expect(code).toBe(0);
  });

  test("install-tools --help returns 0", async () => {
    const code = await runCli(["install-tools", "--help"]);
    expect(code).toBe(0);
  });

  test("baseline --help returns 0", async () => {
    const code = await runCli(["baseline", "--help"]);
    expect(code).toBe(0);
  });

  test("unknown option throws", async () => {
    await expect(runCli(["--bogus-flag"])).rejects.toThrow("Unknown option");
  });

  test("invalid language throws", async () => {
    await expect(runCli(["--language", "rust"])).rejects.toThrow("Invalid language");
  });

  test("invalid install method throws", async () => {
    await expect(runCli(["install-tools", "--method", "yarn"])).rejects.toThrow("Invalid install method");
  });

  test("missing value for option throws", async () => {
    await expect(runCli(["--language"])).rejects.toThrow("Missing value for --language");
  });

  test("invalid max-findings throws", async () => {
    await expect(runCli(["scan", "/nonexistent", "--max-findings", "abc"])).rejects.toThrow();
  });

  test("baseline with unknown action throws", async () => {
    await expect(runCli(["baseline", "unknown"])).rejects.toThrow("Unknown baseline action");
  });
});
