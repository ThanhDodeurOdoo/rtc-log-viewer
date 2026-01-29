const { Component, xml, plugin } = owl;
import { NoData } from "./common/ui_components.js";
import { TimelineEntry } from "./timeline_entry.js";
import { LogPlugin } from "./plugins/log_plugin.js";

export class TimelineViewer extends Component {
    static template = xml`
        <div class="timelines-container">
            <h3>Call Timelines</h3>
            <p class="view-description">Each timeline represents a sequence of events for a specific call session.</p>
            
            <NoData 
                t-if="!this.timelineKeys().length" 
                message="'No timeline data available in this log file'"
            />
            
            <div t-else="" class="timeline-list">
                <div 
                    t-foreach="this.timelineKeys()" 
                    t-as="timelineKey" 
                    t-key="timelineKey"
                >
                    <TimelineEntry 
                        timelineKey="timelineKey"
                    />
                </div>
            </div>
        </div>
    `;

    static components = {
        NoData,
        TimelineEntry,
    };

    setup() {
        this.log = plugin(LogPlugin);
        this.timelineKeys = this.log.filteredTimelineKeys;
    }
}
