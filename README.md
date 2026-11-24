# ReThread

**Take back an assistant’s changes. Keep your later work.**

An MCP recovery prototype for everyday calendar, task and note workflows. Built for consideration under wHACKiest 2026 Track 1, **Make MCP Matter**. This is the new candidate after the earlier concepts were rejected. It is not a claim of a new undo algorithm or guaranteed selection.

This prototype was generated with Codex during this preparation session. A four-person implementation history, independent evaluation and user testing are not claimed.

## What really works

- A self-contained browser demonstration with five examples. Open `ReThread-investigation.html` directly. Fictional records stay in that browser.
- A local web server and persistent reference workspace. Run `npm start`, open `http://127.0.0.1:8791`, and load an example. The included MCP server shares this saved workspace.
- Field-level recovery that retains independent later fields, blocks overlapping changes, checks stale previews, and computes the closure of declared later agent dependencies when the user broadens the scope. Human work is not automatically included.
- An optional **real CalDAV adapter**, verified against Radicale 3.9.2. Actual MCP stdio calls changed a calendar event, preserved an independent later note during recovery, and rejected stale ETags. The live calendar is separate from the reference workspace; cross-tool dependency recovery has not been validated against multiple external services.
- Calendar `.ics`, task `.csv` and notes `.md` exports.

No paid service, model subscription, trial, user account or API secret is required. The deterministic recovery core is exposed to an existing assistant through MCP; it does not contain a standalone language model.

## Run

Requires Node.js 22 or later. There are no Node dependencies to install.

```sh
npm test
npm run build
npm start
```

On Windows, `START_DEMO.cmd` opens the local demo. Stop its server with Ctrl+C. For the portable browser-only example, open `ReThread-investigation.html`; it does not communicate with the MCP process.

## Connect an MCP client

Use the client’s ordinary MCP setup, with a command equivalent to:

```json
{
  "mcpServers": {
    "rethread": {
      "command": "node",
      "args": ["/absolute/path/to/rethread/mcp.mjs"]
    }
  }
}
```

Replace the path with the actual extracted folder. This file does not change your client settings automatically. Review mutating calls in your client. The server does not cryptographically prove that a human reviewed a tool call.

Try: “Read the ReThread workspace. Move the interview to 14:00 in a new run, using the current revision. Show me the undo preview before applying it.” The `reads` argument records declared field dependencies; the system cannot infer every reason an assistant used a fact.

Reference tools: `read_workspace`, `edit_record`, `preview_undo`, `apply_undo`.

Optional live tools: `caldav_read`, `caldav_change`, `caldav_preview_undo`, `caldav_apply_undo`, `caldav_reconcile`. Set `RETHREAD_CALDAV_URL` to a supported event on your disposable loopback server. Default synthetic credentials are `demo:demo`; this adapter intentionally refuses non-loopback URLs. It is not configured for your personal calendar.

## Reproduce the live-calendar verification

Python 3.9+ is needed only for this optional integration. Create a virtual environment inside this checkout and install the separate free/open-source calendar server:

```sh
python -m venv .venv
# Activate the environment using your shell's normal command.
python -m pip install -r requirements-calendar.txt
python -m radicale --server-hosts 127.0.0.1:5237 --auth-type none --storage-filesystem-folder ./data/radicale --logging-level warning
```

This is an isolated, unauthenticated **local test server**. Keep the binding at `127.0.0.1` and use only fictional data. Do not use this configuration for a real or publicly reachable calendar service.

In another terminal:

```sh
node live-calendar-demo.mjs
node live-calendar-mcp-demo.mjs data/live-evidence/live-results.json
```

Each first command creates its own new test collection. It does not edit or delete an existing calendar. Results are written under `data/live-evidence/`, which is ignored by Git. The source package also includes the actual saved verification results from this session under `evidence/`.

The adapter supports one non-recurring Asia/Kolkata event at whole-minute precision, without attendees, alarms, duration or end-time fields. It captures before-state before the remote PUT, uses `If-Match`, records unknown outcomes, and supports inspection without automatically replaying the request. Recovery preserves unrelated **current** fields. An ETag and a current snapshot cannot reconstruct an unknown edit-then-change-back history; see `docs/SECURITY.md`.

## Evidence and originality

32 automated tests passed at packaging. The HTTP test checks the API-to-saved-record flow; the stdio test launches an actual MCP subprocess. Separate live scripts verify real CalDAV requests and final remote state. The browser automation tool refused the local file URL and could not reach this computer’s loopback server, so interactive visual QA is **not verified**.

`benchmark-results.json` contains 21 deterministic observations across seven hand-authored scenario families and three transparent reference strategies. These are not measurements of installed competitors. Four ReThread cases defer recovery; those are not completed recoveries. Do not present “7/7 expectations” as a real-world task success rate.

Existing work includes MCP compensation, three-way recovery and dependency-aware rollback. Our contribution is an inspectable implementation that combines these concerns with an MCP workflow, a real conditional-write calendar adapter and reproducible evidence. Its degree of originality remains a competitive risk. The research comparison in `docs/RESEARCH.md` is part of the submission argument, not proof of worldwide novelty.

## Files

- `engine.mjs`: deterministic structured-record recovery and declared dependency closure.
- `store.mjs`: persisted reference workspace, lock and stale-revision handling.
- `protocol.mjs`, `mcp.mjs`: nine MCP tools over stdio.
- `caldav.mjs`: bounded real-calendar adapter and capture journal.
- `server.mjs`: loopback web/API preview.
- `ui.mjs`, `demo-template.html`, `build.mjs`: portable and local-server UI from the same recovery core.
- `tests/`: recovery, persistence, API, stdio, exports and adapter boundaries.
- `docs/`: research, security limits, four-person build plan, pitch and submission actions.

## Submission status

This public repository contains the wHACKiest 2026 **Make MCP Matter** prototype, tests, and reproducible examples. See [submission notes](docs/SUBMISSION.md) for the entry requirements.
