const { Component, xml, useState } = owl;

export class LogDetails extends Component {
    static template = xml`
        <div class="log-details">
            <div class="log-details-header">
                <h3>Session Details</h3>
                <div t-if="props.selectedSnapshot" class="snapshot-info">
                    Snapshot: <span t-esc="getFormattedSnapshotTime()"></span>
                </div>
            </div>
            
            <div t-if="!props.sessionData and !props.selectedSnapshot" class="no-data">
                No session data available
            </div>
            
            <div t-elif="!props.selectedSnapshot" class="session-logs">
                <h4>Session Events</h4>
                <div class="event-list">
                    <div t-foreach="sessionEvents" t-as="event" t-key="event.id" 
                         t-att-class="'event-item ' + getEventClass(event)">
                        <span class="event-time" t-esc="event.time"></span>
                        <span t-if="event.level" t-att-class="'event-level ' + event.level" t-esc="event.level"></span>
                        <span t-esc="event.text"></span>
                    </div>
                </div>
            </div>
            
            <div t-else="">
                <div class="log-tabs">
                    <div t-attf-class="log-tab {{ state.activeTab === 'overview' ? 'active' : '' }}"
                         t-on-click="() => this.setActiveTab('overview')">
                        Overview
                    </div>
                    <div t-attf-class="log-tab {{ state.activeTab === 'sessions' ? 'active' : '' }}" 
                         t-on-click="() => this.setActiveTab('sessions')">
                        Sessions
                    </div>
                </div>
                
                <div t-if="state.activeTab === 'overview'" class="tab-content">
                    <div class="connection-overview">
                        <div class="connection-state">
                            <div t-att-class="'state-indicator ' + getConnectionClass(snapshot)"></div>
                            <span>Connection Type: <strong t-esc="snapshot.connectionType || 'Unknown'"></strong></span>
                        </div>
                        <div t-if="snapshot.fallback !== undefined">
                            Fallback Mode: <strong t-esc="snapshot.fallback ? 'Yes' : 'No'"></strong>
                        </div>
                    </div>
                    
                    <div t-if="snapshot.server" class="server-info">
                        <h4>Server Information</h4>
                        <div t-if="Object.keys(snapshot.server).length === 0" class="no-data">
                            No server information available
                        </div>
                        <div t-else="">
                            <div t-if="snapshot.server.info">Server: <span t-esc="JSON.stringify(snapshot.server.info)"></span></div>
                            <div t-if="snapshot.server.state">State: <span t-esc="snapshot.server.state"></span></div>
                            <div t-if="snapshot.server.errors and snapshot.server.errors.length">
                                <div>Errors:</div>
                                <ul>
                                    <li t-foreach="snapshot.server.errors" t-as="error" t-key="error_index" t-esc="error"></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div t-if="state.activeTab === 'sessions'" class="tab-content">
                    <div t-if="!snapshot.sessions || snapshot.sessions.length === 0" class="no-data">
                        No session data available
                    </div>
                    <div t-else="" class="session-list">
                        <div t-foreach="snapshot.sessions" t-as="session" t-key="session.id" class="session-entry">
                            <h4 t-att-class="session.isSelf ? 'self-session' : ''">
                                Session ID: <span t-esc="session.id"></span>
                                <span t-if="session.isSelf"> (Self)</span>
                            </h4>
                            
                            <div class="connection-state">
                                <div t-att-class="'state-indicator ' + getSessionStateClass(session)"></div>
                                <span>State: <strong t-esc="session.state || 'Unknown'"></strong></span>
                            </div>
                            
                            <div class="session-properties">
                                <!-- Audio information -->
                                <div t-if="session.audio" class="property-card">
                                    <h4>Audio</h4>
                                    <ul class="property-list">
                                        <li><span class="property-name">State:</span> <span t-esc="getAudioState(session.audio.state)"></span></li>
                                        <li><span class="property-name">Muted:</span> <span t-esc="session.audio.muted ? 'Yes' : 'No'"></span></li>
                                        <li><span class="property-name">Paused:</span> <span t-esc="session.audio.paused ? 'Yes' : 'No'"></span></li>
                                    </ul>
                                </div>
                                
                                <!-- Peer information -->
                                <div t-if="session.peer" class="property-card">
                                    <h4>Peer Connection</h4>
                                    <ul class="property-list">
                                        <li><span class="property-name">ID:</span> <span t-esc="session.peer.id"></span></li>
                                        <li><span class="property-name">State:</span> <span t-esc="session.peer.state"></span></li>
                                        <li><span class="property-name">ICE State:</span> <span t-esc="session.peer.iceState"></span></li>
                                    </ul>
                                </div>
                                
                                <!-- SFU info -->
                                <div t-if="session.sfuConsumers and session.sfuConsumers.length > 0" class="property-card">
                                    <h4>SFU Consumers</h4>
                                    <ul class="property-list">
                                        <li t-foreach="session.sfuConsumers" t-as="consumer" t-key="consumer_index">
                                            <span class="property-name" t-esc="consumer.type"></span>: 
                                            <span t-esc="consumer.state"></span>
                                        </li>
                                    </ul>
                                </div>
                                
                                <!-- Additional properties -->
                                <div class="property-card">
                                    <h4>Other Properties</h4>
                                    <ul class="property-list">
                                        <li t-if="session.channelMemberId !== undefined">
                                            <span class="property-name">Channel Member ID:</span> 
                                            <span t-esc="session.channelMemberId"></span>
                                        </li>
                                        <li t-if="session.audioError">
                                            <span class="property-name">Audio Error:</span> 
                                            <span t-esc="session.audioError"></span>
                                        </li>
                                        <li t-if="session.videoError">
                                            <span class="property-name">Video Error:</span> 
                                            <span t-esc="session.videoError"></span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            activeTab: 'overview'
        });
    }

    get sessionEvents() {
        if (!this.props.sessionData) return [];

        const events = [];
        let eventId = 0;

        // Process session data to extract events from timelines
        const timelines = this.props.sessionData.timelines || {};

        Object.entries(timelines).forEach(([timelineKey, timelineData]) => {
            // Process all logs for all session IDs in the data
            Object.entries(timelineData).forEach(([sessionId, sessionInfo]) => {
                // Skip non-log data like "hasTurn"
                if (sessionId === 'hasTurn') return;

                // Add step information as an event
                if (sessionInfo.step) {
                    events.push({
                        id: `step_${eventId++}`,
                        time: this.extractTimeFromTimelineKey(timelineKey),
                        text: `Step: ${sessionInfo.step}`,
                        level: 'info',
                        sessionId: sessionId,
                        timelineKey: timelineKey
                    });
                }

                // Skip properties that are not logs
                if (!sessionInfo.logs || !Array.isArray(sessionInfo.logs)) return;

                sessionInfo.logs.forEach(log => {
                    // Extract timestamp from event string
                    const timeMatch = log.event.match(/(\d{2}:\d{2}:\d{2}):/);
                    if (timeMatch && timeMatch[1]) {
                        const time = timeMatch[1];
                        const eventText = log.event.substring(timeMatch[0].length).trim();

                        events.push({
                            id: `event_${eventId++}`,
                            time: time,
                            text: eventText,
                            level: log.level || 'info',
                            sessionId: sessionId,
                            timelineKey: timelineKey
                        });
                    } else {
                        // If no timestamp found, just use the whole event
                        events.push({
                            id: `event_${eventId++}`,
                            time: this.extractTimeFromTimelineKey(timelineKey),
                            text: log.event,
                            level: log.level || 'info',
                            sessionId: sessionId,
                            timelineKey: timelineKey
                        });
                    }
                });
            });
        });

        // Sort events by time
        events.sort((a, b) => {
            if (!a.time) return -1;
            if (!b.time) return 1;

            const aTime = a.time.split(':').map(Number);
            const bTime = b.time.split(':').map(Number);

            for (let i = 0; i < aTime.length; i++) {
                if (aTime[i] !== bTime[i]) {
                    return aTime[i] - bTime[i];
                }
            }

            return 0;
        });

        return events;
    }

    get snapshot() {
        if (!this.props.selectedSnapshot || !this.props.sessionData) return null;

        const snapshots = this.props.sessionData.snapshots || {};
        return snapshots[this.props.selectedSnapshot] || null;
    }

    extractTimeFromTimelineKey(key) {
        // Extract time from format "c:1-s:3-d:2025-03-12-10:24:37"
        const match = key.match(/d:(\d{4}-\d{2}-\d{2}-(\d{2}):(\d{2}):(\d{2}))/);
        if (match) {
            return `${match[2]}:${match[3]}:${match[4]}`;
        }
        return '00:00:00'; // Default if no time found
    }

    getFormattedSnapshotTime() {
        if (!this.props.selectedSnapshot) return '';

        // Extract date and time from snapshot ID (snapshot-YYYY-MM-DD-HH-MM-SS)
        try {
            const parts = this.props.selectedSnapshot.substring(9).split('-');
            if (parts.length >= 6) {
                const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
                const time = `${parts[3]}:${parts[4]}:${parts[5]}`;
                return `${date} ${time}`;
            }
        } catch (e) {
            console.error("Error parsing snapshot time", e);
        }

        return this.props.selectedSnapshot;
    }

    getEventClass(event) {
        if (event.level === 'warn') return 'warning';
        if (event.level === 'error') return 'error';
        return '';
    }

    getConnectionClass(snapshot) {
        if (!snapshot) return '';

        // Check for any connected sessions
        if (snapshot.sessions) {
            const connectedSession = snapshot.sessions.find(s =>
                s.state === 'connected' || s.peer?.state === 'connected'
            );

            if (connectedSession) return 'connected';

            const connectingSession = snapshot.sessions.find(s =>
                s.state === 'connecting' || s.peer?.state === 'connecting'
            );

            if (connectingSession) return 'connecting';
        }

        return 'failed';
    }

    getSessionStateClass(session) {
        if (!session) return '';

        if (session.state === 'connected' || session.peer?.state === 'connected') {
            return 'connected';
        }

        if (session.state === 'connecting' || session.peer?.state === 'connecting') {
            return 'connecting';
        }

        return 'failed';
    }

    getAudioState(state) {
        // Audio readyState values: 
        // 0 = HAVE_NOTHING, 1 = HAVE_METADATA, 2 = HAVE_CURRENT_DATA,
        // 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
        const states = [
            'HAVE_NOTHING',
            'HAVE_METADATA',
            'HAVE_CURRENT_DATA',
            'HAVE_FUTURE_DATA',
            'HAVE_ENOUGH_DATA'
        ];

        return states[state] || state;
    }

    setActiveTab(tab) {
        this.state.activeTab = tab;
    }
}
