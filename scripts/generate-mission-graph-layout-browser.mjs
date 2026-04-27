import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourcePath = join(root, "mission-graph-layout.js");
const browserPath = join(root, "mission-graph-layout.browser.js");

const source = readFileSync(sourcePath, "utf8");
const browserSource = `${source.replace(/^export /gm, "")}

if (typeof window !== "undefined") {
  window.MissionGraphLayout = {
    createMissionGraphFixture,
    buildElkGraph,
    buildMissionGraphGeometry,
    validateMissionGraphGeometry,
  };
}
`;

writeFileSync(browserPath, browserSource);
