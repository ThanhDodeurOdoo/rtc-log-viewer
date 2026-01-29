const { Plugin, signal, computed } = owl;

export class LogPlugin extends Plugin {
    setup() {
        this.rawData = signal(null);
        this.selectedTimelines = signal.Set(new Set());
        this.selectedSnapshots = signal.Set(new Set());

        this.isLoaded = computed(() => this.rawData() !== null);
        this.odooInfo = computed(() => this.rawData()?.odooInfo || null);
        this.timelines = computed(() => this.rawData()?.timelines || {});
        this.snapshots = computed(() => this.rawData()?.snapshots || {});
        this.timelineKeys = computed(() => Object.keys(this.timelines()).sort());
        this.snapshotKeys = computed(() => Object.keys(this.snapshots()).sort());
        this.lastRelevantTimestamp = computed(() => {
            const keys = this.snapshotKeys();
            return keys.length ? keys[keys.length - 1] : null;
        });

        this.filteredTimelines = computed(() => {
            const timelines = this.timelines();
            const selected = this.selectedTimelines();
            const filtered = {};
            for (const key of Object.keys(timelines)) {
                if (selected.has(key)) {
                    filtered[key] = timelines[key];
                }
            }
            return filtered;
        });

        this.filteredSnapshots = computed(() => {
            const snapshots = this.snapshots();
            const selected = this.selectedSnapshots();
            const filtered = {};
            for (const key of Object.keys(snapshots)) {
                if (selected.has(key)) {
                    filtered[key] = snapshots[key];
                }
            }
            return filtered;
        });

        this.filteredSnapshotKeys = computed(() =>
            Object.keys(this.filteredSnapshots()).sort(),
        );
        this.filteredTimelineKeys = computed(() =>
            Object.keys(this.filteredTimelines()).sort(),
        );

        this.filteredLogs = computed(() => {
            const raw = this.rawData();
            if (!raw) {
                return null;
            }
            const filtered = {};
            for (const key in raw) {
                if (key !== "timelines" && key !== "snapshots") {
                    filtered[key] = raw[key];
                }
            }
            filtered.timelines = this.filteredTimelines();
            filtered.snapshots = this.filteredSnapshots();
            return filtered;
        });
    }

    load(jsonData) {
        this.rawData.set(jsonData);
        this.selectedTimelines.set(new Set(Object.keys(jsonData.timelines || {})));
        this.selectedSnapshots.set(new Set(Object.keys(jsonData.snapshots || {})));
    }

    clear() {
        this.rawData.set(null);
        this.selectedTimelines.set(new Set());
        this.selectedSnapshots.set(new Set());
    }

    toggleTimeline(key) {
        const selected = this.selectedTimelines();
        if (selected.has(key)) {
            selected.delete(key);
        } else {
            selected.add(key);
        }
    }

    toggleSnapshot(key) {
        const selected = this.selectedSnapshots();
        if (selected.has(key)) {
            selected.delete(key);
        } else {
            selected.add(key);
        }
    }

    selectAllTimelines() {
        this.selectedTimelines.set(new Set(Object.keys(this.timelines())));
    }

    deselectAllTimelines() {
        this.selectedTimelines.set(new Set());
    }

    selectAllSnapshots() {
        this.selectedSnapshots.set(new Set(Object.keys(this.snapshots())));
    }

    deselectAllSnapshots() {
        this.selectedSnapshots.set(new Set());
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
