---
name: {{ skill_name | yaml_str }}
description: {{ skill_description | yaml_str }}
metadata:
  family: {{ metadata.family | yaml_str }}
  companion: {{ metadata.companion | yaml_str }}
---

# Pre-stage interview

Load `references/framework-overview.md` before you start; it describes the pipeline, the modes, certainty, and the register rules.

This skill is a conversation, not a generation stage. Its main product is shared context in this session, which the stage skill then works from when it writes the files. Its written outputs are listed under Artifacts.

## Targets

| Target | Generation skill | Upstream inputs |
| :--- | :--- | :--- |
| PRD | `defining-product-requirements` | None. Work from user intent, draft material, and the codebase. |
| Architecture | `designing-solution-architecture` | `prd/` |
| TechSpec | `specifying-technical-implementation` | `prd/`, `architecture/` |
| Tasks | `planning-engineering-execution` | `prd/`, `architecture/`, `tech-spec/`, the newest relevant `reports/audit-*.md`, `tasks/changelog.yaml`, the actuals under `tasks/completed/`, and the derived `Outstanding obligations` section in `tasks/critical-path.md` with its source records |
| Realign | The stage skills its plan schedules, in pipeline order | Every `.constitution/` directory, the codebase, and `validate` output |

Use a target from the table, named by the user or the authorized handoff, for example `/interview for TechSpec`. If neither names one, ask for one and wait.

## Calibrate before questioning

Before the first question, restore the target, mode, settled choices, and depth budget from the conversation or handoff. Reuse an agreed budget; otherwise estimate the domain's intrinsic complexity, state the estimate, and agree the question budget, reconnaissance, and spike ceiling.

- Don't infer size from the volume of existing artifacts; a thin constitution can sit on top of a large domain.
- Judge complexity from domain signals: distinct actors, entities with nontrivial lifecycles, external integrations, failure and recovery semantics, the security and compliance surface.
- For claims about implementation, prefer running code, then committed documents, then draft material. The user's intent and accepted rulings govern the requested behavior. Treat unsupported draft claims as seeds to probe.

| Pass | Question budget | Reconnaissance subagents | Spikes you can run |
| :--- | :--- | :--- | :--- |
| Quick | The expensive-to-reverse decisions only | 0 to 1 | 0 to 1 |
| Full | The whole surface of the target's layer | Up to 4 parallel, read-only | Up to 3, by agreement |

The spike count is a ceiling, not a plan; the need for one appears in Phase B. Once the user picks the full sweep, don't cut it short.

## Protocol

