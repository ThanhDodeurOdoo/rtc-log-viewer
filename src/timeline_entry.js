const { Component, xml, useState, useRef } = owl;
import helpers from "./utils/helpers.js";
import { ConnectionState, EventList } from "./common/ui_components.js";
import { ZoomControl } from "./zoom_control.js";

export class TimelineEntry extends Component {
    static template = xml`
        <div class="timeline-entry" ref="root">
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
                <!-- Interactive zoom navigator -->
                <ZoomControl 
                    events="getAllEventsMinimal()" 
                    onZoomChange="handleZoomChange"
                    totalDuration="getTimelineTotalDuration()"
                />

                <!-- All sessions displayed as rows -->
                <div class="timeline-sessions">
                    <div 
                        t-foreach="sortedSessionIds" 
                        t-as="sessionId" 
                        t-key="sessionId"
                        t-attf-class="session-row {{ isSessionSelf(sessionId) ? 'self-session' : '' }}"
                        t-att-data-session-id="sessionId"
                    >
                        <div class="session-row-header">
                            <div class="session-title">
                                Session <t t-esc="sessionId"/>
                                <span t-if="isSessionSelf(sessionId)" class="self-indicator">(Self)</span>
                            </div>
                            <button 
                                t-attf-class="session-toggle {{ state.expandedSessions[sessionId] ? 'expanded' : 'collapsed' }}"
                                t-on-click="() => this.toggleSessionDetails(sessionId)"
                            >
                                <t t-esc="state.expandedSessions[sessionId] ? '▼' : '►'" />
                            </button>
                        </div>

                        <!-- Visual Timeline for this session -->
                        <div class="visual-timeline-container">
                            <div class="visual-timeline">
                                <!-- Connection state segments -->
                                <t t-foreach="getVisibleConnectionStateSegments(sessionId)" t-as="segment" t-key="segment_index">
                                    <div 
                                        t-attf-class="timeline-segment {{ helpers.getConnectionStateClass(segment.state) }} {{ segment.state === undefined ? 'undefined-state' : '' }}"
                                        t-attf-style="left: {{ segment.startPos }}%; width: {{ segment.width }}%;"
                                        t-att-title="segment.state || 'Not connected to SFU'"
                                    ></div>
                                </t>
                                
                                <!-- Event groups (clustered events) -->
                                <t t-foreach="getEventGroups(sessionId)" t-as="group" t-key="group_index">
                                    <div 
                                        class="event-group"
                                        t-att-id="'event-group-' + sessionId + '-' + group_index"
                                        t-attf-style="left: {{ getGroupPosition(group) }}%;"
                                        t-on-click="(e) => this.toggleEventGroupPopup(group, e, sessionId, group_index)"
                                    >
                                        <!-- Single event or group indicator -->
                                        <div 
                                            t-if="group.length === 1"
                                            t-attf-class="timeline-event {{ group[0].level || 'info' }}"
                                            t-on-click="(e) => { e.stopPropagation(); this.highlightEvent(sessionId, group[0].index); }"
                                            t-on-mouseenter="(e) => this.showTooltip(group[0], e)"
                                            t-on-mouseleave="hideTooltip"
                                        ></div>
                                        <div 
                                            t-else=""
                                            class="event-cluster"
                                            t-esc="group.length"
                                        ></div>
                                    </div>
                                </t>
                            </div>
                        </div>

                        <!-- Session details (collapsible) -->
                        <div t-if="state.expandedSessions[sessionId]" class="session-details">
                            <!-- Connection step -->
                            <div t-if="getSessionInfo(sessionId).step" class="connection-step">
                                <span class="property-name">Connection Step:</span>
                                <span class="step-value" t-esc="getSessionInfo(sessionId).step"></span>
                            </div>
                            
                            <!-- Connection state -->
                            <ConnectionState 
                                t-if="getSessionInfo(sessionId).state" 
                                state="getSessionInfo(sessionId).state" 
                                stateClass="helpers.getConnectionStateClass(getSessionInfo(sessionId).state)" 
                                label="'Connection State:'"
                            />
                            
                            <!-- Events log -->
                            <div class="events-log">
                                <h5>Events</h5>
                                <EventList 
                                    events="getSessionEvents(sessionId)" 
                                    noDataMessage="'No events recorded for this session'"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Floating tooltip -->
                <div t-if="state.activeTooltip" class="event-tooltip" t-att-style="state.tooltipStyle">
                    <div class="tooltip-time" t-esc="state.activeTooltip.time"></div>
                    <div t-if="state.activeTooltip.level" t-attf-class="tooltip-level {{ state.activeTooltip.level }}" t-esc="state.activeTooltip.level"></div>
                    <div class="tooltip-text" t-esc="state.activeTooltip.text"></div>
                </div>
                
                <div class="timeline-times">
                    <div class="timeline-start-time" t-esc="formatTimelineTime(getVisibleTimeRange().visibleStartTime)"></div>
                    <div class="timeline-end-time" t-esc="formatTimelineTime(getVisibleTimeRange().visibleEndTime)"></div>
                </div>
            </div>
            
            <!-- Sticky event popup (shown when clicking on a group) -->
            <div t-if="state.activeEventGroup" class="sticky-event-popup" t-att-style="state.eventGroupPopupStyle">
                <div class="sticky-popup-header">
                    <h4>Events (<t t-esc="state.activeEventGroup.length" />)</h4>
                    <button class="popup-close-btn" t-on-click="closeEventPopup">×</button>
                </div>
                <div class="sticky-popup-content">
                    <div 
                        t-foreach="state.activeEventGroup" 
                        t-as="event" 
                        t-key="event.index"
                        t-attf-class="popup-event {{ event.level || 'info' }}"
                        t-on-click="() => this.highlightEvent(state.activeEventSessionId, event.index)"
                    >
                        <span class="event-time" t-esc="helpers.formatEventTime(event.original)"></span>
                        <span class="event-text" t-esc="helpers.formatEventText(event.original)"></span>
                    </div>
                </div>
            </div>
            
            <!-- Overlay for clicking outside popup -->
            <div t-if="state.activeEventGroup" class="popup-overlay" t-on-click="closeEventPopup"></div>
        </div>
    `;

