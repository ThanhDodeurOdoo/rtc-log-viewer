const { Component, App, xml } = owl;
import { Main } from "./main.js";
import { LogPlugin } from "./plugins/log_plugin.js";
class Root extends Component {
    static template = xml`
        <div id="root">
            <Main />
        </div>
    `;

    static components = { Main };
}

async function start() {
    try {
        const app = new App({ plugins: [LogPlugin] });
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
