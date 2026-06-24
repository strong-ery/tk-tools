import { BrowserWindow, app } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";
//#region electron/main.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
process.env.DIST = join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, "../public");
var win;
var pythonServer = null;
function startPythonServer() {
	const rootDir = join(__dirname, "../../");
	console.log("[Electron] Starting Python server at", rootDir);
	try {
		console.log("[Electron] Clearing port 8123...");
		try {
			if (process.platform === "win32") execSync(`powershell -Command "$proc = (Get-NetTCPConnection -LocalPort 8123 -ErrorAction SilentlyContinue).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force }"`);
			else execSync(`lsof -t -i:8123 | xargs kill -9`);
		} catch (e) {}
	} catch (e) {}
	pythonServer = spawn("python", ["src/server.py"], { cwd: rootDir });
	pythonServer.stdout?.on("data", (data) => {
		console.log(`[Python] ${data.toString().trim()}`);
	});
	pythonServer.stderr?.on("data", (data) => {
		console.error(`[Python Error] ${data.toString().trim()}`);
	});
	pythonServer.on("error", (err) => {
		console.error(`[Python Spawn Error] Failed to start python process:`, err);
	});
	pythonServer.on("close", (code) => {
		console.log(`[Python] Process exited with code ${code}`);
	});
}
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
	win = new BrowserWindow({
		icon: join(process.env.VITE_PUBLIC, "electron-vite.svg"),
		webPreferences: { preload: join(__dirname, "preload.js") }
	});
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(join(process.env.DIST, "index.html"));
}
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("quit", () => {
	if (pythonServer) pythonServer.kill();
});
app.whenReady().then(() => {
	startPythonServer();
	createWindow();
});
//#endregion
export {};
