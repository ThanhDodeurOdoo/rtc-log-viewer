const { Component, mount, xml } = owl;
import { Main } from "./main.js";
class Root extends Component {
    static template = xml`
        <div id="root">
            <Main />
        </div>
    `;

    static components = { Main };
}

document.addEventListener("DOMContentLoaded", () => {
    mount(Root, document.getElementById("app"));
});
