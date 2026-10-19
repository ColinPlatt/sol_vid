---
name: cost-aware-delegation
description: Split substantial repository work into bounded subagent assignments, choose cheaper models, coordinate file ownership, and verify results. Use when delegation is authorized and independent work can justify its coordination cost.
---

# Cost-aware delegation

Reduce total work and latency while keeping the lead accountable for the
result. A cheaper model per token does not guarantee a cheaper completed task.

## Decide what to delegate

Handle tiny edits, tightly coupled investigations, and work already understood
by the lead directly. Delegate independent tasks with clear outputs: locate a
code path, compare an artifact with its source, implement a contained change,
or check a specific failure mode. Avoid several agents independently reading
the entire repository or solving the same problem.

Keep architecture, uncertain requirements, contract security decisions,
deployment authorization, and final integration with the lead. Independent
reviews can inform these decisions; they do not replace them.

Before spawning, identify dependencies and reserve disjoint write ownership.
Start with one or two workers. Use a third only for genuinely independent work
and when the runtime has capacity. The current collaboration runtime allows
four active agents including the lead; account for existing agents rather
than assuming all slots are free. Do not create nested teams by default.

## Choose model and context

Inspect the current spawn tool's schema and description for supported models
and parameters. If no catalog is exposed, use models established by the
current environment's instructions; do not guess names or probe account
endpoints. Treat unconfirmed availability as unknown. For this repository
the user's requested delegation policy is:

| Assignment | Preferred model and effort |
| --- | --- |
| Targeted search, artifact comparison, routine contained edit | `gpt-6-luna`, `medium` |
| Bounded review requiring edge-case analysis | `gpt-6-luna`, `high` |
| Work Luna cannot resolve, or broader implementation needing substantial judgment | `gpt-6.1-sol`, `medium`, if available; otherwise handle with the lead |

Use only models actually exposed by the runtime. If the cheaper model is
unavailable, tell the lead; do not silently launch an expensive substitute or
retry an unsupported name repeatedly. The lead should default to taking the
task over. It may explicitly choose an available fallback from the table when
the task justifies it, recording the choice and reason in its task ledger.
Keep simple work local when escalation would erase the benefit. A larger
reasoning setting is not a substitute for a clear assignment.

With the current `collaboration.spawn_agent` tool, set `fork_turns="none"` when
specifying `model` or `reasoning_effort`. Supply the necessary context explicitly
instead of copying the conversation. For example:

```text
task_name: audit_evidence
fork_turns: none
model: gpt-6-luna
reasoning_effort: medium
message: [the completed task brief below]
```

This is a tool-call shape, not a shell command. Other clients may expose a
different schema; adapt to their actual tools. A skill sets working policy,
not a hard billing limit or a runtime configuration override.

## Write a complete assignment

Give the worker enough context to proceed without the chat history. Include
only inputs relevant to its task. Use this brief, omitting empty fields:

```text
Outcome: [one concrete deliverable and why it matters]
Workspace: [absolute root; read applicable AGENTS.md first]
Inputs: [specific files, symbols, artifacts, and necessary known facts]
Ownership: [exact files allowed to change, or read-only]
Constraints: [invariants, interfaces, exclusions, and other active owners]
Acceptance: [observable behavior or evidence required]
Validation: [targeted commands; output paths owned by this worker]
Limits: [one focused pass; stop and report if scope or assumptions fail]
Return: [result, changed files, checks with outcomes, unresolved issues]
Coordination: Shared working tree. Preserve others' edits. No commits, pushes,
deployments, broadcasts, or child agents. Report needed scope expansion first.
```

Do not expose signing material or unrelated private context. Repository
deployment and publication rules still apply. A worker's assignment does not
grant broader permissions than the parent has.

For independent review, provide raw inputs and acceptance criteria without
the suspected answer or a request to confirm the lead's conclusion. Ask for
concrete findings with file/line references, evidence, and uncertainty. Allow
the answer to be "no supported finding."

## Coordinate the work

Maintain a small task ledger in working notes: agent, model/effort, deliverable,
owned paths, dependencies, status, and evidence. A chat-local ledger is enough
for short work; use a shared file only for a genuinely long handoff.

While agents work, advance integration or another independent task. Send only
material discoveries affecting a worker's scope. Reuse an existing worker
with a follow-up when its context is still relevant. Avoid frequent status
polling and repeated reviews without a concrete unresolved concern.

In a shared tree, file isolation is insufficient if commands overwrite common
artifacts. Serialize Foundry builds, fixture generation, and other writes to
shared caches/output paths, or configure separate output directories. Never
run a destructive clean or revert to obtain an isolated workspace.

If a worker stalls or fails a check, ask one focused diagnostic follow-up when
new evidence can help. Then narrow the task, take it over, or escalate the
model. Do not fan out replicas of the same failing assignment. Interrupt
obsolete work promptly when the task changes.

## Integrate and verify

Treat worker reports as claims. Read changed diffs, inspect cited artifacts,
and check that acceptance criteria are met. Run relevant integrated checks
once after dependencies land; repeat only for new changes, failures, or
unresolved concerns. Do not rerun a costly media audit merely because a
documentation-only assignment completed.

For this project, distinguish native onchain media from viewing copies, exact
pixel checks from perceptual checks, and measured capped static calls from
estimates. Preserve recipe versioning, live collections, and deployment gates
in AGENTS.md. Coordinate with other active editors, including Claude.

The lead owns commits and pushes, staging only its task's files. Report the
result and remaining limitations. When discussing efficiency, distinguish
observed wall time, usage if exposed, and model choice; do not invent dollar
savings or claim a token budget was enforced without supporting telemetry.

## Capability references

Consult these when client behavior or discovery changes, rather than assuming
configuration from another environment applies:

- [OpenAI subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Local skill discovery](https://learn.chatgpt.com/docs/build-skills)
