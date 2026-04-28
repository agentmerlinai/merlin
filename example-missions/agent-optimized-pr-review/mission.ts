type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

declare function agent(
  prompt: string | { system: string; user: string },
  opts?: { tools?: string[]; model?: string; provider?: string },
): Promise<unknown>;

declare function prompt(request: {
  id: string;
  props?: { [key: string]: JsonValue };
  [key: string]: JsonValue | { [key: string]: JsonValue } | undefined;
}): Promise<any>;

declare function spawn(
  description: string,
  missionCode: string,
): Promise<unknown>;

const readOnlyReviewRules = `
You are the project's maintainer reviewing a GitHub pull request.
Operate in read-only mode: do not edit files, do not post comments,
do not submit a GitHub review, and do not mutate the PR.
Do not speculate about code you have not read.
Be critical about architecture, duplication, module boundaries,
surrounding patterns, PEP 8, PEP 257, inline documentation, and tests.
If requested changes exist, verify each one was fixed and no new issue
was introduced. Keep any intermediate assessment notes terse, at most
five words per step. If an intermediate assessment artifact is requested,
end that assessment with ####. Do not include scratch notes or #### in
the final user-facing review.
`;

const prInput = await prompt({
  id: "PrReviewInput",
  props: {
    title: "Review GitHub PR",
    fields: [
      {
        name: "prUrl",
        label: "PR URL or number",
        widget: "text",
        required: true,
      },
    ],
  },
});

const prUrl = (prInput.prUrl ?? "").trim();
if (!prUrl) {
  throw new Error("PR URL or number is required.");
}

// Step 1: Read the complete PR with read-only tools.
const prContext = await agent(
  {
    system: readOnlyReviewRules,
    user: `
Start by executing exactly:
gh pr view ${JSON.stringify(prUrl)} --comments

Then read the complete pull request using the gh CLI:
- metadata, title, body, author, base/head refs
- complete diff and per-file patches
- commits
- comments, reviews, unresolved or requested changes
- related issues and linked references
- contributor-provided change description or attachment, read in full

Validate the PR description against the diff. Return a concise evidence
brief with file and line references for every material claim.
`,
  },
  {
    tools: ["bash", "glob", "grep", "read"],
    model: "gemini-flash",
    provider: "google",
  },
);

// Step 2: Research surrounding architecture before judging the diff.
const architectureContext = await agent(
  {
    system: readOnlyReviewRules,
    user: `
Use Code Research first, then grep/glob/read as needed.

Based on this PR evidence:
${prContext}

Research the surrounding codebase architecture and answer:
- Which modules own the changed responsibilities?
- What existing code should be reused or extended?
- Are there similar patterns elsewhere?
- Where would duplication or boundary violations show up?

Return only grounded findings with file:line references.
`,
  },
  {
    tools: ["ChunkHound", "glob", "grep", "read"],
    model: "gemini-flash",
    provider: "google",
  },
);

// Step 3: Split the diff into ordered review groups.
const groupingJson = await agent(
  {
    system: readOnlyReviewRules,
    user: `
Break this PR into logical review groups. Explain the grouping logic.
Groups must be ordered so dependent areas are reviewed after the code
they depend on.

PR evidence:
${prContext}

Architecture evidence:
${architectureContext}

Return strict JSON only:
{
  "groupingLogic": "short explanation",
  "groups": [
    {
      "name": "short name",
      "files": ["path"],
      "reason": "why this is one group",
      "focus": ["specific checks"]
    }
  ]
}
`,
  },
  {
    tools: ["glob", "grep", "read"],
    model: "sonnet",
    provider: "anthropic",
  },
);

const grouping = JSON.parse(String(groupingJson));
if (!Array.isArray(grouping.groups) || grouping.groups.length === 0) {
  throw new Error("Review grouping must contain at least one group.");
}

// Step 4: Research test coverage and stable testing practice for this PR.
const testCoverageReview = spawn(
  "Research test coverage and testing standards",
  `
const reviewRules = ${JSON.stringify(readOnlyReviewRules)};
const prContext = ${JSON.stringify(String(prContext))};
const architectureContext = ${JSON.stringify(String(architectureContext))};
const grouping = ${JSON.stringify(grouping)};

await agent(
  {
    system: reviewRules,
    user: \`
Research the current test coverage for this exact changeset.
Use ArguSeek to research industry best practices for testing the
external invariants, constraints, and user-facing contracts implicated
by this PR. Prefer tests that are stable across refactors and reliable
in CI.

PR evidence:
\${prContext}

Architecture evidence:
\${architectureContext}

Review groups:
\${JSON.stringify(grouping, null, 2)}

Return missing coverage, weak assertions, flaky-test risk, and concrete
test expectations with file:line references.
\`,
  },
  { tools: ["ArguSeek", "ChunkHound", "glob", "grep", "read", "bash"] },
);
`,
);

// Step 5: Review each logical group as a sequential subprocess.
const groupReviews = [];
for (const group of grouping.groups) {
  const groupReview = await spawn(
    "Review " + group.name,
    `
const reviewRules = ${JSON.stringify(readOnlyReviewRules)};
const prContext = ${JSON.stringify(String(prContext))};
const architectureContext = ${JSON.stringify(String(architectureContext))};
const groupingLogic = ${JSON.stringify(String(grouping.groupingLogic ?? ""))};
const group = ${JSON.stringify(group)};

await agent(
  {
    system: reviewRules,
    user: \`
Review this PR group only, but account for its dependencies and the
architecture evidence. Investigate files before commenting.

Grouping logic:
\${groupingLogic}

Group:
\${JSON.stringify(group, null, 2)}

PR evidence:
\${prContext}

Architecture evidence:
\${architectureContext}

Check DRY, module boundaries, surrounding patterns, duplication,
documentation, PEP 8, PEP 257, and behavioral regressions.
Return findings by severity with file:line references. If no issue is
found for this group, say that explicitly and state residual risk.
\`,
  },
  { tools: ["ChunkHound", "glob", "grep", "read", "bash"] },
);
`,
  );
  groupReviews.push(groupReview);
}

const coverageFindings = await testCoverageReview;

// Step 6: Produce the maintainer decision in the required format.
const finalReview = await agent(
  {
    system: readOnlyReviewRules,
    user: `
Synthesize the PR review. Use only evidence from the PR intake,
architecture research, sequential group reviews, and test coverage
review. Do not introduce new claims unless you read the relevant code.

PR evidence:
${prContext}

Architecture evidence:
${architectureContext}

Grouping:
${JSON.stringify(grouping, null, 2)}

Group reviews:
${JSON.stringify(groupReviews, null, 2)}

Test coverage review:
${JSON.stringify(coverageFindings, null, 2)}

Output exactly this markdown shape:
**Summary**: [One sentence verdict]
**Strengths**: [2-3 items]
**Issues**: [By severity: Critical/Major/Minor with file:line refs]
**Reusability**: [Specific refactoring opportunities]
**Decision**: [APPROVE/REQUEST CHANGES/REJECT]
`,
  },
  {
    tools: ["ChunkHound", "glob", "grep", "read"],
    model: "opus",
  },
);

// Step 7: Show the read-only review result to the Engineer.
const finalChoice = await prompt({
  id: "ResultsView",
  props: {
    title: "PR review result",
    diff: String(finalReview),
    actions: ["Done", "Save"],
  },
});

if (finalChoice.selectedAction === "Save") {
  await runWriteFile({ test: finalReview, path: "PR-Review.md" });
}
