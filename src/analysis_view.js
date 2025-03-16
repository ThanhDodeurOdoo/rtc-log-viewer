// src/analysis_view.js
const { Component, xml, useState } = owl;
import helpers from "./utils/helpers.js";
import { NoData } from "./common/ui_components.js";

// Constants for analysis
const ISSUE_TYPES = {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
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
                
                <div t-elif="state.analysisResults.length === 0" class="no-issues-found">
                    <h4>No Issues Detected</h4>
                    <p>The analysis did not find any significant connection problems in the logs.</p>
                </div>
                
                <div t-else="" class="analysis-results">
                    <h4>Analysis Results</h4>
                    <p class="analysis-summary">Found <strong t-esc="state.analysisResults.length"></strong> potential issues in the connection logs.</p>
                    <div class="issue-list">
                        <div
                            t-foreach="state.analysisResults"
                            t-as="issue"
                            t-key="issue_index"
                            t-attf-class="issue-item {{ issue.type }}"
                        >
                            <div class="issue-header">
                                <h5 class="issue-title">
                                    <span t-attf-class="issue-icon {{ issue.type }}"></span>
                                    <span t-esc="issue.title"></span>
                                </h5>
                                
                                <button
                                    t-attf-class="issue-toggle {{ state.expandedIssues[issue_index] ? 'expanded' : 'collapsed' }}"
                                    t-on-click="() => this.toggleIssueDetails(issue_index)"
                                >
                                    <t t-esc="state.expandedIssues[issue_index] ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div class="issue-description" t-esc="issue.description"></div>
                            
                            <div t-if="state.expandedIssues[issue_index]" class="issue-details">
                                <div t-if="issue.timestamp" class="issue-metadata">
                                    <span class="metadata-label">Detected at:</span>
                                    <span class="metadata-value" t-esc="helpers.formatTime(issue.timestamp)"></span>
                                </div>
                                
                                <div t-if="issue.sessionId" class="issue-metadata">
                                    <span class="metadata-label">Session ID:</span>
                                    <span class="metadata-value" t-esc="issue.sessionId"></span>
                                </div>
                                
                                <div t-if="issue.details" class="issue-technical-details">
                                    <h6>Technical Details</h6>
                                    <pre t-esc="window.JSON.stringify(issue.details, null, 2)"></pre>
                                </div>
                                
                                <div class="issue-recommendation">
                                    <h6>Recommendation</h6>
                                    <p t-esc="getRecommendation(issue)"></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = { NoData };

    setup() {
        this.state = useState({
            analysisResults: [],
            isAnalyzing: false,
            expandedIssues: {},
        });

        this.helpers = helpers;
        this.analyzeData();
    }

    get hasLogData() {
        return this.props.logs && (this.props.logs.timelines || this.props.logs.snapshots);
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
            this.state.analysisResults = results;
        } finally {
            this.state.isAnalyzing = false;
        }
    }

    sortResultsBySeverity(results) {
        const severity = {
            [ISSUE_TYPES.ERROR]: 0,
            [ISSUE_TYPES.WARNING]: 1,
            [ISSUE_TYPES.INFO]: 2,
        };

        results.sort((a, b) => severity[a.type] - severity[b.type]);
    }

    toggleIssueDetails(index) {
        this.state.expandedIssues[index] = !this.state.expandedIssues[index];
    }

    getRecommendation(issue) {
        switch (issue.title) {
            case "Fallback Mode Detected":
                return "Check if the SFU server is running and accessible. Ensure firewall rules allow WebRTC traffic to the SFU server.";

            case "Recovery Loop Detected":
                return "Check for network stability issues. If behind a corporate firewall, ensure STUN/TURN servers are properly configured.";

            case "Session Unable to Connect":
                return "This may indicate the user is behind a restrictive firewall or asymmetric NAT. Consider using TURN servers to facilitate the connection.";

            case "ICE Connection Issues":
                return "Check for network stability and ensure STUN/TURN servers are properly configured. Firewall rules may be blocking ICE connectivity.";

            case "SFU Server Errors":
                return "Check the SFU server logs for more details. Ensure the server has enough resources and is properly configured.";

            case "Media Stream Issues":
                return "Check for camera/microphone permission issues. Ensure the devices are working properly and not being used by other applications.";

            case "Failed Connection":
                return "The connection attempt failed. Check network conditions, firewall settings, and ensure STUN/TURN servers are properly configured.";

            case "No TURN Server Configured":
                return "Consider configuring TURN servers to improve connection reliability in restrictive network environments.";

            case "Using TURN Relay":
                return "The connection is using a TURN relay, which may result in higher latency. This is normal in restrictive network environments.";

            case "Older Odoo Version":
                return "Consider upgrading to a newer version of Odoo for improved WebRTC functionality and bug fixes.";

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

            if (snapshot.server.errors.length > 0) {
                results.push({
                    type: ISSUE_TYPES.ERROR,
                    title: "SFU Server Errors",
                    description:
                        "The SFU server reported errors, affecting the connection quality.",
                    timestamp,
                    details: {
                        serverErrors: snapshot.server.errors,
                    },
                });
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

                if (!reachedConnected && sessionId !== timeline.selfSessionId.toString()) {
                    results.push({
                        type: ISSUE_TYPES.ERROR,
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
