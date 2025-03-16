const { Component, xml, useState } = owl;
import helpers from "./utils/helpers.js";
import { ConnectionState, SessionProperties } from "./common/ui_components.js";

export class SnapshotViewer extends Component {
    static template = xml`
        <div class="snapshot-viewer">
            <div class="snapshot-header" t-on-click="() => this.state.expanded = !this.state.expanded">
                <h4 t-esc="getSnapshotTitle()"></h4>
                <button 
                    t-attf-class="snapshot-toggle {{ state.expanded ? 'expanded' : 'collapsed' }}"
                    t-on-click.stop="() => this.state.expanded = !this.state.expanded"
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
                            <span class="property-value" t-esc="snapshotData?.connectionType || 'Unknown'"></span>
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
                            <div class="session-header" t-on-click="() => this.toggleSession(session.id)">
                                <h6>
                                    Session ID: <span t-esc="session.id"></span>
                                    <span t-if="session.isSelf" class="self-indicator">(Self)</span>
                                </h6>
                                <button 
                                    t-attf-class="session-toggle {{ state.expandedSessions[session.id] ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="() => this.toggleSession(session.id)"
                                >
                                    <t t-esc="state.expandedSessions[session.id] ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="state.expandedSessions[session.id]" class="session-detail">
                                <!-- Connection state -->
                                <ConnectionState 
                                    state="session.state || 'Unknown'"
                                    stateClass="helpers.getSessionStateClass(session)"
                                />
                                
                                <SessionProperties 
                                    session="session" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = {
        ConnectionState,
        SessionProperties,
    };

    setup() {
        this.state = useState({
            expanded: false,
            expandedSessions: {},
        });
        this.helpers = helpers;
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
        return (
            this.snapshotData.server &&
            this.snapshotData.server.errors &&
            Array.isArray(this.snapshotData.server.errors) &&
            this.snapshotData.server.errors.length > 0
        );
    }

    getSnapshotTitle() {
        const key = this.props.snapshotKey;

        try {
            const date = new Date(key);
            return `Snapshot: ${date.toISOString()}`;
        } catch {
            return key;
        }
    }

    toggleSession(sessionId) {
        this.state.expandedSessions[sessionId] = !this.state.expandedSessions[sessionId];
    }
}
