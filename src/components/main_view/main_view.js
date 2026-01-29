const { Component, plugin, props, types } = owl;
import { TimelineViewer } from "../timeline_viewer/timeline_viewer.js";
import { SnapshotViewer } from "../snapshot_viewer/snapshot_viewer.js";
import { AnalysisView } from "../analysis_view/analysis_view.js";
import { StatsView } from "../stats_view/stats_view.js";
import { NoData } from "../no_data/no_data.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

export class MainView extends Component {
    static template = "MainView";

    static components = {
        TimelineViewer,
        SnapshotViewer,
        NoData,
        AnalysisView,
        StatsView,
    };

    props = props({ activeView: types.signal() });

    setup() {
        this.log = plugin(LogPlugin);
    }
}
