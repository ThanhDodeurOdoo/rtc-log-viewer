const { Component, xml, useState } = owl;
import helpers from '../utils/helpers.js';

export class ExpandableSection extends Component {
    static template = xml`
        <div t-attf-class="{{ props.className }}">
            <div t-attf-class="{{ props.headerClass }}">
                <h4 t-esc="props.title"></h4>
                <button
                    t-attf-class="{{ props.toggleClass }} {{ state.expanded ? 'expanded' : 'collapsed' }}"
                    t-on-click="toggleExpanded"
                >
                    <t t-esc="state.expanded ? '▼' : '►'" />
                </button>
            </div>
            <div t-if="state.expanded" t-attf-class="{{ props.contentClass }}">
                <t t-slot="default"/>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({ expanded: this.props.initialExpanded || false });
    }

    toggleExpanded() {
        this.state.expanded = !this.state.expanded;
    }
}

export class NoData extends Component {
    static template = xml`
        <div class="no-data">
            <t t-esc="props.message || 'No data available'"/>
        </div>
    `;
}

export class EventList extends Component {
    static template = xml`
        <div class="event-list">
            <div t-if="!props.events.length" class="no-data">
                <t t-esc="props.noDataMessage || 'No events available'"/>
            </div>
            
            <div t-else="" class="event-items">
                <div 
                    t-foreach="props.events" 
                    t-as="event" 
                    t-key="event_index"
                    t-attf-class="event-item {{ event.level ? event.level : '' }}"
                >
                    <span class="event-time" t-esc="helpers.formatEventTime(event)"></span>
                    <span t-if="event.level" t-attf-class="event-level {{ event.level }}" t-esc="event.level"></span>
                    <span class="event-text" t-esc="helpers.formatEventText(event)"></span>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.helpers = helpers;
    }
}

export class SessionProperties extends Component {
    static template = xml`
        <div class="session-properties">
            <!-- Audio information -->
            <div t-if="props.session.audio" class="property-card">
                <h6>Audio</h6>
                <ul class="property-list">
                    <li><span class="property-name">State:</span> <span t-esc="helpers.getAudioState(props.session.audio.state)"></span></li>
                    <li><span class="property-name">Muted:</span> <span t-esc="props.session.audio.muted ? 'Yes' : 'No'"></span></li>
                    <li><span class="property-name">Paused:</span> <span t-esc="props.session.audio.paused ? 'Yes' : 'No'"></span></li>
                    <li t-if="props.session.audio.networkState !== undefined"><span class="property-name">Network State:</span> <span t-esc="helpers.getNetworkState(props.session.audio.networkState)"></span></li>
                </ul>
            </div>
            
            <!-- Peer information -->
            <div t-if="props.session.peer" class="property-card">
                <h6>Peer Connection</h6>
                <ul class="property-list">
                    <li><span class="property-name">ID:</span> <span t-esc="props.session.peer.id"></span></li>
                    <li><span class="property-name">State:</span> <span t-esc="props.session.peer.state"></span></li>
                    <li><span class="property-name">ICE State:</span> <span t-esc="props.session.peer.iceState"></span></li>
                </ul>
            </div>
            
            <!-- SFU info -->
            <div t-if="props.session.sfuConsumers and props.session.sfuConsumers.length > 0" class="property-card">
                <h6>SFU Consumers</h6>
                <ul class="property-list">
                    <li t-foreach="props.session.sfuConsumers" t-as="consumer" t-key="consumer_index">
                        <span class="property-name" t-esc="consumer.type"></span>: 
                        <span t-esc="consumer.state"></span>
                    </li>
                </ul>
            </div>
            
            <!-- Additional properties -->
            <div class="property-card">
                <h6>Other Properties</h6>
                <ul class="property-list">
                    <li t-if="props.session.channelMemberId !== undefined">
                        <span class="property-name">Channel Member ID:</span> 
                        <span t-esc="props.session.channelMemberId"></span>
                    </li>
                    <li t-if="props.session.audioError">
                        <span class="property-name">Audio Error:</span> 
                        <span t-esc="props.session.audioError"></span>
                    </li>
                    <li t-if="props.session.videoError">
                        <span class="property-name">Video Error:</span> 
                        <span t-esc="props.session.videoError"></span>
                    </li>
                </ul>
            </div>
        </div>
    `;

    setup() {
        this.helpers = helpers;
    }
}
export class ConnectionState extends Component {
    static template = xml`
        <div class="connection-state">
            <div t-attf-class="state-indicator {{ props.stateClass }}"></div>
            <span class="property-name"><t t-esc="props.label || 'State:'"/></span>
            <span class="property-value" t-esc="props.state || 'Unknown'"></span>
        </div>
    `;
}

export default {
    ExpandableSection,
    NoData,
    EventList,
    SessionProperties,
    ConnectionState
};
