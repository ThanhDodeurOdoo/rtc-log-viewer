const { Component, signal, useEffect, computed, plugin } = owl;
import helpers from "../../utils/helpers.js";
import { NoData } from "../no_data/no_data.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

const ISSUE_TYPES = {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
};

const ISSUE_CODES = {
    FALLBACK_MODE: 1001,
    RECOVERY_LOOP: 1002,
    SESSION_UNABLE_TO_CONNECT: 1003,
    ICE_CONNECTION_ISSUES: 1004,
    SFU_SERVER_ERROR: 1005,
    SFU_SERVER_ERROR_KNOWN: 1006,
    MEDIA_STREAM_ISSUES: 1007,
    FAILED_CONNECTION: 1008,
    NO_TURN_SERVER: 1009,
    USING_TURN_RELAY: 1010,
    MULTIPLE_ISSUES: 1012,
    SFU_LOAD_FAILED: 1013,
    SFU_CONNECT_TIMEOUT: 1014,
    SFU_CONNECT_STALLED: 1015,
    SFU_CONNECT_SLOW: 1016,
    SFU_CONNECTION_CLOSED: 1017,
    BROADCAST_CHANNEL_ISSUE: 1018,
    SELF_SESSION_REMOVED: 1019,
    ICE_CANDIDATE_MISSING_PEER: 1020,
    RECOVERY_CANDIDATE_STORM: 1021,
    AUDIO_ELEMENT_STALLED: 1022,
};

const RECOVERY_THRESHOLD = 3; // Number of recovery attempts that indicates a problem
const RECOVERY_CANDIDATE_THRESHOLD = 5;
const ICE_MISSING_PEER_THRESHOLD = 3;
const SFU_SLOW_CONNECT_MS = 5000;
const AUDIO_STALL_READY_STATE = 2;
const AUDIO_STALL_NETWORK_STATE = 3;
const ISO_EVENT_TIME_REGEX =
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/;

function extractEventDate(log, timelineKey) {
    if (!log || !log.event) {
        return null;
    }
    const match = log.event.match(ISO_EVENT_TIME_REGEX);
    if (match && match[1]) {
        const date = new Date(match[1]);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }
    const timeText = helpers.formatEventTime(log);
    if (!timeText) {
        return null;
    }
    const base = new Date(timelineKey);
    if (Number.isNaN(base.getTime())) {
        return null;
    }
    const [timePart, msText] = timeText.split(".");
    const [hours, minutes, seconds] = timePart.split(":").map(Number);
    if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
        return null;
    }
    const ms = Number(msText || 0);
    const date = new Date(
        Date.UTC(
            base.getUTCFullYear(),
            base.getUTCMonth(),
            base.getUTCDate(),
            hours,
            minutes,
            seconds,
            ms
        )
    );
    return Number.isNaN(date.getTime()) ? null : date;
}

export class AnalysisView extends Component {
    static template = "AnalysisView";

    static components = { NoData };
    setup() {
        this.log = plugin(LogPlugin);
        this.rawResults = signal.Array([]);
        this.groupedResults = signal.Array([]);
        this.isAnalyzing = signal(false);
        this.expandedIssues = signal.Object({});
        this.expandedInstances = signal.Object({});
        this.helpers = helpers;
        this.hasLogData = computed(() => {
            const logs = this.log.filteredLogs();
            return logs && (logs.timelines || logs.snapshots);
        });
        useEffect(() => {
            const logs = this.log.filteredLogs();
            if (!logs || (!logs.timelines && !logs.snapshots)) {
                this.rawResults.set([]);
                this.groupedResults.set([]);
                return;
            }
            this.analyzeData(logs);
        });
    }

