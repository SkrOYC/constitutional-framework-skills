// YAML loading via Bun's built-in parser, plus front matter extraction for markdown files.
import { readFileSync, writeFileSync } from "node:fs";

/** Scalar lists stay on one line only while short; longer prose lists get one item per line so diffs stay reviewable. */
const FLOW_MAX_WIDTH = 80;
const SCIENTIFIC_NOTATION = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)[eE][+-]?[0-9]+$/;

export type Loaded<T = unknown> = { path: string; data: T };

/** Raised before parsing when a block mapping repeats a key; Bun.YAML.parse silently keeps the last value. */
export class DuplicateKeyError extends Error {
  constructor(path: string, readonly key: string, readonly line: number, readonly firstLine: number) {
    super(`${path}: duplicate mapping key "${key}" at line ${line} (first at line ${firstLine})`);
  }
}

const KEY_LINE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#'"[\]{},&*!|>%@`-][^#]*?|-[^\s#][^#]*?)[ \t]*:(?:[ \t]|$)/;
const SEQ_DASH = /^-(?:[ \t]+|$)/;

/** Index just past the closing quote of a quoted scalar that starts at `from`, or -1 when it stays open. */
function closingQuote(line: string, from: number): number {
  const q = line[from];
  for (let i = from + 1; i < line.length; i++) {
    if (q === '"' && line[i] === "\\") i++;
    else if (line[i] === q) {
      if (q === "'" && line[i + 1] === "'") i++;
      else return i + 1;
    }
  }
  return -1;
}

/** Net bracket depth change of a flow collection line, ignoring quoted text and trailing comments. */
function flowDepth(line: string): number {
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' || c === "'") {
      const end = closingQuote(line, i);
      if (end === -1) break;
      i = end - 1;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) break;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
  }
  return depth;
}

/**
 * Finds the first repeated key within one block mapping. A line scan rather than a full parse, because Bun.YAML
 * exposes no syntax tree: it follows indentation, sequence items, block scalars, and multi-line quoted or flow values.
 */
export function findDuplicateKey(text: string, path: string): DuplicateKeyError | null {
  const scopes: { indent: number; keys: Map<string, number> }[] = [];
  let blockIndent = -1;
  let openQuote: string | null = null;
  let flow = 0;
  for (const [n, raw] of text.split(/\r?\n/).entries()) {
    if (openQuote) {
      if (closingQuote(openQuote + raw, 0) !== -1) openQuote = null;
      continue;
    }
    if (flow > 0) {
      flow += flowDepth(raw);
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    let indent = raw.length - raw.trimStart().length;
    if (blockIndent >= 0) {
      if (indent > blockIndent) continue;
      blockIndent = -1;
    }
    if (indent === 0 && (trimmed === "---" || trimmed === "...")) {
      scopes.length = 0;
      continue;
    }
    let rest = raw.slice(indent);
    let item = false;
    for (let dash = SEQ_DASH.exec(rest); dash; dash = SEQ_DASH.exec(rest)) {
      item = true;
      indent += dash[0].length;
      rest = rest.slice(dash[0].length);
      while (scopes.length && scopes[scopes.length - 1].indent >= indent) scopes.pop();
      scopes.push({ indent, keys: new Map() });
    }
    const hit = KEY_LINE.exec(rest);
    let value = rest;
    if (hit) {
      while (scopes.length && scopes[scopes.length - 1].indent > indent) scopes.pop();
      if (!scopes.length || scopes[scopes.length - 1].indent < indent) scopes.push({ indent, keys: new Map() });
      const key = /^["']/.test(hit[1]) ? hit[1].slice(1, -1) : hit[1];
      const keys = scopes[scopes.length - 1].keys;
      const first = keys.get(key);
      if (first !== undefined) return new DuplicateKeyError(path, key, n + 1, first);
      keys.set(key, n + 1);
      value = rest.slice(hit[0].length).trimStart();
    } else if (!item) continue;
    if (/^[|>]/.test(value)) blockIndent = hit ? indent : indent - 2;
    else if (/^["']/.test(value)) {
      if (closingQuote(value, 0) === -1) openQuote = value[0];
    } else if (/^[[{]/.test(value)) flow = Math.max(0, flowDepth(value));
  }
  return null;
}

export function parseYaml(text: string, path: string): unknown {
  const dup = findDuplicateKey(text, path);
  if (dup) throw dup;
  try {
    return Bun.YAML.parse(text);
  } catch (err) {
    throw new Error(`${path}: YAML parse error: ${(err as Error).message}`);
  }
}

export function loadYamlFile(path: string): unknown {
  return parseYaml(readFileSync(path, "utf8"), path);
}

/** Returns the front matter object and the body, or null data when the file has no front matter. */
export function splitFrontMatter(text: string, path: string): { data: unknown | null; body: string } {
  if (!text.startsWith("---\n")) return { data: null, body: text };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { data: null, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, "");
  return { data: parseYaml(raw, path), body };
}

export function loadFrontMatter(path: string): { data: unknown | null; body: string } {
  return splitFrontMatter(readFileSync(path, "utf8"), path);
}

/** Block-style YAML emitter for files humans read. Bun.YAML.stringify emits flow style, which is hard to diff. */
export function toBlockYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (isScalar(item)) return `${pad}- ${scalar(item)}`;
        if (Array.isArray(item)) return `${pad}-\n${toBlockYaml(item, indent + 1)}`;
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length === 0) return `${pad}- {}`;
        const [firstKey, firstVal] = entries[0];
        const first = renderEntry(firstKey, firstVal, indent + 1).replace(/^\s*/, "");
        const rest = entries.slice(1).map(([k, v]) => renderEntry(k, v, indent + 1)).join("\n");
        return `${pad}- ${first}${rest ? "\n" + rest : ""}`;
      })
      .join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries.map(([k, v]) => renderEntry(k, v, indent)).join("\n");
  }
  return pad + scalar(value);
}

