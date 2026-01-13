const { Component, xml, useState } = owl;
import { TimelineViewer } from "./timeline_viewer.js";
import { SnapshotViewer } from "./snapshot_viewer.js";
import { AnalysisView } from "./analysis_view.js";
import helpers from "./utils/helpers.js";
import { NoData } from "./common/ui_components.js";
import { Log } from "./models/log.js";

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <div t-if="!Log.isLoaded"
                t-attf-class="file-upload-container {{ state.isDragOver ? 'drag-over' : '' }}"
                t-on-dragover.prevent.stop="onDragOver"
                t-on-dragleave.prevent.stop="onDragLeave"
                t-on-drop.prevent.stop="onFileDrop"
            >
                <h2>RTC Log Viewer</h2>
                <p>Upload a JSON log file (<a target="_blank" href="https://www.odoo.com/knowledge/article/28833">from Odoo Discuss RTC</a>)</p>
                <p class="download-info">logs are analyzed locally and stay on your device</p>
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
            
            <div t-if="Log.isLoaded" class="log-content">
                <div class="info-panel">
                    <div class="system-info">
                        <h3>System Information</h3>
                        <table>
                            <tr t-if="Log.odooInfo and Log.odooInfo.server_version">
                                <td>Server Version:</td>
                                <td t-esc="Log.odooInfo.server_version"></td>
                            </tr>
                            <tr t-if="Log.odooInfo and Log.odooInfo.db">
                                <td>Database:</td>
                                <td t-esc="Log.odooInfo.db"></td>
                            </tr>
                            <tr t-if="Log.odooInfo and Log.odooInfo.isEnterprise !== undefined">
                                <td>Enterprise:</td>
                                <td t-esc="Log.odooInfo.isEnterprise ? 'Yes' : 'No'"></td>
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
                        
                        <!-- Timeline Filters -->
                        <div t-if="Log.timelineKeys.length > 0" class="filter-section">
                            <div class="filter-header" t-on-click="toggleTimelineFilters">
                                <h4>Timelines</h4>
                                <span class="filter-count">
                                    (<t t-esc="Log.selectedTimelines.size" /> / <t t-esc="Log.timelineKeys.length" />)
                                </span>
                                <button 
                                    t-attf-class="filter-toggle {{ state.showTimelineFilters ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="toggleTimelineFilters"
                                >
                                    <t t-esc="state.showTimelineFilters ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="state.showTimelineFilters" class="filter-content">
                                <div class="filter-actions">
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllTimelines(true)">Select All</button>
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllTimelines(false)">Deselect All</button>
                                </div>
                                
                                <div class="filter-items">
                                    <div 
                                        t-foreach="Log.timelineKeys" 
                                        t-as="timelineKey" 
                                        t-key="timelineKey"
                                        class="filter-item"
                                        t-att-title="Log.formatTimelineLabel(timelineKey)"
                                    >
                                        <label class="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                t-att-checked="Log.selectedTimelines.has(timelineKey)"
                                                t-on-change="() => this.toggleTimeline(timelineKey)"
                                            />
                                            <span class="timeline-label" t-esc="Log.formatTimelineLabel(timelineKey)"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Snapshot Filters -->
                        <div t-if="Log.snapshotKeys.length > 0" class="filter-section">
                            <div class="filter-header" t-on-click="toggleSnapshotFilters">
                                <h4>Snapshots</h4>
                                <span class="filter-count">
                                    (<t t-esc="Log.selectedSnapshots.size" /> / <t t-esc="Log.snapshotKeys.length" />)
                                </span>
                                <button 
                                    t-attf-class="filter-toggle {{ state.showSnapshotFilters ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="toggleSnapshotFilters"
                                >
                                    <t t-esc="state.showSnapshotFilters ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="state.showSnapshotFilters" class="filter-content">
                                <div class="filter-actions">
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllSnapshots(true)">Select All</button>
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllSnapshots(false)">Deselect All</button>
                                </div>
                                
                                <div class="filter-items">
                                    <div 
                                        t-foreach="Log.snapshotKeys" 
                                        t-as="snapshotKey" 
                                        t-key="snapshotKey"
                                        class="filter-item"
                                    >
                                        <label class="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                t-att-checked="Log.selectedSnapshots.has(snapshotKey)"
                                                t-on-change="() => this.toggleSnapshot(snapshotKey)"
                                            />
                                            <span class="snapshot-label" t-esc="Log.formatSnapshotLabel(snapshotKey)"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="main-view">
                    <!-- Analysis View -->
                    <AnalysisView 
                        t-if="state.activeView === 'analysis'" 
                        logs="Log.filteredLogs"
                    />
                    
                    <!-- Timelines View -->
                    <TimelineViewer 
                        t-if="state.activeView === 'timelines'" 
                        logs="Log.filteredLogs"
                        lastRelevantTimestamp="Log.lastRelevantTimestamp"
                    />
                    
                    <!-- Snapshots View -->
                    <div t-if="state.activeView === 'snapshots'" class="snapshots-container">
                        <h3>Connection Snapshots</h3>
                        <p class="view-description">Each snapshot shows the complete state of all sessions at a specific moment.</p>
                        
                        <NoData 
                            t-if="!Log.filteredSnapshotKeys.length" 
                            message="'No snapshot data available in this log file'"
                        />
                        
                        <div t-else="" class="snapshot-list">
                            <div 
                                t-foreach="Log.filteredSnapshotKeys" 
                                t-as="snapshotKey" 
                                t-key="snapshotKey"
                                class="snapshot-entry"
                            >
                                <SnapshotViewer 
                                    snapshotKey="snapshotKey"
                                    snapshotData="Log.filteredSnapshots[snapshotKey]"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Raw Data View -->
                    <div t-if="state.activeView === 'raw'" class="raw-data-container">
                        <h3>Raw Log Data</h3>
                        <div class="raw-data">
                            <pre t-esc="window.JSON.stringify(Log.rawData, null, 2)"></pre>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="app-footer">
                <p>Powered by <a href="https://github.com/odoo/owl" target="_blank">odoo/OWL</a></p>
                <p>Source code on <a href="https://github.com/ThanhDodeurOdoo/rtc-log-viewer" target="_blank">GitHub</a></p>
            </footer>
        </div>
    `;

    static components = {
        TimelineViewer,
        SnapshotViewer,
        NoData,
        AnalysisView,
    };

    setup() {
        // UI-only state (data state is in Log singleton)
        this.state = useState({
            fileName: "",
            activeView: "analysis",
            isDragOver: false,
            showTimelineFilters: false,
            showSnapshotFilters: false,
        });

        this.viewOptions = [
            { id: "analysis", label: "Analysis" },
            { id: "timelines", label: "Timelines" },
            { id: "snapshots", label: "Snapshots" },
            { id: "raw", label: "Raw Data" },
        ];
        this.helpers = helpers;

        // Expose Log to template
        this.Log = Log;

        // Subscribe to Log changes to trigger re-renders
        this._unsubscribe = Log.onChange(() => {
            // Force OWL to re-render by toggling a dummy state
            this.render();
        });
    }

    willUnmount() {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
    }

    toggleTimeline(timelineKey) {
        Log.toggleTimeline(timelineKey);
    }

    toggleSnapshot(snapshotKey) {
        Log.toggleSnapshot(snapshotKey);
    }

    toggleAllTimelines(select = true) {
        if (select) {
            Log.selectAllTimelines();
        } else {
            Log.deselectAllTimelines();
        }
    }

    toggleAllSnapshots(select = true) {
        if (select) {
            Log.selectAllSnapshots();
        } else {
            Log.deselectAllSnapshots();
        }
    }

    toggleTimelineFilters() {
        this.state.showTimelineFilters = !this.state.showTimelineFilters;
    }

    toggleSnapshotFilters() {
        this.state.showSnapshotFilters = !this.state.showSnapshotFilters;
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

        // TODO could use mime?
        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Please upload a JSON file.");
            return;
        }

        this.state.fileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const logs = JSON.parse(e.target.result);
                Log.load(logs);
            } catch {
                alert("Error parsing the log file. Please ensure it is a valid JSON file.");
            }
        };
        reader.readAsText(file);
    }

    setActiveView(viewId) {
        this.state.activeView = viewId;
    }
}
