/**
 * Log singleton for managing RTC log data.
 * Exposed on `window.Log` for debugging.
 */
class LogClass {
    constructor() {
        this._rawData = null;
        this._selectedTimelines = new Set();
        this._selectedSnapshots = new Set();
        this._changeCallbacks = [];
    }

    load(jsonData) {
        this._rawData = jsonData;
        this._selectedTimelines = new Set(Object.keys(jsonData.timelines || {}));
        this._selectedSnapshots = new Set(Object.keys(jsonData.snapshots || {}));
        this._notifyChange();
    }

    clear() {
        this._rawData = null;
        this._selectedTimelines = new Set();
        this._selectedSnapshots = new Set();
        this._notifyChange();
    }

    get isLoaded() {
        return this._rawData !== null;
    }

    get rawData() {
        return this._rawData;
    }

    get odooInfo() {
        return this._rawData?.odooInfo || null;
    }

    get timelines() {
        return this._rawData?.timelines || {};
    }

    get snapshots() {
        return this._rawData?.snapshots || {};
    }

    get timelineKeys() {
        if (!this._rawData?.timelines) {
            return [];
        }
        return Object.keys(this._rawData.timelines).sort();
    }

    get snapshotKeys() {
        if (!this._rawData?.snapshots) {
            return [];
        }
        return Object.keys(this._rawData.snapshots).sort();
    }

    get lastRelevantTimestamp() {
        return this.snapshotKeys.at(-1);
    }

    get selectedTimelines() {
        return this._selectedTimelines;
    }

    get selectedSnapshots() {
        return this._selectedSnapshots;
    }

    get filteredTimelines() {
        if (!this._rawData?.timelines) {
            return {};
        }

        const filtered = {};
        for (const key of Object.keys(this._rawData.timelines)) {
            if (this._selectedTimelines.has(key)) {
                filtered[key] = this._rawData.timelines[key];
            }
        }
        return filtered;
    }

    get filteredSnapshots() {
        if (!this._rawData?.snapshots) {
            return {};
        }

        const filtered = {};
        for (const key of Object.keys(this._rawData.snapshots)) {
            if (this._selectedSnapshots.has(key)) {
                filtered[key] = this._rawData.snapshots[key];
            }
        }
        return filtered;
    }

    get filteredSnapshotKeys() {
        return Object.keys(this.filteredSnapshots).sort();
    }

    get filteredTimelineKeys() {
        return Object.keys(this.filteredTimelines).sort();
    }

    /** Backward compatible format for UI components that expect logs.timelines/snapshots */
    get filteredLogs() {
        if (!this._rawData) {
            return null;
        }

        const filtered = {};
        for (const key in this._rawData) {
            if (key !== "timelines" && key !== "snapshots") {
                filtered[key] = this._rawData[key];
            }
        }

        filtered.timelines = this.filteredTimelines;
        filtered.snapshots = this.filteredSnapshots;

        return filtered;
    }

    toggleTimeline(key) {
        if (this._selectedTimelines.has(key)) {
            this._selectedTimelines.delete(key);
        } else {
            this._selectedTimelines.add(key);
        }
        this._notifyChange();
    }

    toggleSnapshot(key) {
        if (this._selectedSnapshots.has(key)) {
            this._selectedSnapshots.delete(key);
        } else {
            this._selectedSnapshots.add(key);
        }
        this._notifyChange();
    }

    selectAllTimelines() {
        if (this._rawData?.timelines) {
            this._selectedTimelines = new Set(Object.keys(this._rawData.timelines));
            this._notifyChange();
        }
    }

    deselectAllTimelines() {
        this._selectedTimelines.clear();
        this._notifyChange();
    }

    selectAllSnapshots() {
        if (this._rawData?.snapshots) {
            this._selectedSnapshots = new Set(Object.keys(this._rawData.snapshots));
            this._notifyChange();
        }
    }

    deselectAllSnapshots() {
        this._selectedSnapshots.clear();
        this._notifyChange();
    }

    /** Returns an unsubscribe function */
    onChange(callback) {
        this._changeCallbacks.push(callback);
        return () => {
            const index = this._changeCallbacks.indexOf(callback);
            if (index > -1) {
                this._changeCallbacks.splice(index, 1);
            }
        };
    }

    _notifyChange() {
        for (const callback of this._changeCallbacks) {
            try {
                callback();
            } catch (e) {
                console.error("Error in Log change callback:", e);
            }
        }
    }

    formatTimelineLabel(timelineKey) {
        try {
            const date = new Date(timelineKey);
            return `Timeline: ${date.toLocaleString()}`;
        } catch {
            return `Timeline: ${timelineKey}`;
        }
    }

    formatSnapshotLabel(snapshotKey) {
        try {
            const date = new Date(snapshotKey);
            return `Snapshot: ${date.toLocaleString()}`;
        } catch {
            return `Snapshot: ${snapshotKey}`;
        }
    }
}

export const Log = new LogClass();

if (typeof window !== "undefined") {
    window.Log = Log;
}

export default Log;
