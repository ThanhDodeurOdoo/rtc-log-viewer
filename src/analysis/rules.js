import helpers from "../utils/helpers.js";
import { ANALYSIS_THRESHOLDS, ISSUE_CODES, ISSUE_TYPES } from "./constants.js";

const MISSING_PEER_REGEX = /received ice-candidate for missing peer (\d+)/;
const KNOWN_SFU_ERROR =
    "Cannot read properties of undefined (reading 'produce')";

function isLogCollection(logs) {
    return Array.isArray(logs) && logs.length > 0;
}

function getSessionLogs(sessionData) {
    return isLogCollection(sessionData?.logs) ? sessionData.logs : [];
}

function forEachTimeline(logs, iteratee) {
    for (const [timelineKey, timeline] of Object.entries(logs.timelines || {})) {
        iteratee({ timelineKey, timeline });
    }
}

function forEachTimelineSession(logs, iteratee) {
    forEachTimeline(logs, ({ timelineKey, timeline }) => {
        const entries = timeline?.entriesBySessionId || {};
        for (const [sessionId, sessionData] of Object.entries(entries)) {
            iteratee({ timelineKey, timeline, sessionId, sessionData });
        }
    });
}

function forEachSnapshot(logs, iteratee) {
    for (const [timestamp, snapshot] of Object.entries(logs.snapshots || {})) {
        iteratee({ timestamp, snapshot });
    }
}

function forEachSnapshotSession(logs, iteratee) {
    forEachSnapshot(logs, ({ timestamp, snapshot }) => {
        if (!Array.isArray(snapshot?.sessions)) {
            return;
        }
        for (const session of snapshot.sessions) {
            iteratee({ timestamp, snapshot, session });
        }
    });
}

function makeRule({
    id,
    errorCode,
    severity,
    title,
    recommendation,
    evidencePattern = "",
    detect,
}) {
    return {
        id,
        errorCode,
        severity,
        title,
        recommendation,
        evidencePattern,
        detect,
    };
}

const fallbackModeRule = makeRule({
    id: "fallback_mode",
    errorCode: ISSUE_CODES.FALLBACK_MODE,
    severity: ISSUE_TYPES.WARNING,
    title: "Fallback Mode Detected",
    recommendation:
        "Check if the SFU server is running and accessible. Ensure firewall rules allow WebRTC traffic to the SFU server.",
    evidencePattern: "using peer-to-peer",
    detect(logs) {
        const results = [];
        forEachSnapshot(logs, ({ timestamp, snapshot }) => {
            if (snapshot?.fallback !== true) {
                return;
            }
            results.push({
                timestamp,
                description:
                    "The connection fell back to peer-to-peer mode after failing to establish or maintain an SFU connection.",
                details: {
                    connectionType: snapshot.connectionType,
                    fallback: snapshot.fallback,
                },
            });
        });
        return results;
    },
});

const recoveryLoopRule = makeRule({
    id: "recovery_loop",
    errorCode: ISSUE_CODES.RECOVERY_LOOP,
    severity: ISSUE_TYPES.ERROR,
    title: "Recovery Loop Detected",
    recommendation:
        "Check for network stability issues. If behind a corporate firewall, ensure STUN/TURN or SFU servers are properly configured.",
    evidencePattern: "attempting to recover connection",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            let recoveryAttempts = 0;
            let lastRecoveryTime = null;
            for (const log of sessionLogs) {
                const text = helpers.formatEventText(log);
                if (text.includes("attempting to recover connection")) {
                    recoveryAttempts += 1;
                    lastRecoveryTime = helpers.formatEventTime(log);
                }
            }
            if (recoveryAttempts < ANALYSIS_THRESHOLDS.RECOVERY_THRESHOLD) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description: `Session ${sessionId} made ${recoveryAttempts} recovery attempts, indicating persistent connection issues.`,
                details: {
                    recoveryAttempts,
                    lastRecoveryTime,
                },
            });
        });
        return results;
    },
});

