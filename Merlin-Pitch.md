# Merlin 🔥 — Pitch Deck

---

## The Multiplier Problem

- AI coding agents are **force multipliers**
- Give one to a talented engineer. They build wonders
- Give one to a mid-level engineer. Tech debt grows **exponentially**
- 154% larger PRs. 91% longer review times. 9% more bugs per developer [1]
- **The same tool. Radically different outcomes**

> *Speaker note: Don't blame the tool. Don't blame the engineer. The problem is structural. We gave everyone a power tool with no jig.*

---

## The Epistemic Debt Crisis

- Engineers are shipping code **they cannot explain** [2]
- AI generates plausible solutions. Developers accept them without understanding why they work
- This creates **epistemic debt** — the most dangerous kind of tech debt [2]
- You can't debug what you don't understand. You can't extend it. You can't secure it
- 35-65% of AI-generated code gets rejected in review [1] — but only when someone senior is reviewing

> *Speaker note: This is the number that should scare every CTO. The code that passes review unchallenged is worse than the code that gets caught.*

---

## Your Best Engineers Can't Scale

- Senior engineers understand **what good code looks like** [1]
- They know when to refactor vs. rewrite. When to test vs. ship. When to push back on a prompt
- But their judgment is locked inside their heads
- They review PRs one at a time. They pair-program one session at a time
- **You can't hire your way out of this. The senior talent pipeline is shrinking** [3]

> *Speaker note: 13% relative decline in early-career engineering employment [3]. The traditional apprenticeship model is breaking. Who becomes the next generation of senior engineers?*

---

## What If Expertise Was Infrastructure?

- Your best engineer solves a class of problem **once**
- They encode their approach — research patterns, execution strategy, validation criteria
- Every engineer on the team **runs that approach** with guardrails baked in
- The mission enforces the quality bar. Not a code review. Not a hope
- **Design the process once. Manufacturing runs reliably forever**

> *Speaker note: Pause. Let this land. This is the core thesis. Everything that follows is how.*

---

## Introducing Merlin 🔥

**Expertise as Code.**

- Not another coding agent. A system for **encoding how your best engineers think**
- Architects design missions. Engineers run them
- Controllable complexity --- from guided one-click runs to full agent orchestration
- **Separates design from manufacturing in software engineering**

---

## Two Personas, One Platform

### The Architect (Senior / Staff Engineer)
- Generates mission code in TypeScript
- Chooses models, tools, and validation strategies per step
- Defines where human input is needed and what kind
- Commits missions to `.merlin/missions/` — reviewed, versioned, shared

### The Engineer
- Picks a mission from the project's library
- Provides inputs when prompted
- Monitors progress from any device on the Control Room
- Gets senior-quality output **without needing senior-level judgment**

> *Speaker note: The architect decides the "how." The engineer handles the "go." This is the leverage.*

---

## Missions, Not Prompts

```ts
// Step 1: Research — cheap model, read-only tools
const research = await agent("Analyze the codebase for related patterns", {
  tools: ["glob", "grep", "read"],
  model: "haiku"
});

// Step 2: The engineer sees a plan and chooses what to approve
const plan = await agent("Propose a fix based on this research: " + research);
const approved = await prompt("ApprovalForm", {
  title: "Review the proposed plan",
  plan: plan,
  options: ["Approve", "Approve with changes", "Reject"]
});

// Step 3: Execute only what the engineer approved
await agent("Implement the approved plan: " + approved);

// Step 4: Validate — the architect knows you always validate
await bash("npm run test");
const review = await agent("Review the diff for regressions");

// Step 5: Engineer sees results, decides whether to commit
await prompt("ResultsView", {
  title: "Review changes before committing",
  diff: review,
  actions: ["Commit", "Request changes", "Discard"]
});
```

- The engineer **stays in the loop** at every critical decision point
- Custom UI forms appear on their device — desktop, tablet, or phone
- Each step gets a **fresh context window** — no context rot [4]
- A junior engineer running this **cannot skip research, review, or approval**

> *Speaker note: Read this top to bottom. Research. Plan. Ask the human. Execute. Test. Ask the human again. The architect decided where human judgment matters. The mission enforces it every time.*

---

## Guardrails Are Structural, Not Cultural

