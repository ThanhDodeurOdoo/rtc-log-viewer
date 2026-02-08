const { Component, props, signal, computed } = owl;
import helpers from "../../utils/helpers.js";

const VIRTUALIZATION_THRESHOLD = 300;
const VIRTUAL_ROW_HEIGHT = 32;
const VIRTUAL_BUFFER_ROWS = 10;

export class EventList extends Component {
    static template = "EventList";

    props = props();

    setup() {
        this.helpers = helpers;
        this.containerRef = signal(null);
        this.scrollTop = signal(0);
        this.viewportHeight = signal(300);
        this.rowHeight = VIRTUAL_ROW_HEIGHT;

        this.isVirtualized = computed(
            () => (this.props.events || []).length >= VIRTUALIZATION_THRESHOLD
        );
        this.totalHeight = computed(
            () => (this.props.events || []).length * this.rowHeight
        );
        this.visibleWindow = computed(() => {
            const events = this.props.events || [];
            if (!this.isVirtualized()) {
                return { start: 0, end: events.length };
            }
            const start = Math.max(
                0,
                Math.floor(this.scrollTop() / this.rowHeight) -
                    VIRTUAL_BUFFER_ROWS
            );
            const visibleRows =
                Math.ceil(this.viewportHeight() / this.rowHeight) +
                VIRTUAL_BUFFER_ROWS * 2;
            const end = Math.min(events.length, start + visibleRows);
            return { start, end };
        });
        this.visibleItems = computed(() => {
            const events = this.props.events || [];
            const { start, end } = this.visibleWindow();
            const items = [];
            for (let index = start; index < end; index++) {
                items.push({ index, event: events[index] });
            }
            return items;
        });
        this.visibleOffset = computed(() => this.visibleWindow().start * this.rowHeight);
    }

    mounted() {
        this.syncViewportHeight();
    }

    patched() {
        this.syncViewportHeight();
    }

    syncViewportHeight() {
        const container = this.containerRef();
        if (!container) {
            return;
        }
        this.viewportHeight.set(container.clientHeight || 300);
    }

    onScroll(event) {
        const target = event.target;
        this.scrollTop.set(target.scrollTop || 0);
        this.viewportHeight.set(target.clientHeight || 300);
    }
}
