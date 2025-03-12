const { Component, App, mount, xml, useState } = owl;
import { LogViewer } from './log_viewer.js';
import { SessionTimeline } from './session_timeline.js';
import { LogDetails } from './log_details.js';
import { TimelineViewer } from './timeline_viewer.js';
import { SnapshotViewer } from './snapshot_viewer.js';

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <div class="file-upload-container">
                <p>Upload a JSON log file to analyze the RTC connection data</p>
                <p>Refer to <a href="https://www.odoo.com/knowledge/article/28833">this article</a> for more information on how to enable RTC logging in Odoo</p>
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
                        <p class="view-description">Each timeline represents a sequence of events for a specific call.</p>
                        
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
                                    timelineData="state.logs[timelineKey]"
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
                                    snapshotData="state.logs[snapshotKey]"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Raw Data View -->
                    <div t-if="state.activeView === 'raw'" class="raw-data-container">
                        <h3>Raw Log Data</h3>
                        <div class="raw-data">
                            <pre t-esc="window.JSON.stringify(state.logs, null, 2)"></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = { LogViewer, SessionTimeline, LogDetails, TimelineViewer, SnapshotViewer };

    setup() {
        this.state = useState({
            logs: null,
            fileName: '',
            activeView: 'timelines'
        });

        this.viewOptions = [
            { id: 'timelines', label: 'Timelines' },
            { id: 'snapshots', label: 'Snapshots' },
            { id: 'raw', label: 'Raw Data' }
        ];
    }

    get timelineKeys() {
        if (!this.state.logs) return [];
        return Object.keys(this.state.logs)
            .filter(key => key.startsWith('c:'))
            .sort((a, b) => {
                const timeA = this.extractDateFromKey(a);
                const timeB = this.extractDateFromKey(b);
                return timeA.localeCompare(timeB);
            });
    }

    get snapshotKeys() {
        if (!this.state.logs) return [];
        return Object.keys(this.state.logs)
            .filter(key => key.startsWith('snapshot-'))
            .sort();
    }

    extractDateFromKey(key) {
        // Extract date from format "c:1-s:3-d:2025-03-12-10:24:37"
        const match = key.match(/d:([\d-:]+)/);
        return match ? match[1] : '';
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
        this.state.logs = logs;
    }

    setActiveView(viewId) {
        this.state.activeView = viewId;
    }
}

