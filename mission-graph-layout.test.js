import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import ELK from "elkjs/lib/elk.bundled.js";
import * as layoutModule from "./mission-graph-layout.js";

const {
    buildElkGraph,
    buildMissionGraphGeometry,
    createMissionGraphFixture,
    validateMissionGraphGeometry,
} = layoutModule;

const __dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(__dir, "mission-graph-layout.js");
const browserPath = join(__dir, "mission-graph-layout.browser.js");

function measureTextWidth(label, className = "node-label") {
    const scale = {
        "chip-text": 4.5,
        "sub-chip-text": 4,
        "terminal-label": 7,
        "node-label": 7,
    };
    return label.length * (scale[className] ?? 7);
}

function deepClone(value) {
    return structuredClone(value);
}

async function buildGeometry({
    fixtureOptions = {},
    elkResultMutator = null,
    measureTextWidthOverride = measureTextWidth,
} = {}) {
    const fixture = createMissionGraphFixture({
        measureTextWidth: measureTextWidthOverride,
        ...fixtureOptions,
    });
    const elk = new ELK();
    const elkResult = await elk.layout(buildElkGraph(fixture));
    if (elkResultMutator) {
        elkResultMutator(elkResult, fixture);
    }
    const geometry = buildMissionGraphGeometry(fixture, elkResult);
    return { fixture, elkResult, geometry };
}

function onGrid(value, unit) {
    return Math.abs(value / unit - Math.round(value / unit)) < 1e-3;
}

function snapUp(value, unit) {
    return Math.ceil(value / unit) * unit;
}

function snapDown(value, unit) {
    return Math.floor(value / unit) * unit;
}

function snapToNearest(value, unit) {
    return Math.round(value / unit) * unit;
}

function projectedTrackPoint(anchor, clearance, fixture) {
    if (anchor.side === "WEST") {
        return {
            x: snapDown(anchor.x - clearance, fixture.trackGrid),
            y: snapToNearest(anchor.y, fixture.trackGrid),
        };
    }
    if (anchor.side === "EAST") {
        return {
            x: snapUp(anchor.x + clearance, fixture.trackGrid),
            y: snapToNearest(anchor.y, fixture.trackGrid),
        };
    }
    if (anchor.side === "NORTH") {
        return {
            x: snapToNearest(anchor.x, fixture.trackGrid),
            y: snapDown(anchor.y - clearance, fixture.trackGrid),
        };
    }
    return {
        x: snapToNearest(anchor.x, fixture.trackGrid),
        y: snapUp(anchor.y + clearance, fixture.trackGrid),
    };
}

function parseViewBox(viewBox) {
    const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
    return {
        left: minX,
        top: minY,
        right: minX + width,
        bottom: minY + height,
    };
}

function boxOf(box) {
    return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
    };
}

function boxWithinBounds(box, bounds) {
    return (
        box.left >= bounds.left - 1e-3 &&
        box.right <= bounds.right + 1e-3 &&
        box.top >= bounds.top - 1e-3 &&
        box.bottom <= bounds.bottom + 1e-3
    );
}

function nodesInMission(fixture, missionId) {
    return fixture.nodes.filter((node) => node.missionId === missionId);
}

function childContainers(fixture, missionId) {
    return fixture.containers.filter((container) => (container.layoutParentMissionId ?? container.parentMissionId) === missionId);
}

function descendantNodeIds(fixture, missionId) {
    const ids = new Set(nodesInMission(fixture, missionId).map((node) => node.id));
    for (const container of childContainers(fixture, missionId)) {
        for (const id of descendantNodeIds(fixture, container.id)) {
            ids.add(id);
        }
    }
    return ids;
}

function containerIdsForMission(fixture, missionId) {
    const ids = new Set();
    for (const container of childContainers(fixture, missionId)) {
        ids.add(container.id);
        for (const id of containerIdsForMission(fixture, container.id)) {
            ids.add(id);
        }
    }
    return ids;
}

function missionItemBoxes(fixture, geometry, missionId) {
    return [
        ...nodesInMission(fixture, missionId).map((node) => geometry.nodes[node.id]),
        ...childContainers(fixture, missionId).map((container) => geometry.containers[container.id]),
    ];
}

function containerContentBounds(container, fixture) {
    const padding = 2 * fixture.minArrowLength;
    return {
        left: container.left + padding,
        right: container.right - padding,
        top: container.top + container.headerHeight + padding,
        bottom: container.bottom - padding,
    };
}

