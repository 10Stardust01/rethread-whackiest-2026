# ReThread pitch — approximately 4 minutes

Suggested delivery: one speaker explains the problem, one demonstrates the reference workflow, one shows the real-calendar evidence, and one closes with the build plan. This script is optional task output, but the event still requires its video submission.

## 0:00–0:35 · The problem

Imagine your AI assistant moves an interview from ten in the morning to two in the afternoon. It also adjusts a preparation task and a travel note. Then you add something important yourself: which entrance you need to use.

You realise the assistant misunderstood you. You want its changes undone. But you do not want your own new work erased. Restoring an old snapshot can do exactly that. Undoing only the calendar can also leave the travel plan pointing to the wrong time.

## 0:35–1:05 · The idea

ReThread helps an assistant take back supported changes while retaining the work that should survive. It records the fields an action changed and the earlier fields it declared that it used. Before recovery, it shows the scope, the fields it will restore, the work it will retain and anything that blocks it.

Our prototype exposes this through MCP, so an existing assistant can use the recovery tools. The recovery decisions themselves are deterministic; a language model does not invent the inverse action.

## 1:05–2:05 · Reference demonstration

Here the assistant moved the interview. Here is my later note. I preview undo. ReThread restores the original time and keeps the note.

Now I choose a different time myself after the assistant’s change. Recovery stops, because replacing that field would replace my later choice.

Next, another agent run uses the changed interview time to make a travel plan. ReThread shows that dependency. I can explicitly broaden the preview to include the dependent agent run, or keep everything unchanged. A later human dependency is not automatically undone.

This dependency demonstration runs in our reference workspace. We are not claiming that it already works across arbitrary third-party services.

## 2:05–2:50 · Actual service integration

We also tested a real calendar server, Radicale, using fictional appointments. An actual MCP client changed the event. An independent CalDAV writer added a note. Recovery restored the earlier time and preserved that note.

We then changed the event after its recovery preview. The old preview was rejected. The final write also uses the calendar server’s version precondition, so a concurrent edit cannot silently be replaced after the check.

We started with private calendar edits because the calendar itself can reject an update when someone has changed the event in the meantime. That gives us a clear way to check whether recovery preserved the user's work. The saved test results show what happened to the fictional event.

## 2:50–3:30 · Existing work and our contribution

Undo is not our invention. MCP compensation projects exist. Research already studies selective recovery, and other frameworks track causal rollback. We cite them directly.

Our proposed contribution is an inspectable MCP recovery workflow that checks field preservation and declared dependencies, together with a real conditional-write calendar adapter and reproducible tests. The strength of that contribution needs comparison against the closest implementations. We do not claim worldwide novelty.

## 3:30–4:05 · Feasibility and closing

Our current prototype passes 32 automated tests. The case to remember is the interview: the meeting goes back to its original time and your entrance note stays. If you changed the time yourself, the tool leaves your choice in place and explains the conflict.

For the four-person build, we divide recovery logic, external adapters, the user interface, and independent evaluation. We will focus on two well-supported tools rather than promise every application.

ReThread’s goal is simple: when an assistant makes a mistake, fixing it should not require you to reconstruct everything you did afterward.