| What Goes Wrong | How Merlin Prevents It |
|----------------|----------------------|
| Engineer skips research, jumps to coding | Mission defines research step first |
| Agent runs away burning tokens in a loop | AST restrictions block loops in spawned missions |
| Engineer accepts code they don't understand | Validation step is mandatory, not optional |
| Agent accesses files it shouldn't | V8 sandbox — zero filesystem, network, env access |
| Mission fails, takes down other work | Crash isolation — each mission is independent |
| Costs spiral without visibility | Resource limits + live cost tracking on the Control Room |

- "Vibe coding" proved that speed without discipline produces debt, not software [7][8]
- **You can't vibe-code your way past architecture-enforced constraints**

---

## The Control Room

- **Responsive web UI** — desktop, tablet, phone
- Any engineer can monitor their mission's progress at a glance
- Live Sequence Map — see which step is running, which model, token spend
- **Play / Pause / Rewind** — full context inspection of every decision
- Visual indicators for **which sessions need human attention**
- Seamless handoff between engineers across devices and time zones

> *Speaker note: The engineer doesn't need to understand the mission internals. They need to know: is it working, does it need me, and what did it produce.*

---

## Complexity That Fits the Person

**Level 1 — Guided Engineer**

- Select mission, provide input, wait for result
- Like running a CI pipeline. No AI knowledge required

**Level 2 — Informed Engineer**

- Monitor execution, make decisions at branch points
- Override model selection per step when needed

**Level 3 — Architect**

- Write new missions from scratch in TypeScript
- Compose agent calls, tool selections, validation strategies
- Merlin can bootstrap new missions using its built-in Solo mode

> *Speaker note: Most of your team lives at Level 1-2. Your top engineers work at Level 3. Everyone produces Level 3 quality output.*

---

## Multi-Model by Design

- Pick the **right model for each step** — not the most expensive one
- Haiku for research. Opus for architecture. Local models for iteration
- Heavy API usage runs $3-8/hour per developer; Opus 5-10x more [5]
- **Convene a Round Table — 3 providers, majority vote** for critical decisions
- The architect makes these choices once. Engineers inherit them

> *Speaker note: This is cost optimization and quality optimization in one decision. Your senior engineer already knows which model fits which task. Now that knowledge is encoded.*

---

## The Architecture

```
┌───────────────────────────────────────────────┐
│  Orchestrator (main thread)                   │
│                                               │
│    Tool Catalog          Agent Providers      │
│  (bash, read, MCP)    (Claude, GPT, Ollama)   │
│                                               │
│  GoatDB: State, audit trail, ratings          │
│                                               │
│       ┌───────────┐  ┌───────────┐            │
│       │ Mission  │  │ Mission  │  Sandboxed │
│       │ Isolate 1 │  │ Isolate 2 │  V8        │
│       │           │  │           │  Workers   │
│       │ No fs     │  │ No fs     │            │
│       │ No net    │  │ No net    │            │
│       │ No env    │  │ No env    │            │
│       └───────────┘  └───────────┘            │
└───────────────────────────────────────────────┘
```

- Missions run in **Deno Workers with `permissions: "none"`**
- All capability is mediated by the orchestrator through message passing
- Missions are TypeScript — compiled by Deno's built-in SWC, no filesystem write needed

> *Speaker note: For the architects in the room — this is real isolation. Not container isolation. V8 isolate isolation. The mission code literally cannot access anything the orchestrator doesn't explicitly provide.*

---

## Knowledge Compounds

- Every run is **audited** — inputs, outputs, agent calls, tool calls, costs
- Engineers rate missions after completion
- Teams see which missions produce the best results and where they fail
- Missions live in `.merlin/missions` — **code-reviewed like any other code**
- Merlin can generate new missions using Solo mode
- Work surfaces that learn and accumulate knowledge make each successive project easier [9]

> *Speaker note: This is the flywheel. Your best engineers' judgment improves every mission. Every mission improves every engineer's output. The organization gets smarter, not just faster.*

---

## Why Now

- AI agents reached capability. **Orchestration didn't keep up** [6]
- The skill gap isn't closing — it's widening. 13% fewer entry-level engineers entering the field [3]
- "Vibe coding" proved that speed without discipline produces debt, not software [7][8]
- 84% of developers use AI tools, but trust dropped to just 29% [10]
- Every team has 2-3 engineers who know how things should be done. **Their process is the bottleneck**
- MCP standardized tool integration. Merlin leverages it natively [6]

