// Repository-facing lookups shared by validate, reconcile, and derive: command resolution and lockfile pins.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { exists, readText, type Model } from "./model.ts";

// A compound command resolves only when every segment joined by &&, || or ; resolves, and every script
// path passed as an argument exists; a bare first token is looked up on PATH or in package scripts.
export function commandResolves(m: Model, command: string): boolean {
  const segments = command.split(/\s*(?:&&|\|\||;)\s*/).map((x) => x.trim()).filter(Boolean);
  return segments.length > 0 && segments.every((seg) => segmentResolves(m, seg));
}
function segmentResolves(m: Model, command: string): boolean {
  const tokens = command.trim().split(/\s+/).filter((t) => !/^[A-Z_][A-Z0-9_]*=/.test(t));
  const [head, second] = tokens;
  if (!head) return false;
  const script = tokens.slice(1).find((t) => !t.startsWith("-") && /^(?:\.\/)?[\w.@-]+(?:\/[\w.@-]+)+\.(?:sh|bash|ts|js|mjs|cjs|py|rb|pl)$/.test(t));
  if (script && !exists(m, script.replace(/^\.\//, ""))) return false;
  if (head.startsWith("./") || head.startsWith("/") || head.includes("/")) return exists(m, head.replace(/^\.\//, ""));
  const pkgPath = join(m.root, "package.json");
  if (["bun", "npm", "pnpm", "yarn", "bunx", "npx"].includes(head)) {
    if (second === "run" || second === "x") {
      if (!existsSync(pkgPath)) return false;
      const scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {};
      return tokens[2] in scripts;
    }
    if (["test", "build", "install", "fmt", "lint"].includes(second ?? "")) return true;
    if (second && existsSync(pkgPath)) { const scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {}; if (second in scripts) return true; }
    return Bun.which(head) !== null;
  }
  return Bun.which(head) !== null;
}
/**
 * Every version the ecosystem's lockfile locks for a package, in lockfile order without repeats: [] when the lockfile
 * exists but the package is absent, undefined when there is no lockfile or the ecosystem is not supported. Cargo can
 * lock several versions of one crate (hashbrown 0.12.3 and 0.16.0 side by side), so a pin is checked against all of
 * them. npm and bun report the top-level install, which is the one a direct dependency's pin describes.
 */
export function lockfileVersions(m: Model, name: string, ecosystem: string): string[] | undefined {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const all = (re: RegExp, text: string) => [...new Set([...text.matchAll(re)].map((mm) => mm[1]))];
  if (ecosystem === "npm" && exists(m, "package-lock.json")) {
    const lock = JSON.parse(readText(m, "package-lock.json"));
    const v = lock.packages?.[`node_modules/${name}`]?.version;
    return typeof v === "string" ? [v] : [];
  }
  if (ecosystem === "bun" && exists(m, "bun.lock")) {
    const mm = new RegExp(`"${esc}":\\s*\\[\\s*"${esc}@([^"]+)"`).exec(readText(m, "bun.lock"));
    return mm ? [mm[1]] : [];
  }
  if (ecosystem === "cargo" && exists(m, "Cargo.lock")) {
    return all(new RegExp(`\\[\\[package\\]\\]\\s*\\nname = "${esc}"\\s*\\nversion = "([^"]+)"`, "g"), readText(m, "Cargo.lock"));
  }
  if (ecosystem === "pub" && exists(m, "pubspec.lock")) {
    return all(new RegExp(`\\n  ${esc}:\\n(?:.*\\n){0,6}?\\s+version: "([^"]+)"`, "g"), readText(m, "pubspec.lock"));
  }
  return undefined;
}
