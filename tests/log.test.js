/**
 * Unit tests for the Log singleton class.
 * Uses real test data from tests/data/RtcLogs_2026-01-12_05-39.json
 */

import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testDataPath = join(__dirname, "data", "RtcLogs_2026-01-12_05-39.json");
const testData = JSON.parse(readFileSync(testDataPath, "utf-8"));

// Import the real Log singleton
import Log from "../src/models/log.js";

describe("Log Class", () => {
    beforeEach(() => {
        // Reset the Log singleton state before each test
        Log.clear();
    });

    describe("Initial State", () => {
        test("should start with no data loaded", () => {
            expect(Log.isLoaded).toBe(false);
            expect(Log.rawData).toBeNull();
        });

        test("should have empty collections before loading", () => {
            expect(Log.timelineKeys).toEqual([]);
            expect(Log.snapshotKeys).toEqual([]);
            expect(Log.timelines).toEqual({});
            expect(Log.snapshots).toEqual({});
        });

        test("should have null odooInfo before loading", () => {
            expect(Log.odooInfo).toBeNull();
        });
    });

    describe("Loading Data", () => {
        test("should load test data successfully", () => {
            Log.load(testData);
            expect(Log.isLoaded).toBe(true);
            expect(Log.rawData).toBe(testData);
        });

        test("should parse odooInfo correctly", () => {
            Log.load(testData);
            expect(Log.odooInfo).toEqual(testData.odooInfo);
            expect(Log.odooInfo.db).toBe("tso-recordin-6-1-2026");
            expect(Log.odooInfo.server_version).toBe("19.2a1+e");
            expect(Log.odooInfo.isEnterprise).toBe(true);
        });

        test("should select all timelines by default", () => {
            Log.load(testData);
            const expectedCount = Object.keys(testData.timelines).length;
            expect(Log.selectedTimelines.size).toBe(expectedCount);
        });

        test("should select all snapshots by default", () => {
            Log.load(testData);
            const expectedCount = Object.keys(testData.snapshots).length;
            expect(Log.selectedSnapshots.size).toBe(expectedCount);
        });

        test("should fire change callback on load", () => {
            const callback = jest.fn();
            Log.onChange(callback);
            Log.load(testData);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("Timeline Keys", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should return sorted timeline keys", () => {
            const keys = Log.timelineKeys;
            expect(keys.length).toBe(12);
            const sorted = [...keys].sort();
            expect(keys).toEqual(sorted);
        });

        test("should include specific timelines from test data", () => {
            const keys = Log.timelineKeys;
            expect(keys).toContain("2026-01-12T04:03:15.217Z");
            expect(keys).toContain("2026-01-12T04:39:26.550Z");
        });
    });

    describe("Snapshot Keys", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should return sorted snapshot keys", () => {
            const keys = Log.snapshotKeys;
            expect(keys.length).toBe(14);
            const sorted = [...keys].sort();
            expect(keys).toEqual(sorted);
        });

        test("should return last relevant timestamp", () => {
            const lastTimestamp = Log.lastRelevantTimestamp;
            expect(lastTimestamp).toBe("2026-01-12T04:39:53.419Z");
        });
    });

    describe("Filtering - Timelines", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should filter timelines correctly when all selected", () => {
            expect(Object.keys(Log.filteredTimelines).length).toBe(
                Object.keys(testData.timelines).length
            );
        });

        test("should toggle timeline selection", () => {
            const firstKey = Log.timelineKeys[0];
            const initialCount = Log.selectedTimelines.size;

            Log.toggleTimeline(firstKey);
            expect(Log.selectedTimelines.size).toBe(initialCount - 1);
            expect(Log.selectedTimelines.has(firstKey)).toBe(false);

            Log.toggleTimeline(firstKey);
            expect(Log.selectedTimelines.size).toBe(initialCount);
            expect(Log.selectedTimelines.has(firstKey)).toBe(true);
        });

        test("should deselect all timelines", () => {
            Log.deselectAllTimelines();
            expect(Log.selectedTimelines.size).toBe(0);
            expect(Object.keys(Log.filteredTimelines).length).toBe(0);
        });

        test("should select all timelines after deselection", () => {
            Log.deselectAllTimelines();
            Log.selectAllTimelines();
            expect(Log.selectedTimelines.size).toBe(Log.timelineKeys.length);
        });

        test("should fire change callback on toggle", () => {
            const callback = jest.fn();
            Log.onChange(callback);

            Log.toggleTimeline(Log.timelineKeys[0]);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("Filtering - Snapshots", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should filter snapshots correctly when all selected", () => {
            expect(Object.keys(Log.filteredSnapshots).length).toBe(
                Object.keys(testData.snapshots).length
            );
        });

        test("should toggle snapshot selection", () => {
            const firstKey = Log.snapshotKeys[0];
            const initialCount = Log.selectedSnapshots.size;

            Log.toggleSnapshot(firstKey);
            expect(Log.selectedSnapshots.size).toBe(initialCount - 1);
            expect(Log.selectedSnapshots.has(firstKey)).toBe(false);
        });

        test("should deselect all snapshots", () => {
            Log.deselectAllSnapshots();
            expect(Log.selectedSnapshots.size).toBe(0);
            expect(Log.filteredSnapshotKeys.length).toBe(0);
        });

        test("should return filtered snapshot keys correctly", () => {
            Log.deselectAllSnapshots();
            Log.toggleSnapshot(Log.snapshotKeys[0]);
            Log.toggleSnapshot(Log.snapshotKeys[1]);
            expect(Log.filteredSnapshotKeys.length).toBe(2);
        });
    });

    describe("Filtered Logs", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should return complete filtered logs object", () => {
            const filtered = Log.filteredLogs;
            expect(filtered).not.toBeNull();
            expect(filtered.odooInfo).toEqual(testData.odooInfo);
            expect(filtered.timelines).toBeDefined();
            expect(filtered.snapshots).toBeDefined();
        });

        test("should reflect selection in filteredLogs", () => {
            Log.deselectAllTimelines();
            Log.deselectAllSnapshots();

            const firstTimeline = Object.keys(testData.timelines)[0];
            const firstSnapshot = Object.keys(testData.snapshots)[0];

            Log.toggleTimeline(firstTimeline);
            Log.toggleSnapshot(firstSnapshot);

            const filtered = Log.filteredLogs;
            expect(Object.keys(filtered.timelines).length).toBe(1);
            expect(Object.keys(filtered.snapshots).length).toBe(1);
            expect(filtered.timelines[firstTimeline]).toBeDefined();
            expect(filtered.snapshots[firstSnapshot]).toBeDefined();
        });
    });

    describe("Clear", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should clear all data", () => {
            Log.clear();
            expect(Log.isLoaded).toBe(false);
            expect(Log.rawData).toBeNull();
            expect(Log.timelineKeys).toEqual([]);
            expect(Log.snapshotKeys).toEqual([]);
        });

        test("should fire change callback on clear", () => {
            const callback = jest.fn();
            Log.onChange(callback);

            Log.clear();
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe("Change Callbacks", () => {
        test("should allow unsubscribe", () => {
            const callback = jest.fn();
            const unsubscribe = Log.onChange(callback);

            Log.load(testData);
            expect(callback).toHaveBeenCalledTimes(1);

            unsubscribe();
            Log.clear();
            expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        test("should handle multiple callbacks", () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            Log.onChange(callback1);
            Log.onChange(callback2);

            Log.load(testData);

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        test("should continue calling other callbacks if one throws", () => {
            // Silence expected console.error from the error handler
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const errorCallback = jest.fn(() => {
                throw new Error("Test error");
            });
            const successCallback = jest.fn();

            const unsubscribeError = Log.onChange(errorCallback);
            const unsubscribeSuccess = Log.onChange(successCallback);

            expect(() => Log.load(testData)).not.toThrow();
            expect(successCallback).toHaveBeenCalledTimes(1);

            // Cleanup: unsubscribe to prevent callback from firing in subsequent tests
            unsubscribeError();
            unsubscribeSuccess();
            consoleSpy.mockRestore();
        });
    });

    describe("Formatting Helpers", () => {
        test("should format timeline label", () => {
            const key = "2026-01-12T04:03:15.217Z";
            const label = Log.formatTimelineLabel(key);
            expect(label).toContain("Timeline:");
        });

        test("should format snapshot label", () => {
            const key = "2026-01-12T04:03:37.338Z";
            const label = Log.formatSnapshotLabel(key);
            expect(label).toContain("Snapshot:");
        });

        test("should handle invalid date gracefully", () => {
            const label = Log.formatTimelineLabel("invalid-date");
            expect(label).toContain("Timeline:");
        });
    });

    describe("Timeline Data Structure", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should have correct timeline structure", () => {
            const firstKey = Log.timelineKeys[0];
            const timeline = Log.timelines[firstKey];

            expect(timeline).toBeDefined();
            expect(timeline.channelId).toBeDefined();
            expect(timeline.selfSessionId).toBeDefined();
            expect(timeline.start).toBeDefined();
            expect(timeline.end).toBeDefined();
            expect(timeline.entriesBySessionId).toBeDefined();
        });

        test("should have session entries with logs", () => {
            const timelineKey = "2026-01-12T04:03:15.217Z";
            const timeline = Log.timelines[timelineKey];
            const sessions = timeline.entriesBySessionId;

            expect(Object.keys(sessions).length).toBeGreaterThan(0);

            const firstSession = Object.values(sessions)[0];
            expect(firstSession.logs).toBeDefined();
            expect(Array.isArray(firstSession.logs)).toBe(true);
        });
    });

    describe("Snapshot Data Structure", () => {
        beforeEach(() => {
            Log.load(testData);
        });

        test("should have correct snapshot structure", () => {
            const firstKey = Log.snapshotKeys[0];
            const snapshot = Log.snapshots[firstKey];

            expect(snapshot).toBeDefined();
            expect(snapshot.connectionType).toBeDefined();
            expect(snapshot.sessions).toBeDefined();
            expect(Array.isArray(snapshot.sessions)).toBe(true);
        });

        test("should identify self session", () => {
            const snapshotKey = "2026-01-12T04:03:37.338Z";
            const snapshot = Log.snapshots[snapshotKey];
            const selfSession = snapshot.sessions.find((s) => s.isSelf);

            expect(selfSession).toBeDefined();
            expect(selfSession.id).toBe(46);
        });
    });
});
