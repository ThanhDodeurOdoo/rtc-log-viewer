const { Component, plugin } = owl;
import { NoData } from "../no_data/no_data.js";
import { TimelineEntry } from "../timeline_entry/timeline_entry.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

export class TimelineViewer extends Component {
    static template = "TimelineViewer";

    static components = {
        NoData,
        TimelineEntry,
    };

    setup() {
        this.log = plugin(LogPlugin);
        this.timelineKeys = this.log.filteredTimelineKeys;
    }
}
