---
name: {{ skill_name }}
description: "{{ skill_description }}"
metadata:
  family: {{ metadata.family }}
  companion: {{ metadata.companion }}
---

# Interview – Pre-Stage Preparation

This skill is a **transient, conversational companion** to the four canonical stages. You do **not** generate or modify any repository files. Your only output is shared understanding with the user inside this session.

After the interview, you must offer to chain the corresponding stage skill, which will natively consume this active session's memory to produce the actual files.

## 1. When This Skill is Triggered

The user invokes `/interview` and **must** specify a target stage. Valid stage names:

- `PRD`
- `Architecture`
- `TechSpec`
- `Tasks`

Example: `/interview for TechSpec`

If the user does not specify a stage, ask for it and stop until provided.

## 2. Core Protocol

1. **Validate the Stage:** Map the target stage name to the corresponding generation skill:
   - `PRD` → `defining-product-requirements`
   - `Architecture` → `designing-solution-architecture`
   - `TechSpec` → `specifying-technical-implementation`
   - `Tasks` → `planning-engineering-execution`

2. **Read the Target Skill:** Load the target stage's `SKILL.md` to align with its decisions, allowed boundaries, default postures, and validation rules.

3. **Read Upstream Directories:** Load the `.constitution/` directories that the target stage depends on:
   - For `PRD`: none (except user intent and the codebase).
   - For `Architecture`: `.constitution/prd/` (if it exists).
   - For `TechSpec`: `.constitution/prd/` and `.constitution/architecture/`.
   - For `Tasks`: `.constitution/prd/`, `.constitution/architecture/`, and `.constitution/tech-spec/`.

4. **Inspect the Codebase:** Check the target directories against the current codebase using available tools. Detect brownfield realities, active implementation patterns, and any drift between existing docs and active code.

5. **Identify Ambiguities:** Analyze your findings to locate:
   - Gaps where the target generation stage would have to invent state, schemas, or protocols.
   - Areas where the framework's default postures might conflict with the user's unstated preferences.
   - Costly-to-reverse paths (such as persistence engines, logical container boundaries, or breaking contract changes).

6. **Present Findings:** Before asking questions, summarize your analysis for the user: detected gaps, drift between existing `.constitution/` directories and codebase reality, and costly-to-reverse paths. Give the user a chance to correct misreadings before questioning begins.

7. **Interrogate the User:** Ask **one question at a time**.
   - State the specific upstream directory or file context that triggered the query.
   - Provide your recommended default solution along with alternative options and their technical trade-offs.
   - If the user provides a multi-part answer spanning multiple topics, parse and apply it to each relevant area before asking the next outstanding question.
   - Continue until all major design branches are resolved, or the user says "stop" / "ready".

8. **Offer to Proceed:** End the interview with:
   > "Should I run `[target-generation-skill-name]` now?"

   Wait for the user's response. If they say "yes", execute that skill.

## 3. Adaptation

Adjust your questions dynamically based on:

- **Greenfield:** Focus on foundational structural decisions (patterns, data shapes, primary actors).
- **Brownfield:** Focus on discrepancies between what is written in the `.constitution/` subdirectories and how the codebase actually behaves.
- **Evolution:** Skip existing, unchanged structures. Focus exclusively on the boundaries, local changelog version history, and specific delta of the change.
- **Cost of being Wrong:** Prioritize expensive-to-reverse decisions (e.g., choice of databases, communication protocols). Skip low-impact defaults unless the user brings them up.
- **Decision Familiarity (teach-then-decide):** When a decision is both expensive-to-reverse *and* outside the user's evident familiarity (or they say it is unclear), switch from terse recommend-and-confirm to a brief *teach-then-decide*: a plain-language mental model, analogy-framed options, and a decision lens the user can own, then your recommendation with its honest caveat. Keep the terse style for in-wheelhouse decisions so this never becomes the default.
- **Stated Preferences:** If the user says "you decide X", adopt the default posture, record the decision in active memory, and stop questioning on that topic.

## 4. Guardrails

- Do **not** generate, edit, or delete any files in the workspace during `/interview`.
- Do **not** proceed to the interview without a valid, validated target stage.
- Do **not** assume permission to execute the downstream generation skill; always ask and wait for explicit confirmation.
- Do **not** ask low-impact questions when the user signals impatience or when defaults are acceptable.
- Do **not** re-litigate decisions listed in `.constitution/prd/out-of-scope/` files unless the user explicitly asks to reopen a rejected concept.
