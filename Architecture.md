Merlin 🔥 — Expertise as Code.

Merlin is designed to:
- Enable long stretches of agentic coding missions
- Place guardrails on the Engineer so they can truly forget the tool while it's working and have it actively communicate with the Engineer when Engineer input is needed
- Get the utility of a cli agent with the mobility and continence of responsive web UI so you can run it in a dev container for example and control it from your phone
- Seamless handoff between devices and Engineers
- Efficiently orchestrate multiple missions across different machines
- Audit Engineer input, agent input and the final outputs to enable mission improvement
- Build multi-provider missions for greater reliability. For example, review using 3 different providers and take the majority's vote (Round Table mode)
- Cost optimization by choosing the most suitable model per step
- Separate Architect work from run execution by splitting mission creation and editing from running the actual missions
- Make it easier and safer for less experienced Engineers to produce high quality results by using pre-defined missions
- Merlin can build its own missions by bootstrapping from the builtin Solo mode
- Make it easy for the LLM to generate sub-missions safely and token efficiently (`spawn()`) with minimal hallucinations while enabling exact concurrency control for task dependencies
- Avoid lost in the middle context rot due to explicit context passing between agent calls, with each call either continuing the current context or starting a new one intentionally

**NOTE:** GoatDB is being co-developed to support Merlin's needs
## High Level Modules
### Agent Provider - Extension Point
- Provider configuration
- Available models
- Builtin tools
- Supported inputs
- Required attention curve data for each model exposed by the provider. This data is authoritative for the Control Room attention guide and is resolved per provider and per exact model
- Attention curve data must describe the provider's exact model behaviour across the full context window. Different models may be U-shaped, J-shaped or use another provider-defined profile

## Tool Catalog
- Abstracts tool implementation details
- Central registry for available tools
- Builtin tools:
	- `spawn(code)` - execute dynamic sub-mission in a new sandboxed isolate
		- **IMPORTANT:** `spawn` is not available within its own context. Only one level nesting is allowed. Limits max concurrently running sub-missions.
- MCP host
- Exposes predefined kits in addition to individual tools. These are sets of tools that can be easily referenced from missions and be shared across users
### MCP Host
- Lives within the tool catalogue
- Adapter for MCP tools
- Responsible for connecting external tools via MCP
- Manages MCP servers configuration under `.merlin/mcp.json` and project level `mcp.json`

## Mission Orchestrator
- Executes a specific mission
- Receives mission as **TS code** orchestrates the full execution
- Validated code compiles cleanly without limiting errors
- Generates (and caches) structured mission description for UI visualisation from the mission code (using LLM)
- Manages mission state in GoatDB so other modules can observe
- Asks the Engineer to rate the mission at the end for future knowledge building so missions can be audited and continuously improved

## Mission API
- `async agent(prompt:string | {user:string, system:string}, opts = {tools: Kit, model: string}): Promise<AgentResult>`
	- Dynamically generated jsdoc comment lists all available models and tool names
	- Tools and model are optional. Inherit from current context what's not specified. Uses defaults if at root level
	- Limits max number of concurrently running agents
	- Context passing is explicit between agent calls
	- Each call can either continue the current context or start a new context intentionally. This context lineage is runtime state and must be visible to the Control Room
- `async run<ToolName>(toolInput:json): Promise<ToolOutput>`
	- Merlin dynamically injects `run<tool name>` functions at runtime based on the available tools with JSDoc comments for usage instructions
- `async spawn(missionCode:string): Promise<MissionResult>`
- `async prompt(reactComponent): Promise<UserInput>`

### Mission Sandbox
Each mission execution is isolated in its own V8 isolate via Deno Workers with capability-based security. The isolate has zero direct access to the host — all interaction is mediated by the orchestrator through message passing.

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator (main thread)                                 │
│                                                             │
│  ┌─ Tool Catalog ──────────────────────────────────────┐    │
│  │  bash, read, write, glob, grep, MCP tools           │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─ Agent Providers ───────────────────────────────────┐    │
│  │  Anthropic, OpenAI, Ollama, ...                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─ GoatDB ────────────────────────────────────────────┐    │
│  │  Session state, tool calls, token usage             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│         postMessage          postMessage                    │
│          (result)             (result)                      │
│            ▲  │                 ▲  │                        │
│            │  ▼                 │  ▼                        │
│  ┌──────────────────┐ ┌──────────────────┐                  │
│  │ permissions:none │ │ permissions:none │  mission run    │
│  │                  │ │                  │                  │
│  │ globals:         │ │ globals:         │                  │
│  │  agent()         │ │  agent()         │  ← message-      │
│  │  prompt()        │ │  prompt()        │    passing stubs │
│  │  spawn()         │ │  spawn()         │                  │
│  │                  │ │                  │                  │
│  │ ✗ no fs          │ │ ✗ no fs          │  ← zero          │
│  │ ✗ no net         │ │ ✗ no net         │    capabilities  │
│  │ ✗ no env         │ │ ✗ no env         │                  │
│  │ ✗ no subprocess  │ │ ✗ no subprocess  │                  │
│  └──────────────────┘ └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

