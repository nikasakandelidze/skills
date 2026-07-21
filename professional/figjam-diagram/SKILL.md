---
name: figjam-diagram
description: Draw architecture diagrams, information/data flow diagrams, user flows, sequence diagrams, or "how does this feature work" explainers for a software project as a FigJam board, using the Figma MCP server. This is the user's default way of wanting any software diagram drawn, so use this skill whenever they ask to "draw", "diagram", "visualize", "map out", "sketch", or "show" an architecture, a flow, a process, or how a specific feature/system works — even if they never say "FigJam" or "Figma" explicitly. Applies house conventions on top of Figma's own diagram tools — horizontal (left-to-right) layout, diagrams organized into labeled sections, and short textual annotations near parts that need explaining — because the goal of every one of these diagrams is to make knowledge transfer to someone unfamiliar with the system as easy as possible, not just to produce a pretty picture.
---

# FigJam diagrams for software explanations

The user's standing preference: when they want something about a software project explained visually — architecture, information flow, a user flow, or the internals of a specific feature — draw it as a FigJam board via the Figma MCP server, not as an inline text description, ASCII art, or a Mermaid code block dumped into chat. Reach for this skill even if they just say "can you diagram how X works" with no mention of Figma.

The output is judged on one thing: **could someone with zero context follow it and come away understanding the thing?** Horizontal layout, sections, and annotations below are all in service of that, not decoration for its own sake — keep that goal in mind when a case doesn't fit the patterns exactly.

## Setup (check this first if Figma tools aren't showing up)

This skill needs the **remote Figma MCP server** connected — that's what exposes `generate_diagram`, `use_figma`, and `get_figjam`. It's a separate thing from the local Figma-desktop Dev Mode MCP server (that one's read-only design-to-code and won't have these tools).

If a diagram request triggers this skill but those tools aren't available (check the deferred-tools list, or try `ToolSearch` for "figma" first), don't just fail — walk the user through connecting it themselves. You can't complete this for them: the last step is an OAuth grant that has to happen in their own browser.

**For Claude Code**, the steps are:
1. `claude plugin install figma@claude-plugins-official`
2. Restart Claude Code
3. Run `/plugin`, arrow to "Installed", select `figma`, press Enter, then Enter again to start auth — a browser window opens
4. Click "Allow access" in the browser
5. Run `/plugin` again to confirm `figma` shows as "connected"

**For Claude Desktop / claude.ai**, tell them to add Figma under Settings → Connectors instead.

**Plan note:** creating/writing a FigJam board needs a `planKey` for a **team or organization** the user belongs to (that's a separate concept from whether they're logged into Figma at all). A purely personal Figma account with no team may not have one — if `generate_diagram` comes back asking for a plan and none exists, tell the user they'll need to be part of a Figma team/org plan to use this, not just have a personal account. If they belong to more than one, ask which to use rather than guessing.

## Before doing anything else

This skill governs *what the diagram should look like*; the Figma MCP server's own bundled skills govern *how to drive the tools*. Read the relevant one(s) before calling any Figma tool, via `get_figma_skill` (or `read_skill_uri`):

- `skill://figma/figma-generate-diagram/SKILL.md` — always read this first. It routes to a per-diagram-type reference (`references/architecture.md`, `flowchart.md`, `sequence.md`, `erd.md`, `state.md`, `gantt.md`) and to `references/workflow.md` for the annotation pass described below.
- `skill://figma/figma-use-figjam/SKILL.md` — read when you'll be hand-editing the board afterward (sections, sticky notes, labels, connectors). Its `references/` files (`create-section.md`, `create-sticky.md`, `create-label.md`, `create-connector.md`, etc.) cover the exact API calls.
- `skill://figma/figma-use/SKILL.md` — required reading before any `use_figma` call, per that tool's own instructions.

Don't skip these — they contain the actual tool mechanics (FigJam has one implicit page, no `figma.createPage()`, `get_metadata` doesn't work on FigJam boards, etc.) and this skill won't repeat them.

## The workflow

1. **Scope the diagram.** Figure out what's actually being explained — an architecture, a request/data flow, a user journey, or one feature's internals — and how much detail earns its place. When the ask is vague ("diagram the auth system"), make a reasonable call about scope from the codebase/context rather than interrogating the user; a diagram that's roughly right beats no diagram while you wait for clarification.

2. **Draft the diagram as Mermaid**, per `figma-generate-diagram`'s guidance for the matching type (flowchart for flows/features, the architecture layout for system architecture, sequence for request/response interactions, etc.). Two house conventions apply regardless of type:
   - **Horizontal flow.** Use `LR` direction so the diagram reads left-to-right — this is how most people scan a process, and it leaves room to stack annotations below/above the flow instead of squeezing them sideways. Only break this for a subgraph that's genuinely clearer top-to-bottom internally (e.g., a small internal decision tree) — the outer flow should still read LR.
   - **Sections via subgraphs.** Group related nodes into `subgraph "Section Label" ... end` blocks that correspond to real conceptual boundaries — a service, a phase of a flow, a layer of the stack — not arbitrary clusters. This is what becomes FigJam section framing. For architecture diagrams the subgraph IDs are constrained by the tool (`client|gateway|service|datastore|external|async` — see `references/architecture.md`); for everything else, group freely but give each subgraph a fill `style` so it's visually distinct against FigJam's near-white canvas, and don't bother sectioning off fewer than ~3 related nodes.

3. **Generate the base diagram** with `generate_diagram`. Pass `useArchitectureLayoutCode` (the literal string from `references/architecture.md`) only for genuine system-architecture diagrams — not for flows or feature walkthroughs. If the user belongs to more than one team/org plan, ask which `planKey` to use before calling; don't guess.

4. **Always do the annotation pass — treat it as part of the job, not an optional extra.** Because the whole point here is easing knowledge transfer for someone unfamiliar, add short textual explanations next to whichever parts of the diagram aren't self-explanatory from node labels alone: a non-obvious edge case, why a step exists, what a section is responsible for, a gotcha. Follow the hybrid pattern in `figma-generate-diagram/references/workflow.md`: reopen the generated board with `use_figma` (same `fileKey`) and add numbered label markers plus a small sticky-note legend when there are 3+ things to call out, or a single adjacent sticky when there are only 1–2. Skip this step only for a diagram so simple that the node labels already say everything worth saying — don't pad a clear diagram with filler notes.

5. **Report back** the FigJam link/`fileKey` and a one-line description of what's shown, so the user can jump straight to reviewing it.

## Judgment calls worth remembering

- Section labels and annotation text should be written for someone who has never seen this system before — avoid unexplained internal jargon or abbreviations that only make sense to the user.
- Prefer fewer, well-chosen sections and callouts over exhaustively annotating every node — density fights the legibility goal.
- If the user asks to *update* a diagram you (or they) already made in FigJam, reuse the existing `fileKey` rather than generating a fresh board, to avoid draft-file sprawl.
