const { Component, xml, useState } = owl;
import helpers from './utils/helpers.js';

export class ZoomControl extends Component {
    static template = xml`
        <div class="zoom-navigator">
            <div class="zoom-overview">
                <div class="zoom-overview-bar" t-on-mousedown="onBarClick">
                    <!-- Timeline with event markers -->
                    <div class="zoom-overview-timeline">
                        <div 
                            t-foreach="props.events" 
                            t-as="event" 
                            t-key="event.id"
                            t-attf-class="zoom-overview-event {{ event.level || 'info' }}"
                            t-attf-style="left: {{ event.fullPosition }}%;"
                        ></div>
                    </div>
                    
                    <!-- Zoom selector with handles -->
                    <div 
                        class="zoom-selector" 
                        t-attf-style="left: {{ state.zoomStartPercent }}%; width: {{ zoomWidthPercent }}%;"
                        t-on-mousedown="onSelectorMouseDown"
                    >
                        <div 
                            class="zoom-handle zoom-handle-left"
                            t-on-mousedown.stop="startLeftHandleDrag"
                        ></div>
                        <div 
                            class="zoom-handle zoom-handle-right"
                            t-on-mousedown.stop="startRightHandleDrag"
                        ></div>
                    </div>
                </div>
            </div>
            
            <div class="zoom-controls">
                <button 
                    class="zoom-control-btn" 
                    t-att-disabled="isLowZoom"
                    t-on-click="resetZoom"
                >Reset Zoom</button>
                <button 
                    class="zoom-control-btn" 
                    t-on-click="zoomOut"
                    t-att-disabled="isLowZoom"
                >-</button>
                <button 
                    class="zoom-control-btn" 
                    t-on-click="zoomIn"
                >+</button>
            </div>
            
            <div t-if="props.totalDuration" class="zoom-duration">
                Visible timespan: <span t-esc="helpers.formatDuration(getVisibleDuration())"></span>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            zoomLevel: 1,
            zoomStartPercent: 0
        });

        this.onBarClick = this.onBarClick.bind(this);
        this.onSelectorMouseDown = this.onSelectorMouseDown.bind(this);
        this.startLeftHandleDrag = this.startLeftHandleDrag.bind(this);
        this.startRightHandleDrag = this.startRightHandleDrag.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.helpers = helpers;
    }

    get isLowZoom() {
        return this.state.zoomLevel <= 1;
    }

    get zoomWidthPercent() {
        return Math.min(100, 100 / this.state.zoomLevel);
    }

    /**
     * @returns {number} Duration of the visible range in ms
     */
    getVisibleDuration() {
        if (!this.props.totalDuration) return 0;
        return this.props.totalDuration / this.state.zoomLevel;
    }

    onBarClick(ev) {
        if (ev.target.closest('.zoom-selector')) {
            return;
        }

        const rect = ev.currentTarget.getBoundingClientRect();
        const clickPosition = (ev.clientX - rect.left) / rect.width;
        const clickPercent = clickPosition * 100;

        // Center the zoom window at the click position
        const halfWidth = this.zoomWidthPercent / 2;
        let newStart = clickPercent - halfWidth;

        // Ensure it stays within bounds
        newStart = Math.max(0, Math.min(100 - this.zoomWidthPercent, newStart));

        this.state.zoomStartPercent = newStart;
        this.notifyZoomChange();
    }

    onSelectorMouseDown(ev) {
        if (ev.target.classList.contains('zoom-handle')) {
            return;
        }

        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.parentElement.getBoundingClientRect();

        this.dragging = {
            type: 'move',
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width
        };

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.body.classList.add('dragging');
    }

    startLeftHandleDrag(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.closest('.zoom-overview-bar').getBoundingClientRect();

        this.dragging = {
            type: 'left',
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width
        };

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.body.classList.add('dragging');
    }

    startRightHandleDrag(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        const rect = ev.currentTarget.closest('.zoom-overview-bar').getBoundingClientRect();

        this.dragging = {
            type: 'right',
            startX: ev.clientX,
            startLeft: this.state.zoomStartPercent,
            startWidth: 100 / this.state.zoomLevel,
            barWidth: rect.width
        };

        // Add global event listeners
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.body.classList.add('dragging');
    }

    // Handle mouse movement for all drag operations
    onMouseMove(ev) {
        if (!this.dragging) return;

        const deltaX = ev.clientX - this.dragging.startX;
        const deltaPercent = (deltaX / this.dragging.barWidth) * 100;

        switch (this.dragging.type) {
            case 'left': {
                // Dragging left handle - adjust start position and width
                let newStartPercent = this.dragging.startLeft + deltaPercent;
                let newWidthPercent = this.dragging.startWidth - deltaPercent;

                // Enforce constraints
                if (newStartPercent < 0) {
                    newStartPercent = 0;
                    newWidthPercent = this.dragging.startLeft + this.dragging.startWidth;
                }

                if (newWidthPercent < 5) { // Minimum width of 5%
                    newWidthPercent = 5;
                    newStartPercent = this.dragging.startLeft + this.dragging.startWidth - 5;
                }

                if (newStartPercent + newWidthPercent > 100) {
                    newStartPercent = 100 - newWidthPercent;
                }

                this.state.zoomStartPercent = newStartPercent;
                this.state.zoomLevel = 100 / newWidthPercent;
                break;
            }

            case 'right': {
                // Dragging right handle - adjust width
                let newWidthPercent = this.dragging.startWidth + deltaPercent;

                // Enforce constraints
                if (newWidthPercent < 5) newWidthPercent = 5; // Minimum width

                if (this.state.zoomStartPercent + newWidthPercent > 100) {
                    newWidthPercent = 100 - this.state.zoomStartPercent;
                }

                this.state.zoomLevel = 100 / newWidthPercent;
                break;
            }

            case 'move': {
                // Dragging entire selector - move without changing size
                let newStartPercent = this.dragging.startLeft + deltaPercent;
                const widthPercent = 100 / this.state.zoomLevel;

                // Enforce constraints
                if (newStartPercent < 0) newStartPercent = 0;
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
            document.body.classList.remove('dragging');

            // Remove global event listeners
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    notifyZoomChange() {
        this.props.onZoomChange({
            zoomLevel: this.state.zoomLevel,
            zoomStartPercent: this.state.zoomStartPercent
        });
    }

    resetZoom() {
        this.state.zoomLevel = 1;
        this.state.zoomStartPercent = 0;
        this.notifyZoomChange();
    }

    zoomIn() {
        if (this.state.zoomLevel >= 10) return; // Maximum zoom level

        const oldWidth = this.zoomWidthPercent;
        const newLevel = Math.min(10, this.state.zoomLevel * 1.5);
        const newWidth = 100 / newLevel;

        // Adjust start position to keep center point the same
        const centerPoint = this.state.zoomStartPercent + (oldWidth / 2);
        const newStart = centerPoint - (newWidth / 2);

        this.state.zoomLevel = newLevel;
        this.state.zoomStartPercent = Math.max(0, Math.min(100 - newWidth, newStart));

        this.notifyZoomChange();
    }

    zoomOut() {
        if (this.state.zoomLevel <= 1) {
            this.resetZoom();
            return;
        }

        const oldWidth = this.zoomWidthPercent;
        const newLevel = Math.max(1, this.state.zoomLevel / 1.5);
        const newWidth = 100 / newLevel;

        // Adjust start position to keep center point the same
        const centerPoint = this.state.zoomStartPercent + (oldWidth / 2);
        const newStart = centerPoint - (newWidth / 2);

        this.state.zoomLevel = newLevel;
        this.state.zoomStartPercent = Math.max(0, Math.min(100 - newWidth, newStart));

        // If we're fully zoomed out, reset completely
        if (this.state.zoomLevel <= 1) {
            this.resetZoom();
        } else {
            this.notifyZoomChange();
        }
    }
}