function boundsOf(boxes) {
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

function boxesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function segmentsOf(points) {
    return points.slice(1).map((point, index) => ({
        start: points[index],
        end: point,
        axis: points[index].x === point.x ? "V" : "H",
    }));
}

function routesOverlap(left, right) {
    return segmentsOf(left.points).some((leftSegment) =>
        segmentsOf(right.points).some((rightSegment) => {
            if (leftSegment.axis !== rightSegment.axis) return false;
            if (leftSegment.axis === "H") {
                if (leftSegment.start.y !== rightSegment.start.y) return false;
                return intervalOverlapLength(
                    leftSegment.start.x,
                    leftSegment.end.x,
                    rightSegment.start.x,
                    rightSegment.end.x,
                ) > 0;
            }
            if (leftSegment.start.x !== rightSegment.start.x) return false;
            return intervalOverlapLength(
                leftSegment.start.y,
                leftSegment.end.y,
                rightSegment.start.y,
                rightSegment.end.y,
            ) > 0;
        }),
    );
}

function intervalOverlapLength(leftStart, leftEnd, rightStart, rightEnd) {
    const leftMin = Math.min(leftStart, leftEnd);
    const leftMax = Math.max(leftStart, leftEnd);
    const rightMin = Math.min(rightStart, rightEnd);
    const rightMax = Math.max(rightStart, rightEnd);
    return Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin);
}

function segmentHitsBox(start, end, box) {
    if (start.x === end.x) {
        const x = start.x;
        if (x <= box.left || x >= box.right) return false;
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);
        return bottom > box.top && top < box.bottom;
    }
    if (start.y === end.y) {
        const y = start.y;
        if (y <= box.top || y >= box.bottom) return false;
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        return right > box.left && left < box.right;
    }
    return true;
}

function pathHitsBox(points, box) {
    return segmentsOf(points).some((segment) => segmentHitsBox(segment.start, segment.end, box));
}

function routePathDefect(points) {
    for (let index = 2; index < points.length; index += 1) {
        const a = points[index - 2];
        const b = points[index - 1];
        const c = points[index];
        const sameAxis = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
        if (!sameAxis) continue;
        const firstDirection = a.x === b.x ? Math.sign(b.y - a.y) : Math.sign(b.x - a.x);
        const nextDirection = b.x === c.x ? Math.sign(c.y - b.y) : Math.sign(c.x - b.x);
        return firstDirection === nextDirection ? "redundant collinear point" : "backtracks";
    }
    return null;
}

function assertNoOverlaps(nodes, message) {
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
            assert.equal(
                boxesOverlap(boxOf(nodes[leftIndex]), boxOf(nodes[rightIndex])),
                false,
                `${message}: ${nodes[leftIndex].id} overlaps ${nodes[rightIndex].id}`,
            );
        }
    }
}

function routeSnapshot(route) {
    return {
        id: route.id,
        renderType: route.renderType,
        markerId: route.markerId,
        points: route.points,
        d: route.d,
    };
}

function geometrySnapshot(geometry) {
    return {
        viewBox: geometry.viewBox,
        container: {
            x: geometry.container.x,
            y: geometry.container.y,
            width: geometry.container.width,
            height: geometry.container.height,
        },
        containers: Object.fromEntries(
            Object.entries(geometry.containers ?? {}).map(([id, container]) => [
                id,
                { x: container.x, y: container.y, width: container.width, height: container.height },
            ]),
        ),
        nodes: Object.fromEntries(
            Object.entries(geometry.nodes).map(([id, node]) => [
                id,
                { x: node.x, y: node.y, width: node.width, height: node.height },
            ]),
        ),
        ports: geometry.portAnchors,
        routes: geometry.routes.map(routeSnapshot),
        edgeLabels: geometry.edgeLabels.map((label) => ({
            id: label.id,
            x: label.x,
            y: label.y,
            text: label.text,
            textAnchor: label.textAnchor,
        })),
    };
}

function deriveBrowserBundle(source) {
    return `${source.replace(/^export /gm, "")}

if (typeof window !== "undefined") {
  window.MissionGraphLayout = {
    createMissionGraphFixture,
    buildElkGraph,
    buildMissionGraphGeometry,
    validateMissionGraphGeometry,
  };
}
`;
}

function loadBrowserBundleApi() {
    const window = {};
    runInNewContext(readFileSync(browserPath, "utf8"), { window });
    return window.MissionGraphLayout;
}

function findElkNode(node, id) {
    if (node.id === id) return node;
    for (const child of node.children || []) {
        const match = findElkNode(child, id);
        if (match) return match;
    }
    return null;
}