---

## The Landscape

|  | Single-Agent Tools | Merlin |
|--|-------------------|-------|
| Who benefits | Already-skilled engineers | The whole team |
| Quality control | Trust the developer | Enforce via mission |
| Knowledge transfer | Docs and reviews | Executable missions |
| Complexity scaling | One size fits all | Levels 1-2-3 per persona |
| Context management | Window-limited | Fresh context per step |
| Cost control | Hope and rate limits [5] | Per-step model selection + budgets |
| Security model | Trust-based | V8 sandbox-enforced |
| Auditability | Logs | Full execution graph + replay |

---

## What We're Building Toward

- **Cluster mode** — distribute missions across machines and teams
- **Mission sharing** — proven missions discoverable across the organization
- **GoatDB-powered** real-time state sync and collaboration
- **Continuous mission improvement** driven by audit data and engineer ratings
- The vision: **every engineer ships at the level of your best engineer**

> *Speaker note: Merlin isn't a better agent. It's how your best engineers' judgment becomes infrastructure that everyone runs on.*

---

## One More Thing

> *"AI agents don't have a quality problem. Organizations have a distribution-of-expertise problem."*

**Merlin turns your best engineers' judgment into missions everyone can run.**
**Design once. Run safely. Scale expertise.** 🔥

---

## Sources

1. AgileEngine, "Evidence-Based Guide to AI-Assisted Software Development in Production" (2025) --- 154% increase in PR size, 91% increase in review time, 9% rise in bugs per developer, 35-65% AI code rejection rates. https://agileengine.com/evidence-based-guide-to-ai-assisted-software-development-in-production
2. FailingFast.io, "Epistemic Debt: The Hidden Cost of AI Speed" (2025) --- coined "epistemic debt" for shipping code developers cannot explain. https://failingfast.io/ai-epistemic-debt
3. Sundeep Teki, "Impact of AI on the 2025 Software Engineering Job Market" --- 13% relative decline in early-career engineer employment (ages 22-25) in AI-exposed roles. https://www.sundeepteki.org/advice/impact-of-ai-on-the-2025-software-engineering-job-market
4. Ars Technica, "10 Things I Learned from Burning Myself Out with AI Coding Agents" (2026) --- context rot from compacted windows, agents forgetting lessons mid-session, the "90% problem." https://arstechnica.com/information-technology/2026/01/10-things-i-learned-from-burning-myself-out-with-ai-coding-agents
5. MorphLLM, "We Tested 15 AI Coding Agents. Only 3 Changed How We Ship" (2026) --- API costs of $3-8/hour for Sonnet, 5-10x more for Opus; unpredictable credit-based billing; rate limit challenges for multi-agent systems. https://morphllm.com/ai-coding-agent
6. BlackGirlBytes, "My Predictions for MCP and AI-Assisted Coding in 2026" --- MCP/ACP standardization progress, agent infrastructure gaps, complexity burden of context engineering. https://dev.to/blackgirlbytes/my-predictions-for-mcp-and-ai-assisted-coding-in-2026-16bm
7. Murli Sivashanmugam, "The Convenience Paradox of Vibe Coding" (2026) --- unreviewed AI output leading to tech debt and regressions; advocates spec-first and system-in-the-loop approaches. https://www.linkedin.com/posts/smurli_aicoding-vibecoding-softwarearchitecture-activity-7431544598835023832
8. Mark Shust, "Stoplight Engineering" (2025) --- proposes red/yellow/green framework for AI code acceptance; argues unconstrained AI code generation produces subpar results. https://www.linkedin.com/posts/markshust_every-developer-i-know-is-vibe-coding-with-activity-7348683230708977665-7f6a
9. Nathan Hanna, "Compound Engineering: What If Every Project Made the Next One Easier?" (2026) --- work surfaces that learn and accumulate knowledge over time through workflows and codified patterns. https://nothans.com/compound-engineering-what-if-every-project-made-the-next-one-easier
10. Stack Overflow, "Mind the Gap: Closing the AI Trust Gap for Developers" (2026) --- 84% developer AI adoption but only 29% trust; competence-confidence gap in evaluating AI output. https://stackoverflow.blog/2026/02/18/closing-the-developer-ai-trust-gap
