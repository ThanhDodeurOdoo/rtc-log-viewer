const { Component, xml, proxy, computed, props, types } = owl;
import helpers from "./utils/helpers.js";

const ZOOM = {
    MIN_WIDTH_PERCENT: 0.01,
    ZOOM_IN_FACTOR: 1.5,
    ZOOM_OUT_FACTOR: 1.5,
    SLIDE_OVERLAP_FACTOR: 0.5,
};

const DRAG_TYPE = {
    LEFT: "left",
    RIGHT: "right",
    MOVE: "move",
};

const SELECTORS = {
    ZOOM_SELECTOR: ".zoom-selector",
    ZOOM_HANDLE: ".zoom-handle",
    ZOOM_OVERVIEW_BAR: ".zoom-overview-bar",
};

export class ZoomControl extends Component {
    static template = xml`
        <div class="zoom-navigator">
            <div class="zoom-overview">
                <div class="zoom-overview-bar" t-on-mousedown="this.onBarClick">
                    <!-- Timeline with event markers -->
                    <div class="zoom-overview-timeline">
                        <div
                            t-foreach="this.props.events()"
                            t-as="event"
                            t-key="event.id"
                            t-attf-class="zoom-overview-event {{ event.level || 'info' }}"
                            t-attf-style="left: {{ event.fullPosition }}%;"
                        ></div>
                    </div>

                    <!-- Zoom selector with handles -->
                    <div
                        class="zoom-selector"
                        t-attf-style="left: {{ this.state.zoomStartPercent }}%; width: {{ this.zoomWidthPercent() }}%;"
                        t-on-mousedown="this.onSelectorMouseDown"
                    >
                        <div
                            class="zoom-handle zoom-handle-left"
                            t-on-mousedown.stop="this.startLeftHandleDrag"
                        ></div>
                        <div
                            class="zoom-handle zoom-handle-right"
                            t-on-mousedown.stop="this.startRightHandleDrag"
                        ></div>
                    </div>
                </div>
            </div>

            <div class="zoom-controls">
                <button
                    class="zoom-control-btn"
                    t-on-click="this.slideLeft"
                    t-att-disabled="this.cannotSlideLeft()"
                    title="Slide left"
                >←</button>
                <button
                    class="zoom-control-btn"
                    t-att-disabled="this.isLowZoom()"
                    t-on-click="this.resetZoom"
                >Reset Zoom</button>
                <button
                    class="zoom-control-btn"
                    t-on-click="this.zoomOut"
                    t-att-disabled="this.isLowZoom()"
                >-</button>
                <button
                    class="zoom-control-btn"
                    t-on-click="this.zoomIn"
                >+</button>
                <button
                    class="zoom-control-btn"
                    t-on-click="this.slideRight"
                    t-att-disabled="this.cannotSlideRight()"
                    title="Slide right"
                >→</button>
            </div>

            <div t-if="this.props.totalDuration()" class="zoom-duration">
                Visible timespan: <span t-out="this.helpers.formatDuration(this.visibleDuration())"></span>
            </div>
        </div>
    `;

    props = props({
        events: types.reactiveValue(),
        totalDuration: types.reactiveValue(),
        onZoomChange: types.function(),
    });

    setup() {
        this.state = proxy({
            zoomLevel: 1, // Start with no zoom
            zoomStartPercent: 0, // Start at the beginning of the timeline
        });

        this.isLowZoom = computed(() => this.state.zoomLevel <= 1);
        this.zoomWidthPercent = computed(() => Math.min(100, 100 / this.state.zoomLevel));
        this.cannotSlideLeft = computed(() => this.state.zoomStartPercent <= 0);
        this.cannotSlideRight = computed(() => {
            const maxStart = 100 - this.zoomWidthPercent();
            return this.state.zoomStartPercent >= maxStart;
        });
        this.visibleDuration = computed(() => {
            const totalDuration = this.props.totalDuration();
            if (!totalDuration) {
                return 0;
            }
            return totalDuration / this.state.zoomLevel;
        });

        // Bind methods
        this.onBarClick = this.onBarClick.bind(this);
        this.onSelectorMouseDown = this.onSelectorMouseDown.bind(this);
        this.startLeftHandleDrag = this.startLeftHandleDrag.bind(this);
        this.startRightHandleDrag = this.startRightHandleDrag.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.slideLeft = this.slideLeft.bind(this);
        this.slideRight = this.slideRight.bind(this);
        this.helpers = helpers;
    }

