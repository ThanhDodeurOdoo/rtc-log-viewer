const { Component, computed, plugin } = owl;
import helpers from "../../utils/helpers.js";
import { LogPlugin } from "../../plugins/log_plugin.js";
import { TrendCard } from "../trend_card/trend_card.js";

const HEALTH_STATE = {
    GOOD: "good",
    WARNING: "warning",
    CRITICAL: "critical",
};

const TREND_DEFINITIONS = [
    {
        label: "SFU Connect",
        kind: "duration",
        key: "sfuLatencyTrend",
    },
    {
        label: "P2P Connect",
        kind: "duration",
        key: "p2pLatencyTrend",
    },
    {
        label: "First Track Delay",
        kind: "duration",
        key: "firstTrackTrend",
    },
    {
        label: "Recovery Attempts",
        kind: "count",
        key: "recoveryTrend",
    },
    {
        label: "Error Events",
        kind: "count",
        key: "errorTrend",
    },
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function average(values) {
    if (!values.length) {
        return null;
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
}

function lastNumber(values) {
    for (let index = values.length - 1; index >= 0; index--) {
        if (Number.isFinite(values[index])) {
            return values[index];
        }
    }
    return null;
}

function getSessionLogs(sessionData) {
    if (!sessionData?.logs || !Array.isArray(sessionData.logs)) {
        return [];
    }
    return sessionData.logs;
}

function createAccumulator() {
    return {
        attemptedTimelines: 0,
        failedTimelines: 0,
        sfuTimelines: 0,
        p2pTimelines: 0,
        recoveryAttempts: 0,
        missingPeerIce: 0,
        sfuTimeouts: 0,
        sfuLoadFailures: 0,
        totalErrorEvents: 0,
        totalEvents: 0,
        sfuLatencyTrend: [],
        p2pLatencyTrend: [],
        firstTrackTrend: [],
        recoveryTrend: [],
        errorTrend: [],
    };
}

function findSfuConnectionSample({
    timelineKey,
    entriesBySessionId,
    selfSessionId,
}) {
    const selfSession = selfSessionId
        ? entriesBySessionId[selfSessionId]
        : null;
    const selfLogs = getSessionLogs(selfSession);
    const hasSfuAttempt = selfLogs.some((log) =>
        helpers.eventContains(log, "loading sfu server")
    );
    const connectedLog = selfLogs.find(
        (log) =>
            helpers.eventContains(log, "connection state change: connected") &&
            !log.level
    );
    const loadLog = selfLogs.find((log) =>
        helpers.eventContains(log, "loading sfu server")
    );

    let durationMs = null;
    let firstTrackMs = null;
    if (loadLog && connectedLog) {
        const loadTime = helpers.extractEventDate(loadLog, timelineKey);
        const connectedTime = helpers.extractEventDate(connectedLog, timelineKey);
        if (
            loadTime &&
            connectedTime &&
            connectedTime.getTime() >= loadTime.getTime()
        ) {
            durationMs = connectedTime.getTime() - loadTime.getTime();
            firstTrackMs = findFirstTrackDelay({
                entriesBySessionId,
                timelineKey,
                connectedTime,
                eventPattern: "track received (server)",
            });
        }
    }

    return {
        hasSfuAttempt,
        hasSfuConnected: Boolean(connectedLog),
        durationMs,
        firstTrackMs,
    };
}

function findFirstTrackDelay({
    entriesBySessionId,
    timelineKey,
    connectedTime,
    eventPattern,
}) {
    let earliestTrackTime = null;
    for (const sessionData of Object.values(entriesBySessionId)) {
        for (const log of getSessionLogs(sessionData)) {
            if (!helpers.eventContains(log, eventPattern)) {
                continue;
            }
            const trackTime = helpers.extractEventDate(log, timelineKey);
            if (
                !trackTime ||
                trackTime.getTime() < connectedTime.getTime()
            ) {
                continue;
            }
            if (
                !earliestTrackTime ||
                trackTime.getTime() < earliestTrackTime.getTime()
            ) {
                earliestTrackTime = trackTime;
            }
        }
    }
    if (!earliestTrackTime) {
        return null;
    }
    return earliestTrackTime.getTime() - connectedTime.getTime();
}

function findP2pConnectionSample({ entriesBySessionId, timelineKey }) {
    for (const sessionData of Object.values(entriesBySessionId)) {
        const logs = getSessionLogs(sessionData);
        if (!logs.length) {
            continue;
        }
        const isP2pSession =
            sessionData.step === "p2p" || logs.some((log) => Boolean(log.level));
        if (!isP2pSession) {
            continue;
        }
        const startAndConnected = findP2pStartAndConnected(logs);
        if (!startAndConnected) {
            continue;
        }
        const { startLog, connectedLog } = startAndConnected;
        const startTime = helpers.extractEventDate(startLog, timelineKey);
        const connectedTime = helpers.extractEventDate(connectedLog, timelineKey);
        if (
            !startTime ||
            !connectedTime ||
            connectedTime.getTime() < startTime.getTime()
        ) {
            continue;
        }
        const durationMs = connectedTime.getTime() - startTime.getTime();
        const firstTrackMs = findFirstTrackDelay({
            entriesBySessionId: { current: sessionData },
            timelineKey,
            connectedTime,
            eventPattern: "track received (p2p)",
        });
        return {
            hasP2pAttempt: true,
            durationMs,
            firstTrackMs,
        };
    }
    return {
        hasP2pAttempt: false,
        durationMs: null,
        firstTrackMs: null,
    };
}

function findP2pStartAndConnected(logs) {
    let startLog = null;
    for (const log of logs) {
        const text = helpers.formatEventText(log);
        if (!startLog) {
            if (
                text.includes("gathering state change: gathering") ||
                text.includes("connection state change: connecting")
            ) {
                startLog = log;
                continue;
            }
            if (text.includes("connection state change: connected")) {
                return { startLog: log, connectedLog: log };
            }
        }
        if (startLog && text.includes("connection state change: connected")) {
            return { startLog, connectedLog: log };
        }
    }
    return null;
}

function collectTimelineEventStats(entriesBySessionId) {
    const stats = {
        timelineRecoveryAttempts: 0,
        timelineErrorCount: 0,
        missingPeerIce: 0,
        sfuTimeouts: 0,
        sfuLoadFailures: 0,
        totalEvents: 0,
    };
    for (const sessionData of Object.values(entriesBySessionId)) {
        for (const log of getSessionLogs(sessionData)) {
            stats.totalEvents += 1;
            const text = helpers.formatEventText(log);
            if (text.includes("attempting to recover connection")) {
                stats.timelineRecoveryAttempts += 1;
            }
            if (text.includes("received ice-candidate for missing peer")) {
                stats.missingPeerIce += 1;
            }
            if (text.includes("sfu connection timeout")) {
                stats.sfuTimeouts += 1;
            }
            if (text.includes("failed to load sfu server")) {
                stats.sfuLoadFailures += 1;
            }
            if (helpers.getEventSeverity(log) === "error") {
                stats.timelineErrorCount += 1;
            }
        }
    }
    return stats;
}

function collectTimelineSummary({ accumulator, timelineKey, timeline }) {
    const entriesBySessionId = timeline.entriesBySessionId || {};
    const selfSessionId = timeline.selfSessionId?.toString();
    const sfuSample = findSfuConnectionSample({
        timelineKey,
        entriesBySessionId,
        selfSessionId,
    });
    const p2pSample = sfuSample.hasSfuAttempt
        ? { hasP2pAttempt: false, durationMs: null, firstTrackMs: null }
        : findP2pConnectionSample({ entriesBySessionId, timelineKey });
    const eventStats = collectTimelineEventStats(entriesBySessionId);

    updateAttemptCounters({
        accumulator,
        sfuSample,
        p2pSample,
    });
    updateTrendData({
        accumulator,
        sfuSample,
        p2pSample,
        eventStats,
    });
    updateEventCounters({ accumulator, eventStats });
}

function updateAttemptCounters({ accumulator, sfuSample, p2pSample }) {
    if (sfuSample.hasSfuAttempt) {
        accumulator.sfuTimelines += 1;
        accumulator.attemptedTimelines += 1;
    }
    if (!sfuSample.hasSfuAttempt && p2pSample.hasP2pAttempt) {
        accumulator.p2pTimelines += 1;
        accumulator.attemptedTimelines += 1;
    }
    if (
        (sfuSample.hasSfuAttempt && !sfuSample.hasSfuConnected) ||
        (!sfuSample.hasSfuAttempt &&
            p2pSample.hasP2pAttempt &&
            !Number.isFinite(p2pSample.durationMs))
    ) {
        accumulator.failedTimelines += 1;
    }
}

function updateTrendData({ accumulator, sfuSample, p2pSample, eventStats }) {
    accumulator.sfuLatencyTrend.push(sfuSample.durationMs);
    accumulator.p2pLatencyTrend.push(p2pSample.durationMs);
    accumulator.firstTrackTrend.push(
        sfuSample.firstTrackMs ?? p2pSample.firstTrackMs ?? null
    );
    accumulator.recoveryTrend.push(eventStats.timelineRecoveryAttempts);
    accumulator.errorTrend.push(eventStats.timelineErrorCount);
}

function updateEventCounters({ accumulator, eventStats }) {
    accumulator.recoveryAttempts += eventStats.timelineRecoveryAttempts;
    accumulator.totalErrorEvents += eventStats.timelineErrorCount;
    accumulator.missingPeerIce += eventStats.missingPeerIce;
    accumulator.sfuTimeouts += eventStats.sfuTimeouts;
    accumulator.sfuLoadFailures += eventStats.sfuLoadFailures;
    accumulator.totalEvents += eventStats.totalEvents;
}

function countFallbackSnapshots(snapshots) {
    return Object.values(snapshots || {}).reduce(
        (count, snapshot) => (snapshot?.fallback ? count + 1 : count),
        0
    );
}

function computeHealth({ accumulator, timelineCount, snapshotCount, fallbackSnapshots }) {
    const failureRate =
        accumulator.attemptedTimelines > 0
            ? accumulator.failedTimelines / accumulator.attemptedTimelines
            : 0;
    const recoveryRate = accumulator.recoveryAttempts / Math.max(1, timelineCount);
    const timeoutRate = accumulator.sfuTimeouts / Math.max(1, timelineCount);
    const errorRate =
        accumulator.totalErrorEvents / Math.max(1, accumulator.totalEvents);
    const fallbackRate = fallbackSnapshots / Math.max(1, snapshotCount);
    const rawScore =
        100 -
        failureRate * 55 -
        recoveryRate * 16 -
        timeoutRate * 14 -
        errorRate * 28 -
        fallbackRate * 12;
    const healthScore = Math.round(clamp(rawScore, 0, 100));
    const healthState =
        healthScore >= 85
            ? HEALTH_STATE.GOOD
            : healthScore >= 65
              ? HEALTH_STATE.WARNING
              : HEALTH_STATE.CRITICAL;
    return {
        failureRate,
        healthScore,
        healthState,
    };
}

function buildAnomalies({ accumulator, fallbackSnapshots }) {
    return [
        { label: "Recovery Attempts", count: accumulator.recoveryAttempts },
        { label: "SFU Timeouts", count: accumulator.sfuTimeouts },
        { label: "Missing Peer ICE", count: accumulator.missingPeerIce },
        { label: "SFU Load Failures", count: accumulator.sfuLoadFailures },
        { label: "Fallback Snapshots", count: fallbackSnapshots },
    ]
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
}

function buildTrends(accumulator) {
    return TREND_DEFINITIONS.map((definition) => {
        const values = accumulator[definition.key] || [];
        const numericValues = values.filter((value) => Number.isFinite(value));
        return {
            label: definition.label,
            kind: definition.kind,
            values,
            latest: lastNumber(values),
            avg: average(numericValues),
            sampleCount: numericValues.length,
        };
    });
}

function getEmptyMetrics() {
    return {
        healthScore: 100,
        healthState: HEALTH_STATE.GOOD,
        failureRateText: "n/a",
        sfuTimelines: 0,
        p2pTimelines: 0,
        anomalies: [],
        trends: buildTrends(createAccumulator()),
    };
}

function computeCockpitMetrics(logs) {
    if (!logs?.timelines) {
        return getEmptyMetrics();
    }
    const timelineKeys = Object.keys(logs.timelines).sort();
    if (!timelineKeys.length) {
        return getEmptyMetrics();
    }
    const accumulator = createAccumulator();
    for (const timelineKey of timelineKeys) {
        collectTimelineSummary({
            accumulator,
            timelineKey,
            timeline: logs.timelines[timelineKey],
        });
    }
    const snapshotCount = Object.keys(logs.snapshots || {}).length;
    const fallbackSnapshots = countFallbackSnapshots(logs.snapshots);
    const health = computeHealth({
        accumulator,
        timelineCount: timelineKeys.length,
        snapshotCount,
        fallbackSnapshots,
    });
    return {
        healthScore: health.healthScore,
        healthState: health.healthState,
        failureRateText:
            accumulator.attemptedTimelines > 0
                ? `${(health.failureRate * 100).toFixed(1)}% (${accumulator.failedTimelines}/${accumulator.attemptedTimelines})`
                : "n/a",
        sfuTimelines: accumulator.sfuTimelines,
        p2pTimelines: accumulator.p2pTimelines,
        anomalies: buildAnomalies({ accumulator, fallbackSnapshots }),
        trends: buildTrends(accumulator),
    };
}

export class IncidentCockpit extends Component {
    static template = "IncidentCockpit";

    static components = { TrendCard };

    setup() {
        this.log = plugin(LogPlugin);
        this.metrics = computed(() => computeCockpitMetrics(this.log.filteredLogs()));
    }
}