const recoveryCandidateStormRule = makeRule({
    id: "recovery_candidate_storm",
    errorCode: ISSUE_CODES.RECOVERY_CANDIDATE_STORM,
    severity: ISSUE_TYPES.WARNING,
    title: "Frequent Recovery Candidates",
    recommendation:
        "Frequent recovery candidates suggest unstable network conditions. Consider TURN/SFU usage.",
    evidencePattern: "connection recovery candidate",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            let candidateCount = 0;
            let lastCandidateTime = null;
            for (const log of sessionLogs) {
                const text = helpers.formatEventText(log);
                if (text.includes("connection recovery candidate")) {
                    candidateCount += 1;
                    lastCandidateTime = helpers.formatEventTime(log);
                }
            }
            if (
                candidateCount <
                ANALYSIS_THRESHOLDS.RECOVERY_CANDIDATE_THRESHOLD
            ) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description: `Session ${sessionId} reported ${candidateCount} recovery candidates, suggesting unstable connectivity.`,
                details: {
                    candidateCount,
                    lastCandidateTime,
                },
            });
        });
        return results;
    },
});

const sfuLoadFailedRule = makeRule({
    id: "sfu_load_failed",
    errorCode: ISSUE_CODES.SFU_LOAD_FAILED,
    severity: ISSUE_TYPES.ERROR,
    title: "SFU Assets Load Failed",
    recommendation:
        "Failed to load SFU assets. Check asset availability, network access, and browser console errors.",
    evidencePattern: "failed to load sfu server",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            const selfSessionId = timeline?.selfSessionId?.toString();
            if (!selfSessionId) {
                return;
            }
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            const sessionLogs = getSessionLogs(sessionData);
            const failedLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "failed to load sfu server")
            );
            if (!failedLog) {
                return;
            }
            results.push({
                timelineKey,
                sessionId: selfSessionId,
                description:
                    "Failed to load SFU assets and fell back to peer-to-peer.",
                details: {
                    error: failedLog.error,
                    eventTime: helpers.formatEventTime(failedLog),
                },
            });
        });
        return results;
    },
});

const sfuConnectTimeoutRule = makeRule({
    id: "sfu_connect_timeout",
    errorCode: ISSUE_CODES.SFU_CONNECT_TIMEOUT,
    severity: ISSUE_TYPES.ERROR,
    title: "SFU Connection Timeout",
    recommendation:
        "SFU connection timed out. Check SFU reachability and contact your SFU administrator.",
    evidencePattern: "sfu connection timeout",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            const selfSessionId = timeline?.selfSessionId?.toString();
            if (!selfSessionId) {
                return;
            }
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            const sessionLogs = getSessionLogs(sessionData);
            const timeoutLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "sfu connection timeout")
            );
            if (!timeoutLog) {
                return;
            }
            results.push({
                timelineKey,
                sessionId: selfSessionId,
                description:
                    "The SFU connection timed out and the call likely fell back to P2P.",
                details: {
                    eventTime: helpers.formatEventTime(timeoutLog),
                },
            });
        });
        return results;
    },
});

