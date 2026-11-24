# Security and privacy review

## What is in scope

The reference engine owns flat scalar records in an isolated local JSON workspace. Actors and dependencies are trustworthy only within that supported workflow. It never infers an inverse from arbitrary code or a natural-language explanation. The optional CalDAV adapter modifies one supported event on a disposable loopback service.

## Implemented controls

- MCP edits force the actor to `agent`; the browser API uses `human`. Tool arguments cannot substitute an actor.
- No arbitrary shell execution, URL fetching, filesystem path tool or external-account credential is exposed.
- Identifiers and scalar fields are bounded; prototype-related field names are rejected.
- Recovery is recomputed from the current state. A client cannot forge the returned preview result to overwrite the workspace.
- The reference store checks revisions, serializes cooperating local writers with an exclusive lock and writes a temporary state file before renaming it. This was tested through process reopening, not destructive power-failure testing.
- Same-field changes and known ABA histories block reference recovery. Created records containing later work are not deleted. Declared human dependencies block automatic scope expansion.
- The HTTP server binds to `127.0.0.1`, validates Host and Origin, requires a per-process token for mutations and does not enable CORS. This is a local demo, not a multi-user authenticated service.
- The real adapter refuses non-loopback destinations, weak/missing ETags, recurring events, attendees, organizers, alarms, durations, end times and unsupported timestamp precision. Capture IDs cannot contain paths.
- CalDAV writes use server-enforced If-Match. Before-state is saved before mutation. Uncertain outcomes are recorded and block a later move until inspected. Reconciliation observes state without automatically replaying a mutation.
- CSV exports quote fields and prefix formula-like strings. Calendar exports escape text and fold long UTF-8 lines. Markdown exports escape HTML.

## Important limits

This is **not universal undo**, a transparent arbitrary-server proxy, an ACID transaction across providers, or protection from a malicious local user. Capture files and journals are not cryptographically tamper-proof. A compromised MCP client can request authorized tool changes; a revision check does not prove human approval or correct intent.

The reference dependency graph contains only declared read dependencies and known writer history. Unreported reasoning dependencies cannot be recovered. The real calendar adapter is a separate integration and does not participate in a demonstrated multi-provider causal transaction.

CalDAV recovery compares supported current field values and the reviewed ETag. It preserves unrelated current fields and prevents a write racing after review. It **cannot reconstruct an unknown ABA history** where another client changes an affected field and later changes it back. An observed after-state also does not independently prove which request produced it. Do not claim otherwise.

Notifications, invitations, messages, purchases, exports already disclosed to others, and external observers cannot be erased by restoring a record. The adapter refuses event types with known scheduling side effects; the test server has no external recipients. No payment or communication tool is provided.

A file lock left by a killed process stops reference mutations. Confirm that all ReThread processes using that workspace are stopped before removing its `data/state.lock`. Do not delete arbitrary lock files or bypass a live writer. An empty/corrupt capture or state file requires manual inspection; it is not overwritten automatically.

The optional Radicale instructions deliberately use an unauthenticated local test instance with fictional data. Keep the loopback binding. This configuration is not suitable for real accounts or a shared network service.

## Publication review

The source package excludes `data/`, `.venv/`, installed Python libraries, live captures, personal calendars, `.env` files, site credentials and Git metadata. Included evidence contains only synthetic appointments and loopback URLs. `demo:demo` is an explicitly public test credential for the isolated example; it is not a user secret.

No new GitHub repository or public Site was created. No existing project was modified. No Drive upload was retried after the earlier file-upload permission denial.
