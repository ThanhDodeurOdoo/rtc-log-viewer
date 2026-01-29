const { App } = owl;
import { Root } from "./components/root/root.js";
import { LogPlugin } from "./plugins/log_plugin.js";

const TEMPLATE_FILES = [
    "./components/root/root.xml",
    "./components/main/main.xml",
    "./components/upload_panel/upload_panel.xml",
    "./components/system_info_panel/system_info_panel.xml",
    "./components/view_controls/view_controls.xml",
    "./components/timeline_filters/timeline_filters.xml",
    "./components/snapshot_filters/snapshot_filters.xml",
    "./components/main_view/main_view.xml",
    "./components/analysis_view/analysis_view.xml",
    "./components/stats_view/stats_view.xml",
    "./components/timeline_viewer/timeline_viewer.xml",
    "./components/timeline_entry/timeline_entry.xml",
    "./components/snapshot_viewer/snapshot_viewer.xml",
    "./components/zoom_control/zoom_control.xml",
    "./components/log_viewer/log_viewer.xml",
    "./components/expandable_section/expandable_section.xml",
    "./components/no_data/no_data.xml",
    "./components/event_list/event_list.xml",
    "./components/session_properties/session_properties.xml",
    "./components/connection_state/connection_state.xml",
];

async function loadTemplates(app) {
    const responses = await Promise.all(
        TEMPLATE_FILES.map((path) => fetch(new URL(path, import.meta.url))),
    );
    responses.forEach((response, index) => {
        if (!response.ok) {
            throw new Error(
                `Failed to load template ${TEMPLATE_FILES[index]}: ${response.status}`,
            );
        }
    });
    const templates = await Promise.all(responses.map((response) => response.text()));
    for (const template of templates) {
        app.addTemplates(template);
    }
}

async function start() {
    try {
        const app = new App({ plugins: [LogPlugin] });
        await loadTemplates(app);
        const root = app.createRoot(Root);
        const target = document.getElementById("app");
        if (!target) {
            throw new Error("Missing mount target #app");
        }
        await root.mount(target);
    } catch (e) {
        console.error("Error starting Owl App:", e);
        document.body.innerHTML = `
            <div style="color:red; padding: 20px;">
                <h1>Error Starting App</h1>
                <pre>${e instanceof Error ? e.message + "\n" + e.stack : String(e)}</pre>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    start();
});
