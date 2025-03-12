const { Component, xml, useState } = owl;

export class SnapshotViewer extends Component {
    static template = xml`
        <div class="snapshot-viewer">
            <div class="snapshot-header">
                <h4 t-esc="getSnapshotTitle()"></h4>
                <button 
                    t-attf-class="snapshot-toggle {{ state.expanded ? 'expanded' : 'collapsed' }}"
                    t-on-click="() => this.state.expanded = !this.state.expanded"
                >
                <t t-esc="state.expanded ? '▼' : '►'" />
                </button>
            </div>
            
            <div t-if="state.expanded" class="snapshot-content">
                <!-- Connection overview -->
                <div class="connection-overview">
                    <div class="connection-summary">
                        <div class="connection-type">
                            <span class="property-name">Connection Type:</span>
                            <span class="property-value" t-esc="snapshotData.connectionType || 'Unknown'"></span>
                        </div>
                        
                        <div t-if="snapshotData.fallback !== undefined" class="fallback-mode">
                            <span class="property-name">Fallback Mode:</span>
                            <span class="property-value" t-esc="snapshotData.fallback ? 'Yes' : 'No'"></span>
                        </div>
                    </div>
                    
                    <!-- Server info -->
                    <div t-if="hasServerInfo" class="server-info">
                        <h5>Server Information</h5>
                        <div class="server-properties">
                            <div t-if="snapshotData.server.url" class="server-url">
                                <span class="property-name">URL:</span>
                                <span class="property-value" t-esc="snapshotData.server.url"></span>
                            </div>
                            
                            <div t-if="snapshotData.server.state" class="server-state">
                                <span class="property-name">State:</span>
                                <span class="property-value" t-esc="snapshotData.server.state"></span>
                            </div>
                            
                            <div t-if="hasServerErrors" class="server-errors">
                                <span class="property-name">Errors:</span>
                                <ul class="error-list">
                                    <li t-foreach="snapshotData.server.errors" t-as="error" t-key="error_index" 
                                        class="error-item" t-esc="error"></li>
                                </ul>
                            </div>
                            
                            <div t-if="snapshotData.server.info" class="server-info-data">
                                <span class="property-name">Info:</span>
                                <pre class="json-data" t-esc="window.JSON.stringify(snapshotData.server.info, null, 2)"></pre>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sessions list -->
                <div class="sessions-list">
                    <h5>Sessions</h5>
                    
                    <div t-if="!hasSessions" class="no-data">
                        No session data in this snapshot
                    </div>
                    
                    <div t-else="" class="session-items">
                        <div 
                            t-foreach="sessions" 
                            t-as="session" 
                            t-key="session.id"
                            class="session-item"
                        >
                            <div class="session-header">
                                <h6>
                                    Session ID: <span t-esc="session.id"></span>
                                    <span t-if="session.isSelf" class="self-indicator">(Self)</span>
                                </h6>
                                <button 
                                    t-attf-class="session-toggle {{ state.expandedSessions[session.id] ? 'expanded' : 'collapsed' }}"
                                    t-on-click="() => this.toggleSession(session.id)"
                                >
                                    <t t-esc="state.expandedSessions[session.id] ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="state.expandedSessions[session.id]" class="session-detail">
                                <!-- Connection state -->
                                <div class="connection-state">
                                    <div t-attf-class="state-indicator {{ getSessionStateClass(session) }}"></div>
                                    <span class="property-name">State:</span>
                                    <span class="property-value" t-esc="session.state || 'Unknown'"></span>
                                </div>
                                
                                <div class="session-properties">
                                    <!-- Audio information -->
                                    <div t-if="session.audio" class="property-card">
                                        <h6>Audio</h6>
                                        <ul class="property-list">
                                            <li><span class="property-name">State:</span> <span t-esc="getAudioState(session.audio.state)"></span></li>
                                            <li><span class="property-name">Muted:</span> <span t-esc="session.audio.muted ? 'Yes' : 'No'"></span></li>
                                            <li><span class="property-name">Paused:</span> <span t-esc="session.audio.paused ? 'Yes' : 'No'"></span></li>
                                            <li t-if="session.audio.networkState !== undefined"><span class="property-name">Network State:</span> <span t-esc="getNetworkState(session.audio.networkState)"></span></li>
                                        </ul>
                                    </div>
                                    
                                    <!-- Peer information -->
                                    <div t-if="session.peer" class="property-card">
                                        <h6>Peer Connection</h6>
                                        <ul class="property-list">
                                            <li><span class="property-name">ID:</span> <span t-esc="session.peer.id"></span></li>
                                            <li><span class="property-name">State:</span> <span t-esc="session.peer.state"></span></li>
                                            <li><span class="property-name">ICE State:</span> <span t-esc="session.peer.iceState"></span></li>
                                        </ul>
                                    </div>
                                    
                                    <!-- SFU info -->
                                    <div t-if="session.sfuConsumers and session.sfuConsumers.length > 0" class="property-card">
                                        <h6>SFU Consumers</h6>
                                        <ul class="property-list">
                                            <li t-foreach="session.sfuConsumers" t-as="consumer" t-key="consumer_index">
                                                <span class="property-name" t-esc="consumer.type"></span>: 
                                                <span t-esc="consumer.state"></span>
                                            </li>
                                        </ul>
                                    </div>
                                    
                                    <!-- Additional properties -->
                                    <div class="property-card">
                                        <h6>Other Properties</h6>
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
        </div>
    `;

    setup() {
        this.state = useState({
            expanded: false,
            expandedSessions: {}
        });
    }

    get snapshotData() {
        return this.props.snapshotData || {};
    }

    get sessions() {
        if (!this.snapshotData.sessions || !Array.isArray(this.snapshotData.sessions)) {
            return [];
        }
        return this.snapshotData.sessions;
    }

    get hasSessions() {
        return this.sessions.length > 0;
    }

    get hasServerInfo() {
        return this.snapshotData.server && Object.keys(this.snapshotData.server).length > 0;
    }

    get hasServerErrors() {
        return this.snapshotData.server &&
            this.snapshotData.server.errors &&
            Array.isArray(this.snapshotData.server.errors) &&
            this.snapshotData.server.errors.length > 0;
    }

    getSnapshotTitle() {
        const key = this.props.snapshotKey;

        // Extract date and time from snapshot key (snapshot-YYYY-MM-DD-HH-MM-SS)
        const match = key.match(/snapshot-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
            const [_, year, month, day, hour, minute, second] = match;
            return `Snapshot: ${year}/${month}/${day} ${hour}:${minute}:${second}`;
        }

        return key;
    }

    toggleSession(sessionId) {
        this.state.expandedSessions[sessionId] = !this.state.expandedSessions[sessionId];
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

    getNetworkState(state) {
        const states = [
            'NETWORK_EMPTY',
            'NETWORK_IDLE',
            'downloading', // NETWORK_LOADING
            'NETWORK_NO_SOURCE'
        ];

        return states[state] || state;
    }
}
