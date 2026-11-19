#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$repo_root"
export SKILLPRISM_VERSION=0.5.0
bunx skillprism@0.5.0 build --force

skill_count="$(find dist/devin -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l)"
if [[ "$skill_count" -ne 14 ]]; then
  printf 'Expected 14 Devin skills, found %s\n' "$skill_count" >&2
  exit 1
fi

plugin_dir="$repo_root/dist/devin-plugin"
rm -rf -- "$plugin_dir"
mkdir -p -- "$plugin_dir/.devin-plugin" "$plugin_dir/skills"
cp -R -- "$repo_root/dist/devin/." "$plugin_dir/skills/"
printf '%s\n' '{"name":"constitutional-framework-skills","version":"0.1.0","description":"Constitution-driven planning, execution, and independent review skills for Devin."}' > "$plugin_dir/.devin-plugin/plugin.json"
printf 'Packaged 14 skills into %s\n' "$plugin_dir"
