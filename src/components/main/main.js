const { Component, signal, plugin } = owl;
import { UploadPanel } from "../upload_panel/upload_panel.js";
import { SystemInfoPanel } from "../system_info_panel/system_info_panel.js";
import { ViewControls } from "../view_controls/view_controls.js";
import { MainView } from "../main_view/main_view.js";
import { LogPlugin } from "../../plugins/log_plugin.js";

export class Main extends Component {
    static template = "Main";

    static components = {
        UploadPanel,
        SystemInfoPanel,
        ViewControls,
        MainView,
    };

    setup() {
        this.activeView = signal("analysis");
        this.log = plugin(LogPlugin);
    }
}