- Isolation model: Each mission runs in a Deno `Worker` with `deno: { permissions: "none" }` — a dedicated V8 isolate with zero filesystem, network, env, subprocess, or FFI access
- TypeScript compilation: Deno's built-in SWC type-stripping handles TS→JS automatically. Mission code is loaded via `Blob` + `URL.createObjectURL()` — no filesystem write needed
- Capability injection: The worker's global scope contains only the Mission API functions (`agent`, `run<ToolName>`, `spawn`, `prompt`). These are thin message-passing stubs that `postMessage` to the orchestrator and `await` the response
- Security boundary: The orchestrator (main thread) mediates every capability request — validates method, enforces concurrency limits, routes tool calls through the Tool Catalog, tracks tokens/cost, updates GoatDB state
- Import blocking: `permissions: "none"` denies both remote and local `import` — only code in the Blob is available. V8 builtins (`Map`, `Set`, `Promise`, `JSON`, `Math`, `Array`, `String`, `RegExp`) are the only standard library available. No DOM, no IO
- Resource limits: Configurable per-mission heap memory limit via V8 isolate options. `worker.terminate()` on timeout. Orchestrator enforces max concurrent agents and max concurrent sub-missions
- `spawn` nesting: Child mission spawns its own isolate. Orchestrator enforces 1-level nesting limit. Child inherits parent's concurrency budget (does not get additional slots)
- Crash isolation: `worker.onerror` catches unhandled exceptions. Orchestrator terminates the isolate, records error in GoatDB session, notifies the Engineer. Parent mission is unaffected

- Defense in depth layering:
	- Layer 1 (security): V8 isolate with `permissions: "none"` — prevents escape
	- Layer 2 (agent guardrail): AST restrictions — prevents token/cost runaway
	- Layer 3 (resource limits): Heap cap + timeout — prevents resource exhaustion
- Restricted mode for `spawn()` (not applied to persistent missions):
	- Disallows `for` and `while` loops as well as function definitions
	- No `eval`, `Function` constructor or equivalents
	- The AST is parsed to enforce these constraints. The purpose of these constraints is to guardrail the system from unintended loops that burn through a lot of time and money. It's NOT a security mechanism but an AI agent guardrail
- Execution ends when all running agents and tools terminate

Concurrent agents example:
```ts
agent(prompt);
agent(prompt2);
```

Serial agents example:
```ts
await agent('fix bug');
if (!(await run('bash', { cmd: 'npm run test' })).success) {
  await agent('find and explain test failure root cause based on tests.log');
}
```

Complex example:
```ts
await Promise.all([agent(prompt), agent(prompt2)]);
await run('bash', { cmd: 'uv run pytest' });
await agent(prompt3); // await here is optional
```
## Mission Code Analysis
- The analysis's main purpose is observability - efficient visualization for the Engineer
- Parse typescript AST
- Extract Mission API calls and related metadata
- Analyze concurrency - what's sequential and what's concurrent
- Build a graph describing the parsed mission's execution where branches are concurrent execution
- Feed the graph to an LLM as json and prompt it to label all nodes
- Extract interactivity rating based on input throughout the mission
- Extract precision based on # of sequential agent calls

## Mission Step
- Optional provider + model, uses default if unspecified
- Optional tools. Uses default kit if unspecified
- TS code to execute
	- The sandbox enforces structurally that only Mission API functions and V8 builtins are available — imports are blocked, no DOM or IO exposed
	- Code must pass clean js transpilation
	- Comply with other constraints defined above
- Can either continue an existing context or start a new one
- Context lineage is explicit runtime state. Multiple agent calls may build on the same context and conversation history, or intentionally fork into a new context
- The resolved provider + model for the step determines which required attention curve is used by the Control Room attention guide

## Project
- Directory / git worktrees
- Mission Orchestrator
- Default provider + model
- Default kit

## Host
- A machine (IP + port)
- Projects list
- Agent providers
- MCP host
- GoatDB root

## Cluster
- Multiple hosts
- GoatDB cluster
- User management

