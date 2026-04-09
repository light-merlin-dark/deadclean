import { platform } from "node:os";
import { RealCommandRunner } from "./process";
import { inspectAllTools, inspectTool } from "./install";
import type { CommandRunner, DoctorReport, ToolBinaries } from "./types";

export async function buildDoctorReport(runner: CommandRunner, binaries: ToolBinaries): Promise<DoctorReport> {
  const [bun, tools] = await Promise.all([
    inspectTool(runner, "bun"),
    inspectAllTools(runner, binaries)
  ]);

  return {
    platform: platform(),
    nodeVersion: process.version,
    bunVersion: bun.version,
    cwd: process.cwd(),
    tools
  };
}

export async function runDoctor(binaries: ToolBinaries): Promise<DoctorReport> {
  const runner = new RealCommandRunner();
  return buildDoctorReport(runner, binaries);
}
