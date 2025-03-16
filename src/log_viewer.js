const { Component, xml, useState } = owl;
import helpers from "./utils/helpers.js";
import { NoData, EventList, ConnectionState, SessionProperties } from "./common/ui_components.js";

export class LogViewer extends Component {
    static components = {
        NoData,
        EventList,
        ConnectionState,
        SessionProperties,
    };

    static template = xml`
        <div class="log-viewer">
            <div class="log-viewer-header">
                <h3>RTC Log Viewer</h3>
                <div class="view-controls">
                    <button 
                        t-foreach="viewOptions" 
                        t-as="option" 
                        t-key="option.id"
                        t-attf-class="view-option {{ state.activeView === option.id ? 'active' : '' }}"
                        t-on-click="() => this.setActiveView(option.id)"
                    >
                        <t t-esc="option.label" />
                    </button>
                </div>
            </div>
            
            <div class="log-viewer-content">
                <!-- Timeline view -->
                <div t-if="state.activeView === 'timeline'" class="timeline-view">
                    <h4>Timeline View</h4>
                    <p class="description">View events over time for all sessions in the call.</p>
                    
                    <NoData 
                        t-if="!timelineKeys.length" 
                        message="'No timeline data available'"
                    />
                    
                    <div t-else="" class="timeline-selector">
                        <label for="timeline-select">Select Timeline:</label>
                        <select id="timeline-select" t-on-change="onTimelineSelect">
                            <option value="">-- Select a timeline --</option>
                            <option t-foreach="timelineKeys" t-as="key" t-key="key" t-att-value="key" t-esc="helpers.formatTime(key)"></option>
                        </select>
                        
                        <div t-if="state.selectedTimeline" class="session-timeline-container">
                            <div class="sessions-header">
                                <h4>Sessions in Timeline</h4>
                                <div class="session-tabs">
                                    <div 
                                        t-foreach="availableSessions" 
                                        t-as="sessionId" 
                                        t-key="sessionId"
                                        t-attf-class="session-tab {{ state.selectedSession === sessionId ? 'active' : '' }}"
                                        t-on-click="() => this.selectSession(sessionId)"
                                    >
                                        Session <t t-esc="sessionId" />
                                        <span t-if="isSessionSelf(sessionId)" class="self-indicator">(Self)</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div t-if="state.selectedSession" class="session-events">
                                <h4>Events for Session <t t-esc="state.selectedSession" /></h4>
                                <EventList 
                                    events="sessionEvents"
                                    noDataMessage="'No events found for this session'"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Session view -->
                <div t-elif="state.activeView === 'session'" class="session-view">
                    <h4>Session View</h4>
                    <p class="description">Examine the details of specific sessions from snapshots.</p>
                    
                    <NoData 
                        t-if="!snapshotKeys.length" 
                        message="'No snapshot data available'"
                    />
                    
                    <div t-else="" class="snapshot-selector">
                        <label for="snapshot-select">Select Snapshot:</label>
                        <select id="snapshot-select" t-on-change="onSnapshotSelect">
                            <option value="">-- Select a snapshot --</option>
                            <option t-foreach="snapshotKeys" t-as="key" t-key="key" t-att-value="key" t-esc="helpers.formatTime(key)"></option>
                        </select>
                        
                        <div t-if="state.selectedSnapshot" class="snapshot-sessions">
                            <h4>Sessions in Snapshot</h4>
                            <NoData 
                                t-if="!snapshotSessions.length" 
                                message="'No sessions found in this snapshot'"
                            />
                            <div t-else="" class="session-list">
                                <div 
                                    t-foreach="snapshotSessions" 
                                    t-as="session" 
                                    t-key="session.id"
                                    class="session-entry"
                                >
                                    <div class="session-header">
                                        <h5>
                                            Session ID: <span t-esc="session.id" />
                                            <span t-if="session.isSelf" class="self-indicator">(Self)</span>
                                        </h5>
                                        <button 
                                            t-attf-class="session-toggle {{ state.expandedSessions[session.id] ? 'expanded' : 'collapsed' }}"
                                            t-on-click="() => this.toggleSession(session.id)"
                                        >
                                            <t t-esc="state.expandedSessions[session.id] ? '▼' : '►'" />
                                        </button>
                                    </div>
                                    
                                    <div t-if="state.expandedSessions[session.id]" class="session-details">
                                        <ConnectionState 
                                            state="session.state || 'Unknown'"
                                            stateClass="helpers.getSessionStateClass(session)"
                                        />
                                        
                                        <SessionProperties session="session" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Raw data view -->
                <div t-elif="state.activeView === 'raw'" class="raw-view">
                    <h4>Raw Data View</h4>
                    <pre t-esc="window.JSON.stringify(props.logs, null, 2)"></pre>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            activeView: "timeline",
            selectedTimeline: null,
            selectedSession: null,
            selectedSnapshot: null,
            expandedSessions: {},
        });

        this.viewOptions = [
            { id: "timeline", label: "Timeline" },
            { id: "session", label: "Session Details" },
            { id: "raw", label: "Raw Data" },
        ];

        this.helpers = helpers;
    }

    get timelineKeys() {
        if (!this.props.logs || !this.props.logs.timelines) {
            return [];
        }
        return Object.keys(this.props.logs.timelines).sort();
    }

    get snapshotKeys() {
        if (!this.props.logs || !this.props.logs.snapshots) {
            return [];
        }
        return Object.keys(this.props.logs.snapshots).sort();
    }

    get availableSessions() {
        if (!this.state.selectedTimeline || !this.props.logs || !this.props.logs.timelines) {
            return [];
        }

        const timeline = this.props.logs.timelines[this.state.selectedTimeline];
        if (!timeline || !timeline.entriesBySessionId) {
            return [];
        }

        return Object.keys(timeline.entriesBySessionId).filter((id) => {
            // Filter out non-numeric IDs like "hasTurn"
            return !isNaN(parseInt(id));
        });
    }

    get sessionEvents() {
        if (
            !this.state.selectedTimeline ||
            !this.state.selectedSession ||
            !this.props.logs ||
            !this.props.logs.timelines
        ) {
            return [];
        }

        const timeline = this.props.logs.timelines[this.state.selectedTimeline];
        if (!timeline || !timeline.entriesBySessionId) {
            return [];
        }

        const sessionData = timeline.entriesBySessionId[this.state.selectedSession];
        if (!sessionData || !sessionData.logs || !Array.isArray(sessionData.logs)) {
            return [];
        }

        return sessionData.logs;
    }

    get snapshotSessions() {
        if (!this.state.selectedSnapshot || !this.props.logs || !this.props.logs.snapshots) {
            return [];
        }

        const snapshot = this.props.logs.snapshots[this.state.selectedSnapshot];
        if (!snapshot || !snapshot.sessions || !Array.isArray(snapshot.sessions)) {
            return [];
        }

        return snapshot.sessions;
    }

    isSessionSelf(sessionId) {
        if (!this.state.selectedTimeline || !this.props.logs || !this.props.logs.timelines) {
            return false;
        }

        const timeline = this.props.logs.timelines[this.state.selectedTimeline];
        if (!timeline) {
            return false;
        }

        return sessionId === timeline.selfSessionId?.toString();
    }

    setActiveView(viewId) {
        this.state.activeView = viewId;
    }

    onTimelineSelect(event) {
        this.state.selectedTimeline = event.target.value;
        this.state.selectedSession = null;
    }

    onSnapshotSelect(event) {
        this.state.selectedSnapshot = event.target.value;
        this.state.expandedSessions = {};
    }

    selectSession(sessionId) {
        this.state.selectedSession = sessionId;
    }

    toggleSession(sessionId) {
        this.state.expandedSessions[sessionId] = !this.state.expandedSessions[sessionId];
    }
}
