const { Component, xml, signal, props } = owl;
import helpers from "../utils/helpers.js";

export class ExpandableSection extends Component {
    static template = xml`
        <div t-attf-class="{{ this.props.className }}">
            <div t-attf-class="{{ this.props.headerClass }}">
                <h4 t-out="this.props.title"></h4>
                <button
                    t-attf-class="{{ this.props.toggleClass }} {{ this.expanded() ? 'expanded' : 'collapsed' }}"
                    t-on-click="this.toggleExpanded"
                >
                    <t t-out="this.expanded() ? '▼' : '►'" />
                </button>
            </div>
            <div t-if="this.expanded()" t-attf-class="{{ this.props.contentClass }}">
                <t t-call-slot="default"/>
            </div>
        </div>
    `;

    props = props();

    setup() {
        this.expanded = signal(this.props.initialExpanded || false);
    }

    toggleExpanded() {
        this.expanded.set(!this.expanded());
    }
}

export class NoData extends Component {
    static template = xml`
        <div class="no-data">
            <t t-out="this.props.message || 'No data available'"/>
        </div>
    `;

    props = props();
}

export class EventList extends Component {
    static template = xml`
        <div class="event-list">
            <div t-if="!this.props.events.length" class="no-data">
                <t t-out="this.props.noDataMessage || 'No events available'"/>
            </div>
            
            <div t-else="" class="event-items">
                <div 
                    t-foreach="this.props.events" 
                    t-as="event" 
                    t-key="event_index"
                    t-attf-class="event-item {{ event.level ? event.level : '' }}"
                >
                    <span class="event-time" t-out="this.helpers.formatEventTime(event)"></span>
                    <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-out="event.level"></span>
                    <span class="event-text" t-out="this.helpers.formatEventText(event)"></span>
                </div>
            </div>
        </div>
    `;

    props = props();

    setup() {
        this.helpers = helpers;
    }
}

export class SessionProperties extends Component {
    static template = xml`
        <div class="session-properties">
            <!-- Audio information -->
            <div t-if="this.props.session.audio" class="property-card">
                <h6>Audio</h6>
                <ul class="property-list">
                    <li><span class="property-name">State:</span> <span t-out="this.helpers.getAudioState(this.props.session.audio.state)"></span></li>
                    <li><span class="property-name">Muted:</span> <span t-out="this.props.session.audio.muted ? 'Yes' : 'No'"></span></li>
                    <li><span class="property-name">Paused:</span> <span t-out="this.props.session.audio.paused ? 'Yes' : 'No'"></span></li>
                    <li t-if="this.props.session.audio.networkState !== undefined"><span class="property-name">Network State:</span> <span t-out="this.helpers.getNetworkState(this.props.session.audio.networkState)"></span></li>
                </ul>
            </div>
            
            <!-- Peer information -->
            <div t-if="this.props.session.peer" class="property-card">
                <h6>Peer Connection</h6>
                <ul class="property-list">
                    <li><span class="property-name">ID:</span> <span t-out="this.props.session.peer.id"></span></li>
                    <li><span class="property-name">State:</span> <span t-out="this.props.session.peer.state"></span></li>
                    <li><span class="property-name">ICE State:</span> <span t-out="this.props.session.peer.iceState"></span></li>
                </ul>
            </div>
            
            <!-- SFU info -->
            <div t-if="this.props.session.sfuConsumers and this.props.session.sfuConsumers.length > 0" class="property-card">
                <h6>SFU Consumers</h6>
                <ul class="property-list">
                    <li t-foreach="this.props.session.sfuConsumers" t-as="consumer" t-key="consumer_index">
                        <span class="property-name" t-out="consumer.type"></span>: 
                        <span t-out="consumer.state"></span>
                    </li>
                </ul>
            </div>
            
            <!-- Additional properties -->
            <div class="property-card">
                <h6>Other Properties</h6>
                <ul class="property-list">
                    <li t-if="this.props.session.channelMemberId !== undefined">
                        <span class="property-name">Channel Member ID:</span> 
                        <span t-out="this.props.session.channelMemberId"></span>
                    </li>
                    <li t-if="this.props.session.audioError">
                        <span class="property-name">Audio Error:</span> 
                        <span t-out="this.props.session.audioError"></span>
                    </li>
                    <li t-if="this.props.session.videoError">
                        <span class="property-name">Video Error:</span> 
                        <span t-out="this.props.session.videoError"></span>
                    </li>
                </ul>
            </div>
        </div>
    `;

    props = props();

    setup() {
        this.helpers = helpers;
    }
}
export class ConnectionState extends Component {
    static template = xml`
        <div class="connection-state">
            <div t-attf-class="state-indicator {{ this.props.stateClass }}"></div>
            <span class="property-name"><t t-out="this.props.label || 'State:'"/></span>
            <span class="property-value" t-out="this.props.state || 'Unknown'"></span>
        </div>
    `;

    props = props();
}

export default {
    ExpandableSection,
    NoData,
    EventList,
    SessionProperties,
    ConnectionState,
};
