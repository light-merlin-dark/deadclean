import { spawn } from "node:child_process";
import type { CommandResult, CommandRunner, RunCommandOptions } from "./types";

function mergeOutput(stdout: string, stderr: string): string {
  if (stdout.trim().length > 0) {
    return stdout;
  }
  return stderr;
}

export class RealCommandRunner implements CommandRunner {
  async run(command: string, args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
    const start = Date.now();

    return new Promise<CommandResult>((resolve) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let notFound = false;

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          notFound = true;
        }
        stderr += `${error.message}\n`;
      });

      child.on("close", (code) => {
        const exitCode = typeof code === "number" ? code : 1;
        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          notFound
        });
      });
    });
  }
}

export function displayOutput(result: CommandResult): string {
  return mergeOutput(result.stdout, result.stderr).trim();
}
