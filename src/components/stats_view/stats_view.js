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

function formatRate(connected, attempted) {
    if (!attempted) {
        return "n/a";
    }
    return `${((connected / attempted) * 100).toFixed(1)}%`;
}

export class StatsView extends Component {
    static template = "StatsView";

    static components = { NoData };

    setup() {
        this.log = plugin(LogPlugin);
        this.isAnalyzing = signal(false);
        this.statsData = signal.Object({
            timing: { sfu: null, p2p: null, sfuFirstTrack: null, p2pFirstTrack: null },
            success: {
                sfu: { attempted: 0, connected: 0, rate: "n/a" },
                p2p: { attempted: 0, connected: 0, rate: "n/a" },
                p2pExcluded: 0,
            },
            events: {
                recoveryAttempts: 0,
                recoveryCandidates: 0,
                missingPeerIce: 0,
                sfuLoadFailures: 0,
                sfuTimeouts: 0,
                trackReceived: 0,
            },
            totals: {
                timelines: 0,
                sessionEntries: 0,
            },
        });
        this.helpers = helpers;
        this.hasLogData = computed(() => {
            const logs = this.log.filteredLogs();
            return logs && (logs.timelines || logs.snapshots);
        });

        useEffect(() => {
            const logs = this.log.filteredLogs();
            if (!logs || (!logs.timelines && !logs.snapshots)) {
                this.statsData.set({
                    timing: { sfu: null, p2p: null, sfuFirstTrack: null, p2pFirstTrack: null },
                    success: {
                        sfu: { attempted: 0, connected: 0, rate: "n/a" },
                        p2p: { attempted: 0, connected: 0, rate: "n/a" },
                        p2pExcluded: 0,
                    },
                    events: {
                        recoveryAttempts: 0,
                        recoveryCandidates: 0,
                        missingPeerIce: 0,
                        sfuLoadFailures: 0,
                        sfuTimeouts: 0,
                        trackReceived: 0,
                    },
                    totals: {
                        timelines: 0,
                        sessionEntries: 0,
                    },
                });
                return;
            }
            this.analyzeStats(logs);
        });
    }

    analyzeStats(logs) {
        this.isAnalyzing.set(true);
        try {
            this.statsData.set(this.computeStats(logs));
        } finally {
            this.isAnalyzing.set(false);
        }
    }

    formatRate(connected, attempted) {
        return formatRate(connected, attempted);
    }

