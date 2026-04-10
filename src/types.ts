export type InstallMethod = "auto" | "uv" | "pipx" | "pip" | "npm" | "bun";
export type OutputMode = "text" | "json" | "sarif";
export type ProjectLanguage = "python" | "typescript";
export type LanguageMode = "auto" | ProjectLanguage | "all";

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
  timedOut?: boolean;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
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
  confidence: number;
}

export interface StructuredFinding {
  file: string;
  line: number | null;
  message: string;
  tool: string;
  category: string;
  name: string | null;
  confidence: number | null;
  severity: "high" | "medium" | "low";
}

export interface ScanOptions {
  path: string;
  language: LanguageMode;
  fix: boolean;
  minConfidence: number;
  maxFindings: number | null;
  ensureTools: boolean;
  installMethod: InstallMethod;
  output: OutputMode;
  strict: boolean;
  strictLint: boolean;
  verbose: boolean;
  quiet: boolean;
  summary: boolean;
  knipConfig: string | null;
  workspaces: string[];
  directory: string | null;
  knipArgs: string[];
  biomeArgs: string[];
  ruffArgs: string[];
  vultureArgs: string[];
  outputFile: string | null;
  fixRounds: number;
  diffBase: string | null;
  staged: boolean;
  exclude: string[];
  ruffBinary: ToolBinaries["ruffBinary"];
  vultureBinary: ToolBinaries["vultureBinary"];
  biomeBinary: ToolBinaries["biomeBinary"];
  knipBinary: ToolBinaries["knipBinary"];
}

export interface ScanReport {
  path: string;
  language: ProjectLanguage | ProjectLanguage[];
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
  displayedDeadCodeFindingCount: number;
  findingsTruncated: boolean;
  deadCodeFindings: string[];
  deadCodeFindingsStructured: StructuredFinding[];
  toolErrors: string[];
  executionErrors: string[];
  elapsedMs: number;
  timestamp: string;
  toolVersions: Record<string, string | null>;
  filesScanned: number | null;
  filesWithIssues: number;
  exitCode: number;
  status: string;
}

export interface DoctorReport {
  platform: string;
  nodeVersion: string;
  bunVersion: string | null;
  cwd: string;
  tools: ToolStatus[];
  ready: boolean;
  readyFor: Record<string, boolean>;
  missingTools: string[];
}

export interface DeadcleanConfig {
  language?: LanguageMode;
  minConfidence?: number;
  maxFindings?: number | null;
  fix?: boolean;
  fixRounds?: number;
  strict?: boolean;
  strictLint?: boolean;
  output?: OutputMode;
  exclude?: string[];
  knipConfig?: string;
  workspaces?: string[];
  directory?: string;
  diffBase?: string;
  timeout?: number;
  [key: string]: unknown;
}