## Control Room
- Responsive web UI: desktop, tablet and mobile. Exposed by a project. Multiple projects are simply browser tabs
- Customizable themes: colors and typography
	- Auto toggle light/dark themes
	- Design token based
	- Pure CSS
- At a glance view of open hosts / projects with efficient navigation and visualization of which ones need Engineer attention
- Mission visualization:
	- Name
	- Interactivity and accuracy ratings
	- Steps
	- Current step and resolved provider + model used (with ability to override the model per step from the Control Room for the specific run)
	- Current state
	- Play/Pause/Rewind
	- Full context inspection including tool call inputs and outputs
	- Live context meter showing token composition for the active context
	- Attention guide driven by required provider/model attention curve data so the Engineer can see where each station lands in the active context window
	- Context lineage across steps, including when multiple agent calls continue the same context and when a step starts a new one
	- Sequence Map visualization generated by parsing the mission AST and adding LLM labeling. Results are cached to save tokens
	- Different visual weights (sizes, etc) for missions > Engineer inputs > agents > tools
- Visual orientation at a glance: host, project, branch, running mission, which ones need Engineer attention
- Mission controlled customizable input area as a dynamically loaded react component
- Outputs area as a focused view for what the Engineer should pay attention to: files created/modified, high value messages/insights, warnings, etc. Each item in the outputs list links directly to the specific point in the context that it relates to
- Shows the Sequence Map like a "metro map" or execution map, and live updates the display as execution progresses. Actual execution graph may diverge from the static analysis so the map is always updated dynamically at runtime to reflect the actual run

## Builtin Mission: Solo (most basic)
- Single step
- Pops single prompt input at the beginning and when finishing every loop as long as context wasn't exhausted
- Functions the same as any other coding agent out there today

## Builtin Mission: Commando
Visualization graph:
1. Research
2. Plan: Validation. **Parent:** Research
3. Plan: Execution. **Parent:** Research
4. Dynamic execution mission graph. **Parent:** Plan: Execution
5. Child node of Plan: Validation > Validate. **Parent:** Plan: Validation

### Research
- Inputs: plaintext prompt
- Tools: ChunkHound, ArguSeek, grep, glob, list dir, read file, bash
- Output:
	1. single Md file with configurable token limit
	2. The original user prompt
### Plan: Validation
- Inputs:
	1. original user prompt
	2. Research Md file
- Tools: ChunkHound, ArguSeek, grep, glob, list dir, read file, bash
- Research with ArguSeek validation approaches for the specific problem
- Suggest validation approaches to user through multi-select + free prompt view
### Plan: Execution
- Inputs:
	1. original user prompt
	2. Research Md file
	3. Validation approaches
- Tools: ChunkHound, ArguSeek, grep, glob, list dir, read file, bash
- Writes mission code for the actual execution then calls `spawn(code)`

### Validate
- Inputs:
	1. original user prompt
	2. Research Md file
	3. Validation approaches
- Tools: ChunkHound, ArguSeek, grep, glob, list dir, read file, bash
- Runs validation using available tools

## Input Views
- Runtime registry maps name > react component so missions are pure ts not tsx
- Builtin Input Views
	- Plain text prompt
	- Multi select from a list of markdown texts (for nice presentation to the user) + plaintext prompt
	- Prompt template - placeholder text with inline placeholders that must be filled before submitting

## Mission Management
- `.merlin/missions/` at project and host levels
- `.merlin/db/` stores GoatDB db files. Only at project level
- Mission is a directory with the following files:
	- `mission.ts` - required
	- `mission.json` - optional, auto derived from `mission.ts` if not provided
	- `inputs.tsx` - optional custom input components registration
	- Additional files and assets

## Kit Management
- `.merlin/kits` at project and user level
- Kit is a directory with the following files:
	- `mcp.json` - mcp config to use
	- `setup.ts` - optional setup script. MUST be idempotent and perform upgrades as needed.
	- Additional files and assets
- Merlin runs the setup script when needed and configures mcp host

## Data Modelling
### Mission Template
- Stored missions on disk as per **Mission Management**
- No way to edit templates from the Control Room. Instead use missions and tools to edit the files directly
- Live reload when disk change detected

### Project
- GoatDB repo sharded by time
- Item in cluster registry

### Cluster Registry
- GoatDB repo sharded by key
- Host items with config
- Project items with project config

### Run
- An instance of a Mission Template for execution
- Stored in project repo
- GoatDB item
- Stores a copy of the code being executed inline
- Inputs, Outputs, Agent, Tool and `spawn()` calls, all are nested items within the run
