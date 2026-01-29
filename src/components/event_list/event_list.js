const { Component, props } = owl;
import helpers from "../../utils/helpers.js";

export class EventList extends Component {
    static template = "EventList";

    props = props();

    setup() {
        this.helpers = helpers;
    }
}
