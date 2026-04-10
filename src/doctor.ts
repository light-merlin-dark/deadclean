import { platform } from "node:os";
import { RealCommandRunner } from "./process";
import { inspectAllTools, inspectTool } from "./install";
import type { CommandRunner, DoctorReport, ToolBinaries } from "./types";

export async function buildDoctorReport(runner: CommandRunner, binaries: ToolBinaries, strict: boolean = false): Promise<DoctorReport> {
  const [bun, tools] = await Promise.all([
    inspectTool(runner, "bun"),
    inspectAllTools(runner, binaries)
  ]);

  const pythonTools = tools.filter((t) => t.name === binaries.ruffBinary || t.name === binaries.vultureBinary);
  const tsTools = tools.filter((t) => t.name === binaries.biomeBinary || t.name === binaries.knipBinary);

  const readyFor = {
    python: pythonTools.every((t) => t.installed),
    typescript: tsTools.every((t) => t.installed)
  };

  const ready = readyFor.python && readyFor.typescript;
  const missingTools = tools.filter((t) => !t.installed).map((t) => t.name);

  return {
    platform: platform(),
    nodeVersion: process.version,
    bunVersion: bun.version,
    cwd: process.cwd(),
    tools,
    ready,
    readyFor,
    missingTools
  };
}

export async function runDoctor(binaries: ToolBinaries, strict: boolean = false): Promise<DoctorReport> {
  const runner = new RealCommandRunner();
  return buildDoctorReport(runner, binaries, strict);
}
