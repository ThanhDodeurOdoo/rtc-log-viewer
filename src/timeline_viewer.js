const { Component, xml, useState } = owl;
import helpers from './utils/helpers.js';
import { ConnectionState, EventList } from './common/ui_components.js';

export class TimelineViewer extends Component {
    static template = xml`
        <div class="timeline-viewer">
            <div class="timeline-header">
                <h4 t-esc="getTimelineTitle()"></h4>
                <button 
                    t-attf-class="timeline-toggle {{ state.expanded ? 'expanded' : 'collapsed' }}"
                    t-on-click="() => this.state.expanded = !this.state.expanded"
                >
                <t t-esc="state.expanded ? '▼' : '►'" />
                </button>
            </div>
            
            <div t-if="state.expanded" class="timeline-content">
                <!-- Session tabs -->
                <div class="session-tabs">
                    <div 
                        t-foreach="sessionIds" 
                        t-as="sessionId" 
                        t-key="sessionId"
                        t-attf-class="session-tab {{ props.selectedSession === sessionId ? 'active' : '' }}"
                        t-on-click="() => this.selectSession(sessionId)"
                    >
                        Session <t t-esc="sessionId"/>
                        <span t-if="isSessionSelf(sessionId)" class="self-indicator">(Self)</span>
                    </div>
                </div>
                
                <!-- Visual Timeline -->
                <div t-if="state.activeSessionId" class="visual-timeline-container">
                    <h5>Session Timeline</h5>
                    <div class="visual-timeline">
                        <!-- Connection state segments -->
                        <t t-foreach="getConnectionStateSegments()" t-as="segment" t-key="segment_index">
                            <div 
                                class="timeline-segment" 
                                t-attf-class="timeline-segment {{ helpers.getConnectionStateClass(segment.state) }}"
                                t-attf-style="left: {{ segment.startPos }}%; width: {{ segment.width }}%;"
                                t-att-title="segment.state || 'Unknown state'"
                            ></div>
                        </t>
                        
                        <!-- Event markers -->
                        <div 
                            t-foreach="getProcessedEvents()" 
                            t-as="event" 
                            t-key="event_index"
                            t-attf-class="timeline-event {{ event.level || 'info' }}"
                            t-attf-style="left: {{ event.position }}%;"
                            t-on-click="() => this.highlightEvent(event_index)"
                            t-on-mouseenter="(e) => this.showTooltip(event, e)"
                            t-on-mouseleave="hideTooltip"
                            t-att-data-event-time="helpers.formatEventTime(event.original)"
                            t-att-data-event-level="event.level"
                            t-att-data-event-text="helpers.formatEventText(event.original)"
                        ></div>
                        
                        <!-- Floating tooltip that follows mouse -->
                        <div t-if="state.activeTooltip" class="event-tooltip" t-att-style="state.tooltipStyle">
                            <div class="tooltip-time" t-esc="state.activeTooltip.time"></div>
                            <div t-if="state.activeTooltip.level" t-attf-class="tooltip-level {{ state.activeTooltip.level }}" t-esc="state.activeTooltip.level"></div>
                            <div class="tooltip-text" t-esc="state.activeTooltip.text"></div>
                        </div>
                    </div>
                    <div class="timeline-times">
                        <div class="timeline-start-time" t-esc="formatTimelineTime(props.timelineData.start)"></div>
                        <div class="timeline-end-time" t-esc="formatTimelineTime(props.timelineData.end)"></div>
                    </div>
                </div>

                <!-- Session details -->
                <div t-if="state.activeSessionId" class="session-details">
                    <!-- Connection step -->
                    <div t-if="activeSessionInfo.step" class="connection-step">
                        <span class="property-name">Connection Step:</span>
                        <span class="step-value" t-esc="activeSessionInfo.step"></span>
                    </div>
                    
                    <!-- Connection state -->
                    <ConnectionState 
                        t-if="activeSessionInfo.state" 
                        state="activeSessionInfo.state" 
                        stateClass="helpers.getConnectionStateClass(activeSessionInfo.state)" 
                        label="'Connection State:'"
                    />
                    
                    <!-- Events log -->
                    <div class="events-log">
                        <h5>Events</h5>
                        <EventList 
                            events="sessionEvents" 
                            noDataMessage="'No events recorded for this session'"
                        />
                    </div>
                </div>
            </div>
        </div>
    `;

