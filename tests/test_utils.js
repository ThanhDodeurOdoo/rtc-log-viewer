import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const componentDir = join(projectRoot, "src", "components");

export function setupRaf() {
    const raf = (cb) => setTimeout(cb, 0);
    const caf = (id) => clearTimeout(id);
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
    if (globalThis.window) {
        globalThis.window.requestAnimationFrame = raf;
        globalThis.window.cancelAnimationFrame = caf;
    }
}

export function collectXmlFiles(dir = componentDir) {
    const entries = readdirSync(dir);
    const files = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...collectXmlFiles(fullPath));
        } else if (entry.endsWith(".xml")) {
            files.push(fullPath);
        }
    }
    return files.sort();
}

export function loadOwl() {
    if (globalThis.owl) {
        return;
    }
    const owlSource = readFileSync(
        join(projectRoot, "lib", "owl.iife.js"),
        "utf-8",
    );
    const run = new Function(owlSource);
    run.call(globalThis);
}

export function loadTemplates(app, files = collectXmlFiles()) {
    for (const filePath of files) {
        app.addTemplates(readFileSync(filePath, "utf-8"));
    }
}

export async function createApp({ Root, plugins }) {
    const { App } = globalThis.owl;
    const app = new App({ plugins, test: true });
    loadTemplates(app);
    const root = app.createRoot(Root);
    document.body.innerHTML = '<div id="app"></div>';
    await root.mount(document.getElementById("app"));
    return { app, root };
}

export async function flush(app) {
    await Promise.resolve();
    await Promise.resolve();
    app.scheduler.flush();
    app.scheduler.processTasks();
    await Promise.resolve();
    app.scheduler.processTasks();
}

export async function waitFor(app, predicate, attempts = 10) {
    for (let i = 0; i < attempts; i++) {
        await flush(app);
        if (predicate()) {
            return true;
        }
    }
    return false;
}

export async function waitForSelector(app, selector, attempts = 10) {
    let node = null;
    await waitFor(
        app,
        () => {
            node = document.querySelector(selector);
            return Boolean(node);
        },
        attempts,
    );
    return node;
}

export async function waitForElements(app, selector, { min = 1, exact } = {}) {
    let nodes = [];
    await waitFor(app, () => {
        nodes = document.querySelectorAll(selector);
        if (exact !== undefined) {
            return nodes.length === exact;
        }
        return nodes.length >= min;
    });
    return nodes;
}

export function getByText(selector, text) {
    const match = Array.from(document.querySelectorAll(selector)).find(
        (node) => node.textContent.trim() === text,
    );
    if (!match) {
        throw new Error(`Could not find element ${selector} with text "${text}"`);
    }
    return match;
}

export function click(element) {
    element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

export function clickByText(selector, text) {
    click(getByText(selector, text));
}
