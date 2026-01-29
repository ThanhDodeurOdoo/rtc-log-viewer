const { Component, xml, signal, plugin } = owl;
import { LogPlugin } from "./plugins/log_plugin.js";

export class UploadPanel extends Component {
    static template = xml`
        <div
            class="file-upload-container"
            t-attf-class="file-upload-container {{ this.isDragOver() ? 'drag-over' : '' }}"
            t-on-dragover.prevent.stop="this.onDragOver"
            t-on-dragleave.prevent.stop="this.onDragLeave"
            t-on-drop.prevent.stop="this.onFileDrop"
        >
            <h2>RTC Log Viewer</h2>
            <p>Upload a JSON log file (<a target="_blank" href="https://www.odoo.com/knowledge/article/28833">from Odoo Discuss RTC</a>)</p>
            <p class="download-info">logs are analyzed locally and stay on your device</p>
            <div class="drop-zone">
                <div class="drop-zone-prompt">
                    <i class="drop-icon"></i>
                    <p>Drag and drop your JSON log file here</p>
                    <p>or</p>
                </div>
                
                <div class="file-input">
                    <input type="file" accept=".json" t-ref="this.fileInputRef" t-on-change="this.onFileChange"/>
                    <button t-on-click="this.triggerFileInput">Choose File</button>
                    <span t-if="this.fileName()" class="file-name" t-out="this.fileName()"></span>
                    <span t-else="" class="file-hint">No file chosen</span>
                </div>
            </div>
        </div>
    `;

    setup() {
        this.log = plugin(LogPlugin);
        this.fileInputRef = signal(null);
        this.fileName = signal("");
        this.isDragOver = signal(false);
    }

    triggerFileInput() {
        this.fileInputRef()?.click();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        this.processFile(file);
    }

    onDragOver() {
        this.isDragOver.set(true);
    }

    onDragLeave() {
        this.isDragOver.set(false);
    }

    onFileDrop(event) {
        this.isDragOver.set(false);

        const files = event.dataTransfer.files;
        if (files.length === 0) {
            return;
        }

        const file = files[0];
        this.processFile(file);
    }

    processFile(file) {
        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Please upload a JSON file.");
            return;
        }

        this.fileName.set(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const logs = JSON.parse(e.target.result);
                this.log.load(logs);
            } catch {
                alert("Error parsing the log file. Please ensure it is a valid JSON file.");
            }
        };
        reader.readAsText(file);
    }
}
