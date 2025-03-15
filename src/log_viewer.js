const { Component, xml, useState } = owl;

export class LogViewer extends Component {
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
                    
                    <div t-if="!timelineKeys.length" class="no-data">
                        No timeline data available
                    </div>
                    
                    <div t-else="" class="timeline-selector">
                        <label for="timeline-select">Select Timeline:</label>
                        <select id="timeline-select" t-on-change="onTimelineSelect">
                            <option value="">-- Select a timeline --</option>
                            <option t-foreach="timelineKeys" t-as="key" t-key="key" t-att-value="key" t-esc="formatTimelineDate(key)"></option>
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
                                <div class="event-list">
                                    <div t-if="!sessionEvents.length" class="no-data">
                                        No events found for this session
                                    </div>
                                    <div t-else="" class="event-items">
                                        <div 
                                            t-foreach="sessionEvents" 
                                            t-as="event" 
                                            t-key="event_index"
                                            t-attf-class="event-item {{ event.level ? event.level : '' }}"
                                        >
                                            <span class="event-time" t-esc="formatEventTime(event)"></span>
                                            <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-esc="event.level"></span>
                                            <span class="event-text" t-esc="formatEventText(event)"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Session view -->
                <div t-elif="state.activeView === 'session'" class="session-view">
                    <h4>Session View</h4>
                    <p class="description">Examine the details of specific sessions from snapshots.</p>
                    
                    <div t-if="!snapshotKeys.length" class="no-data">
                        No snapshot data available
                    </div>
                    
                    <div t-else="" class="snapshot-selector">
                        <label for="snapshot-select">Select Snapshot:</label>
                        <select id="snapshot-select" t-on-change="onSnapshotSelect">
                            <option value="">-- Select a snapshot --</option>
                            <option t-foreach="snapshotKeys" t-as="key" t-key="key" t-att-value="key" t-esc="formatSnapshotDate(key)"></option>
                        </select>
                        
                        <div t-if="state.selectedSnapshot" class="snapshot-sessions">
                            <h4>Sessions in Snapshot</h4>
                            <div t-if="!snapshotSessions.length" class="no-data">
                                No sessions found in this snapshot
                            </div>
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
                                        <div class="connection-state">
                                            <div t-attf-class="state-indicator {{ getSessionStateClass(session) }}"></div>
                                            <span class="property-name">State:</span>
                                            <span class="property-value" t-esc="session.state || 'Unknown'"></span>
                                        </div>
                                        
                                        <div class="session-properties">
                                            <!-- Display session details here -->
                                            <div t-if="session.audio" class="property-card">
                                                <h6>Audio</h6>
                                                <ul class="property-list">
                                                    <li><span class="property-name">State:</span> <span t-esc="getAudioState(session.audio.state)"></span></li>
                                                    <li><span class="property-name">Muted:</span> <span t-esc="session.audio.muted ? 'Yes' : 'No'"></span></li>
                                                    <li><span class="property-name">Paused:</span> <span t-esc="session.audio.paused ? 'Yes' : 'No'"></span></li>
                                                </ul>
                                            </div>
                                            
                                            <div t-if="session.peer" class="property-card">
                                                <h6>Peer Connection</h6>
                                                <ul class="property-list">
                                                    <li><span class="property-name">ID:</span> <span t-esc="session.peer.id"></span></li>
                                                    <li><span class="property-name">State:</span> <span t-esc="session.peer.state"></span></li>
                                                    <li><span class="property-name">ICE State:</span> <span t-esc="session.peer.iceState"></span></li>
                                                </ul>
                                            </div>
                                            
                                            <div t-if="session.sfuConsumers and session.sfuConsumers.length > 0" class="property-card">
                                                <h6>SFU Consumers</h6>
                                                <ul class="property-list">
                                                    <li t-foreach="session.sfuConsumers" t-as="consumer" t-key="consumer_index">
                                                        <span class="property-name" t-esc="consumer.type"></span>: 
                                                        <span t-esc="consumer.state"></span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Raw data view -->
                <div t-elif="state.activeView === 'raw'" class="raw-view">
                    <h4>Raw Data View</h4>
                    <pre t-esc="JSON.stringify(props.logs, null, 2)"></pre>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            activeView: 'timeline',
            selectedTimeline: null,
            selectedSession: null,
            selectedSnapshot: null,
            expandedSessions: {}
        });

        this.viewOptions = [
            { id: 'timeline', label: 'Timeline' },
            { id: 'session', label: 'Session Details' },
            { id: 'raw', label: 'Raw Data' }
        ];
    }

    get timelineKeys() {
        if (!this.props.logs || !this.props.logs.timelines) return [];
        return Object.keys(this.props.logs.timelines).sort();
    }

    get snapshotKeys() {
        if (!this.props.logs || !this.props.logs.snapshots) return [];
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

        return Object.keys(timeline.entriesBySessionId).filter(id => {
            // Filter out non-numeric IDs like "hasTurn"
            return !isNaN(parseInt(id));
        });
    }

    get sessionEvents() {
        if (!this.state.selectedTimeline || !this.state.selectedSession ||
            !this.props.logs || !this.props.logs.timelines) {
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

    formatTimelineDate(timelineKey) {
        if (!timelineKey) return '';

        try {
            const date = new Date(timelineKey);
            return date.toLocaleString();
        } catch (e) {
            return timelineKey;
        }
    }

    formatSnapshotDate(snapshotKey) {
        if (!snapshotKey) return '';

        try {
            const date = new Date(snapshotKey);
            return date.toLocaleString();
        } catch (e) {
            return snapshotKey;
        }
    }

    formatEventTime(event) {
        if (!event || !event.event) return '';

        const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
        if (timeMatch && timeMatch[1]) {
            // Check if ISO format
            if (timeMatch[1].includes('T')) {
                const date = new Date(timeMatch[1]);
                return date.toLocaleTimeString();
            }
            return timeMatch[1];
        }
        return '';
    }

    formatEventText(event) {
        if (!event || !event.event) return '';

        const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
        if (timeMatch) {
            return event.event.substring(timeMatch[0].length).trim();
        }
        return event.event;
    }

    getSessionStateClass(session) {
        if (!session) return '';

        if (session.state === 'connected' || session.peer?.state === 'connected') {
            return 'connected';
        }

        if (session.state === 'connecting' || session.peer?.state === 'connecting') {
            return 'connecting';
        }

        return 'disconnected';
    }

    getAudioState(state) {
        const states = [
            'HAVE_NOTHING',
            'HAVE_METADATA',
            'HAVE_CURRENT_DATA',
            'HAVE_FUTURE_DATA',
            'HAVE_ENOUGH_DATA'
        ];

        return states[state] || state;
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