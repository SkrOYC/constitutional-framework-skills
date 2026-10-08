# fix command tree

- `fix render <Note>`: writes `<Note>.html`; exit 0 on success, 1 on parse error, 2 on usage error.
- `fix check <Note>`: prints one missing Link per line; exit 0 when none, 1 otherwise.
