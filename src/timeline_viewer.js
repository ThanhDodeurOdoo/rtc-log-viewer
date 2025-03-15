const { Component, xml, useState } = owl;

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
                
                <!-- Session details -->
                <div t-if="state.activeSessionId" class="session-details">
                    <!-- Connection step -->
                    <div t-if="activeSessionInfo.step" class="connection-step">
                        <span class="property-name">Connection Step:</span>
                        <span class="step-value" t-esc="activeSessionInfo.step"></span>
                    </div>
                    
                    <!-- Connection state -->
                    <div t-if="activeSessionInfo.state" class="connection-state">
                        <div t-attf-class="state-indicator {{ getStateClass(activeSessionInfo.state) }}"></div>
                        <span class="property-name">Connection State:</span>
                        <span class="state-value" t-esc="activeSessionInfo.state"></span>
                    </div>
                    
                    <!-- Events log -->
                    <div class="events-log">
                        <h5>Events</h5>
                        <div class="event-list">
                            <div t-if="!sessionEvents.length" class="no-data">
                                No events recorded for this session
                            </div>
                            <div t-else="" class="event-items">
                                <div 
                                    t-foreach="sessionEvents" 
                                    t-as="event" 
                                    t-key="event_index"
                                    t-attf-class="event-item {{ event.level ? event.level : '' }}"
                                >
                                    <span class="event-time" t-esc="formatEventTime(event)"></span>
                                    <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-esc="event.level"></span>
                                    <span class="event-text" t-esc="formatEventText(event)"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            expanded: false,
            activeSessionId: null
        });
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
    }

    isSessionSelf(sessionId) {
        if (!this.props.timelineData) return false;
        return sessionId === this.props.timelineData.selfSessionId?.toString();
    }

    getStateClass(state) {
        if (!state) return '';

        if (state.includes('connected')) return 'connected';
        if (state.includes('connecting')) return 'connecting';
        return 'disconnected';
    }

    formatEventTime(event) {
        if (!event || !event.event) return '';

        const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
        if (timeMatch && timeMatch[1]) {
            // Check if ISO format
            if (timeMatch[1].includes('T')) {
                const date = new Date(timeMatch[1]);
                return date.toLocaleTimeString();
            }
            return timeMatch[1];
        }
        return '';
    }

    formatEventText(event) {
        if (!event || !event.event) return '';

        const timeMatch = event.event.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z|[0-9:.]+):/);
        if (timeMatch) {
            return event.event.substring(timeMatch[0].length).trim();
        }
        return event.event;
    }
}