    analyzeData(logs) {
        this.isAnalyzing.set(true);

        try {
            const results = [];
            this.checkFallbackMode(logs, results);
            this.checkRecoveryLoops(logs, results);
            this.checkRecoveryCandidates(logs, results);
            this.checkSfuLoadFailures(logs, results);
            this.checkSfuConnectionTimeouts(logs, results);
            this.checkSfuConnectionStalls(logs, results);
            this.checkSfuConnectionLatency(logs, results);
            this.checkSfuConnectionClosed(logs, results);
            this.checkBroadcastChannelIssues(logs, results);
            this.checkSelfSessionRemoved(logs, results);
            this.checkIceCandidateMissingPeer(logs, results);
            this.checkStuckSessions(logs, results);
            this.checkConnectionIssues(logs, results);
            this.checkCallQuality(logs, results);
            this.checkAudioElementIssues(logs, results);
            this.checkTurnServerUsage(logs, results);
            this.checkCandidateTypes(logs, results);

            this.sortResultsBySeverity(results);
            this.rawResults.set(results);
            this.groupResults();
        } finally {
            this.isAnalyzing.set(false);
        }
    }

    groupResults() {
        const results = this.rawResults();
        const groups = new Map();

        // Always group by title
        for (const issue of results) {
            // Generate a key based on title
            const key = issue.title;

            if (!groups.has(key)) {
                groups.set(key, {
                    // Copy basic issue properties
                    type: issue.type,
                    title: issue.title,
                    description: issue.description,
                    errorCode: issue.errorCode,
                    // Start tracking instances
                    count: 1,
                    instances: [issue],
                    // For single-instance display
                    ...issue,
                });
            } else {
                const group = groups.get(key);
                group.count++;
                group.instances.push(issue);
            }
        }

        // Convert the map to an array and sort
        const groupedArray = Array.from(groups.values());
        this.sortGroupsBySeverity(groupedArray);
        this.groupedResults.set(groupedArray);
    }

    sortResultsBySeverity(results) {
        const severity = {
            [ISSUE_TYPES.ERROR]: 0,
            [ISSUE_TYPES.WARNING]: 1,
            [ISSUE_TYPES.INFO]: 2,
        };

        results.sort((a, b) => severity[a.type] - severity[b.type]);
    }

