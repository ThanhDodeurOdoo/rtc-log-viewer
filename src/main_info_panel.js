const { Component, xml, plugin } = owl;
import { LogPlugin } from "./plugins/log_plugin.js";

export class SystemInfoPanel extends Component {
    static template = xml`
        <div class="system-info">
            <h3>System Information</h3>
            <table>
                <tr t-if="this.log.odooInfo() and this.log.odooInfo().server_version">
                    <td>Server Version:</td>
                    <td t-out="this.log.odooInfo().server_version"></td>
                </tr>
                <tr t-if="this.log.odooInfo() and this.log.odooInfo().db">
                    <td>Database:</td>
                    <td t-out="this.log.odooInfo().db"></td>
                </tr>
                <tr t-if="this.log.odooInfo() and this.log.odooInfo().isEnterprise !== undefined">
                    <td>Enterprise:</td>
                    <td t-out="this.log.odooInfo().isEnterprise ? 'Yes' : 'No'"></td>
                </tr>
            </table>
        </div>
    `;

    setup() {
        this.log = plugin(LogPlugin);
    }
}
