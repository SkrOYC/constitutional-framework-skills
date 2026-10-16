# Evidence Preservation Checklist

Apply this whenever a milestone cites external sources or preserves their bytes as fixtures. It does not apply to run evidence under `evidence/<ticket>/`, which is captured once and never frozen or re-pinned. Each item is a defect class that independent reviewers reliably find later; catching it before commit is cheaper.

## Citation form

- **Pin every source.** Never cite a branch or floating alias (`main`, `master`, `stable`, `latest`, `HEAD`, `nightly`). Cite a resolved commit, an immutable tag resolved to its commit, a versioned release artifact, or a dated archive snapshot. If no immutable form exists, keep the citation but label it mutable, record the fetch timestamp, and preserve the excerpt that supports the claim.
- **Cite the upstream, not a mirror.** Record the project's own repository as the source of record. A mirror may be used as transport only if you verify the bytes are identical and say so.
- **Transport is not source.** Reader proxies, caches, and rendered-doc sites are transports. Cite the canonical URL, never the proxy URL, and never treat a proxied body as fixture bytes or hash it as if it were the source.
- **Match the citation to the claim's version.** Evidence from release N does not close a claim about release M. If the versioned form of the document does not exist, the claim stays open.
- **One fact, one status.** When two deliverables cite the same fact, they must reach the same status with the same evidence, or one must explicitly defer to the other.

## Preserved bytes

- **Preserve exact bytes and a digest.** Fetch canonically, record byte count and SHA-256, and keep the fetch command as a transcript. Non-byte-stable transports may only contribute preserved excerpts, hashed as excerpts and labeled as such.
- **Record provenance beside the bytes.** Each preserved upstream file carries a sidecar (or equivalent record) with repository, commit or version, upstream-relative path, retrieval URL, license expression, and where the license text lives. Use the repository's existing sidecar convention if one exists; do not invent a second one.
- **Licenses are expressions, not prose.** Use SPDX identifiers or an explicit `LicenseRef-` form plus a note and URL for non-SPDX cases (vendor pages, page copyright notices). Never invent composite identifiers.
- **Retrieval commands must match the record.** Any instruction that tells a later stage to fetch a file quotes the same pinned URL the provenance record stores.

## Commands and transcripts

- **Pin tools, not just sources.** Commands that a later stage must repeat use pinned toolchains and package references, not registry aliases or whatever is on `PATH`.
- **Fix the locale.** Run anything whose output is parsed or compared under a fixed locale (for example `LC_ALL=C`), and say so in the command.
- **No host-specific paths in prescribed commands.** Parameterize checkout roots, home directories, and tool paths. Preserved historical transcripts may keep them but must be labeled historical, with the pinned, host-neutral form given alongside.
- **Distinguish recorded values from pass criteria.** Session-specific outputs (window ids, sizes, versions, timestamps) are recorded facts; a repeatable procedure states what a later run must satisfy.
- **Anchor counts to a commit and recount at use.** A count of files, rows, or fixtures measured for a sequenced plan is true only at the commit it was measured; record that commit beside the number, and make any later step that depends on the count re-run the same command instead of pinning the literal, because the steps before it typically change the set.
- **Coverage is not cardinality.** A check that every present item satisfies a rule (has a sidecar, has a digest, parses) does not enforce how many items there are; if a count matters, add an expected-set comparison against the source inventory that fails on missing and extra items.
- **Prove, don't pattern-match.** A containment or equivalence check must be decisive for the claim it supports (ordered hunks, byte comparison of the governing region), not set membership that a pre-change file could also satisfy.

## Freezing

- Freeze digest-bound content last, after content review.
- When frozen content must change, re-serialize with the documented mechanism, recompute every digest and byte count, and grep every deliverable for the old digest in the same commit.
- Protect frozen blocks from formatters with the repository's documented mechanism and verify digests after formatting runs.
