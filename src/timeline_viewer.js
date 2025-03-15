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
            activeSessionId: null
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
    }

    isSessionSelf(sessionId) {
        if (!this.props.timelineData) return false;
        return sessionId === this.props.timelineData.selfSessionId?.toString();
    }
}