    sortGroupsBySeverity(groups) {
        const severity = {
            [ISSUE_TYPES.ERROR]: 0,
            [ISSUE_TYPES.WARNING]: 1,
            [ISSUE_TYPES.INFO]: 2,
        };

        groups.sort((a, b) => {
            // First by severity
            const severityDiff = severity[a.type] - severity[b.type];
            if (severityDiff !== 0) {
                return severityDiff;
            }

            // Then by count (more occurrences first)
            const countDiff = b.count - a.count;
            if (countDiff !== 0) {
                return countDiff;
            }

            // Finally by title
            return a.title.localeCompare(b.title);
        });
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
        // Use errorCode for recommendations instead of title
        switch (issue.errorCode) {
            case ISSUE_CODES.FALLBACK_MODE:
                return "Check if the SFU server is running and accessible. Ensure firewall rules allow WebRTC traffic to the SFU server.";

            case ISSUE_CODES.RECOVERY_LOOP:
                return "Check for network stability issues. If behind a corporate firewall, ensure STUN/TURN or SFU servers are properly configured.";

            case ISSUE_CODES.SESSION_UNABLE_TO_CONNECT:
                return "This may indicate the user is behind a restrictive firewall or asymmetric NAT. Consider using TURN or SFU servers to facilitate the connection.";

            case ISSUE_CODES.ICE_CONNECTION_ISSUES:
                return "Check for network stability and ensure STUN/TURN or SFU servers are properly configured. Firewall rules may be blocking ICE connectivity.";

            case ISSUE_CODES.SFU_SERVER_ERROR:
                return "Check the SFU server logs for more details. Ensure the server has enough resources and is properly configured.";

            case ISSUE_CODES.MEDIA_STREAM_ISSUES:
                return "Check for camera/microphone permission issues. Ensure the devices are working properly and not being used by other applications.";

            case ISSUE_CODES.FAILED_CONNECTION:
                return "The connection attempt failed. Check network conditions, firewall settings, and ensure STUN/TURN or SFU servers are properly configured.";

            case ISSUE_CODES.NO_TURN_SERVER:
                return "Consider configuring TURN or SFU servers to improve connection reliability in restrictive network environments.";

            case ISSUE_CODES.USING_TURN_RELAY:
                return "The connection is using a TURN relay, which may result in higher latency. This is normal in restrictive network environments.";

            case ISSUE_CODES.MULTIPLE_ISSUES:
                return "This session has multiple issues. Review each instance for specific recommendations.";

            case ISSUE_CODES.SFU_SERVER_ERROR_KNOWN:
                return "This is a known issue and should not cause any problems.";

            case ISSUE_CODES.SFU_LOAD_FAILED:
                return "Failed to load SFU assets. Check asset availability, network access, and browser console errors.";

            case ISSUE_CODES.SFU_CONNECT_TIMEOUT:
                return "SFU connection timed out. Check SFU reachability and contact your SFU administrator.";

            case ISSUE_CODES.SFU_CONNECT_STALLED:
                return "SFU connection did not complete. Verify authentication, firewall rules, and SFU server health.";

            case ISSUE_CODES.SFU_CONNECT_SLOW:
                return "SFU connection was slow. Check network latency and SFU server load.";

            case ISSUE_CODES.SFU_CONNECTION_CLOSED:
                return "SFU connection closed by the server. Check server logs and capacity.";

            case ISSUE_CODES.BROADCAST_CHANNEL_ISSUE:
                return "Cross-tab sync failed. Ensure BroadcastChannel is available and not blocked by browser settings.";

            case ISSUE_CODES.SELF_SESSION_REMOVED:
                return "The server removed the session. Check for duplicate tabs or session cleanup on the server.";

            case ISSUE_CODES.ICE_CANDIDATE_MISSING_PEER:
                return "ICE candidates arrived for an unknown peer. This can indicate race conditions or stale notifications.";

            case ISSUE_CODES.RECOVERY_CANDIDATE_STORM:
                return "Frequent recovery candidates suggest unstable network conditions. Consider TURN/SFU usage.";

            case ISSUE_CODES.AUDIO_ELEMENT_STALLED:
                return "Audio element is not receiving data. Check autoplay policies, output device, and permissions.";

            default:
                return "Investigate the logs further for more context about this issue.";
        }
    }

