/** @jest-environment jsdom */
import { beforeAll, afterEach, describe, expect, test } from "@jest/globals";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
    click,
    clickByText,
    createApp,
    flush,
    getByText,
    loadOwl,
    setupRaf,
    waitForElements,
    waitForSelector,
} from "./test_utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataPath = join(__dirname, "data", "RtcLogs_2026-01-12_05-39.json");
const testData = JSON.parse(readFileSync(testDataPath, "utf-8"));
const multiP2pSamplesData = {
    timelines: {
        "2026-02-11T12:16:37.178Z": {
            selfSessionId: 100,
            entriesBySessionId: {
                100: {
                    step: "",
                    state: "",
                    logs: [
                        {
                            event: "2026-02-11T12:16:37.179Z: no sfu server info, using peer-to-peer",
                        },
                    ],
                },
                101: {
                    step: "p2p",
                    state: "",
                    logs: [
                        {
                            event: "2026-02-11T12:16:38.000Z: gathering state change: gathering",
                            level: "info",
                        },
                        {
                            event: "2026-02-11T12:16:38.310Z: connection state change: connected",
                            level: "info",
                        },
                    ],
                },
                102: {
                    step: "p2p",
                    state: "",
                    logs: [
                        {
                            event: "2026-02-11T12:16:38.500Z: gathering state change: gathering",
                            level: "info",
                        },
                        {
                            event: "2026-02-11T12:16:38.920Z: connection state change: connected",
                            level: "info",
                        },
                    ],
                },
            },
        },
    },
    snapshots: {},
};

let Root;
let LogPlugin;

async function createLoadedApp() {
    const { app, root } = await createApp({ Root, plugins: [LogPlugin] });
    const log = app.pluginManager.getPlugin(LogPlugin);
    log.load(testData);
    await waitForSelector(app, ".info-panel .view-btn");
    return { app, root };
}

beforeAll(async () => {
    setupRaf();
    loadOwl();
    ({ Root } = await import("../src/components/root/root.js"));
    ({ LogPlugin } = await import("../src/plugins/log_plugin.js"));
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("RTC Log Viewer UI", () => {
    test("shows upload panel before data is loaded", async () => {
        const { app, root } = await createApp({ Root, plugins: [LogPlugin] });
        await flush(app);

        expect(document.querySelector(".file-upload-container")).not.toBeNull();
        expect(document.querySelector(".log-content")).toBeNull();

        root.destroy();
        await flush(app);
    });

    test("renders system info and timeline entries from real log data", async () => {
        const { app, root } = await createLoadedApp();

        const systemInfo = document.querySelector(".system-info");
        expect(systemInfo).not.toBeNull();
        expect(systemInfo.textContent).toContain(testData.odooInfo.server_version);
        expect(systemInfo.textContent).toContain(testData.odooInfo.db);

        clickByText(".info-panel .view-btn", "Timelines");
        await waitForSelector(app, ".timelines-container");

        const timelineEntries = await waitForElements(app, ".timeline-entry", {
            exact: Object.keys(testData.timelines).length,
        });
        expect(timelineEntries.length).toBe(Object.keys(testData.timelines).length);

        root.destroy();
        await flush(app);
    });

    test("renders snapshot list from real log data", async () => {
        const { app, root } = await createLoadedApp();

        clickByText(".info-panel .view-btn", "Snapshots");
        await waitForSelector(app, ".snapshots-container");

        const snapshotEntries = await waitForElements(app, ".snapshot-entry", {
            exact: Object.keys(testData.snapshots).length,
        });
        expect(snapshotEntries.length).toBe(Object.keys(testData.snapshots).length);

        root.destroy();
        await flush(app);
    });

    test("expands a timeline entry when clicked", async () => {
        const { app, root } = await createLoadedApp();

        clickByText(".info-panel .view-btn", "Timelines");
        await waitForSelector(app, ".timeline-entry");

        const firstEntry = document.querySelector(".timeline-entry");
        click(firstEntry.querySelector(".timeline-header"));
        await waitForSelector(app, ".timeline-entry .timeline-content");

        expect(firstEntry.querySelector(".timeline-content")).not.toBeNull();

        root.destroy();
        await flush(app);
    });

    test("deselecting all timelines shows the empty state", async () => {
        const { app, root } = await createLoadedApp();

        clickByText(".info-panel .view-btn", "Timelines");
        await waitForSelector(app, ".timelines-container");

        const timelineHeader = getByText(".filter-section h4", "Timelines");
        const timelineFilter = timelineHeader.closest(".filter-section");
        click(timelineFilter.querySelector(".filter-header"));
        await waitForSelector(app, ".filter-content");

        clickByText(".filter-content .filter-action-btn", "Deselect All");
        await waitForSelector(app, ".timelines-container .no-data");

        expect(
            document.querySelector(".timelines-container .no-data"),
        ).not.toBeNull();

        root.destroy();
        await flush(app);
    });

    test("cockpit counts all p2p connect samples in one timeline", async () => {
        const { app, root } = await createApp({ Root, plugins: [LogPlugin] });
        const log = app.pluginManager.getPlugin(LogPlugin);

        log.load(multiP2pSamplesData);
        await waitForSelector(app, ".incident-cockpit .trend-card");

        const p2pHeading = getByText(".trend-card h5", "P2P Connect");
        const p2pCard = p2pHeading.closest(".trend-card");
        expect(p2pCard).not.toBeNull();
        expect(p2pCard.textContent).toContain("2 samples");

        root.destroy();
        await flush(app);
    });
});
