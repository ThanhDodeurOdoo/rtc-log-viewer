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
                    <div t-foreach="sessionEvents" t-as="event" t-key="event_index" 
                         t-attf-class="event-item {{ event.level ? event.level : '' }}">
                        <span class="event-time" t-esc="formatEventTime(event)"></span>
                        <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-esc="event.level"></span>
                        <span t-esc="formatEventText(event)"></span>
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
                            <div t-if="snapshot.server.info">Server: <span t-esc="window.JSON.stringify(snapshot.server.info)"></span></div>
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
        if (!this.props.sessionData || !this.props.selectedSession) return [];

        const session = this.props.sessionData.entriesBySessionId[this.props.selectedSession];
        if (!session || !session.logs || !Array.isArray(session.logs)) {
            return [];
        }

        return session.logs;
    }

    get snapshot() {
        if (!this.props.selectedSnapshot || !this.props.sessionData) return null;

        const snapshots = this.props.sessionData?.snapshots;
        return snapshots ? snapshots[this.props.selectedSnapshot] : null;
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

    getFormattedSnapshotTime() {
        if (!this.props.selectedSnapshot) return '';

        try {
            const date = new Date(this.props.selectedSnapshot);
            return date.toLocaleString();
        } catch (e) {
            console.error("Error parsing snapshot time", e);
        }

        return this.props.selectedSnapshot;
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