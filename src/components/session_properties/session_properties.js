const { Component, props } = owl;
import helpers from "../../utils/helpers.js";

export class SessionProperties extends Component {
    static template = "SessionProperties";

    props = props();

    setup() {
        this.helpers = helpers;
    }
}
