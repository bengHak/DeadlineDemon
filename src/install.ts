import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallTarget = {
  platform: "grok" | "codex" | "claude";
  path: string;
  action: "copy-plugin" | "write-hooks";
};

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
    return;
  }

  const template = readFileSync(join(root, "templates", "claude-hooks.json"), "utf8");
  const nodePath = join(root, "dist", "cli.js").replace(/\\/g, "/");
  const rendered = template.replaceAll("${DEADLINE_DEMON_CLI}", nodePath);
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, rendered, "utf8");
}

export function validateHookManifest(): string {
  const manifestPath = join(packageRoot(), "plugin", "hooks", "hooks.json");
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
  const events = Object.keys(parsed.hooks ?? {});
  if (!events.includes("UserPromptSubmit") || !events.includes("PreToolUse")) {
    throw new Error("hooks.json must register UserPromptSubmit and PreToolUse");
  }
  if (!raw.includes("hook user-prompt-submit") || !raw.includes("hook pre-tool-use")) {
    throw new Error("hooks.json must point at built hook commands");
  }
  return manifestPath;
}

export function pluginExistsAt(path: string): boolean {
  return existsSync(join(path, "hooks", "hooks.json")) && existsSync(join(path, "dist", "cli.js"));
}