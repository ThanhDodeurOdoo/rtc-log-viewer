export function buildFilteredLogs(rawData, { selectedTimelines, selectedSnapshots }) {
    if (!rawData) {
        return null;
    }

    const selectedTimelineSet = new Set(selectedTimelines || []);
    const selectedSnapshotSet = new Set(selectedSnapshots || []);
    const rawTimelines = rawData.timelines || {};
    const rawSnapshots = rawData.snapshots || {};

    const filtered = {};
    for (const [key, value] of Object.entries(rawData)) {
        if (key !== "timelines" && key !== "snapshots") {
            filtered[key] = value;
        }
    }

    filtered.timelines = {};
    for (const [timelineKey, timeline] of Object.entries(rawTimelines)) {
        if (!selectedTimelineSet.size || selectedTimelineSet.has(timelineKey)) {
            filtered.timelines[timelineKey] = timeline;
        }
    }

    filtered.snapshots = {};
    for (const [snapshotKey, snapshot] of Object.entries(rawSnapshots)) {
        if (!selectedSnapshotSet.size || selectedSnapshotSet.has(snapshotKey)) {
            filtered.snapshots[snapshotKey] = snapshot;
        }
    }

    return filtered;
}
