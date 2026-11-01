# Merlin — product thesis

**Landscape.** The loop is commoditized: Claude Agent SDK, Managed Agents at $0.08 per session-hour, LangGraph on Temporal. The plumbing is settled: MCP for tools, AG-UI for surfaces. Isolation is solved on one laptop. What is missing is a base that runs tomorrow and rewrites by Friday.

## Scene

Tuesday, 7am, a parts distributor. Rafa, an FDE, has been on site three days. The counter staff need an agent that reads a supplier PDF, checks stock in the ERP, drafts a quote, and asks a human before it sends. Rafa installs two extensions and a view from npm, points them at the ERP, writes a quote schema in a page of code. The agent appears on the shop-floor tablet and in the owner's browser. Thursday the owner says "move the approve button, only supervisors see cost, and make it look like us." Rafa swaps the view extension and turns two hues while the agent is mid-turn. It reloads. Nobody deploys anything.

## Tension

A framework hands you parts — loop, UI kit, auth library, state store — and a month of glue. A platform hands you a rented builder: fast to start, impossible to keep. Neither is a base.

## Product

Merlin is a base for building and customizing UI-based agents. Loop, tools, state, auth, sync and a React surface ship together, with a design system built in. Domain work arrives as extensions — ordinary npm packages. No forks.

- **Hackable.** Extensions are source, swappable while the agent runs. The UI is an extension surface: every view, component and layout can be replaced, and the agent edits its own UI and reloads it mid-turn. The build is the protocol, so nothing drifts. Brand is an extension too: two hue knobs and a font choice re-skin every view, and the token layer can be replaced whole. A customer's look never needs a fork.
- **Complete.** One process runs the loop and serves the client.
- **Ownable.** No vendor in the request path. State lives on machines you run.

## Three users

**Developers** want velocity, not archaeology. They install what exists, write the extension their problem needs, publish it back. pi.dev is the model: a minimal core that grows by packages.

**Non-developers** get an agent built for their job by an FDE. It speaks their domain, sits in their browser and on their tablets, runs on their hardware. The FDE ships extensions, not a subscription.

**Ops** deploy once. One binary serves the UI, holds the keys and relays signed commits. Every device keeps a full replica, so reads are instant and writes work offline — and when a server dies, the client network restores it from an authorized copy. The stack heals itself; no operator on call. State, identity, sync and authorship are one signed layer in that binary, so running the whole stack is one install.

## Why now

The loop got cheap, so the loop is no longer the product. Extensions used to come from the vendor's own team; models write them now. FDEs became the standard channel to non-developers, with scarce supply and no base built for them.

## A research project

Merlin is a research project by the GoatDB team: an inquiry into what is possible at the frontier of distributed, collaborative agents. The question is what changes when state, identity, sync and authorship collapse into one signed layer. Everything above is the instrument, not a launch. The base has run once — one FDE, five days, a view swapped mid-task, then the machine killed underneath it.

## What we are testing

Two questions. How far conflict-free state can carry an agent: a turn that spans machines, a client that works offline, a second agent writing the same record. And what an FDE needs from a base from 2026 on — which parts to install, and which they should never have to build.

