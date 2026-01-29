const { Component, xml, signal, computed, plugin, props, types } = owl;
import helpers from "./utils/helpers.js";
import { ConnectionState, EventList } from "./common/ui_components.js";
import { ZoomControl } from "./zoom_control.js";
import { LogPlugin } from "./plugins/log_plugin.js";

const CONSTANTS = {
    // Thresholds for event clustering
    VERY_CLOSE_THRESHOLD: 0.5, // Events closer than this % are definitely grouped
    MIN_GROUP_SPACING: 4, // Minimum spacing between groups (visual width of a cluster)

    // Constants for event visibility and positioning
    POSITION_BEFORE_VISIBLE: -10, // Position value for events before visible area
    POSITION_AFTER_VISIBLE: 110, // Position value for events after visible area

    // Animation timings
    HIGHLIGHT_DURATION: 2000, // Duration in ms for the highlight effect
    SCROLL_DELAY: 50, // Delay for scrolling to highlighted event

    // Default values
    DEFAULT_STATE_SELF: undefined, // Default state for self session
    DEFAULT_STATE_OTHER: "new", // Default state for other sessions
};

const LOG_LEVEL_CLASSES = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
    WARN: "warn",
};

const ERROR_KEYWORDS = ["error", "failed", "failure", "attempting to recover"];

export class TimelineEntry extends Component {
    static template = xml`
        <div class="timeline-entry" t-ref="this.rootRef">
            <div class="timeline-header" t-on-click="() => this.expanded.set(!this.expanded())">
                <h4 t-out="this.timelineTitle()"></h4>
                <button
                    t-attf-class="timeline-toggle {{ this.expanded() ? 'expanded' : 'collapsed' }}"
                    t-on-click.stop="() => this.expanded.set(!this.expanded())"
                >
                    <t t-out="this.expanded() ? '▼' : '►'" />
                </button>
            </div>
            <div t-if="this.expanded()" class="timeline-content">
                <!-- Interactive zoom navigator -->
                <ZoomControl
                    events="this.allEventsMinimal"
                    onZoomChange="this.handleZoomChange"
                    totalDuration="this.timelineTotalDuration"
                />

                <!-- All sessions displayed as rows -->
                <div class="timeline-sessions">
                    <div
                        t-foreach="this.sortedSessionIds()"
                        t-as="sessionId"
                        t-key="sessionId"
                        t-attf-class="session-row {{ this.isSessionSelf(sessionId) ? 'self-session' : '' }}"
                        t-att-data-session-id="sessionId"
                    >
                        <div class="session-row-header" t-on-click="() => this.toggleSessionDetails(sessionId)">
                            <div class="session-title">
                                <div t-attf-class="state-indicator {{ this.helpers.getConnectionStateClass(this.getSessionLastState(sessionId)) }}"></div>
                                Session <t t-out="sessionId"/>
                                <span t-if="this.isSessionSelf(sessionId)" class="self-indicator">(Self)</span>
                            </div>
                            <button
                                t-attf-class="session-toggle {{ this.expandedSessions()[sessionId] ? 'expanded' : 'collapsed' }}"
                                t-on-click.stop="() => this.toggleSessionDetails(sessionId)"
                            >
                                <t t-out="this.expandedSessions()[sessionId] ? '▼' : '►'" />
                            </button>
                        </div>

                        <!-- Visual Timeline for this session -->
                        <div class="visual-timeline-container">
                            <div class="visual-timeline">
                                <!-- Connection state segments -->
                                <t t-foreach="this.getVisibleConnectionStateSegments(sessionId)" t-as="segment" t-key="segment_index">
                                    <div
                                        t-attf-class="timeline-segment {{ this.helpers.getConnectionStateClass(segment.state) }} {{ segment.state === undefined ? 'undefined-state' : '' }}"
                                        t-attf-style="left: {{ segment.startPos }}%; width: {{ segment.width }}%;"
                                        t-att-title="segment.state || 'Not connected to SFU'"
                                    ></div>
                                </t>
                                
                                <!-- Event groups (clustered events) -->
                                <t t-foreach="this.getEventGroups(sessionId)" t-as="group" t-key="group_index">
                                    <div
                                        class="event-group"
                                        t-att-id="'event-group-' + sessionId + '-' + group_index"
                                        t-attf-style="left: {{ this.getGroupPosition(group) }}%;"
                                        t-on-click.stop="(e) => this.toggleEventGroupPopup(group, e, sessionId, group_index)"
                                    >
                                        <!-- Single event or group indicator -->
                                        <div
                                            t-if="group.length === 1"
                                            t-attf-class="timeline-event {{ group[0].level || this.LOG_LEVEL_CLASSES.INFO }}"
                                            t-on-click.stop="(e) => { this.highlightEvent(sessionId, group[0].index); }"
                                            t-on-mouseenter="(e) => this.showTooltip(group[0], e)"
                                            t-on-mouseleave="this.hideTooltip"
                                        ></div>
                                        <div
                                            t-else=""
                                            class="event-cluster"
                                            t-out="group.length"
                                        ></div>
                                    </div>
                                </t>
                            </div>
                        </div>

                        <!-- Session details (collapsible) -->
                        <div t-if="this.expandedSessions()[sessionId]" class="session-details">
                            <!-- Connection step -->
                            <div t-if="this.getSessionInfo(sessionId).step" class="connection-step">
                                <span class="property-name">Connection Step:</span>
                                <span class="step-value" t-out="this.getSessionInfo(sessionId).step"></span>
                            </div>
                            <!-- Events log -->
                            <div class="events-log">
                                <h5>Events</h5>
                                <EventList
                                    events="this.getSessionEvents(sessionId)"
                                    noDataMessage="'No events recorded for this session'"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Floating tooltip -->
                <div t-if="this.activeTooltip()" class="event-tooltip" t-att-style="this.tooltipStyle()">
                    <div class="tooltip-time" t-out="this.activeTooltip().time"></div>
                    <div t-if="this.activeTooltip().level" t-attf-class="tooltip-level {{ this.activeTooltip().level }}" t-out="this.activeTooltip().level"></div>
                    <div class="tooltip-text" t-out="this.activeTooltip().text"></div>
                </div>
                
                <div class="timeline-times">
                    <div class="timeline-start-time" t-out="this.formatTimelineTime(this.visibleTimeRange().visibleStartTime)"></div>
                    <div class="timeline-end-time" t-out="this.formatTimelineTime(this.visibleTimeRange().visibleEndTime)"></div>
                </div>
            </div>
            
            <!-- Sticky event popup (shown when clicking on a group) -->
            <div t-if="this.activeEventGroup()" class="sticky-event-popup" t-att-style="this.eventGroupPopupStyle()">
                <div class="sticky-popup-header">
                    <h4>Events (<t t-out="this.activeEventGroup().length" />)</h4>
                    <button class="popup-close-btn" t-on-click="this.closeEventPopup">×</button>
                </div>
                <div class="sticky-popup-content">
                    <div
                        t-foreach="this.activeEventGroup()"
                        t-as="event"
                        t-key="event.index"
                        t-attf-class="popup-event"
                        t-on-click="() => this.highlightEvent(this.activeEventSessionId(), event.index)"
                    >
                        <div t-attf-class="event-indicator {{ event.level || this.LOG_LEVEL_CLASSES.INFO }}"></div>
                        <div class="event-content">
                            <span class="event-time" t-out="this.helpers.formatEventTime(event.original)"></span>
                            <span class="event-text" t-out="this.helpers.formatEventText(event.original)"></span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Overlay for clicking outside popup -->
            <div t-if="this.activeEventGroup()" class="popup-overlay" t-on-click="this.closeEventPopup"></div>
        </div>
    `;

