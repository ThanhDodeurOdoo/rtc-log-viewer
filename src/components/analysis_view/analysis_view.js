const { Component, signal, useEffect, computed, plugin, props, types } = owl;
import helpers from "../../utils/helpers.js";
import { NoData } from "../no_data/no_data.js";
import { IncidentCockpit } from "../incident_cockpit/incident_cockpit.js";
import { LogPlugin } from "../../plugins/log_plugin.js";
import { logWorkerService } from "../../services/log_worker_service.js";
import {
    buildDiagnosticReport,
    exportDiagnosticReport,
} from "../../services/diagnostic_report_service.js";

const ISSUE_SEVERITY_ORDER = {
    error: 0,
    warning: 1,
    info: 2,
};

export class AnalysisView extends Component {
    static template = "AnalysisView";

    static components = { NoData, IncidentCockpit };

    props = props({ activeView: types.signal() });

    setup() {
        this.log = plugin(LogPlugin);
        this.helpers = helpers;

        this.rawResults = signal.Array([]);
        this.groupedResults = signal.Array([]);
        this.isAnalyzing = signal(false);
        this.expandedIssues = signal.Object({});
        this.expandedInstances = signal.Object({});

        this.analysisRequestId = 0;

        this.hasLogData = computed(() => {
            const logs = this.log.filteredLogs();
            return logs && (logs.timelines || logs.snapshots);
        });

        useEffect(() => {
            const rawData = this.log.rawData();
            this.handleRawDataChange(rawData);
        });

        useEffect(() => {
            const rawData = this.log.rawData();
            const logs = this.log.filteredLogs();
            const timelineKeys = this.log.filteredTimelineKeys();
            const snapshotKeys = this.log.filteredSnapshotKeys();
            this.runAnalysis({
                rawData,
                logs,
                timelineKeys,
                snapshotKeys,
            });
        });
    }

    async handleRawDataChange(rawData) {
        if (!rawData) {
            this.analysisRequestId += 1;
            this.rawResults.set([]);
            this.groupedResults.set([]);
            return;
        }
        await logWorkerService.setLogData(rawData);
    }

    async runAnalysis({ rawData, logs, timelineKeys, snapshotKeys }) {
        const requestId = ++this.analysisRequestId;
        if (!rawData || !logs || (!logs.timelines && !logs.snapshots)) {
            this.rawResults.set([]);
            this.groupedResults.set([]);
            this.isAnalyzing.set(false);
            return;
        }

        this.isAnalyzing.set(true);
        try {
            const issues = await logWorkerService.analyzeSelection({
                selectedTimelines: timelineKeys,
                selectedSnapshots: snapshotKeys,
                fallbackLogs: logs,
            });
            if (requestId !== this.analysisRequestId) {
                return;
            }
            this.rawResults.set(issues);
            this.groupResults();
        } finally {
            if (requestId === this.analysisRequestId) {
                this.isAnalyzing.set(false);
            }
        }
    }

    groupResults() {
        const groups = new Map();
        for (const issue of this.rawResults()) {
            const key = issue.title;
            if (!groups.has(key)) {
                groups.set(key, {
                    type: issue.type,
                    title: issue.title,
                    description: issue.description,
                    errorCode: issue.errorCode,
                    recommendation: issue.recommendation,
                    count: 1,
                    instances: [issue],
                    ...issue,
                });
                continue;
            }
            const group = groups.get(key);
            group.count += 1;
            group.instances.push(issue);
        }

        const groupedArray = Array.from(groups.values());
        groupedArray.sort((a, b) => {
            const severityDiff =
                (ISSUE_SEVERITY_ORDER[a.type] ?? 3) -
                (ISSUE_SEVERITY_ORDER[b.type] ?? 3);
            if (severityDiff !== 0) {
                return severityDiff;
            }
            const countDiff = b.count - a.count;
            if (countDiff !== 0) {
                return countDiff;
            }
            return a.title.localeCompare(b.title);
        });
        this.groupedResults.set(groupedArray);
    }

    toggleIssueDetails(index) {
        const expanded = this.expandedIssues();
        expanded[index] = !expanded[index];
    }

    toggleInstanceDetails(groupIndex, instanceIndex) {
        const key = `${groupIndex}-${instanceIndex}`;
        const expanded = this.expandedInstances();
        expanded[key] = !expanded[key];
    }

    getRecommendation(issue) {
        return (
            issue.recommendation ||
            "Investigate the logs further for more context about this issue."
        );
    }