const sfuConnectStalledRule = makeRule({
    id: "sfu_connect_stalled",
    errorCode: ISSUE_CODES.SFU_CONNECT_STALLED,
    severity: ISSUE_TYPES.WARNING,
    title: "SFU Connection Stalled",
    recommendation:
        "SFU connection did not complete. Verify authentication, firewall rules, and SFU server health.",
    evidencePattern: "loading sfu server",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            const selfSessionId = timeline?.selfSessionId?.toString();
            if (!selfSessionId) {
                return;
            }
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            const loadLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "loading sfu server")
            );
            if (!loadLog) {
                return;
            }
            const hasTimeout = sessionLogs.some((log) =>
                helpers.eventContains(log, "sfu connection timeout")
            );
            const hasLoadFailure = sessionLogs.some((log) =>
                helpers.eventContains(log, "failed to load sfu server")
            );
            const connectedLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "connection state change: connected")
            );
            if (hasTimeout || hasLoadFailure || connectedLog) {
                return;
            }
            const lastStateLog = [...sessionLogs]
                .reverse()
                .find((log) =>
                    helpers.eventContains(log, "connection state change:")
                );
            const loadTime = helpers.extractEventDate(loadLog, timelineKey);
            const endTime = timeline?.end ? new Date(timeline.end) : null;
            const duration =
                loadTime && endTime && !Number.isNaN(endTime.getTime())
                    ? endTime.getTime() - loadTime.getTime()
                    : null;
            results.push({
                timelineKey,
                sessionId: selfSessionId,
                description:
                    "SFU connection started but did not reach the connected state before the timeline ended.",
                details: {
                    lastState: lastStateLog
                        ? helpers.formatEventText(lastStateLog)
                        : null,
                    duration,
                },
            });
        });
        return results;
    },
});

const sfuConnectSlowRule = makeRule({
    id: "sfu_connect_slow",
    errorCode: ISSUE_CODES.SFU_CONNECT_SLOW,
    severity: ISSUE_TYPES.WARNING,
    title: "Slow SFU Connection",
    recommendation:
        "SFU connection was slow. Check network latency and SFU server load.",
    evidencePattern: "connection state change: connected",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            const selfSessionId = timeline?.selfSessionId?.toString();
            if (!selfSessionId) {
                return;
            }
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            const loadLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "loading sfu server")
            );
            const connectedLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "connection state change: connected")
            );
            if (!loadLog || !connectedLog) {
                return;
            }
            const loadTime = helpers.extractEventDate(loadLog, timelineKey);
            const connectedTime = helpers.extractEventDate(
                connectedLog,
                timelineKey
            );
            if (!loadTime || !connectedTime) {
                return;
            }
            const duration = connectedTime.getTime() - loadTime.getTime();
            if (duration <= ANALYSIS_THRESHOLDS.SFU_SLOW_CONNECT_MS) {
                return;
            }
            results.push({
                timelineKey,
                sessionId: selfSessionId,
                description: `SFU connection took ${helpers.formatDuration(duration)} to reach connected.`,
                details: {
                    duration,
                },
            });
        });
        return results;
    },
});

const sfuConnectionClosedRule = makeRule({
    id: "sfu_connection_closed",
    errorCode: ISSUE_CODES.SFU_CONNECTION_CLOSED,
    severity: ISSUE_TYPES.WARNING,
    title: "SFU Connection Closed",
    recommendation:
        "SFU connection closed by the server. Check server logs and capacity.",
    evidencePattern: "connection state change: closed",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            const selfSessionId = timeline?.selfSessionId?.toString();
            if (!selfSessionId) {
                return;
            }
            const sessionData = timeline.entriesBySessionId?.[selfSessionId];
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            const hasSfuSignals = sessionLogs.some(
                (log) =>
                    log.cause !== undefined ||
                    helpers.eventContains(log, "loading sfu server") ||
                    helpers.eventContains(
                        log,
                        "connection state change: authenticated"
                    )
            );
            if (!hasSfuSignals) {
                return;
            }
            const closedLog = sessionLogs.find((log) =>
                helpers.eventContains(log, "connection state change: closed")
            );
            if (!closedLog) {
                return;
            }
            results.push({
                timelineKey,
                sessionId: selfSessionId,
                description: "The SFU connection was closed by the server.",
                details: {
                    cause: closedLog.cause,
                    eventTime: helpers.formatEventTime(closedLog),
                },
            });
        });
        return results;
    },
});

