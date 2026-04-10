import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join } from "node:path";
import type { LanguageMode, ProjectLanguage } from "./types";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__",
  ".cache",
  "coverage",
  ".output"
]);

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function hasExtension(root: string, extensions: Set<string>, maxDepth = 4): Promise<boolean> {
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (current.depth >= maxDepth || SKIP_DIRS.has(entry.name)) {
          continue;
        }
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (extensions.has(extension)) {
        return true;
      }
    }
  }

  return false;
}

export async function detectProjectLanguage(path: string, language: LanguageMode): Promise<ProjectLanguage> {
  if (language !== "auto" && language !== "all") {
    return language;
  }

  const [hasPackageJson, hasPyProject, hasRequirements, hasSetupPy] = await Promise.all([
    fileExists(join(path, "package.json")),
    fileExists(join(path, "pyproject.toml")),
    fileExists(join(path, "requirements.txt")),
    fileExists(join(path, "setup.py"))
  ]);

  const hasPythonMarkers = hasPyProject || hasRequirements || hasSetupPy;

  if (hasPackageJson && !hasPythonMarkers) {
    return "typescript";
  }

  if (hasPythonMarkers && !hasPackageJson) {
    return "python";
  }

  if (hasPackageJson && hasPythonMarkers) {
    const [hasPythonFiles, hasTypeScriptFiles] = await Promise.all([
      hasExtension(path, new Set([".py"])),
      hasExtension(path, new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]))
    ]);

    if (hasPythonFiles && !hasTypeScriptFiles) {
      return "python";
    }
    return "typescript";
  }

  if (hasPackageJson) {
    return "typescript";
  }

  return "python";
}
