const { Component, xml, useState } = owl;
import helpers from './utils/helpers.js';
import { NoData } from './common/ui_components.js';
import { TimelineEntry } from './timeline_entry.js';

export class TimelineViewer extends Component {
    static template = xml`
        <div class="timelines-container">
            <h3>Call Timelines</h3>
            <p class="view-description">Each timeline represents a sequence of events for a specific call session.</p>
            
            <NoData 
                t-if="!timelineKeys.length" 
                message="'No timeline data available in this log file'"
            />
            
            <div t-else="" class="timeline-list">
                <div 
                    t-foreach="timelineKeys" 
                    t-as="timelineKey" 
                    t-key="timelineKey"
                >
                    <TimelineEntry 
                        timelineKey="timelineKey"
                        timelineData="props.logs.timelines[timelineKey]"
                    />
                </div>
            </div>
        </div>
    `;

    static components = {
        NoData,
        TimelineEntry
    };

    setup() {
        this.helpers = helpers;
    }

    get timelineKeys() {
        if (!this.props.logs || !this.props.logs.timelines) return [];
        return Object.keys(this.props.logs.timelines).sort();
    }
}