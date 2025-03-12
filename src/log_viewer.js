const { Component, xml, useState } = owl;

export class LogViewer extends Component {
    static template = xml`
        <div class="log-viewer">
            <div class="log-viewer-header">
                <h3>RTC Log Viewer</h3>
                <div class="view-controls">
                    <button 
                        t-foreach="viewOptions" 
                        t-as="option" 
                        t-key="option.id"
                        t-attf-class="view-option {{ state.activeView === option.id ? 'active' : '' }}"
                        t-on-click="() => this.setActiveView(option.id)"
                    >
                        <t t-esc="option.label" />
                    </button>
                </div>
            </div>
            
            <div class="log-viewer-content">
                <div t-if="state.activeView === 'timeline'" class="timeline-view">
                    Timeline view - TBD
                </div>
                
                <div t-elif="state.activeView === 'session'" class="session-view">
                    Session view - TBD
                </div>
                
                <div t-elif="state.activeView === 'raw'" class="raw-view">
                    <pre t-esc="window.JSON.stringify(props.logs, null, 2)"></pre>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.state = useState({
            activeView: 'timeline'
        });

        this.viewOptions = [
            { id: 'timeline', label: 'Timeline' },
            { id: 'session', label: 'Session Details' },
            { id: 'raw', label: 'Raw Data' }
        ];
    }

    setActiveView(viewId) {
        this.state.activeView = viewId;
    }
}