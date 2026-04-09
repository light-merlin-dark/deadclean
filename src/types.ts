export type InstallMethod = "auto" | "uv" | "pipx" | "pip" | "npm";
export type OutputMode = "text" | "json";
export type ProjectLanguage = "python" | "typescript";
export type LanguageMode = "auto" | ProjectLanguage;

export interface ToolBinaries {
  ruffBinary: string;
  vultureBinary: string;
  biomeBinary: string;
  knipBinary: string;
}

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
  language: ProjectLanguage;
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
  language: LanguageMode;
  fix: boolean;
  minConfidence: number;
  ensureTools: boolean;
  installMethod: InstallMethod;
  output: OutputMode;
  strict: boolean;
  verbose: boolean;
  ruffBinary: ToolBinaries["ruffBinary"];
  vultureBinary: ToolBinaries["vultureBinary"];
  biomeBinary: ToolBinaries["biomeBinary"];
  knipBinary: ToolBinaries["knipBinary"];
}

export interface ScanReport {
  path: string;
  language: ProjectLanguage;
  lintTool: string;
  deadCodeTool: string;
  options: ScanOptions;
  install: InstallReport | null;
  fixResult: CommandResult | null;
  lintResult: CommandResult;
  deadCodeResult: CommandResult;
  lintIssueCount: number;
  fixedCount: number;
  deadCodeFindingCount: number;
  deadCodeFindings: string[];
  elapsedMs: number;
}

export interface DoctorReport {
  platform: string;
  nodeVersion: string;
  bunVersion: string | null;
  cwd: string;
  tools: ToolStatus[];
}