const broadcastChannelRule = makeRule({
    id: "broadcast_channel_issue",
    errorCode: ISSUE_CODES.BROADCAST_CHANNEL_ISSUE,
    severity: ISSUE_TYPES.WARNING,
    title: "Broadcast Channel Issue",
    recommendation:
        "Cross-tab sync failed. Ensure BroadcastChannel is available and not blocked by browser settings.",
    evidencePattern: "broadcast channel",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            const issueLog = sessionLogs.find((log) => {
                const text = helpers.formatEventText(log);
                return (
                    text.includes("broadcast channel not available") ||
                    text.includes(
                        "failed to post message to broadcast channel"
                    )
                );
            });
            if (!issueLog) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description: "Cross-tab synchronization failed for RTC updates.",
                details: {
                    event: helpers.formatEventText(issueLog),
                    eventTime: helpers.formatEventTime(issueLog),
                },
            });
        });
        return results;
    },
});

const selfSessionRemovedRule = makeRule({
    id: "self_session_removed",
    errorCode: ISSUE_CODES.SELF_SESSION_REMOVED,
    severity: ISSUE_TYPES.ERROR,
    title: "Session Removed by Server",
    recommendation:
        "The server removed the session. Check for duplicate tabs or session cleanup on the server.",
    evidencePattern: "self session deleted by the server, ending call",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            const issueLog = sessionLogs.find((log) =>
                helpers.eventContains(
                    log,
                    "self session deleted by the server, ending call"
                )
            );
            if (!issueLog) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description:
                    "The server removed the current session and ended the call.",
                details: {
                    eventTime: helpers.formatEventTime(issueLog),
                },
            });
        });
        return results;
    },
});

const missingPeerIceRule = makeRule({
    id: "missing_peer_ice",
    errorCode: ISSUE_CODES.ICE_CANDIDATE_MISSING_PEER,
    severity: ISSUE_TYPES.WARNING,
    title: "ICE Candidates for Missing Peer",
    recommendation:
        "ICE candidates arrived for an unknown peer. This can indicate race conditions or stale notifications.",
    evidencePattern: "received ice-candidate for missing peer",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            const counts = new Map();
            let lastEventTime = null;
            for (const log of sessionLogs) {
                const text = helpers.formatEventText(log);
                const match = text.match(MISSING_PEER_REGEX);
                if (!match) {
                    continue;
                }
                const peerId = match[1];
                counts.set(peerId, (counts.get(peerId) || 0) + 1);
                lastEventTime = helpers.formatEventTime(log);
            }
            for (const [peerId, count] of counts.entries()) {
                if (count < ANALYSIS_THRESHOLDS.ICE_MISSING_PEER_THRESHOLD) {
                    continue;
                }
                results.push({
                    timelineKey,
                    sessionId,
                    description: `Received ${count} ICE candidates for missing peer ${peerId}.`,
                    details: {
                        peerId,
                        count,
                        lastEventTime,
                    },
                });
            }
        });
        return results;
    },
});

const sessionUnableToConnectRule = makeRule({
    id: "session_unable_to_connect",
    errorCode: ISSUE_CODES.SESSION_UNABLE_TO_CONNECT,
    severity: ISSUE_TYPES.ERROR,
    title: "Session Unable to Connect",
    recommendation:
        "This may indicate the user is behind a restrictive firewall or asymmetric NAT. Consider using TURN or SFU servers to facilitate the connection.",
    detect(logs) {
        const results = [];
        forEachSnapshotSession(logs, ({ timestamp, session }) => {
            if (
                (session.state === "new" ||
                    session.state === "searching for network") &&
                session.peer?.state === "new"
            ) {
                results.push({
                    timestamp,
                    sessionId: session.id,
                    description: `Session ${session.id} appears to be stuck in the '${session.state}' state, indicating it may be behind a restrictive firewall or asymmetric NAT.`,
                    details: {
                        sessionState: session.state,
                        peerState: session.peer.state,
                    },
                });
            }
        });
        return results;
    },
});

