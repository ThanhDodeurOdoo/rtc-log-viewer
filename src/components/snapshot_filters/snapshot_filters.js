const { Component, signal, plugin } = owl;
import { LogPlugin } from "../../plugins/log_plugin.js";

export class SnapshotFilters extends Component {
    static template = "SnapshotFilters";

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