    static components = {
        ConnectionState,
        EventList,
        ZoomControl,
    };

    setup() {
        this.state = useState({
            expanded: false,
            expandedSessions: {},
            activeTooltip: null,
            tooltipStyle: "",
            // Interactive zoom and popup state
            zoomLevel: 1, // 1 = no zoom (100% view)
            zoomStartPercent: 0, // Start position of zoom window (0-100%)
            activeEventGroup: null, // Currently displayed event group
            activeEventSessionId: null, // Session ID for the active event group
            clickedEventElement: null, // Store the actual clicked element
            eventGroupPopupStyle: "",
        });

        this.helpers = helpers;
        this.rootRef = useRef("root");

        // Bind methods
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    mounted() {
        window.addEventListener("resize", this.handleResize);
    }

    willUnmount() {
        window.removeEventListener("resize", this.handleResize);
    }

    // Handle window resize to reposition popups
    handleResize() {
        if (this.state.activeEventGroup && this.state.clickedEventElement) {
            this.repositionPopup();
        }
    }

    // Handle zoom changes from the ZoomControl component
    handleZoomChange({ zoomLevel, zoomStartPercent }) {
        this.state.zoomLevel = zoomLevel;
        this.state.zoomStartPercent = zoomStartPercent;
    }

    // Reposition popup to stay anchored to its group
    repositionPopup() {
        // Use the stored clicked element reference directly
        const element = this.state.clickedEventElement;
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const popupWidth = 300; // Approximate width
        const popupHeight = 300; // Approximate max height

        // Position popup - try to center it horizontally relative to the clicked element
        let left = rect.left + rect.width / 2 - popupWidth / 2;

        // Keep popup in viewport horizontally
        if (left < 10) {
            left = 10;
        }
        if (left + popupWidth > viewportWidth - 10) {
            left = viewportWidth - popupWidth - 10;
        }

        // Position vertically - try above first, then below if not enough space
        let top;
        if (rect.top > popupHeight + 20) {
            // Enough space above
            top = rect.top - popupHeight - 10;
        } else if (viewportHeight - rect.bottom > popupHeight + 20) {
            // Enough space below
            top = rect.bottom + 10;
        } else {
            // Not enough space above or below, center on screen
            top = Math.max(10, (viewportHeight - popupHeight) / 2);
        }

        const popupStyle = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            z-index: 1000;
            max-height: ${Math.min(popupHeight, viewportHeight - 20)}px;
        `;

        this.state.eventGroupPopupStyle = popupStyle;
    }

    get sessionIds() {
        const timelineData = this.props.timelineData;
        if (!timelineData || !timelineData.entriesBySessionId) {
            return [];
        }

        return Object.keys(timelineData.entriesBySessionId).filter(
            (key) => key !== "hasTurn" && !isNaN(parseInt(key)),
        );
    }

    get sortedSessionIds() {
        // Sort sessions with self-session at the top
        return this.sessionIds.sort((a, b) => {
            const aIsSelf = this.isSessionSelf(a);
            const bIsSelf = this.isSessionSelf(b);

            if (aIsSelf && !bIsSelf) {
                return -1;
            }
            if (!aIsSelf && bIsSelf) {
                return 1;
            }
            return parseInt(a) - parseInt(b);
        });
    }

    // Get all events across all sessions for overview
    getAllEventsMinimal() {
        const allEvents = [];
        const sessionIds = this.sessionIds;

        let eventId = 0;
        for (const sessionId of sessionIds) {
            const events = this.getProcessedEvents(sessionId, false); // Get all events without visibility filtering
            for (const event of events) {
                allEvents.push({
                    ...event,
                    id: eventId++, // Add unique identifier
                    sessionId,
                    fullPosition: this.calculateFullPosition(event.timestamp), // Calculate position in full timeline
                });
            }
        }

        return allEvents;
    }

    // Calculate position in full timeline (0-100%)
    calculateFullPosition(timestamp) {
        if (!timestamp) {
            return 0;
        }

        const timelineData = this.props.timelineData;
        if (!timelineData || !timelineData.start || !timelineData.end) {
            return 0;
        }

        const start = new Date(timelineData.start).getTime();
        const end = new Date(timelineData.end || new Date().toISOString()).getTime();

        if (!start || !end || end <= start) {
            return 0;
        }

        return ((timestamp - start) / (end - start)) * 100;
    }

    getSessionInfo(sessionId) {
        if (!sessionId || !this.props.timelineData || !this.props.timelineData.entriesBySessionId) {
            return {};
        }

        return this.props.timelineData.entriesBySessionId[sessionId] || {};
    }

    getSessionEvents(sessionId) {
        const sessionInfo = this.getSessionInfo(sessionId);
        if (!sessionInfo || !sessionInfo.logs || !Array.isArray(sessionInfo.logs)) {
            return [];
        }

        return sessionInfo.logs;
    }

    getTimelineTitle() {
        if (!this.props.timelineData) {
            return "Timeline";
        }

        try {
            const date = new Date(this.props.timelineKey);
            const formattedDate = date.toLocaleString();

            const channelId = this.props.timelineData.channelId;
            const selfSessionId = this.props.timelineData.selfSessionId;

            return `Timeline: Channel ${channelId} - Session ${selfSessionId} - ${formattedDate}`;
        } catch {
            return `Timeline: ${this.props.timelineKey}`;
        }
    }

    toggleSessionDetails(sessionId) {
        this.state.expandedSessions[sessionId] = !this.state.expandedSessions[sessionId];
    }

    isSessionSelf(sessionId) {
        if (!this.props.timelineData) {
            return false;
        }
        return sessionId === this.props.timelineData.selfSessionId?.toString();
    }

    // Get the visible time range based on zoom level and position
    getVisibleTimeRange() {
        const timelineData = this.props.timelineData;
        if (!timelineData) {
            return { visibleStartTime: new Date(), visibleEndTime: new Date() };
        }

        const fullStartTime = new Date(timelineData.start);
        const fullEndTime = new Date(timelineData.end || new Date().toISOString());
        const fullRange = fullEndTime.getTime() - fullStartTime.getTime();

        // If no zoom, show full range
        if (this.state.zoomLevel <= 1) {
            return {
                visibleStartTime: fullStartTime,
                visibleEndTime: fullEndTime,
                fullStartTime,
                fullEndTime,
            };
        }

        // Calculate visible range based on zoom
        const visibleRangeDuration = fullRange / this.state.zoomLevel;

        // Use zoomStartPercent to determine start time
        const startOffset = (fullRange * this.state.zoomStartPercent) / 100;

        // Calculate visible start and end times
        const visibleStartTime = new Date(fullStartTime.getTime() + startOffset);
        const visibleEndTime = new Date(visibleStartTime.getTime() + visibleRangeDuration);

        return {
            visibleStartTime,
            visibleEndTime,
            fullStartTime,
            fullEndTime,
        };
    }

    // Extract timestamp from event for timeline positioning
    getEventTimestamp(event) {
        if (!event || !event.event) {
            return null;
        }

        const timeMatch = event.event.match(
            /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/,
        );
        if (timeMatch && timeMatch[1]) {
            // If it's ISO format, parse date
            if (timeMatch[1].includes("T")) {
                return new Date(timeMatch[1]).getTime();
            }
            // For simple time format, use a base date and set the time
            try {
                const timeParts = timeMatch[1].split(":").map(Number);
                const now = new Date();
                now.setHours(timeParts[0] || 0, timeParts[1] || 0, timeParts[2] || 0, 0);
                return now.getTime();
            } catch {
                return new Date().getTime();
            }
        }

        // Default to current time if no valid timestamp
        return new Date().getTime();
    }

    // Calculate position along timeline (0-100%) considering zoom
    calculateEventPosition(timestamp) {
        if (!timestamp) {
            return 0;
        }

        const { visibleStartTime, visibleEndTime } = this.getVisibleTimeRange();
        const start = visibleStartTime.getTime();
        const end = visibleEndTime.getTime();

        if (!start || !end || end <= start) {
            return 0;
        }

        // Check if event is outside visible range
        if (timestamp < start) {
            return -10;
        } // Position before visible area
        if (timestamp > end) {
            return 110;
        } // Position after visible area

        // Calculate position as percentage within visible range
        return ((timestamp - start) / (end - start)) * 100;
    }

    // Process events for visual timeline
    getProcessedEvents(sessionId, applyVisibilityFilter = true) {
        const events = this.getSessionEvents(sessionId);
        if (!events || events.length === 0) {
            return [];
        }

        return events
            .map((event, index) => {
                const timestamp = this.getEventTimestamp(event);
                // Ensure events have a level (default to info if not specified)
                let level = event.level || "";

                // Normalize levels to handle variations
                if (level.includes("warn")) {
                    level = "warning";
                } else if (level.includes("error")) {
                    level = "error";
                } else if (level === "") {
                    level = "info";
                }

                // Check for error messages in text if level isn't already error
                const text = helpers.formatEventText(event);
                if (
                    level !== "error" &&
                    (text.includes("error") ||
                        text.includes("failed") ||
                        text.includes("failure") ||
                        text.includes("attempting to recover"))
                ) {
                    level = "error";
                }

                // Extract connection state changes from event text
                const connectionStateChange = this.extractConnectionState(event);

                const isVisible = this.isEventVisible(timestamp);

                // Filter out non-visible events if requested
                if (applyVisibilityFilter && !isVisible) {
                    return null;
                }

                return {
                    original: event,
                    timestamp,
                    position: this.calculateEventPosition(timestamp),
                    level,
                    text: helpers.formatEventText(event),
                    index,
                    connectionState: connectionStateChange,
                    isVisible,
                };
            })
            .filter((event) => event !== null);
    }

    // Check if an event is within the visible time range
    isEventVisible(timestamp) {
        if (!timestamp) {
            return false;
        }

        const { visibleStartTime, visibleEndTime } = this.getVisibleTimeRange();
        const start = visibleStartTime.getTime();
        const end = visibleEndTime.getTime();

        return timestamp >= start && timestamp <= end;
    }

    // Group events that are close to each other
    getEventGroups(sessionId) {
        const visibleEvents = this.getProcessedEvents(sessionId);
        if (!visibleEvents.length) {
            return [];
        }

        // Sort events by position
        const sortedEvents = [...visibleEvents].sort((a, b) => a.position - b.position);

        const groups = [];
        let currentGroup = [];

        // Group threshold - consider events as clustered if they're within 3% of timeline width
        const threshold = 3;

        for (const event of sortedEvents) {
            if (currentGroup.length === 0) {
                currentGroup.push(event);
            } else {
                const lastEvent = currentGroup[currentGroup.length - 1];

                if (Math.abs(lastEvent.position - event.position) < threshold) {
                    currentGroup.push(event);
                } else {
                    groups.push([...currentGroup]);
                    currentGroup = [event];
                }
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    // Get position for a group (average of all events in group)
    getGroupPosition(group) {
        if (!group || group.length === 0) {
            return 0;
        }

        // Use the middle event in the group for positioning
        return group[Math.floor(group.length / 2)].position;
    }

    // Extract connection state from event text
    extractConnectionState(event) {
        if (!event || !event.event) {
            return null;
        }

        const text = helpers.formatEventText(event);

        // Look for connection state changes
        if (text.includes("connection state change:")) {
            const statePart = text.split("connection state change:")[1].trim();
            return statePart;
        }

        // Check for session deletion/closing events
        if (
            text.includes("peer removed") ||
            text.includes("session deleted") ||
            text.includes("ending call")
        ) {
            return "closed";
        }

        return null;
    }

    // Generate segments for the timeline based on connection states
    getConnectionStateSegments(sessionId) {
        const events = this.getProcessedEvents(sessionId, false); // Get all events without filtering for position calculation
        const isSelfSession = this.isSessionSelf(sessionId);

        if (!events || events.length === 0) {
            return [
                {
                    state: isSelfSession ? undefined : "new", // Use undefined for self sessions
                    startPos: 0,
                    width: 100,
                },
            ];
        }

        const segments = [];
        // Self sessions start with undefined state, other sessions start with "new"
        let currentState = isSelfSession ? undefined : "new";
        let lastPosition = 0;

        // Find all state change events and create segments
        events.forEach((event, index) => {
            if (event.connectionState) {
                // Add a segment from last position to current
                if (index > 0) {
                    segments.push({
                        state: currentState,
                        startPos: lastPosition,
                        width: event.position - lastPosition,
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
            width: 100 - lastPosition,
        });

        // If no segments created, create a default one
        if (segments.length === 0) {
            segments.push({
                state: isSelfSession ? undefined : "new",
                startPos: 0,
                width: 100,
            });
        }

        return segments;
    }

    // Get connection state segments adjusted for visible time range
    getVisibleConnectionStateSegments(sessionId) {
        const segments = this.getConnectionStateSegments(sessionId);
        if (this.state.zoomLevel <= 1) {
            return segments; // No need to adjust if not zoomed
        }

        // Filter segments that are outside visible range and adjust positions
        return segments
            .filter((segment) => {
                // Skip segments that are completely outside visible range
                return !(segment.startPos > 100 || segment.startPos + segment.width < 0);
            })
            .map((segment) => {
                // Clamp segment to visible range
                const adjustedStart = Math.max(0, segment.startPos);
                let adjustedWidth = segment.width;

                // Reduce width if segment extends beyond visible area
                if (adjustedStart + adjustedWidth > 100) {
                    adjustedWidth = 100 - adjustedStart;
                }

                return {
                    ...segment,
                    startPos: adjustedStart,
                    width: adjustedWidth,
                };
            });
    }

    formatTimelineTime(time) {
        if (!time) {
            return "";
        }

        try {
            const date = new Date(time);
            return date.toLocaleTimeString();
        } catch {
            return time.toString();
        }
    }

    toggleEventGroupPopup(group, e, sessionId, groupIndex) {
        e.stopPropagation();

        // If it's a single event, just highlight it
        if (group.length === 1) {
            this.highlightEvent(sessionId, group[0].index);
            return;
        }

        const groupId = `event-group-${sessionId}-${groupIndex}`;

        // If clicking on the same group, close it
        if (this.state.activeGroupId === groupId) {
            this.closeEventPopup();
            return;
        }

        // Store the actual DOM element that was clicked for accurate positioning
        this.state.clickedEventElement = e.currentTarget;
        this.state.activeEventGroup = group;
        this.state.activeEventSessionId = sessionId;
        this.state.activeGroupId = groupId;

        // Position popup
        this.repositionPopup();
    }

    closeEventPopup() {
        this.state.activeEventGroup = null;
        this.state.activeEventSessionId = null;
        this.state.activeGroupId = null;
        this.state.clickedEventElement = null;
    }

    // Highlight an event in the list when clicked in the timeline
    highlightEvent(sessionId, index) {
        // Make sure session details are expanded
        if (!this.state.expandedSessions[sessionId]) {
            this.state.expandedSessions[sessionId] = true;
        }

        // Find and scroll to the event in the list
        setTimeout(() => {
            const eventElements = this.rootRef.el?.querySelectorAll(
                `.session-row[data-session-id="${sessionId}"] .event-item`,
            );
            if (!eventElements.length) {
                return;
            }

            // Get the correct event element - handle zero-based indexing
            if (index >= eventElements.length) {
                index = eventElements.length - 1;
            }

            const eventElement = eventElements[index];
            if (eventElement) {
                // Scroll the event into view
                eventElement.scrollIntoView({ behavior: "smooth", block: "center" });

                // Add and then remove highlight
                eventElement.classList.add("highlighted");
                setTimeout(() => {
                    eventElement.classList.remove("highlighted");
                }, 2000);
            }
        }, 50);
    }

    showTooltip(event, e) {
        // Get event information
        this.state.activeTooltip = {
            time: event.original ? helpers.formatEventTime(event.original) : "",
            level: event.level || "",
            text: event.original ? helpers.formatEventText(event.original) : "",
        };

        // Update tooltip position
        const updatePosition = (e) => {
            const x = e.clientX + 10;
            const y = e.clientY - 80;
            this.state.tooltipStyle = `left: ${x}px; top: ${y}px;`;
        };

        // Set initial position
        updatePosition(e);

        // Track mouse movement for tooltip
        this.tooltipMoveHandler = updatePosition;
        document.addEventListener("mousemove", this.tooltipMoveHandler);
    }

    hideTooltip() {
        this.state.activeTooltip = null;
        if (this.tooltipMoveHandler) {
            document.removeEventListener("mousemove", this.tooltipMoveHandler);
            this.tooltipMoveHandler = null;
        }
    }

    /**
     * @returns {number} Total duration of the timeline in milliseconds
     */
    getTimelineTotalDuration() {
        const timelineData = this.props.timelineData;
        if (!timelineData) {
            return 0;
        }

        const start = new Date(timelineData.start);
        const end = new Date(timelineData.end || new Date().toISOString());
        return end.getTime() - start.getTime();
    }
}
