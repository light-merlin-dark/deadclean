import { spawn } from "node:child_process";
import type { CommandResult, CommandRunner, RunCommandOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 120_000;

const activeChildren: Set<import("node:child_process").ChildProcess> = new Set();

function registerShutdownHandlers(): void {
  const shutdown = () => {
    for (const child of activeChildren) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
    activeChildren.clear();
    process.exit(130);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

let shutdownRegistered = false;

function ensureShutdownHandlers(): void {
  if (!shutdownRegistered) {
    registerShutdownHandlers();
    shutdownRegistered = true;
  }
}

export function mergeOutput(stdout: string, stderr: string): string {
  const parts: string[] = [];
  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();
  if (trimmedStdout.length > 0) {
    parts.push(trimmedStdout);
  }
  if (trimmedStderr.length > 0) {
    parts.push(trimmedStderr);
  }
  return parts.join("\n");
}

export class RealCommandRunner implements CommandRunner {
  private timeoutMs: number;

  constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    ensureShutdownHandlers();
  }

  async run(command: string, args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
    const start = Date.now();

    return new Promise<CommandResult>((resolve) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      activeChildren.add(child);

      let stdout = "";
      let stderr = "";
      let notFound = false;
      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      if (this.timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          try {
            child.kill("SIGTERM");
          } catch {}
        }, this.timeoutMs);
      }

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += String(chunk);
      });

      child.on("error", (error: Error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          notFound = true;
        }
        stderr += `${error.message}\n`;
      });

      child.on("close", (code: number | null) => {
        activeChildren.delete(child);
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        const exitCode = typeof code === "number" ? code : 1;
        if (timedOut) {
          stderr += `\nProcess timed out after ${this.timeoutMs}ms`;
        }

        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          notFound,
          timedOut
        });
      });
    });
  }
}

export function displayOutput(result: CommandResult): string {
  return mergeOutput(result.stdout, result.stderr).trim();
}