const audioElementStalledRule = makeRule({
    id: "audio_element_stalled",
    errorCode: ISSUE_CODES.AUDIO_ELEMENT_STALLED,
    severity: ISSUE_TYPES.WARNING,
    title: "Audio Element Stalled",
    recommendation:
        "Audio element is not receiving data. Check autoplay policies, output device, and permissions.",
    detect(logs) {
        const results = [];
        forEachSnapshotSession(logs, ({ timestamp, session }) => {
            if (!session.audio) {
                return;
            }
            const isConnected =
                session.state === "connected" ||
                session.peer?.state === "connected";
            if (!isConnected) {
                return;
            }
            const hasStalledReadyState =
                typeof session.audio.state === "number" &&
                session.audio.state <= ANALYSIS_THRESHOLDS.AUDIO_STALL_READY_STATE;
            const hasNoSource =
                session.audio.networkState ===
                ANALYSIS_THRESHOLDS.AUDIO_STALL_NETWORK_STATE;
            if (!hasStalledReadyState && !hasNoSource) {
                return;
            }
            results.push({
                timestamp,
                sessionId: session.id,
                description:
                    "Audio element reported no source or insufficient buffered data while connected.",
                details: {
                    audio: session.audio,
                    state: session.state,
                    peerState: session.peer?.state,
                },
            });
        });
        return results;
    },
});

const iceFailureRule = makeRule({
    id: "ice_connection_issues",
    errorCode: ISSUE_CODES.ICE_CONNECTION_ISSUES,
    severity: ISSUE_TYPES.WARNING,
    title: "ICE Connection Issues",
    recommendation:
        "Check for network stability and ensure STUN/TURN or SFU servers are properly configured. Firewall rules may be blocking ICE connectivity.",
    evidencePattern: "ice connection",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, sessionId, sessionData }) => {
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            let iceFailures = 0;
            for (const log of sessionLogs) {
                const text = helpers.formatEventText(log);
                if (
                    text.includes("ice connection") &&
                    (text.includes("failed") || text.includes("disconnected"))
                ) {
                    iceFailures += 1;
                }
            }
            if (!iceFailures) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description: `Session ${sessionId} experienced ICE connection failures, indicating potential network issues or firewall restrictions.`,
                details: {
                    iceFailures,
                },
            });
        });
        return results;
    },
});

const sfuKnownErrorRule = makeRule({
    id: "sfu_server_error_known",
    errorCode: ISSUE_CODES.SFU_SERVER_ERROR_KNOWN,
    severity: ISSUE_TYPES.WARNING,
    title: "SFU Server Error (known)",
    recommendation: "This is a known issue and should not cause any problems.",
    detect(logs) {
        const results = [];
        forEachSnapshot(logs, ({ timestamp, snapshot }) => {
            const errors = Array.isArray(snapshot?.server?.errors)
                ? snapshot.server.errors
                : [];
            if (!errors.includes(KNOWN_SFU_ERROR)) {
                return;
            }
            results.push({
                timestamp,
                description: "Eager usage of `updateUpload()`",
            });
        });
        return results;
    },
});

const sfuServerErrorRule = makeRule({
    id: "sfu_server_error",
    errorCode: ISSUE_CODES.SFU_SERVER_ERROR,
    severity: ISSUE_TYPES.ERROR,
    title: "SFU Server Error",
    recommendation:
        "Check the SFU server logs for more details. Ensure the server has enough resources and is properly configured.",
    detect(logs) {
        const results = [];
        forEachSnapshot(logs, ({ timestamp, snapshot }) => {
            const errors = Array.isArray(snapshot?.server?.errors)
                ? snapshot.server.errors
                : [];
            for (const error of errors) {
                if (error === KNOWN_SFU_ERROR) {
                    continue;
                }
                results.push({
                    timestamp,
                    description: error,
                });
            }
        });
        return results;
    },
});

