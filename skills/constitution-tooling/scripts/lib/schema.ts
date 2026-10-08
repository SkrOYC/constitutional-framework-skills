// Minimal JSON Schema validator for the keyword subset the constitution schemas use.
// Supported: type, properties, required, additionalProperties, items, enum, const, pattern,
// minimum, maximum, minItems, uniqueItems, minLength, $ref (local and cross-file), $defs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SchemaError = { pointer: string; message: string };
type Schema = Record<string, any>;

export class SchemaSet {
  private docs = new Map<string, Schema>();
  constructor(dir: string) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".schema.json"))) {
      this.docs.set(f, JSON.parse(readFileSync(join(dir, f), "utf8")));
    }
  }
  names(): string[] { return [...this.docs.keys()]; }
  /** The parsed schema document, for checks that read an enum instead of restating it. */
  get(schemaFile: string): Schema | undefined { return this.docs.get(schemaFile); }

  validate(schemaFile: string, value: unknown): SchemaError[] {
    const root = this.docs.get(schemaFile);
    if (!root) throw new Error(`unknown schema ${schemaFile}`);
    const errors: SchemaError[] = [];
    this.check(root, schemaFile, value, "", errors, 0);
    return errors;
  }

  private resolve(ref: string, currentFile: string): { schema: Schema; file: string } {
    const [file, frag] = ref.split("#");
    const targetFile = file === "" ? currentFile : file;
    const doc = this.docs.get(targetFile);
    if (!doc) throw new Error(`unresolved $ref ${ref}`);
    let cur: any = doc;
    for (const seg of (frag ?? "").split("/").filter(Boolean)) {
      cur = cur?.[seg];
      if (cur === undefined) throw new Error(`unresolved $ref ${ref}`);
    }
    return { schema: cur, file: targetFile };
  }

  private check(schema: Schema, file: string, value: unknown, pointer: string, errors: SchemaError[], depth: number): void {
    if (depth > 64) throw new Error("schema recursion too deep");
    if (schema.$ref) {
      const { schema: target, file: targetFile } = this.resolve(schema.$ref, file);
      // Sibling keywords beside $ref apply too (2020-12 semantics).
      const { $ref, ...rest } = schema;
      this.check(target, targetFile, value, pointer, errors, depth + 1);
      if (Object.keys(rest).some((k) => k !== "description")) this.check(rest, file, value, pointer, errors, depth + 1);
      return;
    }
    const type = schema.type;
    if (type && !typeMatches(type, value)) {
      errors.push({ pointer, message: `expected ${type}, got ${describe(value)}` });
      return;
    }
    if (schema.enum && !schema.enum.some((e: unknown) => deepEqual(e, value))) {
      errors.push({ pointer, message: `must be one of ${schema.enum.map((e: unknown) => JSON.stringify(e)).join(", ")}` });
    }
    if (schema.const !== undefined && !deepEqual(schema.const, value)) {
      errors.push({ pointer, message: `must equal ${JSON.stringify(schema.const)}` });
    }
    if (typeof value === "string") {
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push({ pointer, message: `"${value}" does not match ${schema.pattern}` });
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push({ pointer, message: `shorter than ${schema.minLength}` });
    }
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) errors.push({ pointer, message: `below minimum ${schema.minimum}` });
      if (schema.maximum !== undefined && value > schema.maximum) errors.push({ pointer, message: `above maximum ${schema.maximum}` });
    }
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ pointer, message: `needs at least ${schema.minItems} item(s)` });
      if (schema.uniqueItems) {
        const seen = new Set<string>();
        value.forEach((v, i) => { const k = JSON.stringify(v); if (seen.has(k)) errors.push({ pointer: `${pointer}/${i}`, message: "duplicate item" }); seen.add(k); });
      }
      if (schema.items) value.forEach((v, i) => this.check(schema.items, file, v, `${pointer}/${i}`, errors, depth + 1));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      for (const req of schema.required ?? []) if (!(req in obj)) errors.push({ pointer, message: `missing required "${req}"` });
      const props = schema.properties ?? {};
      for (const [k, v] of Object.entries(obj)) {
        if (k in props) this.check(props[k], file, v, `${pointer}/${k}`, errors, depth + 1);
        else if (schema.additionalProperties === false) errors.push({ pointer: `${pointer}/${k}`, message: "unknown property" });
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object") this.check(schema.additionalProperties, file, v, `${pointer}/${k}`, errors, depth + 1);
      }
    }
  }
}

function typeMatches(type: string, v: unknown): boolean {
  switch (type) {
    case "string": return typeof v === "string";
    case "integer": return typeof v === "number" && Number.isInteger(v);
    case "number": return typeof v === "number";
    case "boolean": return typeof v === "boolean";
    case "null": return v === null;
    case "array": return Array.isArray(v);
    case "object": return v !== null && typeof v === "object" && !Array.isArray(v);
    default: return true;
  }
}
function describe(v: unknown): string { return v === null ? "null" : Array.isArray(v) ? "array" : typeof v; }
function deepEqual(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