1. Read the target skill's `SKILL.md`, so your questions respect its decisions, boundaries, defaults, and schemas. For Realign, read all four.
2. Read the upstream inputs, `reports/open-decisions.yaml`, and relevant prior rulings and handoffs, carrying their sourced preferences and continuation limits forward.
3. Calibrate any unsettled depth choices without repeating an answered calibration question, and dispatch the agreed pass's reconnaissance at once so its findings are back before Phase A.
4. Inspect applicable `validate` evidence and run it only when missing or invalidated. Collect the reconnaissance (what's built, the patterns in use, and where the code contradicts an assumed record) and check any finding you rely on yourself.
5. Before asking anything, summarize your analysis: the gaps, the disagreements between the constitution and the code, the assumed records, and the expensive paths.
6. Run Phase A. When it closes, dispatch one parallel batch of grounding subagents for the external facts Phase B will lean on, then run Phase B.
7. Finish the artifacts.
8. List the files you wrote and hand the settled context to the target stage, with the ordered realignment plan for Realign. Keep code and constitution changes in separate commits; small related stage changes can share one coherent PR.
9. Continue into the named stage when existing user authorization covers it; otherwise ask once to run it and wait. Stop at the user's stated boundary; completing the interview doesn't expand that authority.

### Phase A: elicitation

Sweep the surface before settling any design. PRD gets the heaviest sweep. Architecture and TechSpec sweep their own layer's surface: flows, contracts, failure semantics. In Evolution mode, sweep only the delta.

- For each actor, walk their workflows end to end until nothing new appears.
- For each entity, walk the full lifecycle, including hold, cancel, and failure paths.
- For each capability the user names, ask what's adjacent that hasn't been named.
- For each external integration, ask what happens when it's down, slow, or wrong.
- Exit when a full pass yields nothing new, or when the user stops it.

### Phase B: resolution

Settle the design decisions Phase A surfaced. Three patterns mark an ambiguity worth a question: a gap that forces the stage to invent state, schemas, or protocols; a framework default that might conflict with an unstated preference; a path that's expensive to reverse.

For each unresolved question, name the upstream record or Phase A answer that prompted it, and give your recommended answer, the alternatives, and their trade-offs; a deferred answer becomes a register entry in exactly that shape. Reopen a settled choice only when new evidence or changed scope invalidates it, and name that change first.

#### Offer a closure when your ground is thin

On a choice that's expensive to reverse, say what your recommendation rests on before the user answers. When the ground is thin, name the evidence that would change your mind, and offer the closure that would produce it as one of the options.

In the TechSpec target, an ADR-level choice (contract family, persistence engine, compatibility policy, vendor, platform IPC model) gets two independent designs before you recommend. Brief both designers identically with the question, the binding boundaries and flows, the PRD meters, and the operator preferences, withholding your own view and each other's output. Present both side by side with where they converge and diverge, and your synthesis: convergence from two runtimes is strong ground, and a divergence you can't settle is the question to ask. Record both in the interview record so the Stage 3 pass cites them under "Alternatives considered" instead of designing again.

| What's missing | Offer | What it produces |
| :--- | :--- | :--- |
| A fact about this system that measurement would settle | A spike | A spike file whose recommendation closes the entry |
| A method, prior art, or source behind the recommendation | A design review | A research file the user rules from |
| Only the user's intent decides it | A ruling | Their answer, in the record |
| Nothing much, and the choice is cheap to reverse | The framework default | One line stating it back |

When you can't name what would change your recommendation, there's nothing for a spike to find, so don't offer one. When the user asks for a design review because a recommendation feels shallow, commission it.

## Subagents

Keep the conversation and judgment with the interviewer, and delegate substantial independent reconnaissance, source gathering, or agreed research as bounded assignments. Use available models suited to the work and the user's cost preferences, name the chosen model or explicitly agreed inheritance, and don't require another provider for a routine interview.

| Job | Capability | When |
| :--- | :--- | :--- |
| Codebase reconnaissance | Read-only repository inspection | During calibration when the agreed pass needs it |
| External grounding | Web research with pinned sources | One batch of independent questions after Phase A |
| Spike | Isolated measurement and technical judgment | By agreement, within the spike budget |
| Design review | Analysis of methods and alternatives | When a recommendation lacks grounding |
| Design it twice | Two isolated designers, preferably different models or runtimes | Before an unresolved ADR-level recommendation |

{% if harness.id == "claude" %}Use the Agent tool for native delegation and an available runtime adapter only when chosen.{% elif harness.id == "codex" %}Use `collaboration.spawn_agent` with `fork_turns: "none"` and an explicit available model and reasoning effort. For Claude designers or research workers, read [Coordinate Codex and Claude](~/.codex/skills/constitution-tooling/references/codex-claude-bridge.md), launch fresh sessions with approved controls, require explicit reports, and keep the receive waiter active alongside outgoing briefs.{% elif harness.id == "antigravity" %}Use `invoke_subagent` (`TypeName: "research"` for read-only reconnaissance, grounding, or design reviews; for a spike that writes scratch files, first register a spike subagent with `define_subagent` setting `EnableWriteTools: true` and `EnableSubagentTools: false`) with a self-contained brief and the agreed `Model` tier (`"pro"`, `"flash"`, `"flash_lite"`, or `"inherit"` when inheritance was agreed); use an available runtime adapter (`codex-subagent` or `pi-subagent`) when an external model ID is chosen.{% else %}Use `spawn_subagent` with a self-contained brief and the agreed model; an omitted model is allowed only when inheritance was explicitly agreed.{% endif %} Every brief names the role, target revision, bounded question, exact input pointers, constraints, output, permissions, and a no-further-delegation boundary. Do small mechanical reads and corrections directly.

Grounding workers return the canonical URL, checked version, date, and supported claim. Check the source your recommendation needs and cite it in the interview record so later stages reuse the same research. Reuse applicable research, refreshing only claims that changed versions, inputs, or constraints invalidated.

## Interview stance

Challenge rather than absorb: when the user's stated design conflicts with good engineering judgment, say so plainly, name the problem, and offer two or three options with a recommendation. When a choice is workable but weak, say so and say what you'd do. Question rather than assume; a mistake caught here costs one question, and caught in Stage 4 it costs a replan.

## Batch questions

Ask one question at a time by default. Batch two to four when their answers are provably independent and on one theme, never mixing a heavyweight decision into quick enumerations, and return to one at a time the moment an answer surprises you.

## Adapt the questions

- **Greenfield.** Foundational structure: the pattern, the data shapes, the primary actors.
- **Brownfield.** The differences between what the constitution claims and how the code behaves.
- **Evolution.** Only the delta, its boundaries, and the changelog history of the directories it touches.
- **Cost of being wrong.** Prioritize expensive-to-reverse decisions. In Phase B, skip low-impact questions the user hasn't raised when the defaults are acceptable or the user signals impatience; Phase A depth is governed by the calibration agreement.
- **Unfamiliar decisions.** Teach before you ask for a choice: a plain-language mental model, options by analogy, a lens to apply, then your recommendation and its caveat.
- **Delegated decisions.** When the user says "you decide," take the framework default, state it back in one line, and stop asking.
- **Verification preferences.** Carry the owner's contribution model and local or remote verification requirements forward, and don't reopen an agreed comments, tests, CI, or release policy without a material change.

## The register

`reports/open-decisions.yaml`, schema `open-decisions.schema.json` in `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/constitution-tooling/assets/schemas/`, is the single live register and this skill owns it.

Only the user defers a question: every entry records a question the user was actually asked and chose to leave open or to close by evidence. Never register a question you skipped or ran out of budget for; ask it before closing, or drop it.

An entry is a decision, not a topic: one concrete question, what it blocks (non-empty), at least two options with pros and cons, your recommendation, and a closure path:

- **`spike`** when evidence about this system closes it: name the spike id. Run it here when it fits three points; otherwise Stage 4 plans it ahead of what the entry blocks.
- **`ruling`** when only the user closes it: name who rules and what input they wait for. When they wait on a design review, `waiting_on` names the research file.

Closure requires a ruling reference: this interview record, a spike, a changelog version, or the user's words.

In each interview, mark entries the user closed as `closed` with the ruling, keep unresolved entries `open`, and review entries execution proposed (`status: proposed`) with the user, either opening them properly or closing them. Never delete an entry.

For a Tasks or Realign interview, inspect the derived `Outstanding obligations` section, when present, and its active or archived source records, matching existing owners, scheduled replacements, accepted rulings, delivery evidence, and explicit retirement before proposing work. An archived epic or a done replacement doesn't by itself close an obligation. Keep material residual risk visible without creating duplicate tickets or a second register.

### Close a question with a spike

Register the entry first, because the spike's name comes from its number. The spike file is `spikes/SPK-<ACRONYM>-OD<NNN>.md`, with `<NNN>` the entry's number padded to three digits, written from the Stage 4 template at `~/.{% if harness.id == "antigravity" %}gemini/antigravity-cli{% else %}{{ harness.id }}{% endif %}/skills/planning-engineering-execution/assets/templates/spike.md`. `OD` is reserved for these spikes, and the validator rejects an epic that takes it as an id.

Give the subagent the question, the budget in points, and the entry's option set. It works in a throwaway git worktree or temp directory that's discarded afterwards. Measurements go in the spike file's options section in units of measure, never calendar time, because the validator rejects time units in a spike. Read the spike and run `validate` before you use it. When you accept its recommendation, close the entry with the spike as its ruling reference, so the next stage writes against a settled record; when it fails to answer, leave the entry open and record what it ruled out.

### Commission a design review

A design review answers a recommendation that has no method, prior art, or source behind it. It's a research deliverable at `research/<slug>.md`, written from `assets/templates/research-review.md` with that template's front matter. It informs a ruling and settles nothing itself, and the entry keeps `ruling` closure with the ruler named.

The brief names the question, the constraints from the PRD, and what counts as a reputable source for it, and withholds your own recommendation so the subagent reaches its own; where it disagrees with you, the disagreement is the finding. The review returns options with the method or source behind each, a recommendation, pinned references, and where your view was shallow, if it was.

## Realign

Realign upgrades the constitution of a running project.

- Start from the assumed records `validate` lists and the decayed-evidence warnings: those are the agenda. Send the reconnaissance after them, one question each: does the code settle this record, contradict it, or neither?
- Diff reality against each layer, top down. For each material drift, ask whether the code's behavior is the new intent, a defect to fix, or both.
- Assign each accepted change to the stage that owns it, never a downstream patch for an upstream defect.
- Close with an ordered realignment plan: the stage skills to run in pipeline order, each in Evolution mode, with the scope of its delta.

## Artifacts

- `reports/DATE-interview-TARGET.md`: every ruling made, with the user's reasoning, sourced preferences and communication channel, authorized continuation and stop boundary, and the pinned sources the grounding returned. This is a log; its rulings reach the constitution through the stage that runs next, cited as `ruling` evidence.
- `reports/open-decisions.yaml`: the register, updated as above.
- `spikes/SPK-<ACRONYM>-OD<NNN>.md`: a spike you ran to close an entry, which is the entry's ruling reference and `spike` evidence for the stage that writes next.
- `research/<slug>.md`: a design review you commissioned. It informs a ruling; nothing cites it as evidence.

## Handoff and continuation

Pass a compact handoff with only the context the receiving stage needs: role, target and mode, effective authority and its source, settled rulings and preference pointers, communication channel, current unit, next gate, stop boundary, artifact paths, and any native task handles. Sending a handoff doesn't prove it was applied.

## Guardrails

- Write only the artifacts above. Never touch the stage directories, and never commit a spike's scratch code.
- Don't reopen a decision recorded in `prd/out-of-scope/` unless the user asks to reconsider it.
