# Evidence Preservation Checklist

Apply this whenever a milestone cites external sources or preserves their bytes as fixtures, but not to run evidence under `evidence/<ticket>/`, which is captured once and never frozen or re-pinned. Each item is a defect class independent reviewers reliably find later, so catch it before commit.

## Citation form

- **Pin every source.** Never cite a branch or floating alias (`main`, `master`, `stable`, `latest`, `HEAD`, `nightly`). Cite a resolved commit, an immutable tag resolved to its commit, a versioned release artifact, or a dated archive snapshot. If no immutable form exists, keep the citation labeled mutable, with the fetch timestamp and the preserved excerpt that supports the claim.
- **Cite the upstream, not a mirror.** The project's own repository is the source of record; a mirror may serve as transport only after you verify its bytes are identical and say so.
- **Transport is not source.** Reader proxies, caches, and rendered-doc sites are transports: cite the canonical URL, never the proxy URL, and never treat a proxied body as fixture bytes or hash it as the source.
- **Match the citation to the claim's version.** Evidence from release N doesn't close a claim about release M; if the versioned form of the document doesn't exist, the claim stays open.
- **One fact, one status.** When two deliverables cite the same fact, they reach the same status with the same evidence, or one explicitly defers to the other.

## Preserved bytes

- **Preserve exact bytes and a digest.** Fetch canonically, record byte count and SHA-256, and keep the fetch command as a transcript. A non-byte-stable transport may contribute only preserved excerpts, hashed and labeled as excerpts.
- **Record provenance beside the bytes.** Each preserved upstream file carries a sidecar or equivalent record with repository, commit or version, upstream-relative path, retrieval URL, license expression, and where the license text lives. Use the repository's existing sidecar convention if one exists rather than inventing a second.
- **Licenses are expressions, not prose.** Use SPDX identifiers, or an explicit `LicenseRef-` form plus a note and URL for non-SPDX cases (vendor pages, page copyright notices). Never invent composite identifiers.
- **Retrieval commands match the record.** Any instruction telling a later stage to fetch a file quotes the same pinned URL the provenance record stores.

## Commands and transcripts

- **Pin tools, not just sources.** Commands a later stage must repeat use pinned toolchains and package references, not registry aliases or whatever is on `PATH`.
- **Fix the locale.** Run anything whose output is parsed or compared under a fixed locale (for example `LC_ALL=C`), stated in the command.
- **No host-specific paths in prescribed commands.** Parameterize checkout roots, home directories, and tool paths. Preserved historical transcripts may keep them if labeled historical, with the pinned, host-neutral form alongside.
- **Distinguish recorded values from pass criteria.** Session-specific outputs (window ids, sizes, versions, timestamps) are recorded facts; a repeatable procedure states what a later run must satisfy.
- **Anchor counts to a commit and recount at use.** A count of files, rows, or fixtures measured for a sequenced plan is true only at the commit where it was measured, because earlier steps typically change the set. Record that commit beside the number, and have any later step that depends on the count re-run the same command instead of pinning the literal.
- **Coverage is not cardinality.** A check that every present item satisfies a rule (has a sidecar, has a digest, parses) doesn't enforce how many items exist; if a count matters, add an expected-set comparison against the source inventory that fails on missing and extra items.
- **Prove, don't pattern-match.** A containment or equivalence check must be decisive for its claim (ordered hunks, byte comparison of the governing region), not set membership a pre-change file could also satisfy.

## Freezing

- Freeze digest-bound content last, after content review.
- When frozen content must change, re-serialize with the documented mechanism, recompute every digest and byte count, and grep every deliverable for the old digest in the same commit.
- Protect frozen blocks from formatters with the repository's documented mechanism, and verify digests after formatting runs.
