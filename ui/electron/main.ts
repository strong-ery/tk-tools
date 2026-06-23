import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess, execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null
let pythonServer: ChildProcess | null = null

function startPythonServer() {
  const rootDir = join(__dirname, '../../')
  console.log('[Electron] Starting Python server at', rootDir)

  try {
    // Force kill any zombie process holding our port before starting
    console.log('[Electron] Clearing port 8123...')
    if (process.platform === 'win32') {
      execSync(`powershell -Command "(Get-NetTCPConnection -LocalPort 8123 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force"`)
    } else {
      execSync(`lsof -t -i:8123 | xargs kill -9`)
    }
  } catch (e) {
    // Ignore errors if the port was already free
  }

  pythonServer = spawn('python', ['src/server.py'], {
    cwd: rootDir,
  })

  pythonServer.stdout?.on('data', (data) => {
    console.log(`[Python] ${data.toString().trim()}`)
  })

  pythonServer.stderr?.on('data', (data) => {
    console.error(`[Python Error] ${data.toString().trim()}`)
  })

  pythonServer.on('error', (err) => {
    console.error(`[Python Spawn Error] Failed to start python process:`, err)
  })

  pythonServer.on('close', (code) => {
    console.log(`[Python] Process exited with code ${code}`)
  })
}

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('quit', () => {
  if (pythonServer) {
    pythonServer.kill()
  }
})

app.whenReady().then(() => {
  startPythonServer()
  createWindow()
})
