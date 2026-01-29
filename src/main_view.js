const { Component, xml, plugin, props, types } = owl;
import { TimelineViewer } from "./timeline_viewer.js";
import { SnapshotViewer } from "./snapshot_viewer.js";
import { AnalysisView } from "./analysis_view.js";
import { NoData } from "./common/ui_components.js";
import { LogPlugin } from "./plugins/log_plugin.js";

export class MainView extends Component {
    static components = {
        TimelineViewer,
        SnapshotViewer,
        NoData,
        AnalysisView,
    };

    static template = xml`
        <div class="main-view">
            <AnalysisView t-if="this.props.activeView() === 'analysis'" />

            <TimelineViewer t-if="this.props.activeView() === 'timelines'" />

            <div t-if="this.props.activeView() === 'snapshots'" class="snapshots-container">
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
                        <SnapshotViewer snapshotKey="snapshotKey" />
                    </div>
                </div>
            </div>

            <div t-if="this.props.activeView() === 'raw'" class="raw-data-container">
                <h3>Raw Log Data</h3>
                <div class="raw-data">
                    <pre t-out="window.JSON.stringify(this.log.rawData(), null, 2)"></pre>
                </div>
            </div>
        </div>
    `;

    props = props({ activeView: types.signal() });

    setup() {
        this.log = plugin(LogPlugin);
    }
}