    static components = {
        ConnectionState,
        EventList
    };

    setup() {
        this.state = useState({
            expanded: false,
            activeSessionId: null,
            highlightedEventIndex: null,
            activeTooltip: null,
            tooltipStyle: ''
        });
        this.helpers = helpers;
    }

    mounted() {
        // Set first session as active by default when component is mounted
        if (this.sessionIds.length > 0 && !this.state.activeSessionId) {
            this.selectSession(this.sessionIds[0]);
        }
    }

    get sessionIds() {
        const timelineData = this.props.timelineData;
        if (!timelineData || !timelineData.entriesBySessionId) return [];

        return Object.keys(timelineData.entriesBySessionId)
            .filter(key => key !== 'hasTurn' && !isNaN(parseInt(key)))
            .sort((a, b) => parseInt(a) - parseInt(b));
    }

    get activeSessionInfo() {
        if (!this.state.activeSessionId || !this.props.timelineData || !this.props.timelineData.entriesBySessionId) {
            return {};
        }

        return this.props.timelineData.entriesBySessionId[this.state.activeSessionId] || {};
    }

    get sessionEvents() {
        const sessionInfo = this.activeSessionInfo;
        if (!sessionInfo || !sessionInfo.logs || !Array.isArray(sessionInfo.logs)) {
            return [];
        }

        return sessionInfo.logs;
    }

    getTimelineTitle() {
        if (!this.props.timelineData) return "Timeline";

        try {
            const date = new Date(this.props.timelineKey);
            const formattedDate = date.toLocaleString();

            const channelId = this.props.timelineData.channelId;
            const selfSessionId = this.props.timelineData.selfSessionId;

            return `Timeline: Channel ${channelId} - Session ${selfSessionId} - ${formattedDate}`;
        } catch (e) {
            return `Timeline: ${this.props.timelineKey}`;
        }
    }

    selectSession(sessionId) {
        this.state.activeSessionId = sessionId;
        this.props.onSessionSelect(sessionId);
        this.state.highlightedEventIndex = null;
    }

    isSessionSelf(sessionId) {
        if (!this.props.timelineData) return false;
        return sessionId === this.props.timelineData.selfSessionId?.toString();
    }

    // Extract timestamp from event for timeline positioning
    getEventTimestamp(event) {
        if (!event || !event.event) return null;

        const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
        if (timeMatch && timeMatch[1]) {
            // If it's ISO format, parse date
            if (timeMatch[1].includes('T')) {
                return new Date(timeMatch[1]).getTime();
            }
        }

        // Default to current time if no valid timestamp (shouldn't happen)
        return new Date().getTime();
    }

    // Calculate position along timeline (0-100%)
    calculateEventPosition(timestamp) {
        const timelineData = this.props.timelineData;
        if (!timelineData || !timelineData.start || !timelineData.end) return 0;

        const start = new Date(timelineData.start).getTime();
        const end = new Date(timelineData.end).getTime();

        if (!start || !end || end <= start || !timestamp) return 0;

        // Calculate position as percentage
        return ((timestamp - start) / (end - start)) * 100;
    }

    // Process events for visual timeline
    getProcessedEvents() {
        const events = this.sessionEvents;
        if (!events || events.length === 0) return [];

        return events.map((event, index) => {
            const timestamp = this.getEventTimestamp(event);
            // Ensure events have a level (default to info if not specified)
            let level = event.level || '';

            // Normalize levels to handle variations
            if (level.includes('warn')) level = 'warning';
            else if (level.includes('error')) level = 'error';
            else if (level === '') level = 'info';

            // Check for error messages in text if level isn't already error
            const text = helpers.formatEventText(event);
            if (level !== 'error' && (
                text.includes('error') ||
                text.includes('failed') ||
                text.includes('failure') ||
                text.includes('attempting to recover')
            )) {
                level = 'error';
            }

            // Extract connection state changes from event text
            const connectionStateChange = this.extractConnectionState(event);

            return {
                original: event,
                timestamp,
                position: this.calculateEventPosition(timestamp),
                level,
                text: helpers.formatEventText(event),
                index,
                connectionState: connectionStateChange
            };
        });
    }

