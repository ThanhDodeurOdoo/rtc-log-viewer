const { Component, xml, proxy, computed, plugin, props, types } = owl;
import helpers from "./utils/helpers.js";
import { ConnectionState, SessionProperties } from "./common/ui_components.js";
import { LogPlugin } from "./plugins/log_plugin.js";

export class SnapshotViewer extends Component {
    static template = xml`
        <div class="snapshot-viewer">
            <div class="snapshot-header" t-on-click="() => this.state.expanded = !this.state.expanded">
                <h4 t-out="this.snapshotTitle()"></h4>
                <button 
                    t-attf-class="snapshot-toggle {{ this.state.expanded ? 'expanded' : 'collapsed' }}"
                    t-on-click.stop="() => this.state.expanded = !this.state.expanded"
                >
                <t t-out="this.state.expanded ? '▼' : '►'" />
                </button>
            </div>
            
            <div t-if="this.state.expanded" class="snapshot-content">
                <!-- Connection overview -->
                <div class="connection-overview">
                    <div class="connection-summary">
                        <div class="connection-type">
                            <span class="property-name">Connection Type:</span>
                            <span class="property-value" t-out="this.snapshotData().connectionType || 'Unknown'"></span>
                        </div>
                        
                        <div t-if="this.snapshotData().fallback !== undefined" class="fallback-mode">
                            <span class="property-name">Fallback Mode:</span>
                            <span class="property-value" t-out="this.snapshotData().fallback ? 'Yes' : 'No'"></span>
                        </div>
                    </div>
                    
                    <!-- Server info -->
                    <div t-if="this.hasServerInfo()" class="server-info">
                        <h5>Server Information</h5>
                        <div class="server-properties">
                            <div t-if="this.snapshotData().server.url" class="server-url">
                                <span class="property-name">URL:</span>
                                <span class="property-value" t-out="this.snapshotData().server.url"></span>
                            </div>
                            
                            <div t-if="this.snapshotData().server.state" class="server-state">
                                <span class="property-name">State:</span>
                                <span class="property-value" t-out="this.snapshotData().server.state"></span>
                            </div>
                            
                            <div t-if="this.hasServerErrors()" class="server-errors">
                                <span class="property-name">Errors:</span>
                                <ul class="error-list">
                                    <li t-foreach="this.snapshotData().server.errors" t-as="error" t-key="error_index" 
                                        class="error-item" t-out="error"></li>
                                </ul>
                            </div>
                            
                            <div t-if="this.snapshotData().server.info" class="server-info-data">
                                <span class="property-name">Info:</span>
                                <pre class="json-data" t-out="window.JSON.stringify(this.snapshotData().server.info, null, 2)"></pre>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sessions list -->
                <div class="sessions-list">
                    <h5>Sessions</h5>
                    
                    <div t-if="!this.hasSessions()" class="no-data">
                        No session data in this snapshot
                    </div>
                    
                    <div t-else="" class="session-items">
                        <div 
                            t-foreach="this.sessions()" 
                            t-as="session" 
                            t-key="session.id"
                            class="session-item"
                        >
                            <div class="session-header" t-on-click="() => this.toggleSession(session.id)">
                                <h6>
                                    Session ID: <span t-out="session.id"></span>
                                    <span t-if="session.isSelf" class="self-indicator">(Self)</span>
                                </h6>
                                <button 
                                    t-attf-class="session-toggle {{ this.state.expandedSessions[session.id] ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="() => this.toggleSession(session.id)"
                                >
                                    <t t-out="this.state.expandedSessions[session.id] ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="this.state.expandedSessions[session.id]" class="session-detail">
                                <!-- Connection state -->
                                <ConnectionState 
                                    state="session.state || 'Unknown'"
                                    stateClass="this.helpers.getSessionStateClass(session)"
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

    props = props({ snapshotKey: types.string });

    setup() {
        this.state = proxy({
            expanded: false,
            expandedSessions: {},
        });
        this.helpers = helpers;
        this.log = plugin(LogPlugin);
        this.snapshotData = computed(() => {
            const snapshots = this.log.filteredSnapshots();
            return snapshots[this.props.snapshotKey] || {};
        });
        this.sessions = computed(() => {
            const snapshotData = this.snapshotData();
            if (!snapshotData.sessions || !Array.isArray(snapshotData.sessions)) {
                return [];
            }
            return snapshotData.sessions;
        });
        this.hasSessions = computed(() => this.sessions().length > 0);
        this.hasServerInfo = computed(() => {
            const server = this.snapshotData().server;
            return !!server && Object.keys(server).length > 0;
        });
        this.hasServerErrors = computed(() => {
            const server = this.snapshotData().server;
            return !!(
                server &&
                server.errors &&
                Array.isArray(server.errors) &&
                server.errors.length > 0
            );
        });
        this.snapshotTitle = computed(() => {
            try {
                const date = new Date(this.props.snapshotKey);
                return `Snapshot: ${date.toISOString()}`;
            } catch {
                return this.props.snapshotKey;
            }
        });
    }

    toggleSession(sessionId) {
        this.state.expandedSessions[sessionId] = !this.state.expandedSessions[sessionId];
    }
}
