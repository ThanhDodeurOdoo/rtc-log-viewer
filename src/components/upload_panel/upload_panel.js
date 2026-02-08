const { Component, signal, plugin } = owl;
import { LogPlugin } from "../../plugins/log_plugin.js";
import { logWorkerService } from "../../services/log_worker_service.js";

export class UploadPanel extends Component {
    static template = "UploadPanel";

    setup() {
        this.log = plugin(LogPlugin);
        this.fileInputRef = signal(null);
        this.fileName = signal("");
        this.isDragOver = signal(false);
        this.isProcessing = signal(false);
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

    async processFile(file) {
        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Please upload a JSON file.");
            return;
        }

        this.fileName.set(file.name);
        this.isProcessing.set(true);

        try {
            const text = await file.text();
            const logs = await logWorkerService.parseJsonText(text);
            this.log.load(logs);
        } catch {
            alert("Error parsing the log file. Please ensure it is a valid JSON file.");
        } finally {
            this.isProcessing.set(false);
        }
    }

    async loadDemoData() {
        try {
            const response = await fetch(
                new URL("../../demo/rtc_log_demo.json", import.meta.url),
            );
            if (!response.ok) {
                throw new Error(`Failed to load demo data: ${response.status}`);
            }
            const logs = await response.json();
            await logWorkerService.setLogData(logs);
            this.log.load(logs);
            this.fileName.set("Demo data");
        } catch (error) {
            console.error("Failed to load demo data:", error);
            alert("Failed to load demo data. Please try again later.");
        }
    }
}
