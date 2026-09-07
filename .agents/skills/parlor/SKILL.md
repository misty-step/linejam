---
name: parlor
description: Review Parlor integration guidance for this game; Parlor is not installed and migration is not implied.
---

# Parlor — repository-local guidance

Maintained by [Parlor](https://github.com/misty-step/parlor), imported only for this consuming repository at `.agents/skills/parlor`. Do not install it in a home/global skills directory or copy it into unrelated projects. The user's request and this game's requirements remain authority.

## Source and scope

**Guidance only: Parlor is not installed in this app.** This import does not select or perform a migration. Apply integration instructions only when the user requests that work, then select and inspect a pinned source revision.

Read [SOURCE.json](SOURCE.json) for the source revision and content hashes, then [reference.md](reference.md) for integration guidance. Its code paths are relative to the Parlor source, not this game's root. A working-tree reference is explicitly recorded as such; its revision is a base commit, not a claim that uncommitted text was released. Website docs may describe a newer API.

Historical examples are context, not a task plan or an API guarantee. Use the [owner's guidance on older examples](https://parlor.mistystep.io/docs/agents/#use-historical-examples-safely) when adapting them, with the installed implementation remaining authority. Read only the contracts relevant to the requested change and verify that integration path; complete-game acceptance belongs to new integrations, with affected trust and lifecycle transitions checked when changed.

## Current work and permission boundary

Linear owns current work, prioritization, and selected unresolved opportunities. Any GitHub issue-intake instructions in the pinned reference are historical and superseded, not commands to execute. Prepare a concise reproduction with the source revision and expected/actual behavior; create or update a work item only when the user requests it. No automatic queue intake.

Keep version-bound contracts, accepted decisions, and portable procedures in the repository. Keep raw, large, or sensitive run output in approved retained artifact storage, with only a sanitized summary and appropriate link in Linear. Do not publish credentials, cookies, tokens, or private game data. Importing this skill does not authorize dependency updates, backend changes, or deployment.

## Refresh from the owner

Maintain integration guidance in Parlor's `skills/parlor/SKILL.md`, not this derived package. Use Parlor's `scripts/import-skill.mjs --target <game-repository> --guidance-only` after reviewing source alignment. Keep all imported files byte-for-byte, including excluding this directory from consumer formatters. The importer leaves an identical package untouched and refuses to overwrite a differing package; preserve and review that copy before deliberately replacing the whole package. Updating the framework pin is a separate, explicit change.
