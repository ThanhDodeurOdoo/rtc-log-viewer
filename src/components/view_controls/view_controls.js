const { Component, props, types } = owl;
import { TimelineFilters } from "../timeline_filters/timeline_filters.js";
import { SnapshotFilters } from "../snapshot_filters/snapshot_filters.js";

export class ViewControls extends Component {
    static components = {
        TimelineFilters,
        SnapshotFilters,
    };

    static template = "ViewControls";

    props = props({ activeView: types.signal() });

    setup() {
        this.viewOptions = [
            { id: "analysis", label: "Analysis" },
            { id: "timing", label: "Timing" },
            { id: "timelines", label: "Timelines" },
            { id: "snapshots", label: "Snapshots" },
            { id: "raw", label: "Raw Data" },
        ];
    }

    setActiveView(viewId) {
        this.props.activeView.set(viewId);
    }
}
