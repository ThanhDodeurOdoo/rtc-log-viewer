const { Component, xml, useState } = owl;
import { TimelineViewer } from "./timeline_viewer.js";
import { SnapshotViewer } from "./snapshot_viewer.js";
import helpers from "./utils/helpers.js";
import { NoData } from "./common/ui_components.js";

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <div 
                t-attf-class="file-upload-container {{ state.isDragOver ? 'drag-over' : '' }}"
                t-on-dragover.prevent.stop="onDragOver"
                t-on-dragleave.prevent.stop="onDragLeave"
                t-on-drop.prevent.stop="onFileDrop"
            >
                <h2>RTC Log Viewer</h2>
                <p>Upload a JSON log file to analyze the RTC connection data</p>
                
                <div class="drop-zone">
                    <div class="drop-zone-prompt">
                        <i class="drop-icon"></i>
                        <p>Drag and drop your JSON log file here</p>
                        <p>or</p>
                    </div>
                    
                    <div class="file-input">
                        <input type="file" accept=".json" t-on-change="onFileChange"/>
                        <button t-on-click="triggerFileInput">Choose File</button>
                        <span t-if="state.fileName" class="file-name" t-esc="state.fileName"></span>
                        <span t-else="" class="file-hint">No file chosen</span>
                    </div>
                </div>
            </div>
            
            <div t-if="state.logs" class="log-content">
                <div class="info-panel">
                    <div class="system-info">
                        <h3>System Information</h3>
                        <table>
                            <tr t-if="state.logs.odooInfo and state.logs.odooInfo.server_version">
                                <td>Server Version:</td>
                                <td t-esc="state.logs.odooInfo.server_version"></td>
                            </tr>
                            <tr t-if="state.logs.odooInfo and state.logs.odooInfo.db">
                                <td>Database:</td>
                                <td t-esc="state.logs.odooInfo.db"></td>
                            </tr>
                            <tr t-if="state.logs.odooInfo and state.logs.odooInfo.isEnterprise !== undefined">
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
                    <TimelineViewer 
                        t-if="state.activeView === 'timelines'" 
                        logs="state.logs"
                    />
                    
                    <!-- Snapshots View -->
                    <div t-if="state.activeView === 'snapshots'" class="snapshots-container">
                        <h3>Connection Snapshots</h3>
                        <p class="view-description">Each snapshot shows the complete state of all sessions at a specific moment.</p>
                        
                        <NoData 
                            t-if="!snapshotKeys.length" 
                            message="'No snapshot data available in this log file'"
                        />
                        
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

    static components = {
        TimelineViewer,
        SnapshotViewer,
        NoData,
    };

    setup() {
        this.state = useState({
            logs: null,
            fileName: "",
            activeView: "timelines",
            isDragOver: false,
        });

        this.viewOptions = [
            { id: "timelines", label: "Timelines" },
            { id: "snapshots", label: "Snapshots" },
            { id: "raw", label: "Raw Data" },
        ];
        this.helpers = helpers;
    }

    triggerFileInput() {
        document.querySelector('input[type="file"]').click();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        this.processFile(file);
    }

    onDragOver(event) {
        this.state.isDragOver = true;
    }

    onDragLeave(event) {
        this.state.isDragOver = false;
    }

    onFileDrop(event) {
        this.state.isDragOver = false;

        const files = event.dataTransfer.files;
        if (files.length === 0) {
            return;
        }

        const file = files[0];
        this.processFile(file);
    }

    processFile(file) {
        if (!file) {
            return;
        }

        // Check if it's a JSON file
        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Please upload a JSON file.");
            return;
        }

        this.state.fileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const logs = JSON.parse(e.target.result);
                this.processParsedLogs(logs);
            } catch {
                alert("Error parsing the log file. Please ensure it is a valid JSON file.");
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

    get snapshotKeys() {
        if (!this.state.logs || !this.state.logs.snapshots) {
            return [];
        }
        return Object.keys(this.state.logs.snapshots).sort();
    }
}