    // Extract connection state from event text
    extractConnectionState(event) {
        if (!event || !event.event) return null;

        const text = helpers.formatEventText(event);

        // Look for connection state changes
        if (text.includes('connection state change:')) {
            const statePart = text.split('connection state change:')[1].trim();
            return statePart;
        }

        // Check for session deletion/closing events
        if (text.includes('peer removed') ||
            text.includes('session deleted') ||
            text.includes('ending call')) {
            return 'closed';
        }

        return null;
    }

    // Generate segments for the timeline based on connection states
    getConnectionStateSegments() {
        const events = this.getProcessedEvents();
        if (!events || events.length === 0) return [{
            state: 'new',  // Default to 'new' state instead of disconnected
            startPos: 0,
            width: 100
        }];

        const segments = [];
        let currentState = 'new';  // Start with 'new' state
        let lastPosition = 0;

        // Find all state change events and create segments
        events.forEach((event, index) => {
            if (event.connectionState) {
                // Add a segment from last position to current
                if (index > 0) {
                    segments.push({
                        state: currentState,
                        startPos: lastPosition,
                        width: event.position - lastPosition
                    });
                }

                // Update state for next segment
                currentState = event.connectionState;
                lastPosition = event.position;
            }
        });

        // Add the final segment from last state change to end
        segments.push({
            state: currentState,
            startPos: lastPosition,
            width: 100 - lastPosition
        });

        // If no segments created, create a default one
        if (segments.length === 0) {
            segments.push({
                state: 'new',
                startPos: 0,
                width: 100
            });
        }

        return segments;
    }

    // Format time for timeline display
    formatTimelineTime(isoTime) {
        if (!isoTime) return '';

        try {
            const date = new Date(isoTime);
            return date.toLocaleTimeString();
        } catch (e) {
            return isoTime;
        }
    }

    // Highlight an event in the list when clicked in the timeline
    highlightEvent(index) {
        this.state.highlightedEventIndex = index;

        // Scroll to the clicked event in the event list
        setTimeout(() => {
            const eventElements = this.el.querySelectorAll('.event-item');
            if (eventElements[index]) {
                eventElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                eventElements[index].classList.add('highlighted');

                // Remove highlight after a delay
                setTimeout(() => {
                    eventElements[index].classList.remove('highlighted');
                }, 2000);
            }
        }, 50);
    }

    // Show tooltip for a specific event
    showTooltip(event, e) {
        // Get event information from data attributes
        this.state.activeTooltip = {
            time: event.original ? helpers.formatEventTime(event.original) : '',
            level: event.level || '',
            text: event.original ? helpers.formatEventText(event.original) : ''
        };

        // Update tooltip position on mousemove
        const updateTooltipPosition = (e) => {
            // Position tooltip above and slightly to the right of cursor
            const x = e.clientX + 10;
            const y = e.clientY - 100; // Position above cursor

            this.state.tooltipStyle = `left: ${x}px; top: ${y}px;`;
        };

        // Initial position using the passed event
        this.tooltipMoveHandler = (e) => updateTooltipPosition(e);
        document.addEventListener('mousemove', this.tooltipMoveHandler);

        // Set initial position with the current event
        if (e) {
            updateTooltipPosition(e);
        }
    }

    // Hide tooltip
    hideTooltip() {
        this.state.activeTooltip = null;
        if (this.tooltipMoveHandler) {
            document.removeEventListener('mousemove', this.tooltipMoveHandler);
            this.tooltipMoveHandler = null;
        }
    }
}