    onBarClick(ev) {
        if (ev.target.closest(SELECTORS.ZOOM_SELECTOR)) {
            return;
        }

        const rect = ev.currentTarget.getBoundingClientRect();
        const clickPosition = (ev.clientX - rect.left) / rect.width;
        const clickPercent = clickPosition * 100;

        // Center the zoom window at the click position
        const halfWidth = this.zoomWidthPercent() / 2;
        let newStart = clickPercent - halfWidth;

        // Ensure it stays within bounds
        newStart = Math.max(0, Math.min(100 - this.zoomWidthPercent(), newStart));

        this.state.zoomStartPercent = newStart;
        this.notifyZoomChange();
    }

    onSelectorMouseDown(ev) {
        if (ev.target.classList.contains(SELECTORS.ZOOM_HANDLE.substring(1))) {
            return;
        }

        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.parentElement.getBoundingClientRect();

        this.dragging = {
            type: DRAG_TYPE.MOVE,
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width,
        };

        document.addEventListener("mousemove", this.onMouseMove);
        document.addEventListener("mouseup", this.onMouseUp);
        document.body.classList.add("dragging");
    }

    startLeftHandleDrag(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.closest(SELECTORS.ZOOM_OVERVIEW_BAR).getBoundingClientRect();

        this.dragging = {
            type: DRAG_TYPE.LEFT,
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width,
        };

        document.addEventListener("mousemove", this.onMouseMove);
        document.addEventListener("mouseup", this.onMouseUp);
        document.body.classList.add("dragging");
    }

    startRightHandleDrag(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.closest(SELECTORS.ZOOM_OVERVIEW_BAR).getBoundingClientRect();

        this.dragging = {
            type: DRAG_TYPE.RIGHT,
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width,
        };

        // Add global event listeners
        document.addEventListener("mousemove", this.onMouseMove);
        document.addEventListener("mouseup", this.onMouseUp);
        document.body.classList.add("dragging");
    }

    // Handle mouse movement for all drag operations
    onMouseMove(ev) {
        if (!this.dragging) {
            return;
        }

        const deltaX = ev.clientX - this.dragging.startX;
        const deltaPercent = (deltaX / this.dragging.barWidth) * 100;

        switch (this.dragging.type) {
            case DRAG_TYPE.LEFT: {
                // Dragging left handle - adjust start position and width
                let newStartPercent = this.dragging.startLeft + deltaPercent;
                let newWidthPercent = this.dragging.startWidth - deltaPercent;

                // Enforce constraints
                if (newStartPercent < 0) {
                    newStartPercent = 0;
                    newWidthPercent = this.dragging.startLeft + this.dragging.startWidth;
                }

                if (newWidthPercent < ZOOM.MIN_WIDTH_PERCENT) {
                    newWidthPercent = ZOOM.MIN_WIDTH_PERCENT;
                    newStartPercent =
                        this.dragging.startLeft + this.dragging.startWidth - ZOOM.MIN_WIDTH_PERCENT;
                }

                if (newStartPercent + newWidthPercent > 100) {
                    newStartPercent = 100 - newWidthPercent;
                }

                this.state.zoomStartPercent = newStartPercent;
                this.state.zoomLevel = 100 / newWidthPercent;
                break;
            }

            case DRAG_TYPE.RIGHT: {
                // Dragging right handle - adjust width
                let newWidthPercent = this.dragging.startWidth + deltaPercent;

                // Enforce constraints
                if (newWidthPercent < ZOOM.MIN_WIDTH_PERCENT) {
                    newWidthPercent = ZOOM.MIN_WIDTH_PERCENT;
                }

                if (this.state.zoomStartPercent + newWidthPercent > 100) {
                    newWidthPercent = 100 - this.state.zoomStartPercent;
                }

                this.state.zoomLevel = 100 / newWidthPercent;
                break;
            }

            case DRAG_TYPE.MOVE: {
                // Dragging entire selector - move without changing size
                let newStartPercent = this.dragging.startLeft + deltaPercent;
                const widthPercent = 100 / this.state.zoomLevel;

                // Enforce constraints
                if (newStartPercent < 0) {
                    newStartPercent = 0;
                }
                if (newStartPercent + widthPercent > 100) {
                    newStartPercent = 100 - widthPercent;
                }

                this.state.zoomStartPercent = newStartPercent;
                break;
            }
        }

        this.notifyZoomChange();
    }

