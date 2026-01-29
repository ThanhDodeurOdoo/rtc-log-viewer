const { Component, xml, signal, computed, useEffect, props } = owl;
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
                        t-foreach="this.viewOptions" 
                        t-as="option" 
                        t-key="option.id"
                        t-attf-class="view-option {{ this.activeView() === option.id ? 'active' : '' }}"
                        t-on-click="() => this.setActiveView(option.id)"
                    >
                        <t t-out="option.label" />
                    </button>
                </div>
            </div>
            
            <div class="log-viewer-content">
                <!-- Timeline view -->
                <div t-if="this.activeView() === 'timeline'" class="timeline-view">
                    <h4>Timeline View</h4>
                    <p class="description">View events over time for all sessions in the call.</p>
                    
                    <NoData 
                        t-if="!this.timelineKeys().length" 
                        message="'No timeline data available'"
                    />
                    
                    <div t-else="" class="timeline-selector">
                        <label for="timeline-select">Select Timeline:</label>
                        <select id="timeline-select" t-model="this.selectedTimeline">
                            <option value="">-- Select a timeline --</option>
                            <option t-foreach="this.timelineKeys()" t-as="key" t-key="key" t-att-value="key" t-out="this.helpers.formatTime(key)"></option>
                        </select>
                        
                        <div t-if="this.selectedTimeline()" class="session-timeline-container">
                            <div class="sessions-header">
                                <h4>Sessions in Timeline</h4>
                                <div class="session-tabs">
                                    <div 
                                        t-foreach="this.availableSessions()" 
                                        t-as="sessionId" 
                                        t-key="sessionId"
                                        t-attf-class="session-tab {{ this.selectedSession() === sessionId ? 'active' : '' }}"
                                        t-on-click="() => this.selectSession(sessionId)"
                                    >
                                        Session <t t-out="sessionId" />
                                        <span t-if="this.isSessionSelf(sessionId)" class="self-indicator">(Self)</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div t-if="this.selectedSession()" class="session-events">
                                <h4>Events for Session <t t-out="this.selectedSession()" /></h4>
                                <EventList 
                                    events="this.sessionEvents()"
                                    noDataMessage="'No events found for this session'"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Session view -->
                <div t-elif="this.activeView() === 'session'" class="session-view">
                    <h4>Session View</h4>
                    <p class="description">Examine the details of specific sessions from snapshots.</p>
                    
                    <NoData 
                        t-if="!this.snapshotKeys().length" 
                        message="'No snapshot data available'"
                    />
                    
                    <div t-else="" class="snapshot-selector">
                        <label for="snapshot-select">Select Snapshot:</label>
                        <select id="snapshot-select" t-model="this.selectedSnapshot">
                            <option value="">-- Select a snapshot --</option>
                            <option t-foreach="this.snapshotKeys()" t-as="key" t-key="key" t-att-value="key" t-out="this.helpers.formatTime(key)"></option>
                        </select>
                        
                        <div t-if="this.selectedSnapshot()" class="snapshot-sessions">
                            <h4>Sessions in Snapshot</h4>
                            <NoData 
                                t-if="!this.snapshotSessions().length" 
                                message="'No sessions found in this snapshot'"
                            />
                            <div t-else="" class="session-list">
                                <div 
                                    t-foreach="this.snapshotSessions()" 
                                    t-as="session" 
                                    t-key="session.id"
                                    class="session-entry"
                                >
                                    <div class="session-header" t-on-click="() => this.toggleSession(session.id)">
                                        <h5>
                                            Session ID: <span t-out="session.id" />
                                            <span t-if="session.isSelf" class="self-indicator">(Self)</span>
                                        </h5>
                                        <button 
                                            t-attf-class="session-toggle {{ this.expandedSessions()[session.id] ? 'expanded' : 'collapsed' }}"
                                            t-on-click.stop="() => this.toggleSession(session.id)"
                                        >
                                            <t t-out="this.expandedSessions()[session.id] ? '▼' : '►'" />
                                        </button>
                                    </div>
                                    
                                    <div t-if="this.expandedSessions()[session.id]" class="session-details">
                                        <ConnectionState 
                                            state="session.state || 'Unknown'"
                                            stateClass="this.helpers.getSessionStateClass(session)"
                                        />
                                        
                                        <SessionProperties session="session" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Raw data view -->
                <div t-elif="this.activeView() === 'raw'" class="raw-view">
                    <h4>Raw Data View</h4>
                    <pre t-out="window.JSON.stringify(this.logs(), null, 2)"></pre>
                </div>
            </div>
        </div>
    `;

    props = props();

    setup() {
        this.activeView = signal("timeline");
        this.selectedTimeline = signal("");
        this.selectedSession = signal("");
        this.selectedSnapshot = signal("");
        this.expandedSessions = signal.Object({});

        this.viewOptions = [
            { id: "timeline", label: "Timeline" },
            { id: "session", label: "Session Details" },
            { id: "raw", label: "Raw Data" },
        ];

        this.helpers = helpers;
        this.logs = computed(() => {
            if (typeof this.props.logs === "function") {
                return this.props.logs();
            }
            return this.props.logs || null;
        });
        this.timelineKeys = computed(() => {
            const logs = this.logs();
            if (!logs || !logs.timelines) {
                return [];
            }
            return Object.keys(logs.timelines).sort();
        });
        this.snapshotKeys = computed(() => {
            const logs = this.logs();
            if (!logs || !logs.snapshots) {
                return [];
            }
            return Object.keys(logs.snapshots).sort();
        });
        this.availableSessions = computed(() => {
            const logs = this.logs();
            const selectedTimeline = this.selectedTimeline();
            if (!selectedTimeline || !logs || !logs.timelines) {
                return [];
            }

            const timeline = logs.timelines[selectedTimeline];
            if (!timeline || !timeline.entriesBySessionId) {
                return [];
            }

            return Object.keys(timeline.entriesBySessionId).filter((id) => {
                return !isNaN(parseInt(id));
            });
        });
        this.sessionEvents = computed(() => {
            const logs = this.logs();
            const selectedTimeline = this.selectedTimeline();
            const selectedSession = this.selectedSession();
            if (!selectedTimeline || !selectedSession || !logs || !logs.timelines) {
                return [];
            }

            const timeline = logs.timelines[selectedTimeline];
            if (!timeline || !timeline.entriesBySessionId) {
                return [];
            }

            const sessionData = timeline.entriesBySessionId[selectedSession];
            if (!sessionData || !sessionData.logs || !Array.isArray(sessionData.logs)) {
                return [];
            }

            return sessionData.logs;
        });
        this.snapshotSessions = computed(() => {
            const logs = this.logs();
            const selectedSnapshot = this.selectedSnapshot();
            if (!selectedSnapshot || !logs || !logs.snapshots) {
                return [];
            }

            const snapshot = logs.snapshots[selectedSnapshot];
            if (!snapshot || !snapshot.sessions || !Array.isArray(snapshot.sessions)) {
                return [];
            }

            return snapshot.sessions;
        });
        useEffect(() => {
            this.selectedTimeline();
            this.selectedSession.set("");
        });
        useEffect(() => {
            this.selectedSnapshot();
            this.expandedSessions.set({});
        });
    }

    isSessionSelf(sessionId) {
        const logs = this.logs();
        const selectedTimeline = this.selectedTimeline();
        if (!selectedTimeline || !logs || !logs.timelines) {
            return false;
        }

        const timeline = logs.timelines[selectedTimeline];
        if (!timeline) {
            return false;
        }

        return sessionId === timeline.selfSessionId?.toString();
    }

    setActiveView(viewId) {
        this.activeView.set(viewId);
    }

    selectSession(sessionId) {
        this.selectedSession.set(sessionId);
    }

    toggleSession(sessionId) {
        const expanded = this.expandedSessions();
        expanded[sessionId] = !expanded[sessionId];
    }
}