const mediaStreamIssuesRule = makeRule({
    id: "media_stream_issues",
    errorCode: ISSUE_CODES.MEDIA_STREAM_ISSUES,
    severity: ISSUE_TYPES.WARNING,
    title: "Media Stream Issues",
    recommendation:
        "Check for camera/microphone permission issues. Ensure the devices are working properly and not being used by other applications.",
    detect(logs) {
        const results = [];
        forEachSnapshotSession(logs, ({ timestamp, session }) => {
            if (!session.audioError && !session.videoError) {
                return;
            }
            results.push({
                timestamp,
                sessionId: session.id,
                description: `Session ${session.id} experienced issues with audio/video streams.`,
                details: {
                    audioError: session.audioError,
                    videoError: session.videoError,
                },
            });
        });
        return results;
    },
});

const failedConnectionRule = makeRule({
    id: "failed_connection",
    errorCode: ISSUE_CODES.FAILED_CONNECTION,
    severity: ISSUE_TYPES.ERROR,
    title: "Failed Connection",
    recommendation:
        "The connection attempt failed. Check network conditions, firewall settings, and ensure STUN/TURN or SFU servers are properly configured.",
    evidencePattern: "connection state change: connected",
    detect(logs) {
        const results = [];
        forEachTimelineSession(logs, ({ timelineKey, timeline, sessionId, sessionData }) => {
            if (sessionId === timeline?.selfSessionId?.toString()) {
                return;
            }
            const sessionLogs = getSessionLogs(sessionData);
            if (!sessionLogs.length) {
                return;
            }
            const reachedConnected = sessionLogs.some((log) =>
                helpers
                    .formatEventText(log)
                    .includes("connection state change: connected")
            );
            if (reachedConnected) {
                return;
            }
            results.push({
                timelineKey,
                sessionId,
                description: `Session ${sessionId} never reached the 'connected' state.`,
                details: {
                    reachedConnected: false,
                },
            });
        });
        return results;
    },
});

const noTurnServerRule = makeRule({
    id: "no_turn_server",
    errorCode: ISSUE_CODES.NO_TURN_SERVER,
    severity: ISSUE_TYPES.INFO,
    title: "No TURN Server Configured",
    recommendation:
        "Consider configuring TURN or SFU servers to improve connection reliability in restrictive network environments.",
    detect(logs) {
        const results = [];
        forEachTimeline(logs, ({ timelineKey, timeline }) => {
            if (timeline?.hasTurn) {
                return;
            }
            results.push({
                timelineKey,
                description:
                    "No TURN server was configured for this session. This may cause connection issues in restrictive network environments [THIS CAN BE IGNORED IF YOU ARE USING A SFU].",
                details: {
                    hasTurn: false,
                },
            });
        });
        return results;
    },
});

const usingTurnRelayRule = makeRule({
    id: "using_turn_relay",
    errorCode: ISSUE_CODES.USING_TURN_RELAY,
    severity: ISSUE_TYPES.INFO,
    title: "Using TURN Relay",
    recommendation:
        "The connection is using a TURN relay, which may result in higher latency. This is normal in restrictive network environments.",
    detect(logs) {
        const results = [];
        forEachSnapshotSession(logs, ({ timestamp, session }) => {
            if (session.peer?.remoteCandidateType !== "relay") {
                return;
            }
            results.push({
                timestamp,
                sessionId: session.id,
                description: `Session ${session.id} is using a TURN relay, indicating a restrictive network environment.`,
                details: {
                    localCandidateType: session.peer.localCandidateType,
                    remoteCandidateType: session.peer.remoteCandidateType,
                },
            });
        });
        return results;
    },
});

export const analysisRules = [
    fallbackModeRule,
    recoveryLoopRule,
    recoveryCandidateStormRule,
    sfuLoadFailedRule,
    sfuConnectTimeoutRule,
    sfuConnectStalledRule,
    sfuConnectSlowRule,
    sfuConnectionClosedRule,
    broadcastChannelRule,
    selfSessionRemovedRule,
    missingPeerIceRule,
    sessionUnableToConnectRule,
    audioElementStalledRule,
    iceFailureRule,
    sfuKnownErrorRule,
    sfuServerErrorRule,
    mediaStreamIssuesRule,
    failedConnectionRule,
    noTurnServerRule,
    usingTurnRelayRule,
];
