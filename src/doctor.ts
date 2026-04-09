import { platform } from "node:os";
import { RealCommandRunner } from "./process";
import { inspectRequiredTools, inspectTool } from "./install";
import type { CommandRunner, DoctorReport } from "./types";

export async function buildDoctorReport(
  runner: CommandRunner,
  ruffBinary: string,
  vultureBinary: string
): Promise<DoctorReport> {
  const [bun, tools] = await Promise.all([
    inspectTool(runner, "bun"),
    inspectRequiredTools(runner, ruffBinary, vultureBinary)
  ]);

  return {
    platform: platform(),
    nodeVersion: process.version,
    bunVersion: bun.version,
    cwd: process.cwd(),
    tools
  };
}

export async function runDoctor(ruffBinary: string, vultureBinary: string): Promise<DoctorReport> {
  const runner = new RealCommandRunner();
  return buildDoctorReport(runner, ruffBinary, vultureBinary);
}
