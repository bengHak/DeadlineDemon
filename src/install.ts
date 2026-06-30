import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallTarget = {
  platform: "grok" | "codex" | "claude";
  path: string;
  action: "copy-plugin" | "write-hooks";
  hard: boolean;
};

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function hookManifestName(hard: boolean): string {
  return hard ? "hooks-hard.json" : "hooks.json";
}

export function readHookManifest(hard = false): string {
  return readFileSync(join(packageRoot(), "plugin", "hooks", hookManifestName(hard)), "utf8");
}

export function hookManifestHasPreToolUse(hard: boolean): boolean {
  const raw = readHookManifest(hard);
  const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
  return Object.keys(parsed.hooks ?? {}).includes("PreToolUse");
}

export function installTargets(dryRun = false, hard = false): InstallTarget[] {
  const root = packageRoot();
  const home = homedir();

  const targets: InstallTarget[] = [
    {
      platform: "grok",
      path: join(home, ".grok", "plugins", "deadline-demon"),
      action: "copy-plugin",
      hard,
    },
    {
      platform: "codex",
      path: join(home, ".codex", "plugins", "deadline-demon"),
      action: "copy-plugin",
      hard,
    },
    {
      platform: "claude",
      path: join(home, ".claude", "hooks", "deadline-demon.json"),
      action: "write-hooks",
      hard,
    },
  ];

  return targets.map((target) => {
    if (!dryRun) applyInstallTarget(target, root);
    return target;
  });
}

function applyInstallTarget(target: InstallTarget, root: string): void {
  if (target.action === "copy-plugin") {
    mkdirSync(dirname(target.path), { recursive: true });
    cpSync(join(root, "plugin"), target.path, { recursive: true });
    cpSync(join(root, "dist"), join(target.path, "dist"), { recursive: true });
    if (target.hard) {
      writeFileSync(join(target.path, "hooks", "hooks.json"), readHookManifest(true), "utf8");
    }
    return;
  }

  const templateName = target.hard ? "claude-hooks-hard.json" : "claude-hooks.json";
  const template = readFileSync(join(root, "templates", templateName), "utf8");
  const nodePath = join(root, "dist", "cli.js").replace(/\\/g, "/");
  const rendered = template.replaceAll("${DEADLINE_DEMON_CLI}", nodePath);
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, rendered, "utf8");
}

export function validateHookManifest(hard = false): string {
  const manifestPath = join(packageRoot(), "plugin", "hooks", hookManifestName(hard));
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
  const events = Object.keys(parsed.hooks ?? {});
  if (!events.includes("UserPromptSubmit")) {
    throw new Error(`${hookManifestName(hard)} must register UserPromptSubmit`);
  }
  if (!raw.includes("hook user-prompt-submit")) {
    throw new Error(`${hookManifestName(hard)} must point at user-prompt-submit hook command`);
  }
  if (hard) {
    if (!events.includes("PreToolUse")) {
      throw new Error("hooks-hard.json must register PreToolUse");
    }
    if (!raw.includes("hook pre-tool-use")) {
      throw new Error("hooks-hard.json must point at pre-tool-use hook command");
    }
  } else if (events.includes("PreToolUse")) {
    throw new Error("hooks.json must not register PreToolUse (use install --hard)");
  }
  return manifestPath;
}

export function pluginExistsAt(path: string): boolean {
  return existsSync(join(path, "hooks", "hooks.json")) && existsSync(join(path, "dist", "cli.js"));
}