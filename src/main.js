const { Component, xml, signal, plugin } = owl;
import { UploadPanel } from "./main_upload.js";
import { SystemInfoPanel } from "./main_info_panel.js";
import { ViewControls } from "./main_controls.js";
import { MainView } from "./main_view.js";
import { LogPlugin } from "./plugins/log_plugin.js";

export class Main extends Component {
    static template = xml`
        <div id="main" class="rtc-log-viewer">
            <UploadPanel t-if="!this.log.isLoaded()" />

            <div t-if="this.log.isLoaded()" class="log-content">
                <div class="info-panel">
                    <SystemInfoPanel />
                    <ViewControls activeView="this.activeView" />
                </div>

                <MainView activeView="this.activeView" />
            </div>

            <footer class="app-footer">
                <p>Powered by <a href="https://github.com/odoo/owl" target="_blank">odoo/OWL</a></p>
                <p>Source code on <a href="https://github.com/ThanhDodeurOdoo/rtc-log-viewer" target="_blank">GitHub</a></p>
            </footer>
        </div>
    `;

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