    onMouseUp() {
        if (this.dragging) {
            this.dragging = null;
            document.body.classList.remove("dragging");

            // Remove global event listeners
            document.removeEventListener("mousemove", this.onMouseMove);
            document.removeEventListener("mouseup", this.onMouseUp);
        }
    }

    notifyZoomChange() {
        this.props.onZoomChange({
            zoomLevel: this.state.zoomLevel,
            zoomStartPercent: this.state.zoomStartPercent,
        });
    }

    resetZoom() {
        this.state.zoomLevel = 1;
        this.state.zoomStartPercent = 0;
        this.notifyZoomChange();
    }

    zoomIn() {
        const oldWidth = this.zoomWidthPercent();
        const newLevel = this.state.zoomLevel * ZOOM.ZOOM_IN_FACTOR;
        const newWidth = 100 / newLevel;

        // Adjust start position to keep center point the same
        const centerPoint = this.state.zoomStartPercent + oldWidth / 2;
        const newStart = centerPoint - newWidth / 2;

        this.state.zoomLevel = newLevel;
        this.state.zoomStartPercent = Math.max(0, Math.min(100 - newWidth, newStart));

        this.notifyZoomChange();
    }

    zoomOut() {
        if (this.state.zoomLevel <= 1) {
            this.resetZoom();
            return;
        }

        const oldWidth = this.zoomWidthPercent();
        const newLevel = Math.max(1, this.state.zoomLevel / ZOOM.ZOOM_OUT_FACTOR);
        const newWidth = 100 / newLevel;

        // Adjust start position to keep center point the same
        const centerPoint = this.state.zoomStartPercent + oldWidth / 2;
        const newStart = centerPoint - newWidth / 2;

        this.state.zoomLevel = newLevel;
        this.state.zoomStartPercent = Math.max(0, Math.min(100 - newWidth, newStart));

        // If we're fully zoomed out, reset completely
        if (this.state.zoomLevel <= 1) {
            this.resetZoom();
        } else {
            this.notifyZoomChange();
        }
    }

    /**
     * Slides the zoom window to the left by a percentage of the window width
     * with a small overlap to ensure continuity
     */
    slideLeft() {
        if (this.cannotSlideLeft) {
            return;
        }

        const slideAmount = this.zoomWidthPercent() * ZOOM.SLIDE_OVERLAP_FACTOR;
        this.state.zoomStartPercent = Math.max(0, this.state.zoomStartPercent - slideAmount);
        this.notifyZoomChange();
    }

    /**
     * Slides the zoom window to the right by a percentage of the window width
     * with a small overlap to ensure continuity
     */
    slideRight() {
        if (this.cannotSlideRight) {
            return;
        }

        const slideAmount = this.zoomWidthPercent() * ZOOM.SLIDE_OVERLAP_FACTOR;
        const maxStart = 100 - this.zoomWidthPercent();
        this.state.zoomStartPercent = Math.min(maxStart, this.state.zoomStartPercent + slideAmount);
        this.notifyZoomChange();
    }
}
