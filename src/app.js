const { Component, mount, xml } = owl;
import { Main } from './main.js';

// Define the root component
class Root extends Component {
    static template = xml`
        <div id="root">
        <h1>RTC LOG VIEWER</h1>
        <Main />
        </div>
    `;

    static components = { Main };
}

// Mount the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    mount(Root, document.getElementById('app'));
});