function renderEntry(key: string, val: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  const k = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
  if (isScalar(val)) {
    if (typeof val === "string" && val.includes("\n")) {
      const lines = val.replace(/\n$/, "").split("\n").map((l) => `${pad}  ${l}`).join("\n");
      return `${pad}${k}: |\n${lines}`;
    }
    return `${pad}${k}: ${scalar(val)}`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return `${pad}${k}: []`;
    if (val.every((x) => isScalar(x) && !(typeof x === "string" && x.includes("\n")))) {
      const flow = `${pad}${k}: [${val.map(scalar).join(", ")}]`;
      if (flow.length <= FLOW_MAX_WIDTH) return flow;
    }
    return `${pad}${k}:\n${toBlockYaml(val, indent + 1)}`;
  }
  const entries = Object.entries(val as Record<string, unknown>);
  if (entries.length === 0) return `${pad}${k}: {}`;
  return `${pad}${k}:\n${toBlockYaml(val, indent + 1)}`;
}

function isScalar(v: unknown): boolean {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function scalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  const plainSafe = /^[A-Za-z0-9][A-Za-z0-9 _./#()<>+@\-]*$/.test(s) &&
    !/^(true|false|null|yes|no|on|off|~)$/i.test(s) &&
    !/^[0-9.]+$/.test(s) &&
    !SCIENTIFIC_NOTATION.test(s) &&
    !/^0[xXoObB][0-9a-fA-F]+$/.test(s) &&
    !s.endsWith(" ") && !s.includes(": ") && !s.includes(" #");
  return plainSafe && bunEmitsPlain(s) ? s : JSON.stringify(s);
}

/**
 * True when Bun's emitter leaves the scalar unquoted. Parse is not enough: it accepts
 * `756874e` as a string, while stringify quotes it.
 */
function bunEmitsPlain(s: string): boolean {
  try {
    return Bun.YAML.stringify(s).trim() === s;
  } catch {
    return false;
  }
}

/**
 * Adds one entry at the top of a changelog file without re-emitting the entries below it, so history stays byte-identical.
 * Falls back to a full rewrite when the file does not start with an `entries:` block sequence.
 */
export function prependChangelogEntry(text: string, entry: unknown): string {
  const head = /^entries:[ \t]*\r?\n/.exec(text);
  if (head && /^ +- /.test(text.slice(head[0].length))) {
    const rendered = toBlockYaml({ entries: [entry] });
    const item = rendered.slice(rendered.indexOf("\n") + 1);
    return text.slice(0, head[0].length) + item + "\n" + text.slice(head[0].length);
  }
  const data = parseYaml(text, "changelog") as { entries?: unknown[] } | null;
  return toBlockYaml({ ...(data ?? {}), entries: [entry, ...(data?.entries ?? [])] }) + "\n";
}

export type FormatOutcome = { path: string; status: "formatted" | "unchanged" | "skipped"; reason?: string };

/**
 * Re-emits a YAML data file in the canonical block style. Skips files with comments (the emitter would drop them)
 * and refuses any rewrite whose parsed value differs from the original.
 */
export function formatYamlFile(path: string, write: boolean): FormatOutcome {
  const before = readFileSync(path, "utf8");
  if (/^\s*#/m.test(before)) return { path, status: "skipped", reason: "contains comments that re-emitting would drop" };
  const data = parseYaml(before, path);
  const after = toBlockYaml(data) + "\n";
  if (JSON.stringify(parseYaml(after, path)) !== JSON.stringify(data)) return { path, status: "skipped", reason: "re-emitted value differs from the original" };
  if (after === before) return { path, status: "unchanged" };
  if (write) writeFileSync(path, after);
  return { path, status: "formatted" };
}
