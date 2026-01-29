const { Component, xml, signal, plugin, props, types } = owl;
import { LogPlugin } from "./plugins/log_plugin.js";

class TimelineFilters extends Component {
    static template = xml`
        <div t-if="this.log.timelineKeys().length > 0" class="filter-section">
            <div class="filter-header" t-on-click="this.toggle">
                <h4>Timelines</h4>
                <span class="filter-count">
                    (<t t-out="this.log.selectedTimelines().size" /> / <t t-out="this.log.timelineKeys().length" />)
                </span>
                <button
                    t-attf-class="filter-toggle {{ this.isOpen() ? 'expanded' : 'collapsed' }}"
                    t-on-click.stop="this.toggle"
                >
                    <t t-out="this.isOpen() ? '▼' : '►'" />
                </button>
            </div>

            <div t-if="this.isOpen()" class="filter-content">
                <div class="filter-actions">
                    <button class="filter-action-btn" t-on-click="() => this.toggleAll(true)">Select All</button>
                    <button class="filter-action-btn" t-on-click="() => this.toggleAll(false)">Deselect All</button>
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
    `;

    setup() {
        this.log = plugin(LogPlugin);
        this.isOpen = signal(false);
    }

    toggle() {
        this.isOpen.set(!this.isOpen());
    }

    toggleAll(select) {
        if (select) {
            this.log.selectAllTimelines();
        } else {
            this.log.deselectAllTimelines();
        }
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
}

class SnapshotFilters extends Component {
    static template = xml`
        <div t-if="this.log.snapshotKeys().length > 0" class="filter-section">
            <div class="filter-header" t-on-click="this.toggle">
                <h4>Snapshots</h4>
                <span class="filter-count">
                    (<t t-out="this.log.selectedSnapshots().size" /> / <t t-out="this.log.snapshotKeys().length" />)
                </span>
                <button
                    t-attf-class="filter-toggle {{ this.isOpen() ? 'expanded' : 'collapsed' }}"
                    t-on-click.stop="this.toggle"
                >
                    <t t-out="this.isOpen() ? '▼' : '►'" />
                </button>
            </div>

            <div t-if="this.isOpen()" class="filter-content">
                <div class="filter-actions">
                    <button class="filter-action-btn" t-on-click="() => this.toggleAll(true)">Select All</button>
                    <button class="filter-action-btn" t-on-click="() => this.toggleAll(false)">Deselect All</button>
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
    `;

    setup() {
        this.log = plugin(LogPlugin);
        this.isOpen = signal(false);
    }

    toggle() {
        this.isOpen.set(!this.isOpen());
    }

    toggleAll(select) {
        if (select) {
            this.log.selectAllSnapshots();
        } else {
            this.log.deselectAllSnapshots();
        }
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

export class ViewControls extends Component {
    static components = {
        TimelineFilters,
        SnapshotFilters,
    };

    static template = xml`
        <div class="view-controls">
            <h3>View Options</h3>
            <div class="view-buttons">
                <button
                    t-foreach="this.viewOptions"
                    t-as="option"
                    t-key="option.id"
                    t-attf-class="view-btn {{ this.props.activeView() === option.id ? 'active' : '' }}"
                    t-on-click="() => this.setActiveView(option.id)"
                    t-out="option.label"
                />
            </div>

            <TimelineFilters />
            <SnapshotFilters />
        </div>
    `;

    props = props({ activeView: types.signal() });

    setup() {
        this.viewOptions = [
            { id: "analysis", label: "Analysis" },
            { id: "timelines", label: "Timelines" },
            { id: "snapshots", label: "Snapshots" },
            { id: "raw", label: "Raw Data" },
        ];
    }

    setActiveView(viewId) {
        this.props.activeView.set(viewId);
    }
}
