const { Component, xml, signal, plugin } = owl;
import { TimelineViewer } from "./timeline_viewer.js";
import { SnapshotViewer } from "./snapshot_viewer.js";
import { AnalysisView } from "./analysis_view.js";
import { NoData } from "./common/ui_components.js";
import { LogPlugin } from "./plugins/log_plugin.js";

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <div t-if="!this.log.isLoaded()"
                t-attf-class="file-upload-container {{ this.isDragOver() ? 'drag-over' : '' }}"
                t-on-dragover.prevent.stop="this.onDragOver"
                t-on-dragleave.prevent.stop="this.onDragLeave"
                t-on-drop.prevent.stop="this.onFileDrop"
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
                        <input type="file" accept=".json" t-on-change="this.onFileChange"/>
                        <button t-on-click="this.triggerFileInput">Choose File</button>
                        <span t-if="this.fileName()" class="file-name" t-out="this.fileName()"></span>
                        <span t-else="" class="file-hint">No file chosen</span>
                    </div>
                </div>
            </div>
            
            <div t-if="this.log.isLoaded()" class="log-content">
                <div class="info-panel">
                    <div class="system-info">
                        <h3>System Information</h3>
                        <table>
                            <tr t-if="this.log.odooInfo() and this.log.odooInfo().server_version">
                                <td>Server Version:</td>
                                <td t-out="this.log.odooInfo().server_version"></td>
                            </tr>
                            <tr t-if="this.log.odooInfo() and this.log.odooInfo().db">
                                <td>Database:</td>
                                <td t-out="this.log.odooInfo().db"></td>
                            </tr>
                            <tr t-if="this.log.odooInfo() and this.log.odooInfo().isEnterprise !== undefined">
                                <td>Enterprise:</td>
                                <td t-out="this.log.odooInfo().isEnterprise ? 'Yes' : 'No'"></td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="view-controls">
                        <h3>View Options</h3>
                        <div class="view-buttons">
                            <button 
                                t-foreach="this.viewOptions" 
                                t-as="option" 
                                t-key="option.id"
                                t-attf-class="view-btn {{ this.activeView() === option.id ? 'active' : '' }}"
                                t-on-click="() => this.setActiveView(option.id)"
                                t-out="option.label"
                            />
                        </div>
                        
                        <!-- Timeline Filters -->
                        <div t-if="this.log.timelineKeys().length > 0" class="filter-section">
                            <div class="filter-header" t-on-click="this.toggleTimelineFilters">
                                <h4>Timelines</h4>
                                <span class="filter-count">
                                    (<t t-out="this.log.selectedTimelines().size" /> / <t t-out="this.log.timelineKeys().length" />)
                                </span>
                                <button 
                                    t-attf-class="filter-toggle {{ this.showTimelineFilters() ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="this.toggleTimelineFilters"
                                >
                                    <t t-out="this.showTimelineFilters() ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="this.showTimelineFilters()" class="filter-content">
                                <div class="filter-actions">
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllTimelines(true)">Select All</button>
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllTimelines(false)">Deselect All</button>
                                </div>
                                
                                <div class="filter-items">
                                    <div 
                                        t-foreach="this.log.timelineKeys()" 
                                        t-as="timelineKey" 
                                        t-key="timelineKey"
                                        class="filter-item"
                                        t-att-title="this.log.formatTimelineLabel(timelineKey)"
                                    >
                                        <label class="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                t-model="this.timelineModel(timelineKey)"
                                            />
                                            <span class="timeline-label" t-out="this.log.formatTimelineLabel(timelineKey)"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Snapshot Filters -->
                        <div t-if="this.log.snapshotKeys().length > 0" class="filter-section">
                            <div class="filter-header" t-on-click="this.toggleSnapshotFilters">
                                <h4>Snapshots</h4>
                                <span class="filter-count">
                                    (<t t-out="this.log.selectedSnapshots().size" /> / <t t-out="this.log.snapshotKeys().length" />)
                                </span>
                                <button 
                                    t-attf-class="filter-toggle {{ this.showSnapshotFilters() ? 'expanded' : 'collapsed' }}"
                                    t-on-click.stop="this.toggleSnapshotFilters"
                                >
                                    <t t-out="this.showSnapshotFilters() ? '▼' : '►'" />
                                </button>
                            </div>
                            
                            <div t-if="this.showSnapshotFilters()" class="filter-content">
                                <div class="filter-actions">
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllSnapshots(true)">Select All</button>
                                    <button class="filter-action-btn" t-on-click="() => this.toggleAllSnapshots(false)">Deselect All</button>
                                </div>
                                
                                <div class="filter-items">
                                    <div 
                                        t-foreach="this.log.snapshotKeys()" 
                                        t-as="snapshotKey" 
                                        t-key="snapshotKey"
                                        class="filter-item"
                                    >
                                        <label class="checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                t-model="this.snapshotModel(snapshotKey)"
                                            />
                                            <span class="snapshot-label" t-out="this.log.formatSnapshotLabel(snapshotKey)"></span>
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
                        t-if="this.activeView() === 'analysis'"
                    />
                    
                    <!-- Timelines View -->
                    <TimelineViewer 
                        t-if="this.activeView() === 'timelines'"
                    />
                    
                    <!-- Snapshots View -->
                    <div t-if="this.activeView() === 'snapshots'" class="snapshots-container">
                        <h3>Connection Snapshots</h3>
                        <p class="view-description">Each snapshot shows the complete state of all sessions at a specific moment.</p>
                        
                        <NoData 
                            t-if="!this.log.filteredSnapshotKeys().length" 
                            message="'No snapshot data available in this log file'"
                        />
                        
                        <div t-else="" class="snapshot-list">
                            <div 
                                t-foreach="this.log.filteredSnapshotKeys()" 
                                t-as="snapshotKey" 
                                t-key="snapshotKey"
                                class="snapshot-entry"
                            >
                                <SnapshotViewer 
                                    snapshotKey="snapshotKey"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Raw Data View -->
                    <div t-if="this.activeView() === 'raw'" class="raw-data-container">
                        <h3>Raw Log Data</h3>
                        <div class="raw-data">
                            <pre t-out="window.JSON.stringify(this.log.rawData(), null, 2)"></pre>
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
        this.fileName = signal("");
        this.activeView = signal("analysis");
        this.isDragOver = signal(false);
        this.showTimelineFilters = signal(false);
        this.showSnapshotFilters = signal(false);

        this.viewOptions = [
            { id: "analysis", label: "Analysis" },
            { id: "timelines", label: "Timelines" },
            { id: "snapshots", label: "Snapshots" },
            { id: "raw", label: "Raw Data" },
        ];
        this.log = plugin(LogPlugin);
    }

    toggleAllTimelines(select = true) {
        if (select) {
            this.log.selectAllTimelines();
        } else {
            this.log.deselectAllTimelines();
        }
    }

    toggleAllSnapshots(select = true) {
        if (select) {
            this.log.selectAllSnapshots();
        } else {
            this.log.deselectAllSnapshots();
        }
    }

    toggleTimelineFilters() {
        this.showTimelineFilters.set(!this.showTimelineFilters());
    }

    toggleSnapshotFilters() {
        this.showSnapshotFilters.set(!this.showSnapshotFilters());
    }

    triggerFileInput() {
        document.querySelector('input[type="file"]').click();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        this.processFile(file);
    }

    onDragOver(event) {
        this.isDragOver.set(true);
    }

    onDragLeave(event) {
        this.isDragOver.set(false);
    }

    onFileDrop(event) {
        this.isDragOver.set(false);

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

        this.fileName.set(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const logs = JSON.parse(e.target.result);
                this.log.load(logs);
            } catch {
                alert("Error parsing the log file. Please ensure it is a valid JSON file.");
            }
        };
        reader.readAsText(file);
    }

    setActiveView(viewId) {
        this.activeView.set(viewId);
    }

    timelineModel(timelineKey) {
        const model = () => this.log.selectedTimelines().has(timelineKey);
        model.set = (value) => {
            const selected = this.log.selectedTimelines();
            if (value) {
                selected.add(timelineKey);
            } else {
                selected.delete(timelineKey);
            }
        };
        return model;
    }

    snapshotModel(snapshotKey) {
        const model = () => this.log.selectedSnapshots().has(snapshotKey);
        model.set = (value) => {
            const selected = this.log.selectedSnapshots();
            if (value) {
                selected.add(snapshotKey);
            } else {
                selected.delete(snapshotKey);
            }
        };
        return model;
    }
}
