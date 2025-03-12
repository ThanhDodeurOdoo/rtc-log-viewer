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
                        t-attf-class="session-tab {{ state.activeSessionId === sessionId ? 'active' : '' }}"
                        t-on-click="() => this.setActiveSession(sessionId)"
                    >
                        Session <t t-esc="sessionId"/>
                        <span t-if="isSelfSession(sessionId)" class="self-indicator">(Self)</span>
                    </div>
                </div>
                
                <!-- Session details -->
                <div t-if="state.activeSessionId" class="session-details">
                    <!-- Connection step -->
                    <div t-if="activeSessionData.step" class="connection-step">
                        Connection Step: <span class="step-value" t-esc="activeSessionData.step"></span>
                    </div>
                    
                    <!-- Connection state -->
                    <div t-if="activeSessionData.state" class="connection-state">
                        <div t-attf-class="state-indicator {{ getStateClass(activeSessionData.state) }}"></div>
                        Connection State: <span class="state-value" t-esc="activeSessionData.state"></span>
                    </div>
                    
                    <!-- Events log -->
                    <div class="events-log">
                        <h5>Events</h5>
                        <div class="event-list">
                            <div t-if="!hasEvents" class="no-data">
                                No events recorded for this session
                            </div>
                            <div t-else="" class="event-items">
                                <div 
                                    t-foreach="sessionEvents" 
                                    t-as="event" 
                                    t-key="event.id"
                                    t-attf-class="event-item {{ event.level ? event.level : '' }}"
                                >
                                    <span class="event-time" t-esc="event.time"></span>
                                    <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-esc="event.level"></span>
                                    <span class="event-text" t-esc="event.text"></span>
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
            this.setActiveSession(this.sessionIds[0]);
        }
    }

    get sessionIds() {
        const timelineData = this.props.timelineData;
        if (!timelineData) return [];

        return Object.keys(timelineData)
            .filter(key => key !== 'hasTurn' && !isNaN(parseInt(key)))
            .sort((a, b) => parseInt(a) - parseInt(b));
    }

    get activeSessionData() {
        if (!this.state.activeSessionId || !this.props.timelineData) {
            return {};
        }

        return this.props.timelineData[this.state.activeSessionId] || {};
    }

    get sessionEvents() {
        const sessionData = this.activeSessionData;
        if (!sessionData || !sessionData.logs || !Array.isArray(sessionData.logs)) {
            return [];
        }

        return sessionData.logs.map((log, index) => {
            // Extract timestamp from event string
            const timeMatch = log.event.match(/(\d{2}:\d{2}:\d{2}):/);
            const time = timeMatch ? timeMatch[1] : '';
            const text = timeMatch ? log.event.substring(timeMatch[0].length).trim() : log.event;

            return {
                id: `event_${index}`,
                time: time,
                text: text,
                level: log.level || 'info'
            };
        });
    }

    get hasEvents() {
        return this.sessionEvents.length > 0;
    }

    getTimelineTitle() {
        const key = this.props.timelineKey;

        // Extract channel ID, session ID and date from the key format: "c:{channel}-s:{session}-d:{date}"
        const channelMatch = key.match(/c:(\d+)/);
        const sessionMatch = key.match(/s:(\d+)/);
        const dateMatch = key.match(/d:([\d-:]+)/);

        const channelId = channelMatch ? channelMatch[1] : '?';
        const sessionId = sessionMatch ? sessionMatch[1] : '?';
        const dateTime = dateMatch ? this.formatDateTime(dateMatch[1]) : '';

        return `Timeline: Channel ${channelId} - Session ${sessionId} - ${dateTime}`;
    }

    formatDateTime(dateTimeStr) {
        // Format: 2025-03-12-10:24:37 to 2025-03-12 10:24:37
        return dateTimeStr.replace('-', ' ').replace(/-/g, '/');
    }

    setActiveSession(sessionId) {
        this.state.activeSessionId = sessionId;
    }

    isSelfSession(sessionId) {
        // Check if the timeline key contains this session ID
        const timelineKey = this.props.timelineKey;
        const sessionInKey = timelineKey.includes(`s:${sessionId}`);

        return sessionInKey;
    }

    getStateClass(state) {
        if (!state) return '';

        if (state.includes('connected')) return 'connected';
        if (state.includes('connecting')) return 'connecting';
        return 'disconnected';
    }
}