    canOpenTimeline(issue) {
        return Boolean(this.resolveTimelineKey(issue));
    }

    canOpenSnapshot(issue) {
        return Boolean(this.resolveSnapshotKey(issue));
    }

    openTimelineEvidence(issue) {
        const evidence = issue.evidence || {};
        const timelineKey = this.resolveTimelineKey(issue);
        if (!timelineKey) {
            return;
        }
        const selectedTimelines = this.log.selectedTimelines();
        if (!selectedTimelines.has(timelineKey)) {
            const updated = new Set(selectedTimelines);
            updated.add(timelineKey);
            this.log.selectedTimelines.set(updated);
        }
        this.log.focusTimeline({
            timelineKey,
            sessionId:
                evidence.sessionId ||
                (issue.sessionId !== undefined && issue.sessionId !== null
                    ? String(issue.sessionId)
                    : null),
            eventPattern: evidence.eventPattern || "",
            eventTime: evidence.eventTime || null,
        });
        this.props.activeView.set("timelines");
    }

    openSnapshotContext(issue) {
        const evidence = issue.evidence || {};
        const snapshotKey = this.resolveSnapshotKey(issue);
        if (!snapshotKey) {
            return;
        }
        const selectedSnapshots = this.log.selectedSnapshots();
        if (!selectedSnapshots.has(snapshotKey)) {
            const updated = new Set(selectedSnapshots);
            updated.add(snapshotKey);
            this.log.selectedSnapshots.set(updated);
        }
        this.log.focusSnapshot({
            snapshotKey,
            sessionId:
                evidence.sessionId ||
                (issue.sessionId !== undefined && issue.sessionId !== null
                    ? String(issue.sessionId)
                    : null),
        });
        this.props.activeView.set("snapshots");
    }

    resolveTimelineKey(issue) {
        const evidence = issue.evidence || {};
        if (evidence.timelineKey) {
            return evidence.timelineKey;
        }
        if (issue.timelineKey) {
            return issue.timelineKey;
        }
        if (issue.timestamp) {
            return this.findTimelineByTimestamp(issue.timestamp);
        }
        return null;
    }

    resolveSnapshotKey(issue) {
        const evidence = issue.evidence || {};
        if (evidence.snapshotKey) {
            return evidence.snapshotKey;
        }
        if (issue.timestamp) {
            return issue.timestamp;
        }
        if (issue.timelineKey) {
            return this.findNearestSnapshotKey(issue.timelineKey);
        }
        return null;
    }

    findTimelineByTimestamp(timestampKey) {
        const target = new Date(timestampKey);
        if (Number.isNaN(target.getTime())) {
            return null;
        }
        for (const [timelineKey, timeline] of Object.entries(
            this.log.timelines()
        )) {
            if (!timeline?.start) {
                continue;
            }
            const start = new Date(timeline.start);
            const end = timeline.end ? new Date(timeline.end) : null;
            if (Number.isNaN(start.getTime())) {
                continue;
            }
            const endTime = end && !Number.isNaN(end.getTime()) ? end : start;
            if (
                target.getTime() >= start.getTime() &&
                target.getTime() <= endTime.getTime()
            ) {
                return timelineKey;
            }
        }
        return null;
    }

    findNearestSnapshotKey(timelineKey) {
        const snapshotKeys = this.log.snapshotKeys();
        if (!snapshotKeys.length) {
            return null;
        }
        const target = new Date(timelineKey);
        if (Number.isNaN(target.getTime())) {
            return snapshotKeys[0];
        }
        let nearest = snapshotKeys[0];
        let nearestDistance = Infinity;
        for (const snapshotKey of snapshotKeys) {
            const candidate = new Date(snapshotKey);
            if (Number.isNaN(candidate.getTime())) {
                continue;
            }
            const distance = Math.abs(candidate.getTime() - target.getTime());
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = snapshotKey;
            }
        }
        return nearest;
    }

    exportReport(format) {
        const logs = this.log.filteredLogs();
        if (!logs) {
            return;
        }
        const report = buildDiagnosticReport({
            logs,
            issues: this.rawResults(),
            groupedIssues: this.groupedResults(),
            selectedTimelines: Array.from(this.log.selectedTimelines()),
            selectedSnapshots: Array.from(this.log.selectedSnapshots()),
        });
        exportDiagnosticReport(report, format);
    }
}