    static components = {
        ConnectionState,
        EventList,
        ZoomControl,
    };

    props = props({ timelineKey: types.string });

    setup() {
        this.expanded = signal(false);
        this.expandedSessions = signal.Object({});
        this.activeTooltip = signal(null);
        this.tooltipStyle = signal("");
        this.zoomLevel = signal(1);
        this.zoomStartPercent = signal(0);
        this.activeEventGroup = signal(null);
        this.activeEventSessionId = signal(null);
        this.clickedEventElement = signal(null);
        this.eventGroupPopupStyle = signal("");
        this.activeGroupId = signal(null);

        this.helpers = helpers;
        this.rootRef = signal(null);
        this.LOG_LEVEL_CLASSES = LOG_LEVEL_CLASSES;
        this.log = plugin(LogPlugin);

        this.timelineData = computed(() => {
            const timelines = this.log.filteredTimelines();
            return timelines[this.props.timelineKey] || {};
        });
        this.endDate = computed(() => {
            const endStamp = this.timelineData().end || this.log.lastRelevantTimestamp();
            if (!endStamp) {
                return new Date();
            }
            return new Date(endStamp);
        });
        this.sessionIds = computed(() => {
            const timelineData = this.timelineData();
            if (!timelineData.entriesBySessionId) {
                return [];
            }
            return Object.keys(timelineData.entriesBySessionId).filter(
                (key) => key !== "hasTurn" && !isNaN(parseInt(key)),
            );
        });
        this.sortedSessionIds = computed(() => {
            const ids = this.sessionIds().slice();
            return ids.sort((a, b) => {
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
        });
        this.timelineTitle = computed(() => {
            try {
                const date = new Date(this.props.timelineKey);
                const formattedDate = date.toISOString();

                const channelId = this.timelineData().channelId;
                const selfSessionId = this.timelineData().selfSessionId;

                return `Timeline: Channel ${channelId} - Session ${selfSessionId} - ${formattedDate}`;
            } catch {
                return `Timeline: ${this.props.timelineKey}`;
            }
        });
        this.visibleTimeRange = computed(() => {
            const timelineData = this.timelineData();
            if (!timelineData.start) {
                const now = new Date();
                return { visibleStartTime: now, visibleEndTime: now, fullStartTime: now, fullEndTime: now };
            }

            const fullStartTime = new Date(timelineData.start);
            const fullEndTime = this.endDate();
            const fullRange = fullEndTime.getTime() - fullStartTime.getTime();

            if (this.zoomLevel() <= 1) {
                return { visibleStartTime: fullStartTime, visibleEndTime: fullEndTime, fullStartTime, fullEndTime };
            }

            const visibleRangeDuration = fullRange / this.zoomLevel();
            const startOffset = (fullRange * this.zoomStartPercent()) / 100;
            const visibleStartTime = new Date(fullStartTime.getTime() + startOffset);
            const visibleEndTime = new Date(visibleStartTime.getTime() + visibleRangeDuration);

            return { visibleStartTime, visibleEndTime, fullStartTime, fullEndTime };
        });
        this.allEventsMinimal = computed(() => {
            const allEvents = [];
            const sessionIds = this.sessionIds();

            let eventId = 0;
            for (const sessionId of sessionIds) {
                const events = this.getProcessedEvents(sessionId, false);
                for (const event of events) {
                    allEvents.push({
                        ...event,
                        id: eventId++,
                        sessionId,
                        fullPosition: this.calculateFullPosition(event.timestamp),
                    });
                }
            }

            return allEvents;
        });
        this.timelineTotalDuration = computed(() => {
            const timelineData = this.timelineData();
            if (!timelineData.start) {
                return 0;
            }
            const start = new Date(timelineData.start);
            const end = this.endDate();
            return end.getTime() - start.getTime();
        });

        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    mounted() {
        window.addEventListener("resize", this.handleResize);
    }

    willUnmount() {
        window.removeEventListener("resize", this.handleResize);
    }

    handleResize() {
        if (this.activeEventGroup() && this.clickedEventElement()) {
            this.repositionPopup();
        }
    }

    handleZoomChange({ zoomLevel, zoomStartPercent }) {
        this.zoomLevel.set(zoomLevel);
        this.zoomStartPercent.set(zoomStartPercent);
    }

    repositionPopup() {
        const element = this.clickedEventElement();
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const popupWidth = 300; // Approximate width
        const popupHeight = 300; // Approximate max height
        const padding = 10; // Padding from viewport edges

        let left = rect.left + rect.width / 2 - popupWidth / 2;

        // Keep popup in viewport horizontally
        if (left < padding) {
            left = padding;
        }
        if (left + popupWidth > viewportWidth - padding) {
            left = viewportWidth - popupWidth - padding;
        }

        // Position vertically - try above first, then below if not enough space
        let top;
        if (rect.top > popupHeight + 20) {
            // Enough space above
            top = rect.top - popupHeight - padding;
        } else if (viewportHeight - rect.bottom > popupHeight + 20) {
            // Enough space below
            top = rect.bottom + padding;
        } else {
            // Not enough space above or below, center on screen
            top = Math.max(padding, (viewportHeight - popupHeight) / 2);
        }

        const popupStyle = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            z-index: 1000;
            max-height: ${Math.min(popupHeight, viewportHeight - 2 * padding)}px;
        `;

        this.eventGroupPopupStyle.set(popupStyle);
    }

    calculateFullPosition(timestamp) {
        if (!timestamp) {
            return 0;
        }

        const timelineData = this.timelineData();
        if (!timelineData.start) {
            return 0;
        }

        const start = new Date(timelineData.start).getTime();
        const end = this.endDate().getTime();

        if (!start || !end || end <= start) {
            return 0;
        }

        return ((timestamp - start) / (end - start)) * 100;
    }

    getSessionInfo(sessionId) {
        const timelineData = this.timelineData();
        if (!sessionId || !timelineData.entriesBySessionId) {
            return {};
        }

        return timelineData.entriesBySessionId[sessionId] || {};
    }

    getSessionEvents(sessionId) {
        const sessionInfo = this.getSessionInfo(sessionId);
        if (!sessionInfo || !sessionInfo.logs || !Array.isArray(sessionInfo.logs)) {
            return [];
        }

        return sessionInfo.logs;
    }

    toggleSessionDetails(sessionId) {
        const expanded = this.expandedSessions();
        expanded[sessionId] = !expanded[sessionId];
    }

    isSessionSelf(sessionId) {
        const timelineData = this.timelineData();
        if (!timelineData.selfSessionId) {
            return false;
        }
        return sessionId === timelineData.selfSessionId.toString();
    }

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

    calculateEventPosition(timestamp) {
        if (!timestamp) {
            return 0;
        }

        const { visibleStartTime, visibleEndTime } = this.visibleTimeRange();
        const start = visibleStartTime.getTime();
        const end = visibleEndTime.getTime();

        if (!start || !end || end <= start) {
            return 0;
        }

        // Check if event is outside visible range
        if (timestamp < start) {
            return CONSTANTS.POSITION_BEFORE_VISIBLE;
        }
        if (timestamp > end) {
            return CONSTANTS.POSITION_AFTER_VISIBLE;
        }

        // Calculate position as percentage within visible range
        return ((timestamp - start) / (end - start)) * 100;
    }

    getProcessedEvents(sessionId, applyVisibilityFilter = true) {
        const events = this.getSessionEvents(sessionId);
        if (!events || events.length === 0) {
            return [];
        }

        return events
            .map((event, index) => {
                const timestamp = this.getEventTimestamp(event);
                let level = event.level || "";
                if (level.includes("warn")) {
                    level = LOG_LEVEL_CLASSES.WARNING;
                } else if (level.includes("error")) {
                    level = LOG_LEVEL_CLASSES.ERROR;
                } else if (level === "") {
                    level = LOG_LEVEL_CLASSES.INFO;
                }
                // Check for error messages in text if level isn't already error
                const text = helpers.formatEventText(event);
                if (
                    level !== LOG_LEVEL_CLASSES.ERROR &&
                    ERROR_KEYWORDS.some((keyword) => text.includes(keyword))
                ) {
                    level = LOG_LEVEL_CLASSES.ERROR;
                }
                const connectionStateChange = this.extractConnectionState(event);
                const isVisible = this.isEventVisible(timestamp);
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

    isEventVisible(timestamp) {
        if (!timestamp) {
            return false;
        }

        const { visibleStartTime, visibleEndTime } = this.visibleTimeRange();
        const start = visibleStartTime.getTime();
        const end = visibleEndTime.getTime();

        return timestamp >= start && timestamp <= end;
    }

    getEventGroups(sessionId) {
        const visibleEvents = this.getProcessedEvents(sessionId);
        if (!visibleEvents.length) {
            return [];
        }

        // Sort events by position
        const sortedEvents = [...visibleEvents].sort((a, b) => a.position - b.position);

        // Step 1: Create initial groups of events that are very close to each other
        const initialGroups = [];
        let currentGroup = [sortedEvents[0]];

        for (let i = 1; i < sortedEvents.length; i++) {
            const prevEvent = sortedEvents[i - 1];
            const currentEvent = sortedEvents[i];

            // If events are extremely close, group them immediately
            if (currentEvent.position - prevEvent.position <= CONSTANTS.VERY_CLOSE_THRESHOLD) {
                currentGroup.push(currentEvent);
            } else {
                initialGroups.push([...currentGroup]);
                currentGroup = [currentEvent];
            }
        }

        // Add the last group
        if (currentGroup.length > 0) {
            initialGroups.push(currentGroup);
        }

        // If we already have just one group, return it
        if (initialGroups.length <= 1) {
            return initialGroups;
        }

        const mergeGroupsUntilSpaced = (groups) => {
            // Check if groups have adequate spacing
            let needsMerging = false;
            for (let i = 0; i < groups.length - 1; i++) {
                const currentGroupPos = this.getGroupPosition(groups[i]);
                const nextGroupPos = this.getGroupPosition(groups[i + 1]);

                if (nextGroupPos - currentGroupPos < CONSTANTS.MIN_GROUP_SPACING) {
                    needsMerging = true;
                    break;
                }
            }

            // If spacing is adequate, return current groups
            if (!needsMerging || groups.length <= 1) {
                return groups;
            }

            // Find the closest pair of groups to merge
            let closestPairIndex = 0;
            let smallestDistance = Infinity;

            for (let i = 0; i < groups.length - 1; i++) {
                const currentGroupPos = this.getGroupPosition(groups[i]);
                const nextGroupPos = this.getGroupPosition(groups[i + 1]);
                const distance = nextGroupPos - currentGroupPos;

                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    closestPairIndex = i;
                }
            }

            // Merge the closest pair
            const newGroups = [...groups];
            const mergedGroup = [
                ...newGroups[closestPairIndex],
                ...newGroups[closestPairIndex + 1],
            ];

            newGroups.splice(closestPairIndex, 2, mergedGroup);

            // Recursively check if further merging is needed
            return mergeGroupsUntilSpaced(newGroups);
        };

        // Apply the recursive merging
        return mergeGroupsUntilSpaced(initialGroups);
    }

    getGroupPosition(group) {
        if (!group || group.length === 0) {
            return 0;
        }

        // Calculate the average position
        const sum = group.reduce((total, event) => total + event.position, 0);
        return sum / group.length;
    }

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

    getConnectionStateSegments(sessionId) {
        const events = this.getProcessedEvents(sessionId, false); // Get all events without filtering for position calculation
        const isSelfSession = this.isSessionSelf(sessionId);

        if (!events || events.length === 0) {
            return [
                {
                    state: isSelfSession
                        ? CONSTANTS.DEFAULT_STATE_SELF
                        : CONSTANTS.DEFAULT_STATE_OTHER,
                    startPos: 0,
                    width: 100,
                },
            ];
        }

        const segments = [];
        // Self sessions start with undefined state, other sessions start with "new"
        let currentState = isSelfSession
            ? CONSTANTS.DEFAULT_STATE_SELF
            : CONSTANTS.DEFAULT_STATE_OTHER;
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
                state: isSelfSession ? CONSTANTS.DEFAULT_STATE_SELF : CONSTANTS.DEFAULT_STATE_OTHER,
                startPos: 0,
                width: 100,
            });
        }

        return segments;
    }

    getVisibleConnectionStateSegments(sessionId) {
        const segments = this.getConnectionStateSegments(sessionId);
        if (this.zoomLevel() <= 1) {
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
            return date.toISOString().split("T")[1].replace("Z", "");
        } catch {
            return "";
        }
    }

    toggleEventGroupPopup(group, e, sessionId, groupIndex) {
        // If it's a single event, just highlight it
        if (group.length === 1) {
            this.highlightEvent(sessionId, group[0].index);
            return;
        }

        const groupId = `event-group-${sessionId}-${groupIndex}`;

        // If clicking on the same group, close it
        if (this.activeGroupId() === groupId) {
            this.closeEventPopup();
            return;
        }

        // Store the actual DOM element that was clicked for accurate positioning
        this.clickedEventElement.set(e.currentTarget);
        this.activeEventGroup.set(group);
        this.activeEventSessionId.set(sessionId);
        this.activeGroupId.set(groupId);

        // Position popup
        this.repositionPopup();
    }

    closeEventPopup() {
        this.activeEventGroup.set(null);
        this.activeEventSessionId.set(null);
        this.activeGroupId.set(null);
        this.clickedEventElement.set(null);
    }

    highlightEvent(sessionId, index) {
        // Make sure session details are expanded
        const expanded = this.expandedSessions();
        if (!expanded[sessionId]) {
            expanded[sessionId] = true;
        }

        // Find and scroll to the event in the list
        setTimeout(() => {
            const eventElements = this.rootRef()?.querySelectorAll(
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
                }, CONSTANTS.HIGHLIGHT_DURATION);
            }
        }, CONSTANTS.SCROLL_DELAY);
    }

    showTooltip(event, e) {
        this.activeTooltip.set({
            time: event.original ? helpers.formatEventTime(event.original) : "",
            level: event.level || "",
            text: event.original ? helpers.formatEventText(event.original) : "",
        });
        const updatePosition = (e) => {
            const x = e.clientX + 10;
            const y = e.clientY - 80;
            this.tooltipStyle.set(`left: ${x}px; top: ${y}px;`);
        };
        updatePosition(e);

        this.tooltipMoveHandler = updatePosition;
        document.addEventListener("mousemove", this.tooltipMoveHandler);
    }

    hideTooltip() {
        this.activeTooltip.set(null);
        if (this.tooltipMoveHandler) {
            document.removeEventListener("mousemove", this.tooltipMoveHandler);
            this.tooltipMoveHandler = null;
        }
    }


    getSessionLastState(sessionId) {
        const segments = this.getConnectionStateSegments(sessionId);
        if (!segments || segments.length === 0) {
            return "";
        }
        const lastSegment = segments[segments.length - 1];
        return lastSegment.state;
    }
}
