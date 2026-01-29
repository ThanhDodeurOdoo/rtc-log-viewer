const { Component, signal, plugin } = owl;
import { LogPlugin } from "../../plugins/log_plugin.js";

export class TimelineFilters extends Component {
    static template = "TimelineFilters";

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
