const { Component, xml, useState, useEffect } = owl;
import helpers from "./utils/helpers.js";
import { NoData } from "./common/ui_components.js";

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
};

const RECOVERY_THRESHOLD = 3; // Number of recovery attempts that indicates a problem

export class AnalysisView extends Component {
    static template = xml`
        <div class="analysis-view">
            <h3>Connection Analysis [⚠️WORK IN PROGESS⚠️]</h3>
            <p class="view-description">Automatic analysis of connection issues and potential problems.</p>
            <NoData
                t-if="!hasLogData"
                message="'No log data available for analysis'"
            />
            <div t-else="" class="analysis-content">
                <div t-if="state.isAnalyzing" class="loading-analysis">
                    <p>Analyzing connection logs...</p>
                </div>
                
                <div t-elif="state.groupedResults.length === 0" class="no-issues-found">
                    <h4>No Issues Detected</h4>
                    <p>The analysis did not find any significant connection problems in the logs.</p>
                </div>
                
                <div t-else="" class="analysis-results">
                    <h4>Analysis Results</h4>
                    <div class="issue-list">
                        <div
                            t-foreach="state.groupedResults"
                            t-as="group"
                            t-key="group_index"
                            t-attf-class="issue-item {{ group.type }}"
                        >
                            <div class="issue-header" t-on-click="() => this.toggleIssueDetails(group_index)">
                                <h5 class="issue-title">
                                    <span t-attf-class="issue-icon {{ group.type }}"></span>
                                    <span t-esc="group.title"></span>
                                    <span class="issue-count" t-if="group.count > 1">
                                        (<t t-esc="group.count"/> occurrences)
                                    </span>
                                </h5>
                                
                                <button
                                    t-attf-class="issue-toggle {{ state.expandedIssues[group_index] ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="() => this.toggleIssueDetails(group_index)"
                                >
                                    <t t-esc="state.expandedIssues[group_index] ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div class="issue-description" t-esc="group.description"></div>
                            
                            <div t-if="state.expandedIssues[group_index]" class="issue-details">
                                <div class="issue-recommendation">
                                    <h6>Recommendation</h6>
                                    <p t-esc="getRecommendation(group)"></p>
                                </div>

                                <div t-if="group.count > 1" class="issue-instances">
                                    <h6>Occurrences (<t t-esc="group.count"/>)</h6>
                                    
                                    <div t-foreach="group.instances" t-as="instance" t-key="instance_index" class="issue-instance">
                                        <div class="instance-header" t-on-click="() => this.toggleInstanceDetails(group_index, instance_index)">
                                            <h6 class="instance-title">
                                                <span t-if="instance.sessionId">Session <t t-esc="instance.sessionId"/></span>
                                                <span t-if="instance.timestamp" class="instance-source">
                                                    - Snapshot <t t-esc="helpers.formatTime(instance.timestamp)"/>
                                                </span>
                                                <span t-elif="instance.timelineKey" class="instance-source">
                                                    - Timeline <t t-esc="helpers.formatTime(instance.timelineKey)"/>
                                                </span>
                                            </h6>
                                            
                                            <button
                                                t-attf-class="instance-toggle {{ state.expandedInstances[group_index + '-' + instance_index] ? 'expanded' : 'collapsed' }}"
                                                t-on-click.stop="() => this.toggleInstanceDetails(group_index, instance_index)"
                                            >
                                                <t t-esc="state.expandedInstances[group_index + '-' + instance_index] ? '▼' : '►'" />
                                            </button>
                                        </div>
                                        
                                        <div t-if="state.expandedInstances[group_index + '-' + instance_index]" class="instance-details">
                                            <div t-if="instance.timestamp" class="issue-metadata">
                                                <span class="metadata-label">Detected at:</span>
                                                <span class="metadata-value" t-esc="helpers.formatTime(instance.timestamp)"></span>
                                            </div>
                                            
                                            <div t-if="instance.sessionId" class="issue-metadata">
                                                <span class="metadata-label">Session ID:</span>
                                                <span class="metadata-value" t-esc="instance.sessionId"></span>
                                            </div>
                                            
                                            <div t-if="instance.details" class="issue-technical-details">
                                                <h6>Technical Details</h6>
                                                <pre t-esc="window.JSON.stringify(instance.details, null, 2)"></pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div t-else="" class="single-issue-details">
                                    <div class="issue-metadata">
                                        <span class="metadata-label">Source:</span>
                                        <span class="metadata-value source-indicator">
                                            <span t-if="group.timestamp" class="source-tag snapshot-source">
                                                Snapshot <t t-esc="helpers.formatTime(group.timestamp)"/>
                                            </span>
                                            <span t-elif="group.timelineKey" class="source-tag timeline-source">
                                                Timeline <t t-esc="helpers.formatTime(group.timelineKey)"/>
                                            </span>
                                            <span t-else="" class="source-tag unknown-source">
                                                Unknown source
                                            </span>
                                        </span>
                                    </div>
                                    
                                    <div t-if="group.sessionId" class="issue-metadata">
                                        <span class="metadata-label">Session ID:</span>
                                        <span class="metadata-value" t-esc="group.sessionId"></span>
                                    </div>
                                    
                                    <div t-if="group.details" class="issue-technical-details">
                                        <h6>Technical Details</h6>
                                        <pre t-esc="window.JSON.stringify(group.details, null, 2)"></pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = { NoData };
    static props = ["logs?"];

    setup() {
        this.state = useState({
            rawResults: [], // Store all raw issues
            groupedResults: [], // Grouped issues
            isAnalyzing: false,
            expandedIssues: {},
            expandedInstances: {},
        });

        this.helpers = helpers;
        useEffect(
            () => {
                this.analyzeData();
            },
            () => [this.props.logs],
        );
    }

    get hasLogData() {
        return this.props.logs && (this.props.logs.timelines || this.props.logs.snapshots);
    }

    getTotalIssueCount() {
        return this.state.rawResults.length;
    }

    async analyzeData() {
        if (!this.hasLogData) {
            return;
        }

        this.state.isAnalyzing = true;

        try {
            const results = [];
            this.checkFallbackMode(results);
            this.checkRecoveryLoops(results);
            this.checkStuckSessions(results);
            this.checkConnectionIssues(results);
            this.checkCallQuality(results);
            this.checkTurnServerUsage(results);
            this.checkCandidateTypes(results);

            this.sortResultsBySeverity(results);
            this.state.rawResults = results;
            this.groupResults();
        } finally {
            this.state.isAnalyzing = false;
        }
    }

    groupResults() {
        const results = this.state.rawResults;
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
        this.state.groupedResults = groupedArray;
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
        this.state.expandedIssues[index] = !this.state.expandedIssues[index];
    }

    toggleInstanceDetails(groupIndex, instanceIndex) {
        const key = `${groupIndex}-${instanceIndex}`;
        this.state.expandedInstances[key] = !this.state.expandedInstances[key];
    }

    getRecommendation(issue) {
        // Use errorCode for recommendations instead of title
        switch (issue.errorCode) {
            case ISSUE_CODES.FALLBACK_MODE:
                return "Check if the SFU server is running and accessible. Ensure firewall rules allow WebRTC traffic to the SFU server.";

            case ISSUE_CODES.RECOVERY_LOOP:
                return "Check for network stability issues. If behind a corporate firewall, ensure STUN/TURN servers are properly configured.";

            case ISSUE_CODES.SESSION_UNABLE_TO_CONNECT:
                return "This may indicate the user is behind a restrictive firewall or asymmetric NAT. Consider using TURN servers to facilitate the connection.";

            case ISSUE_CODES.ICE_CONNECTION_ISSUES:
                return "Check for network stability and ensure STUN/TURN servers are properly configured. Firewall rules may be blocking ICE connectivity.";

            case ISSUE_CODES.SFU_SERVER_ERROR:
                return "Check the SFU server logs for more details. Ensure the server has enough resources and is properly configured.";

            case ISSUE_CODES.MEDIA_STREAM_ISSUES:
                return "Check for camera/microphone permission issues. Ensure the devices are working properly and not being used by other applications.";

            case ISSUE_CODES.FAILED_CONNECTION:
                return "The connection attempt failed. Check network conditions, firewall settings, and ensure STUN/TURN servers are properly configured.";

            case ISSUE_CODES.NO_TURN_SERVER:
                return "Consider configuring TURN servers to improve connection reliability in restrictive network environments.";

            case ISSUE_CODES.USING_TURN_RELAY:
                return "The connection is using a TURN relay, which may result in higher latency. This is normal in restrictive network environments.";

            case ISSUE_CODES.MULTIPLE_ISSUES:
                return "This session has multiple issues. Review each instance for specific recommendations.";

            case ISSUE_CODES.SFU_SERVER_ERROR_KNOWN:
                return "This is a known issue and should not cause any problems.";

            default:
                return "Investigate the logs further for more context about this issue.";
        }
    }

    checkFallbackMode(results) {
        const snapshots = this.props.logs.snapshots;
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

    checkRecoveryLoops(results) {
        const timelines = this.props.logs.timelines;
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

    checkStuckSessions(results) {
        const snapshots = this.props.logs.snapshots;
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

    checkConnectionIssues(results) {
        this.checkIceFailures(results);
        this.checkSfuErrors(results);
        this.checkMediaIssues(results);
    }

    checkIceFailures(results) {
        const timelines = this.props.logs.timelines;
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

    checkSfuErrors(results) {
        const snapshots = this.props.logs.snapshots;
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

    checkMediaIssues(results) {
        const snapshots = this.props.logs.snapshots;
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

    checkCallQuality(results) {
        const timelines = this.props.logs.timelines;
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

    checkTurnServerUsage(results) {
        const timelines = this.props.logs.timelines;
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
                        "No TURN server was configured for this session. This may cause connection issues in restrictive network environments.",
                    timelineKey,
                    details: {
                        hasTurn: false,
                    },
                });
            }
        }
    }

    checkCandidateTypes(results) {
        const snapshots = this.props.logs.snapshots;
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