describe("mission graph geometry", () => {
    it("models three hydrated recursive levels with stable mission paths", () => {
        const fixture = createMissionGraphFixture({ measureTextWidth });

        assert.deepEqual(
            fixture.missions.map((mission) => ({
                id: mission.id,
                path: mission.path,
                depth: mission.depth,
                parentMissionId: mission.parentMissionId,
                layoutParentMissionId: mission.layoutParentMissionId,
            })),
            [
                { id: "root", path: "root", depth: 0, parentMissionId: null, layoutParentMissionId: undefined },
                {
                    id: "dependencyAudit",
                    path: "dependencyAudit",
                    depth: 1,
                    parentMissionId: "root",
                    layoutParentMissionId: "root",
                },
                {
                    id: "researchDeepDive",
                    path: "dependencyAudit/researchDeepDive",
                    depth: 2,
                    parentMissionId: "dependencyAudit",
                    layoutParentMissionId: "root",
                },
            ],
        );
        assert.deepEqual(
            fixture.containers.map((container) => container.id),
            ["dependencyAudit", "researchDeepDive"],
        );
        assert.deepEqual(
            nodesInMission(fixture, "researchDeepDive").map((node) => node.id),
            ["deepStart", "collectSignals", "evidence?", "deepEnd"],
        );
    });

    it("keeps root as the only mission without container chrome", () => {
        const fixture = createMissionGraphFixture({ measureTextWidth });
        const containerIds = new Set(fixture.containers.map((container) => container.id));

        assert.equal(containerIds.has("root"), false);
        assert.equal(fixture.container.id, "dependencyAudit");
        assert.deepEqual(
            fixture.missions
                .filter((mission) => mission.id !== "root")
                .map((mission) => mission.id),
            fixture.containers.map((container) => container.id),
        );
        for (const container of fixture.containers) {
            assert.equal(container.kind, "container");
            assert.equal(container.headerHeight, fixture.G);
            assert.equal(container.inputPort, `${container.id}.n.spawn`);
            assert.ok(container.path);
        }
    });

    it("builds ELK children from rendered layout parents while preserving mission contents", () => {
        const fixture = createMissionGraphFixture({ measureTextWidth });
        const elkGraph = buildElkGraph(fixture);

        const rootContainer = findElkNode(elkGraph, "dependencyAudit");
        const nestedContainer = findElkNode(elkGraph, "researchDeepDive");
        assert.ok(rootContainer);
        assert.ok(nestedContainer);

        assert.deepEqual(
            rootContainer.children.map((child) => child.id),
            ["childStart", "fork", "research", "researchDeepDiveSpawn", "synthesize", "join", "childEnd"],
        );
        assert.deepEqual(
            nestedContainer.children.map((child) => child.id),
            ["deepStart", "collectSignals", "evidence?", "deepEnd"],
        );
        assert.equal(rootContainer.children.includes(nestedContainer), false);
        assert.equal(elkGraph.children.includes(nestedContainer), true);
    });

    it("produces validation-clean geometry from live ELK output", async () => {
        const { geometry } = await buildGeometry();
        assert.equal(geometry.ok, true);
        assert.deepEqual(geometry.validationFailures, []);
    });

    it("returns geometry for every non-root container including nested sub-missions", async () => {
        const { fixture, geometry } = await buildGeometry();
        assert.equal("root" in geometry.containers, false);
        assert.deepEqual(
            Object.keys(geometry.containers).sort(),
            fixture.containers.map((container) => container.id).sort(),
        );
        assert.notEqual(geometry.containers.dependencyAudit, geometry.containers.researchDeepDive);
        assert.equal(geometry.container, geometry.containers[fixture.container.id]);
        for (const id of containerIdsForMission(fixture, "root")) {
            assert.ok(geometry.containers[id], id);
        }
    });

    it("keeps all rendered geometry inside the computed viewBox", async () => {
        const { geometry } = await buildGeometry();
        const viewBounds = parseViewBox(geometry.viewBox);
        const boxes = [
            ...Object.values(geometry.containers),
            ...Object.values(geometry.nodes),
            ...geometry.annotations.map((annotation) => annotation.box),
            ...geometry.edgeLabels.map((label) => label.box),
        ];
        for (const box of boxes) {
            assert.ok(boxWithinBounds(box, viewBounds), JSON.stringify(box));
        }
        for (const route of geometry.routes) {
            for (const point of [route.startAnchor, ...route.points, route.endAnchor]) {
                assert.ok(
                    point.x >= viewBounds.left - 1e-3 &&
                        point.x <= viewBounds.right + 1e-3 &&
                        point.y >= viewBounds.top - 1e-3 &&
                        point.y <= viewBounds.bottom + 1e-3,
                    `${route.id} ${point.x},${point.y}`,
                );
            }
        }
    });

    it("keeps dynamic container geometry snapped and children below each header", async () => {
        const { fixture, geometry } = await buildGeometry();
        for (const containerFixture of fixture.containers) {
            const container = geometry.containers[containerFixture.id];
            const contentBounds = containerContentBounds(container, fixture);

            assert.ok(onGrid(container.width, fixture.columnGrid), `${container.id}.width`);
            assert.ok(onGrid(container.height, fixture.trackGrid), `${container.id}.height`);
            for (const node of nodesInMission(fixture, container.id)) {
                const child = geometry.nodes[node.id];
                assert.ok(boxWithinBounds(child, contentBounds), `${container.id}/${node.id}`);
            }
            for (const nested of childContainers(fixture, container.id)) {
                assert.ok(
                    boxWithinBounds(geometry.containers[nested.id], contentBounds),
                    `${container.id}/${nested.id}`,
                );
            }
        }
    });

    it("renders sub-mission containers as root lanes without nesting non-root containers", async () => {
        const { geometry } = await buildGeometry();
        const dependencyAudit = geometry.containers.dependencyAudit;
        const researchDeepDive = geometry.containers.researchDeepDive;

        assert.equal(
            boxWithinBounds(researchDeepDive, boxOf(dependencyAudit)),
            false,
            "researchDeepDive should not be rendered inside dependencyAudit",
        );
        assert.ok(
            researchDeepDive.top >= dependencyAudit.bottom + 48,
            "researchDeepDive should be in its own lane below dependencyAudit",
        );
        for (const outer of Object.values(geometry.containers)) {
            for (const inner of Object.values(geometry.containers)) {
                if (outer.id === inner.id) continue;
                assert.equal(boxWithinBounds(inner, boxOf(outer)), false, `${inner.id} inside ${outer.id}`);
            }
        }
    });

    it("sizes every container from its padded mission envelope", async () => {
        const { fixture, geometry } = await buildGeometry();
        const padding = 2 * fixture.minArrowLength;

        for (const containerFixture of [...fixture.containers].sort((a, b) => b.depth - a.depth)) {
            const childIds = descendantNodeIds(fixture, containerFixture.id);
            const childEnvelope = boundsOf([
                ...nodesInMission(fixture, containerFixture.id).map((node) => boxOf(geometry.nodes[node.id])),
                ...childContainers(fixture, containerFixture.id).map((container) => boxOf(geometry.containers[container.id])),
                ...geometry.annotations
                    .filter((annotation) => childIds.has(annotation.ownerId))
                    .map((annotation) => annotation.box),
            ]);

            assert.deepEqual(boxOf(geometry.containers[containerFixture.id]), {
                left: snapDown(childEnvelope.left - padding, fixture.columnGrid),
                right: snapUp(childEnvelope.right + padding, fixture.columnGrid),
                top: snapDown(
                    childEnvelope.top - containerFixture.headerHeight - padding,
                    fixture.trackGrid,
                ),
                bottom: snapUp(childEnvelope.bottom + padding, fixture.trackGrid),
            }, containerFixture.id);
        }

        const synthesizeAnnotation = geometry.annotations.find(
            (annotation) => annotation.id === "anno.synthesize",
        );
        assert.ok(boxWithinBounds(synthesizeAnnotation.box, boxOf(geometry.container)));
    });

    it("derives container dimensions from rendered children instead of raw ELK compound size", async () => {
        const baseline = await buildGeometry();
        const mutated = await buildGeometry({
            elkResultMutator(elkResult) {
                const container = findElkNode(elkResult, "dependencyAudit");
                container.width += 5 * baseline.fixture.G;
                container.height += 4 * baseline.fixture.G;
            },
        });

        assert.deepEqual(
            Object.fromEntries(
                Object.entries(mutated.geometry.containers).map(([id, container]) => [
                    id,
                    { x: container.x, y: container.y, width: container.width, height: container.height },
                ]),
            ),
            Object.fromEntries(
                Object.entries(baseline.geometry.containers).map(([id, container]) => [
                    id,
                    { x: container.x, y: container.y, width: container.width, height: container.height },
                ]),
            ),
        );
    });

    it("keeps node sizing tied to semantic labels and Merlin grid snapping", async () => {
        const { fixture, geometry } = await buildGeometry();
        for (const node of fixture.nodes.filter((candidate) => candidate.kind === "station")) {
            const expected = Math.ceil(
                (node.labelWidth + fixture.stationPadding * 2) / fixture.stationWidthGrid,
            ) * fixture.stationWidthGrid;
            assert.equal(node.width, expected, node.id);
            const rendered = geometry.nodes[node.id];
            assert.ok(onGrid(rendered.left, fixture.columnGrid), `${node.id}.left`);
            assert.ok(onGrid(rendered.right, fixture.columnGrid), `${node.id}.right`);
            assert.ok(onGrid(rendered.cx, fixture.columnGrid), `${node.id}.cx`);
        }
    });

    it("serializes all graph paths as Manhattan M/H/V commands", async () => {
        const { fixture, geometry } = await buildGeometry();
        for (const route of geometry.routes) {
            assert.match(route.d, /^M [\d.]+,[\d.]+(?: [HV] [\d.]+)+$/);
            for (let index = 1; index < route.points.length; index += 1) {
                const previous = route.points[index - 1];
                const point = route.points[index];
                assert.notEqual(previous.x === point.x, previous.y === point.y, route.id);
            }
            for (const point of route.trackPoints) {
                assert.ok(onGrid(point.x, fixture.trackGrid), `${route.id}.track.x`);
                assert.ok(onGrid(point.y, fixture.trackGrid), `${route.id}.track.y`);
            }
        }
    });

    it("uses a two-tile clear gap for unobstructed parent spine neighbors", async () => {
        const { fixture, geometry } = await buildGeometry();
        const unobstructedEdges = [
            "edge.start.loadConfig",
            "edge.loadConfig.env",
            "edge.env.analyze.true",
            "edge.analyze.analysisMission",
            "edge.gapReview.planFixes",
            "edge.planFixes.fixAgents",
            "edge.fixAgents.cleanReview",
            "edge.cleanReview.end.true",
        ];

        for (const edgeId of unobstructedEdges) {
            const route = geometry.routes.find((candidate) => candidate.id === edgeId);
            const source = geometry.nodes[geometry.portAnchors[route.sourcePort].ownerId];
            const target = geometry.nodes[geometry.portAnchors[route.targetPort].ownerId];

            assert.equal(target.left - source.right, 2 * fixture.G, edgeId);
        }
    });

    it("renders arrowheads at the target station boundary", async () => {
        const { geometry } = await buildGeometry();
        for (const route of geometry.routes) {
            assert.deepEqual(route.points.at(-1), route.endAnchor, route.id);
        }
    });

    it("keeps sibling items collision-free within each mission", async () => {
        const { fixture, geometry } = await buildGeometry();
        for (const mission of fixture.missions) {
            assertNoOverlaps(missionItemBoxes(fixture, geometry, mission.id), `${mission.id} mission`);
        }
    });

    it("keeps ports attached to the expected owner and side", async () => {
        const { fixture, geometry } = await buildGeometry();
        const ownerIdByPort = new Map();
        for (const node of fixture.nodes) {
            ownerIdByPort.set(`${node.id}.w`, node.id);
            ownerIdByPort.set(`${node.id}.e`, node.id);
            ownerIdByPort.set(`${node.id}.s.false`, node.id);
            ownerIdByPort.set(`${node.id}.n.loop`, node.id);
            ownerIdByPort.set(`${node.id}.s.spawn`, node.id);
            ownerIdByPort.set(`${node.id}.n`, node.id);
            ownerIdByPort.set(`${node.id}.e.research`, node.id);
            ownerIdByPort.set(`${node.id}.e.synthesize`, node.id);
            ownerIdByPort.set(`${node.id}.w.research`, node.id);
            ownerIdByPort.set(`${node.id}.w.synthesize`, node.id);
        }
        for (const container of fixture.containers) {
            ownerIdByPort.set(container.inputPort, container.id);
        }
        for (const edge of fixture.edges) {
            const source = geometry.portAnchors[edge.sourcePort];
            const target = geometry.portAnchors[edge.targetPort];
            assert.ok(source, edge.sourcePort);
            assert.ok(target, edge.targetPort);
            assert.equal(source.ownerId, ownerIdByPort.get(edge.sourcePort), edge.sourcePort);
            assert.equal(target.ownerId, ownerIdByPort.get(edge.targetPort), edge.targetPort);
        }
        assert.equal(geometry.portAnchors["analysisMission.s.spawn"].side, "SOUTH");
        assert.equal(geometry.portAnchors[fixture.container.inputPort].side, "NORTH");
        assert.equal(geometry.portAnchors["researchDeepDiveSpawn.s.spawn"].side, "SOUTH");
        assert.equal(geometry.portAnchors["researchDeepDive.n.spawn"].side, "NORTH");
        assert.equal(geometry.portAnchors["clean twice?.n.loop"].side, "NORTH");
        assert.equal(geometry.portAnchors["Gap Review.n.loop"].side, "NORTH");
    });

    it("preserves semantic route styles and marker ids", async () => {
        const { geometry } = await buildGeometry();
        const expected = new Map([
            ["edge.env.error.false", ["error", "arr-error"]],
            ["edge.env.analyze.true", ["branch", "arr-branch"]],
            ["edge.cleanReview.end.true", ["branch", "arr-branch"]],
            ["edge.cleanReview.gapReview.false", ["loop", "arr-branch"]],
            ["edge.analysisMission.dependencyAudit", ["spawn", "arr-spawn"]],
            ["edge.researchDeepDiveSpawn.deepDive", ["spawn", "arr-spawn"]],
            ["edge.evidence.deepEnd", ["branch", "arr-branch"]],
        ]);
        for (const route of geometry.routes) {
            const [renderType, markerId] = expected.get(route.id) || [route.type, "arr-seq"];
            assert.equal(route.renderType, renderType, `${route.id}.renderType`);
            assert.equal(route.markerId, markerId, `${route.id}.markerId`);
        }
    });

    it("keeps the env false branch in the env column above the error terminal", async () => {
        const { geometry } = await buildGeometry();
        const env = geometry.nodes["env?"];
        const error = geometry.nodes.error;
        const analyze = geometry.nodes.Analyze;
        const falseRoute = geometry.routes.find((route) => route.id === "edge.env.error.false");

        assert.equal(error.x, env.x);
        assert.equal(error.cx, env.cx);
        assert.notEqual(error.cx, analyze.cx);
        assert.ok(error.top > env.bottom);
        assert.match(falseRoute.d, /^M [\d.]+,[\d.]+(?: [HV] [\d.]+)+$/);
        assert.equal(falseRoute.renderType, "error");
        assert.equal(falseRoute.targetPort, "error.n");
        assert.deepEqual(falseRoute.endAnchor, {
            x: geometry.portAnchors["error.n"].x,
            y: geometry.portAnchors["error.n"].y,
        });
        assert.deepEqual(falseRoute.points.at(-1), falseRoute.endAnchor);
        assert.ok(falseRoute.points.every((point) => point.x === env.cx));
        assert.ok(falseRoute.points.every((point) => point.x < analyze.left));
    });

    it("keeps labels and annotations grid-snapped inside the computed viewBox", async () => {
        const { fixture, geometry } = await buildGeometry();
        const viewBounds = parseViewBox(geometry.viewBox);
        for (const label of geometry.edgeLabels) {
            assert.ok(onGrid(label.x, fixture.labelGrid), `${label.id}.x`);
            assert.ok(onGrid(label.y, fixture.labelGrid), `${label.id}.y`);
            assert.ok(boxWithinBounds(label.box, viewBounds), `${label.id}.box`);
        }
        for (const annotation of geometry.annotations) {
            assert.ok(onGrid(annotation.x, fixture.labelGrid), `${annotation.id}.x`);
            assert.ok(onGrid(annotation.textY, fixture.labelGrid), `${annotation.id}.textY`);
            assert.ok(boxWithinBounds(annotation.box, viewBounds), `${annotation.id}.box`);
        }
    });

    it("keeps the env decision branches clear of annotations and target nodes", async () => {
        const { geometry } = await buildGeometry();
        const env = geometry.nodes["env?"];
        const analyze = geometry.nodes.Analyze;
        const error = geometry.nodes.error;
        const trueRoute = geometry.routes.find((route) => route.id === "edge.env.analyze.true");
        const falseRoute = geometry.routes.find((route) => route.id === "edge.env.error.false");
        const analyzeAnnotation = geometry.annotations.find((annotation) => annotation.id === "anno.analyze");

        assert.equal(routePathDefect(trueRoute.points), null);
        assert.ok(trueRoute.points.every((point) => point.x >= trueRoute.startAnchor.x));
        assert.ok(error.top > env.bottom);
        assert.ok(falseRoute.points.every((point) => point.x === env.cx));
        assert.ok(falseRoute.points.every((point) => point.x < analyze.left));
        assert.equal(pathHitsBox(falseRoute.points, analyzeAnnotation.box), false);
        assert.equal(pathHitsBox(falseRoute.points, boxOf(geometry.nodes.Analyze)), false);
        assert.equal(pathHitsBox(falseRoute.points, boxOf(geometry.nodes.error)), false);
        assert.equal(boxesOverlap(analyzeAnnotation.box, boxOf(geometry.nodes.error)), false);
    });

    it("keeps spawn routes anchored to computed entry ports", async () => {
        const { fixture, geometry } = await buildGeometry();
        for (const edgeId of ["edge.analysisMission.dependencyAudit", "edge.researchDeepDiveSpawn.deepDive"]) {
            const spawnRoute = geometry.routes.find((route) => route.id === edgeId);
            const sourcePort = geometry.portAnchors[spawnRoute.sourcePort];
            const targetPort = geometry.portAnchors[spawnRoute.targetPort];
            assert.deepEqual(spawnRoute.startAnchor, { x: sourcePort.x, y: sourcePort.y }, `${edgeId}.start`);
            assert.deepEqual(spawnRoute.endAnchor, { x: targetPort.x, y: targetPort.y }, `${edgeId}.end`);
            assert.deepEqual(
                spawnRoute.entryPoint,
                projectedTrackPoint(sourcePort, fixture.minArrowLength, fixture),
                `${edgeId}.entryPoint`,
            );
            assert.deepEqual(
                spawnRoute.exitPoint,
                projectedTrackPoint(targetPort, fixture.markerClearance, fixture),
                `${edgeId}.exitPoint`,
            );
        }
    });

    it("keeps research deep-dive spawn routing off the join route", async () => {
        const { geometry } = await buildGeometry();
        const spawnRoute = geometry.routes.find(
            (route) => route.id === "edge.researchDeepDiveSpawn.deepDive",
        );
        const joinRoute = geometry.routes.find((route) => route.id === "edge.synthesize.join");

        assert.equal(routesOverlap(spawnRoute, joinRoute), false);
    });

    it("renders the cycle as one recurrence summary route above the main spine", async () => {
        const { fixture, geometry } = await buildGeometry();
        const loopEdges = fixture.edges.filter((edge) => edge.type === "loop");
        assert.deepEqual(loopEdges.map((edge) => edge.id), ["edge.cleanReview.gapReview.false"]);
        const loopRoute = geometry.routes.find(
            (route) => route.id === "edge.cleanReview.gapReview.false",
        );
        assert.equal(loopRoute.label, "false");
        assert.equal(loopRoute.renderType, "loop");
        assert.equal(loopRoute.markerId, "arr-branch");
        assert.equal(loopRoute.sourcePort, "clean twice?.n.loop");
        assert.equal(loopRoute.targetPort, "Gap Review.n.loop");
        for (const point of loopRoute.points) {
            assert.ok(point.y < geometry.nodes["Gap Review"].cy, `${loopRoute.id} ${point.y}`);
        }
    });

    it("keeps non-collinear error branch exit stitching orthogonal", async () => {
        const { geometry } = await buildGeometry({
            elkResultMutator(elkResult) {
                findElkNode(elkResult, "error").x += 32;
            },
        });
        const errorRoute = geometry.routes.find(
            (route) => route.id === "edge.env.error.false",
        );

        for (let index = 1; index < errorRoute.points.length; index += 1) {
            const previous = errorRoute.points[index - 1];
            const point = errorRoute.points[index];
            assert.notEqual(
                previous.x === point.x,
                previous.y === point.y,
                `${previous.x},${previous.y} -> ${point.x},${point.y}`,
            );
        }

        const exitPointIndex = errorRoute.points.findIndex((point) =>
            point.x === errorRoute.exitPoint.x && point.y === errorRoute.exitPoint.y
        );
        assert.equal(routePathDefect(errorRoute.points), null);
        if (exitPointIndex > -1) {
            assert.ok(exitPointIndex < errorRoute.points.length - 1, "exitPoint precedes target boundary");
        }
        assert.deepEqual(errorRoute.points.at(-1), errorRoute.endAnchor);
    });

    it("rejects overlapping sibling nodes within a mission", async () => {
        const { fixture, geometry } = await buildGeometry();
        const parentOverlap = deepClone(geometry);
        parentOverlap.nodes.fixAgents.x = parentOverlap.nodes["Plan Fixes"].x;
        parentOverlap.nodes.fixAgents.left = parentOverlap.nodes.fixAgents.x;
        parentOverlap.nodes.fixAgents.right = parentOverlap.nodes.fixAgents.x + parentOverlap.nodes.fixAgents.width;
        parentOverlap.nodes.fixAgents.cx = parentOverlap.nodes.fixAgents.x + parentOverlap.nodes.fixAgents.width / 2;
        assert.ok(
            validateMissionGraphGeometry(fixture, parentOverlap).some((failure) =>
                failure.includes("Plan Fixes overlaps fixAgents"),
            ),
        );

        const siblingOverlap = deepClone(geometry);
        siblingOverlap.nodes.synthesize.x = siblingOverlap.nodes.research.x;
        siblingOverlap.nodes.synthesize.y = siblingOverlap.nodes.research.y;
        siblingOverlap.nodes.synthesize.left = siblingOverlap.nodes.research.left;
        siblingOverlap.nodes.synthesize.right = siblingOverlap.nodes.research.right;
        siblingOverlap.nodes.synthesize.top = siblingOverlap.nodes.research.top;
        siblingOverlap.nodes.synthesize.bottom = siblingOverlap.nodes.research.bottom;
        siblingOverlap.nodes.synthesize.cx = siblingOverlap.nodes.research.cx;
        siblingOverlap.nodes.synthesize.cy = siblingOverlap.nodes.research.cy;
        assert.ok(
            validateMissionGraphGeometry(fixture, siblingOverlap).some((failure) =>
                failure.includes("research overlaps") && failure.includes("synthesize"),
            ),
        );
    });

    it("rejects routes through annotations, annotation-node overlaps, and backtracking paths", async () => {
        const { fixture, geometry } = await buildGeometry();

        const routeThroughAnnotation = deepClone(geometry);
        const crossingRoute = routeThroughAnnotation.routes.find(
            (route) => route.id === "edge.env.analyze.true",
        );
        const annotation = routeThroughAnnotation.annotations.find(
            (candidate) => candidate.id === "anno.analyze",
        );
        const y = (annotation.box.top + annotation.box.bottom) / 2;
        crossingRoute.points = [
            { x: annotation.box.left - fixture.G, y },
            { x: annotation.box.right + fixture.G, y },
        ];
        assert.ok(
            validateMissionGraphGeometry(fixture, routeThroughAnnotation).includes(
                "edge.env.analyze.true intersects an unrelated box",
            ),
        );

        const annotationOverlap = deepClone(geometry);
        const overlapAnnotation = annotationOverlap.annotations.find(
            (candidate) => candidate.id === "anno.analyze",
        );
        overlapAnnotation.box = {
            id: overlapAnnotation.id,
            ...boxOf(annotationOverlap.nodes.error),
        };
        assert.ok(
            validateMissionGraphGeometry(fixture, annotationOverlap).includes(
                "anno.analyze overlaps non-owner node error",
            ),
        );

        const backtrackingRoute = deepClone(geometry);
        const badRoute = backtrackingRoute.routes.find(
            (route) => route.id === "edge.env.analyze.true",
        );
        badRoute.points = [
            { x: 416, y: 224 },
            { x: 448, y: 224 },
            { x: 424, y: 224 },
        ];
        assert.ok(
            validateMissionGraphGeometry(fixture, backtrackingRoute).includes(
                "edge.env.analyze.true path backtracks at 448,224",
            ),
        );

        const routeOverlap = deepClone(geometry);
        const overlappingSpawn = routeOverlap.routes.find(
            (route) => route.id === "edge.researchDeepDiveSpawn.deepDive",
        );
        const joinRoute = routeOverlap.routes.find((route) => route.id === "edge.synthesize.join");
        overlappingSpawn.points = [
            { x: joinRoute.points[0].x - fixture.G, y: joinRoute.points[0].y },
            { x: joinRoute.points[1].x + fixture.G, y: joinRoute.points[1].y },
        ];
        assert.ok(
            validateMissionGraphGeometry(fixture, routeOverlap).includes(
                "edge.researchDeepDiveSpawn.deepDive overlaps route edge.synthesize.join",
            ),
        );
    });

    it("keeps widened live ELK station geometry collision-free", async () => {
        const { geometry } = await buildGeometry({
            measureTextWidthOverride(label, className) {
                if (label === "Plan Fixes" && className === "node-label") {
                    return 130;
                }
                return measureTextWidth(label, className);
            },
        });
        assert.deepEqual(geometry.validationFailures, []);
    });

    it("does not expose mock ELK helpers in either runtime surface", () => {
        assert.equal("createMockElkResult" in layoutModule, false);

        const browserApi = loadBrowserBundleApi();
        assert.deepEqual(Object.keys(browserApi).sort(), [
            "buildElkGraph",
            "buildMissionGraphGeometry",
            "createMissionGraphFixture",
            "validateMissionGraphGeometry",
        ]);
        assert.equal("createMockElkResult" in browserApi, false);
    });

    it("keeps the browser bundle derived from the ESM source", () => {
        const source = readFileSync(sourcePath, "utf8");
        const browser = readFileSync(browserPath, "utf8");
        assert.equal(browser, deriveBrowserBundle(source));
    });

    it("keeps browser and ESM geometry output in sync from live ELK output", async () => {
        const fixture = createMissionGraphFixture({ measureTextWidth });
        const elk = new ELK();
        const elkResult = await elk.layout(buildElkGraph(fixture));
        const esmGeometry = buildMissionGraphGeometry(fixture, deepClone(elkResult));

        const browserApi = loadBrowserBundleApi();
        const browserFixture = browserApi.createMissionGraphFixture({ measureTextWidth });
        const browserGeometry = browserApi.buildMissionGraphGeometry(
            browserFixture,
            deepClone(elkResult),
        );

        assert.deepEqual(
            JSON.parse(JSON.stringify(geometrySnapshot(browserGeometry))),
            JSON.parse(JSON.stringify(geometrySnapshot(esmGeometry))),
        );
    });
});
