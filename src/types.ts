export type InstallMethod = "auto" | "uv" | "pipx" | "pip";
export type OutputMode = "text" | "json";

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  notFound: boolean;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CommandRunner {
  run(command: string, args: string[], options?: RunCommandOptions): Promise<CommandResult>;
}

export interface ToolStatus {
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface InstallAttempt {
  method: InstallMethod;
  success: boolean;
  details: string;
}

export interface InstallReport {
  success: boolean;
  methodRequested: InstallMethod;
  methodUsed: InstallMethod | null;
  attempts: InstallAttempt[];
}

export interface VultureFinding {
  file: string;
  line: number;
  message: string;
}

export interface ScanOptions {
  path: string;
  fix: boolean;
  minConfidence: number;
  ensureTools: boolean;
  installMethod: InstallMethod;
  output: OutputMode;
  strict: boolean;
  verbose: boolean;
  ruffBinary: string;
  vultureBinary: string;
}

export interface ScanReport {
  path: string;
  options: ScanOptions;
  install: InstallReport | null;
  ruffFix: CommandResult | null;
  ruffCheck: CommandResult;
  vultureCheck: CommandResult;
  ruffIssueCount: number;
  ruffFixedCount: number;
  vultureFindingCount: number;
  vultureFindings: VultureFinding[];
  elapsedMs: number;
}

export interface DoctorReport {
  platform: string;
  nodeVersion: string;
  bunVersion: string | null;
  cwd: string;
  tools: ToolStatus[];
}
