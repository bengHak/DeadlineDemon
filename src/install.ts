import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallTarget = {
  platform: "grok" | "codex" | "claude";
  path: string;
  action: "copy-plugin" | "write-hooks";
};

/** Persistent install root (survives npx cache eviction). */
export function persistentInstallDir(): string {
  return join(homedir(), ".deadline-demon");
}

export function persistentCliPath(): string {
  return join(persistentInstallDir(), "dist", "cli.js");
}

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function hookManifestPath(): string {
  return join(packageRoot(), "plugin", "hooks", "hooks.json");
}

export function readHookManifest(): string {
  return readFileSync(hookManifestPath(), "utf8");
}

export function hookManifestHasPreToolUse(): boolean {
  const parsed = JSON.parse(readHookManifest()) as { hooks?: Record<string, unknown> };
  return Object.keys(parsed.hooks ?? {}).includes("PreToolUse");
}

/** Copy package artifacts to ~/.deadline-demon so hooks keep working after npx exits. */
export function syncPersistentInstall(root: string): string {
  const dest = persistentInstallDir();
  mkdirSync(dest, { recursive: true });
  cpSync(join(root, "plugin"), join(dest, "plugin"), { recursive: true });
  cpSync(join(root, "dist"), join(dest, "dist"), { recursive: true });
  cpSync(join(root, "templates"), join(dest, "templates"), { recursive: true });
  return persistentCliPath();
}

export function installTargets(dryRun = false): InstallTarget[] {
  const root = packageRoot();
  const home = homedir();

  const targets: InstallTarget[] = [
    {
      platform: "grok",
      path: join(home, ".grok", "plugins", "deadline-demon"),
      action: "copy-plugin",
    },
    {
      platform: "codex",
      path: join(home, ".codex", "plugins", "deadline-demon"),
      action: "copy-plugin",
    },
    {
      platform: "claude",
      path: join(home, ".claude", "hooks", "deadline-demon.json"),
      action: "write-hooks",
    },
  ];

  if (dryRun) return targets;

  const cliPath = syncPersistentInstall(root).replace(/\\/g, "/");
  for (const target of targets) {
    applyInstallTarget(target, cliPath);
  }
  return targets;
}

function applyInstallTarget(target: InstallTarget, cliPath: string): void {
  const persistentRoot = persistentInstallDir();

  if (target.action === "copy-plugin") {
    mkdirSync(dirname(target.path), { recursive: true });
    cpSync(join(persistentRoot, "plugin"), target.path, { recursive: true });
    cpSync(join(persistentRoot, "dist"), join(target.path, "dist"), { recursive: true });
    return;
  }

  const template = readFileSync(join(persistentRoot, "templates", "claude-hooks.json"), "utf8");
  const rendered = template.replaceAll("${DEADLINE_DEMON_CLI}", cliPath);
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, rendered, "utf8");
}

export function validateHookManifest(): string {
  const manifestPath = hookManifestPath();
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
  const events = Object.keys(parsed.hooks ?? {});
  if (!events.includes("UserPromptSubmit")) {
    throw new Error("hooks.json must register UserPromptSubmit");
  }
  if (!events.includes("PreToolUse")) {
    throw new Error("hooks.json must register PreToolUse");
  }
  if (!raw.includes("hook user-prompt-submit")) {
    throw new Error("hooks.json must point at user-prompt-submit hook command");
  }
  if (!raw.includes("hook pre-tool-use")) {
    throw new Error("hooks.json must point at pre-tool-use hook command");
  }
  return manifestPath;
}

export function pluginExistsAt(path: string): boolean {
  return existsSync(join(path, "hooks", "hooks.json")) && existsSync(join(path, "dist", "cli.js"));
}
