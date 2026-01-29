const { Component, signal, props } = owl;

export class ExpandableSection extends Component {
    static template = "ExpandableSection";

    props = props();

    setup() {
        this.expanded = signal(this.props.initialExpanded || false);
    }

    toggleExpanded() {
        this.expanded.set(!this.expanded());
    }
}