    computeStats(logs) {
        const timelines = logs.timelines;
        if (!timelines) {
            return {
                timing: { sfu: null, p2p: null, sfuFirstTrack: null, p2pFirstTrack: null },
                success: {
                    sfu: { attempted: 0, connected: 0, rate: "n/a" },
                    p2p: { attempted: 0, connected: 0, rate: "n/a" },
                    p2pExcluded: 0,
                },
                events: {
                    recoveryAttempts: 0,
                    recoveryCandidates: 0,
                    missingPeerIce: 0,
                    sfuLoadFailures: 0,
                    sfuTimeouts: 0,
                    trackReceived: 0,
                },
                totals: {
                    timelines: 0,
                    sessionEntries: 0,
                },
            };
        }

        const sfuSamples = [];
        const p2pSamples = [];
        const sfuFirstTrackSamples = [];
        const p2pFirstTrackSamples = [];
        const success = {
            sfu: { attempted: 0, connected: 0, rate: "n/a" },
            p2p: { attempted: 0, connected: 0, rate: "n/a" },
            p2pExcluded: 0,
        };
        const events = {
            recoveryAttempts: 0,
            recoveryCandidates: 0,
            missingPeerIce: 0,
            sfuLoadFailures: 0,
            sfuTimeouts: 0,
            trackReceived: 0,
        };
        const totals = {
            timelines: Object.keys(timelines).length,
            sessionEntries: 0,
        };

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const entriesBySessionId = timeline.entriesBySessionId || {};
            totals.sessionEntries += Object.keys(entriesBySessionId).length;
            const selfSessionId = timeline.selfSessionId?.toString();
            const selfSession = selfSessionId ? entriesBySessionId[selfSessionId] : null;
            const hasSfuAttempt = Boolean(
                selfSession?.logs?.some((log) => helpers.eventContains(log, "loading sfu server"))
            );

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

                if (hasSfuAttempt) {
                    success.sfu.attempted += 1;
                    if (connectedLog) {
                        success.sfu.connected += 1;
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

                if (hasSfuAttempt && connectedLog) {
                    const connectedTime = helpers.extractEventDate(connectedLog, timelineKey);
                    if (connectedTime) {
                        let firstTrackLog = null;
                        for (const sessionData of Object.values(entriesBySessionId)) {
                            if (!sessionData?.logs?.length) {
                                continue;
                            }
                            for (const log of sessionData.logs) {
                                if (!helpers.eventContains(log, "track received (server)")) {
                                    continue;
                                }
                                const logTime = helpers.extractEventDate(log, timelineKey);
                                if (!logTime || logTime.getTime() < connectedTime.getTime()) {
                                    continue;
                                }
                                if (!firstTrackLog) {
                                    firstTrackLog = { log, time: logTime };
                                } else if (logTime.getTime() < firstTrackLog.time.getTime()) {
                                    firstTrackLog = { log, time: logTime };
                                }
                            }
                        }
                        if (firstTrackLog) {
                            sfuFirstTrackSamples.push({
                                timelineKey,
                                sessionId: selfSessionId,
                                durationMs: firstTrackLog.time.getTime() - connectedTime.getTime(),
                                startEvent: helpers.formatEventText(connectedLog),
                                endEvent: helpers.formatEventText(firstTrackLog.log),
                            });
                        }
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
                if (hasSfuAttempt) {
                    success.p2pExcluded += 1;
                    continue;
                }
                let startLog = null;
                let connectedLog = null;
                let hadAttempt = false;
                for (const log of sessionData.logs) {
                    const text = helpers.formatEventText(log);
                    if (!startLog) {
                        if (text.includes("gathering state change: gathering")) {
                            startLog = log;
                            hadAttempt = true;
                            continue;
                        }
                        if (text.includes("connection state change: connecting")) {
                            startLog = log;
                            hadAttempt = true;
                            continue;
                        }
                    }
                    if (startLog && text.includes("connection state change: connected")) {
                        connectedLog = log;
                        break;
                    }
                    if (!hadAttempt && text.includes("connection state change: connected")) {
                        hadAttempt = true;
                        connectedLog = log;
                        startLog = log;
                        break;
                    }
                }
                if (hadAttempt) {
                    success.p2p.attempted += 1;
                    if (connectedLog) {
                        success.p2p.connected += 1;
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

                        let firstTrackLog = null;
                        for (const log of sessionData.logs) {
                            if (!helpers.eventContains(log, "track received (p2p)")) {
                                continue;
                            }
                            const logTime = helpers.extractEventDate(log, timelineKey);
                            if (!logTime || logTime.getTime() < connectedTime.getTime()) {
                                continue;
                            }
                            if (!firstTrackLog) {
                                firstTrackLog = { log, time: logTime };
                            } else if (logTime.getTime() < firstTrackLog.time.getTime()) {
                                firstTrackLog = { log, time: logTime };
                            }
                        }
                        if (firstTrackLog) {
                            p2pFirstTrackSamples.push({
                                timelineKey,
                                sessionId,
                                durationMs: firstTrackLog.time.getTime() - connectedTime.getTime(),
                                startEvent: helpers.formatEventText(connectedLog),
                                endEvent: helpers.formatEventText(firstTrackLog.log),
                            });
                        }
                    }
                }
            }

            for (const sessionData of Object.values(entriesBySessionId)) {
                if (!sessionData?.logs?.length) {
                    continue;
                }
                for (const log of sessionData.logs) {
                    const text = helpers.formatEventText(log);
                    if (text.includes("attempting to recover connection")) {
                        events.recoveryAttempts += 1;
                    }
                    if (text.includes("connection recovery candidate")) {
                        events.recoveryCandidates += 1;
                    }
                    if (text.includes("received ice-candidate for missing peer")) {
                        events.missingPeerIce += 1;
                    }
                    if (text.includes("failed to load sfu server")) {
                        events.sfuLoadFailures += 1;
                    }
                    if (text.includes("sfu connection timeout")) {
                        events.sfuTimeouts += 1;
                    }
                    if (text.includes("track received")) {
                        events.trackReceived += 1;
                    }
                }
            }
        }

        success.sfu.rate = formatRate(success.sfu.connected, success.sfu.attempted);
        success.p2p.rate = formatRate(success.p2p.connected, success.p2p.attempted);

        return {
            timing: {
                sfu: buildTimingSummary(sfuSamples),
                p2p: buildTimingSummary(p2pSamples),
                sfuFirstTrack: buildTimingSummary(sfuFirstTrackSamples),
                p2pFirstTrack: buildTimingSummary(p2pFirstTrackSamples),
            },
            success,
            events,
            totals,
        };
    }
}
