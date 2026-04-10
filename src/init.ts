import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { detectProjectLanguage } from "./language";
import type { LanguageMode, OutputMode, ProjectLanguage } from "./types";

export interface InitOptions {
  path: string;
  language: LanguageMode | "all";
  force: boolean;
  output: OutputMode;
}

interface InitArtifact {
  path: string;
  created: boolean;
  overwritten: boolean;
  skipped: boolean;
}

export interface InitReport {
  root: string;
  languageRequested: LanguageMode | "all";
  languageResolved: ProjectLanguage[];
  force: boolean;
  artifacts: {
    knipConfig: InitArtifact | null;
    vultureIgnore: InitArtifact | null;
  };
}

const KNIP_TEMPLATE = {
  $schema: "https://unpkg.com/knip@latest/schema.json",
  entry: [
    "src/**/*.{ts,tsx,js,jsx,mts,cts}",
    "app/**/*.{ts,tsx,js,jsx,mts,cts}",
    "server/**/*.{ts,tsx,js,jsx,mts,cts}",
    "client/**/*.{ts,tsx,js,jsx,mts,cts}",
    "lib/**/*.{ts,tsx,js,jsx,mts,cts}"
  ],
  project: [
    "**/*.{ts,tsx,js,jsx,mts,cts}",
    "!node_modules/**",
    "!dist/**",
    "!build/**",
    "!coverage/**"
  ]
};

const VULTURE_IGNORE_TEMPLATE = `# deadclean defaults
# One glob per line. Comments and blank lines are ignored.
*/tests/*
*/test/*
*/migrations/*
*/__pycache__/*
*/venv/*
*/.venv/*
`;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeIfNeeded(path: string, content: string, force: boolean): Promise<InitArtifact> {
  const alreadyExists = await exists(path);
  if (alreadyExists && !force) {
    return {
      path,
      created: false,
      overwritten: false,
      skipped: true
    };
  }

  if (alreadyExists && force) {
    await writeFile(path, content, "utf8");
    return {
      path,
      created: false,
      overwritten: true,
      skipped: false
    };
  }

  await writeFile(path, content, "utf8");
  return {
    path,
    created: true,
    overwritten: false,
    skipped: false
  };
}

async function resolveInitLanguages(path: string, language: InitOptions["language"]): Promise<ProjectLanguage[]> {
  if (language === "all") {
    return ["python", "typescript"];
  }
  if (language === "auto") {
    return [await detectProjectLanguage(path, "auto")];
  }
  return [language];
}

export async function runInit(options: InitOptions): Promise<InitReport> {
  const root = resolve(options.path);
  const languages = await resolveInitLanguages(root, options.language);
  await mkdir(root, { recursive: true });

  let knipConfig: InitArtifact | null = null;
  let vultureIgnore: InitArtifact | null = null;

  if (languages.includes("typescript")) {
    const filePath = join(root, "knip.json");
    knipConfig = await writeIfNeeded(filePath, `${JSON.stringify(KNIP_TEMPLATE, null, 2)}\n`, options.force);
  }

  if (languages.includes("python")) {
    const filePath = join(root, ".vulture_ignore");
    vultureIgnore = await writeIfNeeded(filePath, VULTURE_IGNORE_TEMPLATE, options.force);
  }

  return {
    root,
    languageRequested: options.language,
    languageResolved: languages,
    force: options.force,
    artifacts: {
      knipConfig,
      vultureIgnore
    }
  };
}

export function formatInitText(report: InitReport): string {
  const lines: string[] = [];
  lines.push("deadclean init");
  lines.push(`path: ${report.root}`);
  lines.push(`requested_language: ${report.languageRequested}`);
  lines.push(`resolved_languages: ${report.languageResolved.join(", ")}`);
  lines.push(`force: ${report.force}`);

  const entries: Array<{ name: string; artifact: InitArtifact | null }> = [
    { name: "knip_config", artifact: report.artifacts.knipConfig },
    { name: "vulture_ignore", artifact: report.artifacts.vultureIgnore }
  ];

  lines.push("artifacts:");
  for (const entry of entries) {
    if (!entry.artifact) {
      lines.push(`  - ${entry.name}: not_applicable`);
      continue;
    }
    const status = entry.artifact.created
      ? "created"
      : entry.artifact.overwritten
        ? "overwritten"
        : entry.artifact.skipped
          ? "skipped"
          : "unknown";
    lines.push(`  - ${entry.name}: ${status} | ${entry.artifact.path}`);
  }

  return `${lines.join("\n")}\n`;
}
