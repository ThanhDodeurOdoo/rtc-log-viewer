const { Component, signal, useEffect, computed, plugin } = owl;
import helpers from "../../utils/helpers.js";
import { NoData } from "../no_data/no_data.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

function getPercentile(sortedValues, percentile) {
    if (!sortedValues.length) {
        return null;
    }
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
        return sortedValues[lower];
    }
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function buildStats(values) {
    if (!values.length) {
        return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const total = values.reduce((sum, value) => sum + value, 0);
    const avg = total / values.length;
    return {
        count: values.length,
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        avgMs: avg,
        medianMs: getPercentile(sorted, 0.5),
        p95Ms: getPercentile(sorted, 0.95),
    };
}

function buildTimingSummary(samples) {
    if (!samples.length) {
        return null;
    }
    const durations = samples.map((sample) => sample.durationMs);
    const sorted = [...samples].sort((a, b) => a.durationMs - b.durationMs);
    return {
        stats: buildStats(durations),
        fastest: sorted.slice(0, 3),
        slowest: sorted.slice(-3).reverse(),
        samples: sorted,
    };
}

export class TimingView extends Component {
    static template = "TimingView";

    static components = { NoData };

    setup() {
        this.log = plugin(LogPlugin);
        this.isAnalyzing = signal(false);
        this.timingStats = signal.Object({ sfu: null, p2p: null });
        this.helpers = helpers;
        this.hasLogData = computed(() => {
            const logs = this.log.filteredLogs();
            return logs && (logs.timelines || logs.snapshots);
        });

        useEffect(() => {
            const logs = this.log.filteredLogs();
            if (!logs || (!logs.timelines && !logs.snapshots)) {
                this.timingStats.set({ sfu: null, p2p: null });
                return;
            }
            this.analyzeTiming(logs);
        });
    }

    analyzeTiming(logs) {
        this.isAnalyzing.set(true);
        try {
            this.timingStats.set(this.computeTimingStats(logs));
        } finally {
            this.isAnalyzing.set(false);
        }
    }

    computeTimingStats(logs) {
        const timelines = logs.timelines;
        if (!timelines) {
            return { sfu: null, p2p: null };
        }

        const sfuSamples = [];
        const p2pSamples = [];

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const entriesBySessionId = timeline.entriesBySessionId || {};
            const selfSessionId = timeline.selfSessionId?.toString();
            const selfSession = selfSessionId ? entriesBySessionId[selfSessionId] : null;

            if (selfSession?.logs?.length) {
                let loadLog = null;
                let connectedLog = null;
                for (const log of selfSession.logs) {
                    if (!loadLog && helpers.eventContains(log, "loading sfu server")) {
                        loadLog = log;
                        continue;
                    }
                    if (
                        loadLog &&
                        helpers.eventContains(log, "connection state change: connected") &&
                        !log.level
                    ) {
                        connectedLog = log;
                        break;
                    }
                }

                if (loadLog && connectedLog) {
                    const loadTime = helpers.extractEventDate(loadLog, timelineKey);
                    const connectedTime = helpers.extractEventDate(connectedLog, timelineKey);
                    if (
                        loadTime &&
                        connectedTime &&
                        connectedTime.getTime() >= loadTime.getTime()
                    ) {
                        sfuSamples.push({
                            timelineKey,
                            sessionId: selfSessionId,
                            durationMs: connectedTime.getTime() - loadTime.getTime(),
                            startEvent: helpers.formatEventText(loadLog),
                            endEvent: helpers.formatEventText(connectedLog),
                        });
                    }
                }
            }

            for (const [sessionId, sessionData] of Object.entries(entriesBySessionId)) {
                if (!sessionData?.logs?.length) {
                    continue;
                }
                const isP2pSession =
                    sessionData.step === "p2p" || sessionData.logs.some((log) => log.level);
                if (!isP2pSession) {
                    continue;
                }
                let startLog = null;
                let connectedLog = null;
                for (const log of sessionData.logs) {
                    const text = helpers.formatEventText(log);
                    if (!startLog) {
                        if (text.includes("gathering state change: gathering")) {
                            startLog = log;
                            continue;
                        }
                        if (text.includes("connection state change: connecting")) {
                            startLog = log;
                            continue;
                        }
                    }
                    if (startLog && text.includes("connection state change: connected")) {
                        connectedLog = log;
                        break;
                    }
                }
                if (startLog && connectedLog) {
                    const startTime = helpers.extractEventDate(startLog, timelineKey);
                    const connectedTime = helpers.extractEventDate(connectedLog, timelineKey);
                    if (
                        startTime &&
                        connectedTime &&
                        connectedTime.getTime() >= startTime.getTime()
                    ) {
                        p2pSamples.push({
                            timelineKey,
                            sessionId,
                            durationMs: connectedTime.getTime() - startTime.getTime(),
                            startEvent: helpers.formatEventText(startLog),
                            endEvent: helpers.formatEventText(connectedLog),
                        });
                    }
                }
            }
        }

        return {
            sfu: buildTimingSummary(sfuSamples),
            p2p: buildTimingSummary(p2pSamples),
        };
    }
}
