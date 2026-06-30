import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/** Persistent install root (survives npx cache eviction). */
export function persistentInstallDir() {
    return join(homedir(), ".deadline-demon");
}
export function persistentCliPath() {
    return join(persistentInstallDir(), "dist", "cli.js");
}
export function packageRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}
export function hookManifestPath() {
    return join(packageRoot(), "plugin", "hooks", "hooks.json");
}
export function readHookManifest() {
    return readFileSync(hookManifestPath(), "utf8");
}
export function hookManifestHasPreToolUse() {
    const parsed = JSON.parse(readHookManifest());
    return Object.keys(parsed.hooks ?? {}).includes("PreToolUse");
}
/** Copy package artifacts to ~/.deadline-demon so hooks keep working after npx exits. */
export function syncPersistentInstall(root) {
    const dest = persistentInstallDir();
    mkdirSync(dest, { recursive: true });
    cpSync(join(root, "plugin"), join(dest, "plugin"), { recursive: true });
    cpSync(join(root, "dist"), join(dest, "dist"), { recursive: true });
    cpSync(join(root, "templates"), join(dest, "templates"), { recursive: true });
    return persistentCliPath();
}
export function harnessInstallTargets() {
    const home = homedir();
    return [
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
}
export function uninstallTargetList() {
    const persistent = {
        platform: "persistent",
        path: persistentInstallDir(),
        action: "remove-dir",
    };
    const harness = harnessInstallTargets().map((target) => ({
        platform: target.platform,
        path: target.path,
        action: target.action === "copy-plugin" ? "remove-dir" : "remove-file",
    }));
    return [persistent, ...harness];
}
function applyUninstallTarget(target) {
    if (!existsSync(target.path))
        return;
    if (target.action === "remove-dir") {
        rmSync(target.path, { recursive: true, force: true });
        return;
    }
    rmSync(target.path, { force: true });
}
export function uninstallTargets(dryRun = false) {
    const targets = uninstallTargetList();
    if (!dryRun) {
        for (const target of targets) {
            applyUninstallTarget(target);
        }
    }
    return targets;
}
export function installTargets(dryRun = false) {
    const root = packageRoot();
    const targets = harnessInstallTargets();
    if (dryRun)
        return targets;
    const cliPath = syncPersistentInstall(root).replace(/\\/g, "/");
    for (const target of targets) {
        applyInstallTarget(target, cliPath);
    }
    return targets;
}
function applyInstallTarget(target, cliPath) {
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
export function validateHookManifest() {
    const manifestPath = hookManifestPath();
    const raw = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
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
export function pluginExistsAt(path) {
    return existsSync(join(path, "hooks", "hooks.json")) && existsSync(join(path, "dist", "cli.js"));
}
