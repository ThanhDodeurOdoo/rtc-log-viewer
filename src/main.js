const { Component, xml, useState } = owl;
import { LogViewer } from './log_viewer.js';
import { TimelineViewer } from './timeline_viewer.js';
import { SnapshotViewer } from './snapshot_viewer.js';
import { SessionTimeline } from './session_timeline.js';
import { LogDetails } from './log_details.js';

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <div class="file-upload-container">
                <h2>RTC Log Viewer</h2>
                <p>Upload a JSON log file to analyze the RTC connection data</p>
                <div class="file-input">
                    <input type="file" accept=".json" t-on-change="onFileChange"/>
                    <button t-on-click="triggerFileInput">Choose File</button>
                    <span t-if="state.fileName" class="file-name" t-esc="state.fileName"></span>
                    <span t-else="" class="file-hint">No file chosen</span>
                </div>
            </div>
            
            <div t-if="state.logs" class="log-content">
                <div class="info-panel">
                    <div class="system-info">
                        <h3>System Information</h3>
                        <table>
                            <tr t-if="state.logs.odooInfo.server_version">
                                <td>Server Version:</td>
                                <td t-esc="state.logs.odooInfo.server_version"></td>
                            </tr>
                            <tr t-if="state.logs.odooInfo.db">
                                <td>Database:</td>
                                <td t-esc="state.logs.odooInfo.db"></td>
                            </tr>
                            <tr t-if="state.logs.odooInfo.isEnterprise !== undefined">
                                <td>Enterprise:</td>
                                <td t-esc="state.logs.odooInfo.isEnterprise ? 'Yes' : 'No'"></td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="view-controls">
                        <h3>View Options</h3>
                        <div class="view-buttons">
                            <button 
                                t-foreach="viewOptions" 
                                t-as="option" 
                                t-key="option.id"
                                t-attf-class="view-btn {{ state.activeView === option.id ? 'active' : '' }}"
                                t-on-click="() => this.setActiveView(option.id)"
                                t-esc="option.label"
                            />
                        </div>
                    </div>
                </div>
                
                <div class="main-view">
                    <!-- Timelines View -->
                    <div t-if="state.activeView === 'timelines'" class="timelines-container">
                        <h3>Call Timelines</h3>
                        <p class="view-description">Each timeline represents a sequence of events for a specific call session.</p>
                        
                        <div t-if="!timelineKeys.length" class="no-data">
                            No timeline data available in this log file
                        </div>
                        
                        <div t-else="" class="timeline-list">
                            <div 
                                t-foreach="timelineKeys" 
                                t-as="timelineKey" 
                                t-key="timelineKey"
                                class="timeline-entry"
                            >
                                <TimelineViewer 
                                    timelineKey="timelineKey"
                                    timelineData="state.logs.timelines[timelineKey]"
                                    onSessionSelect="(sessionId) => this.setSelectedSession(timelineKey, sessionId)"
                                    selectedSession="state.selectedSession"
                                />
                            </div>
                            
                            <div t-if="state.selectedTimeline and state.selectedSession" class="session-details-container">
                                <LogDetails 
                                    sessionData="state.logs.timelines[state.selectedTimeline]"
                                    selectedSession="state.selectedSession"
                                    snapshots="snapshotKeys"
                                    selectedSnapshot="state.selectedSnapshot"
                                    onSnapshotSelect="(snapshotId) => this.selectSnapshot(snapshotId)"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Snapshots View -->
                    <div t-if="state.activeView === 'snapshots'" class="snapshots-container">
                        <h3>Connection Snapshots</h3>
                        <p class="view-description">Each snapshot shows the complete state of all sessions at a specific moment.</p>
                        
                        <div t-if="!snapshotKeys.length" class="no-data">
                            No snapshot data available in this log file
                        </div>
                        
                        <div t-else="" class="snapshot-list">
                            <div 
                                t-foreach="snapshotKeys" 
                                t-as="snapshotKey" 
                                t-key="snapshotKey"
                                class="snapshot-entry"
                            >
                                <SnapshotViewer 
                                    snapshotKey="snapshotKey"
                                    snapshotData="state.logs.snapshots[snapshotKey]"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Session Timeline View -->
                    <div t-if="state.activeView === 'session-timeline'" class="session-timeline-container">
                        <h3>Session Timeline View</h3>
                        <p class="view-description">Visualize the timeline of events for a specific session.</p>
                        
                        <div t-if="!timelineKeys.length" class="no-data">
                            No timeline data available in this log file
                        </div>
                        
                        <div t-else="">
                            <div class="session-selector">
                                <label for="timeline-select">Select Timeline:</label>
                                <select id="timeline-select" t-on-change="onTimelineSelect">
                                    <option value="">-- Select a timeline --</option>
                                    <option t-foreach="timelineKeys" t-as="key" t-key="key" t-att-value="key" t-esc="formatTimelineDate(key)"></option>
                                </select>
                                
                                <t t-if="state.selectedTimeline">
                                    <label for="session-select">Select Session:</label>
                                    <select id="session-select" t-on-change="onSessionSelect">
                                        <option value="">-- Select a session --</option>
                                        <option t-foreach="availableSessions" t-as="session" t-key="session" t-att-value="session" t-esc="'Session ' + session"></option>
                                    </select>
                                </t>
                            </div>
                            
                            <div t-if="state.selectedTimeline and state.selectedSession" class="session-timeline-view">
                                <SessionTimeline 
                                    session="state.selectedSession"
                                    sessionData="state.logs.timelines[state.selectedTimeline]"
                                    snapshots="snapshotKeysForTimeline"
                                    selectedSnapshot="state.selectedSnapshot"
                                    onSnapshotSelect="(snapshotId) => this.selectSnapshot(snapshotId)"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Raw Data View -->
                    <div t-if="state.activeView === 'raw'" class="raw-data-container">
                        <h3>Raw Log Data</h3>
                        <div class="raw-data">
                            <pre t-esc="JSON.stringify(state.logs, null, 2)"></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = { LogViewer, TimelineViewer, SnapshotViewer, SessionTimeline, LogDetails };

    setup() {
        this.state = useState({
            logs: null,
            fileName: '',
            activeView: 'timelines',
            selectedTimeline: null,
            selectedSession: null,
            selectedSnapshot: null
        });

        this.viewOptions = [
            { id: 'timelines', label: 'Timelines' },
            { id: 'snapshots', label: 'Snapshots' },
            { id: 'session-timeline', label: 'Session Timeline' },
            { id: 'raw', label: 'Raw Data' }
        ];
    }

    get timelineKeys() {
        if (!this.state.logs || !this.state.logs.timelines) return [];
        return Object.keys(this.state.logs.timelines).sort();
    }

    get snapshotKeys() {
        if (!this.state.logs || !this.state.logs.snapshots) return [];
        return Object.keys(this.state.logs.snapshots).sort();
    }

    get snapshotKeysForTimeline() {
        if (!this.state.selectedTimeline || !this.state.logs || !this.state.logs.snapshots) {
            return [];
        }

        // Extract timeline date info
        const timelineDate = new Date(this.state.selectedTimeline).toISOString().split('T')[0];

        // Filter snapshots that belong to this timeline (same date)
        return this.snapshotKeys.filter(key => {
            const snapshotDate = new Date(key).toISOString().split('T')[0];
            return snapshotDate === timelineDate;
        });
    }

    get availableSessions() {
        if (!this.state.selectedTimeline || !this.state.logs || !this.state.logs.timelines) {
            return [];
        }

        const timeline = this.state.logs.timelines[this.state.selectedTimeline];
        if (!timeline || !timeline.entriesBySessionId) {
            return [];
        }

        return Object.keys(timeline.entriesBySessionId).filter(id => {
            // Filter out any non-numeric IDs (like "hasTurn")
            return !isNaN(parseInt(id));
        });
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

    triggerFileInput() {
        document.querySelector('input[type="file"]').click();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.state.fileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const logs = JSON.parse(e.target.result);
                this.processParsedLogs(logs);
            } catch (error) {
                console.error('Error parsing log file:', error);
                alert('Error parsing the log file. Please ensure it is a valid JSON file.');
            }
        };
        reader.readAsText(file);
    }

    processParsedLogs(logs) {
        // Reset selections when loading new logs
        this.state.selectedTimeline = null;
        this.state.selectedSession = null;
        this.state.selectedSnapshot = null;

        this.state.logs = logs;
    }

    setActiveView(viewId) {
        this.state.activeView = viewId;
    }

    setSelectedSession(timeline, sessionId) {
        this.state.selectedTimeline = timeline;
        this.state.selectedSession = sessionId;
    }

    selectSnapshot(snapshotId) {
        this.state.selectedSnapshot = snapshotId;
    }

    onTimelineSelect(event) {
        this.state.selectedTimeline = event.target.value;
        this.state.selectedSession = null;
    }

    onSessionSelect(event) {
        this.state.selectedSession = event.target.value;
    }
}