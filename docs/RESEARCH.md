# Research and selection record

Checked 24 November 2026. ReThread is the next concrete candidate, not a claim that no similar system exists. The user rejected the earlier return-deadline, fraction-tutor and Morae-adjacent directions. Those are not the proposed submission.

## Track fit

The official [Track 1 page](https://whackiest-2026.vercel.app/#tracks) says: “Build an MCP-powered solution a regular person would actually use every day: intelligent agents that work with the apps, services and tools people already rely on. Go beyond basic integrations, with useful, reliable and controlled interactions that make everyday tasks simpler.”

ReThread addresses controlled recovery after everyday assistants edit calendars, tasks and notes. The working reference workspace implements structured recovery; the optional real adapter implements one bounded CalDAV event. It does not yet transparently protect arbitrary existing MCP servers. That integration gap matters for track fit and should be acknowledged in questions.

The unchanged official track and guideline PDFs are supplied with the deliverables. Consult them for the exact descriptions of all four tracks. The website names them Make MCP Matter, Beyond the Browser, Know Thyself and UnlockED. Detailed Track 4 directions include vocational skill verification, rural low-bandwidth adaptive learning and hyperlocal jobs.

## Closest primary sources

| Source | Already demonstrated or documented | What we may honestly claim |
|---|---|---|
| [mcp-compensator](https://github.com/mohithhhh/mcp-compensator) | MCP journaling, snapshots and LIFO inverse/compensating calls. Its limitations explicitly warn that a later writer can be overwritten. | ReThread’s supported reference cases preserve independent fields and block conflicts. We have not installed or benchmarked this competitor. |
| [Can You Undo It? Reversibility Classes for AI Agent Actions](https://arxiv.org/html/2611.22075) | Tool classifications, capture contracts, and controlled experiments with whole snapshots, guarded restore, three-way merging and conditional database updates. | Selective merging and protecting later work are prior art. ReThread packages a narrow working workflow; it does not introduce these ideas. |
| [DriftGuard](https://pypi.org/project/agents-driftguard/) | A causal state graph, dependency-aware rollback traversal, registered compensation hooks, and replanning. | Dependency-aware rollback is also prior art. ReThread’s declared dependency closure is a concrete implementation, not an unprecedented algorithm. |
| [VOID](https://www.voidagent.tech/) | Its public page describes policy, evidence and guarded recovery for supported agent tools. | Another close commercial/product direction exists. The accessible static pages did not expose enough detail for a reliable feature-by-feature exclusion claim. |
| [Taskade’s account of agent OT and undo](https://www.taskade.com/blog/ai-agents-in-multiplayer-docs-solving-the-ot-challenge) | Agent provenance, intent grouping and preservation of concurrent human work inside a collaborative document system. | Preserving human work is not a new goal. ReThread is a bounded MCP and calendar-adapter implementation across separately described workspaces. |

The plausible engineering contribution is **one inspectable recovery contract covering field ownership, declared dependencies, explicit scope and a conditional-write adapter, with reproducible evidence**. We have not established worldwide novelty or validated adoption. Its originality remains a material competitive risk; adding these components is not, by itself, proof of a winning entry.

## Why the previous accessibility direction was dropped

[Morae](https://arxiv.org/abs/2508.21456) already detects decision points, pauses automation and provides accessible interfaces for users to make choices. The proposed omission/consent checker was too close to that core contribution for the ambition requested. We do not use that idea or claim it as an invention.

## Technical foundations

[MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) specifies newline-delimited UTF-8 JSON-RPC and keeping non-protocol logs off stdout. The included server implements that dated protocol version; it is not a claim to implement every feature of the latest MCP specification.

[CalDAV, RFC 4791](https://www.rfc-editor.org/rfc/rfc4791) and HTTP conditional requests supply server-side version preconditions. ETags and If-Match are existing standards, not inventions of this project. [Radicale](https://radicale.org/v3.html) is a free/open-source calendar server. Verification used version 3.9.2 on loopback, fictional data and a new test collection.

## Actual evidence

32 automated tests passed. Separate saved live results show real MCP stdio → CalDAV HTTP → Radicale operations, preserving an independent later note, rejecting an old preview and verifying the final remote ETag. This is one supported event type, not general production reliability.

The seven-family reference comparison contains 21 deterministic method observations. ReThread meets the authored scenario expectation in seven cases, but four expectations are to defer without changing state. This does **not** mean seven successful recoveries. The methods are reference implementations, not measured competitor binaries. The fixtures are synthetic and were authored alongside the implementation.

## Competitive demonstration

1. Move a fictional interview from 10:00 to 14:00.
2. Independently add an entrance note.
3. Preview recovery: show the time field being restored and the note retained.
4. Add a conflicting time change: recovery must stop.
5. Show a later travel action that declared a read of the interview time: narrow undo must stop, and broader agent-only scope must be explicit.
6. Run the real CalDAV scripts: verify final state and a server-rejected stale If-Match.

Broader impact is a hypothesis: reducing reconstruction after agent mistakes may make daily assistance more usable. There are no measured user time savings, prevented-loss figures, pilots, customers, partnerships or revenue.
