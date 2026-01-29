const { Component, plugin } = owl;
import { LogPlugin } from "../../plugins/log_plugin.js";

export class SystemInfoPanel extends Component {
    static template = "SystemInfoPanel";

    setup() {
        this.log = plugin(LogPlugin);
    }
}
