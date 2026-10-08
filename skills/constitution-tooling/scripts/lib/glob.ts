// Minimal glob matching: ** (any depth), * (within a segment), ? (one char). Paths are repository-relative with forward slashes.
export function globToRegExp(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slashAfter = glob[i + 2] === "/";
        re += slashAfter ? "(?:.*/)?" : ".*";
        i += slashAfter ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(re + "$");
}

export function matchesAny(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path) || path === g || path.startsWith(g.replace(/\/$/, "") + "/"));
}

/** True when one path is the other or lies inside it (directory prefix). */
export function overlaps(a: string, b: string): boolean {
  const x = a.replace(/\/$/, "");
  const y = b.replace(/\/$/, "");
  return x === y || x.startsWith(y + "/") || y.startsWith(x + "/");
}