    checkFallbackMode(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (snapshot.fallback === true) {
                results.push({
                    type: ISSUE_TYPES.WARNING,
                    errorCode: ISSUE_CODES.FALLBACK_MODE,
                    title: "Fallback Mode Detected",
                    description:
                        "The connection fell back to peer-to-peer mode after failing to establish or maintain an SFU connection.",
                    timestamp,
                    details: {
                        connectionType: snapshot.connectionType,
                        fallback: snapshot.fallback,
                    },
                });
            }
        }
    }

    checkRecoveryLoops(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                let recoveryAttempts = 0;
                let lastRecoveryTime = null;

                sessionData.logs.forEach((log) => {
                    const text = helpers.formatEventText(log);
                    if (text.includes("attempting to recover connection")) {
                        recoveryAttempts++;
                        lastRecoveryTime = helpers.formatEventTime(log);
                    }
                });

                if (recoveryAttempts >= RECOVERY_THRESHOLD) {
                    results.push({
                        type: ISSUE_TYPES.ERROR,
                        errorCode: ISSUE_CODES.RECOVERY_LOOP,
                        title: "Recovery Loop Detected",
                        description: `Session ${sessionId} made ${recoveryAttempts} recovery attempts, indicating persistent connection issues.`,
                        timelineKey,
                        sessionId,
                        details: {
                            recoveryAttempts,
                            lastRecoveryTime,
                        },
                    });
                }
            }
        }
    }

    checkRecoveryCandidates(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                let candidateCount = 0;
                let lastCandidateTime = null;

                sessionData.logs.forEach((log) => {
                    const text = helpers.formatEventText(log);
                    if (text.includes("connection recovery candidate")) {
                        candidateCount++;
                        lastCandidateTime = helpers.formatEventTime(log);
                    }
                });

                if (candidateCount >= RECOVERY_CANDIDATE_THRESHOLD) {
                    results.push({
                        type: ISSUE_TYPES.WARNING,
                        errorCode: ISSUE_CODES.RECOVERY_CANDIDATE_STORM,
                        title: "Frequent Recovery Candidates",
                        description: `Session ${sessionId} reported ${candidateCount} recovery candidates, suggesting unstable connectivity.`,
                        timelineKey,
                        sessionId,
                        details: {
                            candidateCount,
                            lastCandidateTime,
                        },
                    });
                }
            }
        }
    }

    checkSfuLoadFailures(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const selfSessionId = timeline.selfSessionId?.toString();
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            if (!sessionData?.logs) {
                continue;
            }

            for (const log of sessionData.logs) {
                if (!helpers.eventContains(log, "failed to load sfu server")) {
                    continue;
                }
                results.push({
                    type: ISSUE_TYPES.ERROR,
                    errorCode: ISSUE_CODES.SFU_LOAD_FAILED,
                    title: "SFU Assets Load Failed",
                    description: "Failed to load SFU assets and fell back to peer-to-peer.",
                    timelineKey,
                    sessionId: selfSessionId,
                    details: {
                        error: log.error,
                        eventTime: helpers.formatEventTime(log),
                    },
                });
                break;
            }
        }
    }

    checkSfuConnectionTimeouts(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const selfSessionId = timeline.selfSessionId?.toString();
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            if (!sessionData?.logs) {
                continue;
            }

            for (const log of sessionData.logs) {
                if (!helpers.eventContains(log, "sfu connection timeout")) {
                    continue;
                }
                results.push({
                    type: ISSUE_TYPES.ERROR,
                    errorCode: ISSUE_CODES.SFU_CONNECT_TIMEOUT,
                    title: "SFU Connection Timeout",
                    description: "The SFU connection timed out and the call likely fell back to P2P.",
                    timelineKey,
                    sessionId: selfSessionId,
                    details: {
                        eventTime: helpers.formatEventTime(log),
                    },
                });
                break;
            }
        }
    }

    checkSfuConnectionStalls(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const selfSessionId = timeline.selfSessionId?.toString();
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            if (!sessionData?.logs) {
                continue;
            }

            const logsArray = sessionData.logs;
            const loadLog = logsArray.find((log) =>
                helpers.eventContains(log, "loading sfu server")
            );
            if (!loadLog) {
                continue;
            }

            const hasTimeout = logsArray.some((log) =>
                helpers.eventContains(log, "sfu connection timeout")
            );
            const hasLoadFailure = logsArray.some((log) =>
                helpers.eventContains(log, "failed to load sfu server")
            );
            const connectedLog = logsArray.find((log) =>
                helpers.eventContains(log, "connection state change: connected")
            );
            if (hasTimeout || hasLoadFailure || connectedLog) {
                continue;
            }

            const lastStateLog = [...logsArray]
                .reverse()
                .find((log) => helpers.eventContains(log, "connection state change:"));
            const loadTime = extractEventDate(loadLog, timelineKey);
            const endTime = timeline.end ? new Date(timeline.end) : null;
            const duration =
                loadTime && endTime && !Number.isNaN(endTime.getTime())
                    ? endTime.getTime() - loadTime.getTime()
                    : null;

            results.push({
                type: ISSUE_TYPES.WARNING,
                errorCode: ISSUE_CODES.SFU_CONNECT_STALLED,
                title: "SFU Connection Stalled",
                description:
                    "SFU connection started but did not reach the connected state before the timeline ended.",
                timelineKey,
                sessionId: selfSessionId,
                details: {
                    lastState: lastStateLog ? helpers.formatEventText(lastStateLog) : null,
                    duration,
                },
            });
        }
    }

    checkSfuConnectionLatency(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const selfSessionId = timeline.selfSessionId?.toString();
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            if (!sessionData?.logs) {
                continue;
            }

            const logsArray = sessionData.logs;
            const loadLog = logsArray.find((log) =>
                helpers.eventContains(log, "loading sfu server")
            );
            const connectedLog = logsArray.find((log) =>
                helpers.eventContains(log, "connection state change: connected")
            );
            if (!loadLog || !connectedLog) {
                continue;
            }

            const loadTime = extractEventDate(loadLog, timelineKey);
            const connectedTime = extractEventDate(connectedLog, timelineKey);
            if (!loadTime || !connectedTime) {
                continue;
            }

            const duration = connectedTime.getTime() - loadTime.getTime();
            if (duration <= SFU_SLOW_CONNECT_MS) {
                continue;
            }

            results.push({
                type: ISSUE_TYPES.WARNING,
                errorCode: ISSUE_CODES.SFU_CONNECT_SLOW,
                title: "Slow SFU Connection",
                description: `SFU connection took ${helpers.formatDuration(duration)} to reach connected.`,
                timelineKey,
                sessionId: selfSessionId,
                details: {
                    duration,
                },
            });
        }
    }

    checkSfuConnectionClosed(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            const selfSessionId = timeline.selfSessionId?.toString();
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            if (!sessionData?.logs) {
                continue;
            }

            const logsArray = sessionData.logs;
            const hasSfuSignals = logsArray.some(
                (log) =>
                    log.cause !== undefined ||
                    helpers.eventContains(log, "loading sfu server") ||
                    helpers.eventContains(log, "connection state change: authenticated")
            );
            if (!hasSfuSignals) {
                continue;
            }

            const closedLog = logsArray.find((log) =>
                helpers.eventContains(log, "connection state change: closed")
            );
            if (!closedLog) {
                continue;
            }

            results.push({
                type: ISSUE_TYPES.WARNING,
                errorCode: ISSUE_CODES.SFU_CONNECTION_CLOSED,
                title: "SFU Connection Closed",
                description: "The SFU connection was closed by the server.",
                timelineKey,
                sessionId: selfSessionId,
                details: {
                    cause: closedLog.cause,
                    eventTime: helpers.formatEventTime(closedLog),
                },
            });
        }
    }

    checkBroadcastChannelIssues(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                const issueLog = sessionData.logs.find((log) => {
                    const text = helpers.formatEventText(log);
                    return (
                        text.includes("broadcast channel not available") ||
                        text.includes("failed to post message to broadcast channel")
                    );
                });

                if (!issueLog) {
                    continue;
                }

                results.push({
                    type: ISSUE_TYPES.WARNING,
                    errorCode: ISSUE_CODES.BROADCAST_CHANNEL_ISSUE,
                    title: "Broadcast Channel Issue",
                    description: "Cross-tab synchronization failed for RTC updates.",
                    timelineKey,
                    sessionId,
                    details: {
                        event: helpers.formatEventText(issueLog),
                        eventTime: helpers.formatEventTime(issueLog),
                    },
                });
            }
        }
    }

    checkSelfSessionRemoved(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                const issueLog = sessionData.logs.find((log) =>
                    helpers.eventContains(log, "self session deleted by the server, ending call")
                );
                if (!issueLog) {
                    continue;
                }

                results.push({
                    type: ISSUE_TYPES.ERROR,
                    errorCode: ISSUE_CODES.SELF_SESSION_REMOVED,
                    title: "Session Removed by Server",
                    description: "The server removed the current session and ended the call.",
                    timelineKey,
                    sessionId,
                    details: {
                        eventTime: helpers.formatEventTime(issueLog),
                    },
                });
            }
        }
    }

    checkIceCandidateMissingPeer(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        const missingPeerRegex = /received ice-candidate for missing peer (\d+)/;

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                const counts = new Map();
                let lastEventTime = null;

                sessionData.logs.forEach((log) => {
                    const text = helpers.formatEventText(log);
                    const match = text.match(missingPeerRegex);
                    if (!match) {
                        return;
                    }
                    const peerId = match[1];
                    counts.set(peerId, (counts.get(peerId) || 0) + 1);
                    lastEventTime = helpers.formatEventTime(log);
                });

                for (const [peerId, count] of counts.entries()) {
                    if (count < ICE_MISSING_PEER_THRESHOLD) {
                        continue;
                    }
                    results.push({
                        type: ISSUE_TYPES.WARNING,
                        errorCode: ISSUE_CODES.ICE_CANDIDATE_MISSING_PEER,
                        title: "ICE Candidates for Missing Peer",
                        description: `Received ${count} ICE candidates for missing peer ${peerId}.`,
                        timelineKey,
                        sessionId,
                        details: {
                            peerId,
                            count,
                            lastEventTime,
                        },
                    });
                }
            }
        }
    }

    checkStuckSessions(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (!snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                continue;
            }

            snapshot.sessions.forEach((session) => {
                // Check if session is stuck in 'new' or 'connecting' for a long time
                if (
                    (session.state === "new" || session.state === "searching for network") &&
                    session.peer &&
                    session.peer.state === "new"
                ) {
                    results.push({
                        type: ISSUE_TYPES.ERROR,
                        errorCode: ISSUE_CODES.SESSION_UNABLE_TO_CONNECT,
                        title: "Session Unable to Connect",
                        description: `Session ${session.id} appears to be stuck in the '${session.state}' state, indicating it may be behind a restrictive firewall or asymmetric NAT.`,
                        timestamp,
                        sessionId: session.id,
                        details: {
                            sessionState: session.state,
                            peerState: session.peer.state,
                        },
                    });
                }
            });
        }
    }

    checkAudioElementIssues(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (!snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                continue;
            }

            snapshot.sessions.forEach((session) => {
                if (!session.audio) {
                    return;
                }
                const isConnected =
                    session.state === "connected" || session.peer?.state === "connected";
                if (!isConnected) {
                    return;
                }
                const hasStalledReadyState =
                    typeof session.audio.state === "number" &&
                    session.audio.state <= AUDIO_STALL_READY_STATE;
                const hasNoSource = session.audio.networkState === AUDIO_STALL_NETWORK_STATE;
                if (!hasStalledReadyState && !hasNoSource) {
                    return;
                }
                results.push({
                    type: ISSUE_TYPES.WARNING,
                    errorCode: ISSUE_CODES.AUDIO_ELEMENT_STALLED,
                    title: "Audio Element Stalled",
                    description:
                        "Audio element reported no source or insufficient buffered data while connected.",
                    timestamp,
                    sessionId: session.id,
                    details: {
                        audio: session.audio,
                        state: session.state,
                        peerState: session.peer?.state,
                    },
                });
            });
        }
    }

    checkConnectionIssues(logs, results) {
        this.checkIceFailures(logs, results);
        this.checkSfuErrors(logs, results);
        this.checkMediaIssues(logs, results);
    }

    checkIceFailures(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                let iceFailures = 0;

                sessionData.logs.forEach((log) => {
                    const text = helpers.formatEventText(log);
                    if (
                        text.includes("ice connection") &&
                        (text.includes("failed") || text.includes("disconnected"))
                    ) {
                        iceFailures++;
                    }
                });

                if (iceFailures > 0) {
                    results.push({
                        type: ISSUE_TYPES.WARNING,
                        errorCode: ISSUE_CODES.ICE_CONNECTION_ISSUES,
                        title: "ICE Connection Issues",
                        description: `Session ${sessionId} experienced ICE connection failures, indicating potential network issues or firewall restrictions.`,
                        timelineKey,
                        sessionId,
                        details: {
                            iceFailures,
                        },
                    });
                }
            }
        }
    }

    checkSfuErrors(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (
                !snapshot.server ||
                !snapshot.server.errors ||
                !Array.isArray(snapshot.server.errors)
            ) {
                continue;
            }

            for (const error of snapshot.server.errors) {
                switch (error) {
                    case "Cannot read properties of undefined (reading 'produce')":
                        results.push({
                            type: ISSUE_TYPES.WARNING,
                            errorCode: ISSUE_CODES.SFU_SERVER_ERROR_KNOWN,
                            title: "SFU Server Error (known)",
                            description: "Eager usage of `updateUpload()`",
                            timestamp,
                        });
                        break;
                    default:
                        results.push({
                            type: ISSUE_TYPES.ERROR,
                            errorCode: ISSUE_CODES.SFU_SERVER_ERROR,
                            title: "SFU Server Error",
                            description: error,
                            timestamp,
                        });
                        break;
                }
            }
        }
    }

    checkMediaIssues(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (!snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                continue;
            }

            snapshot.sessions.forEach((session) => {
                if (session.audioError || session.videoError) {
                    results.push({
                        type: ISSUE_TYPES.WARNING,
                        errorCode: ISSUE_CODES.MEDIA_STREAM_ISSUES,
                        title: "Media Stream Issues",
                        description: `Session ${session.id} experienced issues with audio/video streams.`,
                        timestamp,
                        sessionId: session.id,
                        details: {
                            audioError: session.audioError,
                            videoError: session.videoError,
                        },
                    });
                }
            });
        }
    }

    checkCallQuality(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.entriesBySessionId) {
                continue;
            }

            // Check for sessions that didn't reach 'connected' state
            for (const [sessionId, sessionData] of Object.entries(timeline.entriesBySessionId)) {
                if (!sessionData.logs || !Array.isArray(sessionData.logs)) {
                    continue;
                }

                let reachedConnected = false;

                sessionData.logs.forEach((log) => {
                    const text = helpers.formatEventText(log);
                    if (text.includes("connection state change: connected")) {
                        reachedConnected = true;
                    }
                });

                if (!reachedConnected && sessionId !== timeline.selfSessionId?.toString()) {
                    results.push({
                        type: ISSUE_TYPES.ERROR,
                        errorCode: ISSUE_CODES.FAILED_CONNECTION,
                        title: "Failed Connection",
                        description: `Session ${sessionId} never reached the 'connected' state.`,
                        timelineKey,
                        sessionId,
                        details: {
                            reachedConnected: false,
                        },
                    });
                }
            }
        }
    }

    checkTurnServerUsage(logs, results) {
        const timelines = logs.timelines;
        if (!timelines) {
            return;
        }

        for (const [timelineKey, timeline] of Object.entries(timelines)) {
            if (!timeline.hasTurn) {
                results.push({
                    type: ISSUE_TYPES.INFO,
                    errorCode: ISSUE_CODES.NO_TURN_SERVER,
                    title: "No TURN Server Configured",
                    description:
                        "No TURN server was configured for this session. This may cause connection issues in restrictive network environments [THIS CAN BE IGNORED IF YOU ARE USING A SFU].",
                    timelineKey,
                    details: {
                        hasTurn: false,
                    },
                });
            }
        }
    }

    checkCandidateTypes(logs, results) {
        const snapshots = logs.snapshots;
        if (!snapshots) {
            return;
        }

        for (const [timestamp, snapshot] of Object.entries(snapshots)) {
            if (!snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                continue;
            }

            snapshot.sessions.forEach((session) => {
                // Check if relayed candidates are being used (indicating TURN usage)
                if (session.peer && session.peer.remoteCandidateType === "relay") {
                    results.push({
                        type: ISSUE_TYPES.INFO,
                        errorCode: ISSUE_CODES.USING_TURN_RELAY,
                        title: "Using TURN Relay",
                        description: `Session ${session.id} is using a TURN relay, indicating a restrictive network environment.`,
                        timestamp,
                        sessionId: session.id,
                        details: {
                            localCandidateType: session.peer.localCandidateType,
                            remoteCandidateType: session.peer.remoteCandidateType,
                        },
                    });
                }
            });
        }
    }
}
