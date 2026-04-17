/**
 * Console & Dev Tools module for settings tab.
 * Captures Minecraft game output and launcher logs.
 * Provides filtering, copy, export, and diagnostics.
 * 
 * NOTE: os, path, ipcRenderer, shell, remote are already declared
 * in uicore.js / settings.js which share the same global scope.
 */

const _consoleClipboard = require('electron').clipboard
const _consoleFs = require('fs')

// ============================
// LOG STORE
// ============================

const LOG_MAX_ENTRIES = 10000
const logStore = {
    entries: [],    // { time: Date, source: 'game'|'launcher', level: 'info'|'warn'|'error'|'debug', text: string }
    listeners: [],

    add(source, level, text) {
        const entry = {
            time: new Date(),
            source,
            level,
            text: text.replace(/\x1b\[[0-9;]*m/g, '') // strip ANSI
        }
        this.entries.push(entry)
        if (this.entries.length > LOG_MAX_ENTRIES) {
            this.entries.splice(0, this.entries.length - LOG_MAX_ENTRIES)
        }
        this.listeners.forEach(fn => fn(entry))
    },

    clear() {
        this.entries = []
    },

    onEntry(fn) {
        this.listeners.push(fn)
    },

    getAll() {
        return this.entries
    }
}

// Make globally accessible for other modules
window.logStore = logStore

// ============================
// INTERCEPT console.log FOR LAUNCHER LOGS
// ============================

const _origConsoleLog = console.log
const _origConsoleWarn = console.warn
const _origConsoleError = console.error
const _origConsoleDebug = console.debug

console.log = function(...args) {
    _origConsoleLog.apply(console, args)
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    // Check if this is a Minecraft log line (from processbuilder)
    if (text.includes('[Minecraft]')) {
        // Already handled by game capture, skip
        return
    }
    logStore.add('launcher', 'info', text)
}

console.warn = function(...args) {
    _origConsoleWarn.apply(console, args)
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    logStore.add('launcher', 'warn', text)
}

console.error = function(...args) {
    _origConsoleError.apply(console, args)
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    logStore.add('launcher', 'error', text)
}

console.debug = function(...args) {
    _origConsoleDebug.apply(console, args)
    const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    logStore.add('launcher', 'debug', text)
}

// ============================
// GAME LOG CAPTURE (called from landing.js)
// ============================

/**
 * Feed game stdout line to log store.
 * @param {string} data 
 */
function captureGameStdout(data) {
    const lines = data.trim().split('\n')
    lines.forEach(line => {
        const level = detectLogLevel(line)
        logStore.add('game', level, line)
    })
}

/**
 * Feed game stderr line to log store.
 * @param {string} data 
 */
function captureGameStderr(data) {
    const lines = data.trim().split('\n')
    lines.forEach(line => {
        logStore.add('game', 'error', line)
    })
}

function detectLogLevel(line) {
    const lower = line.toLowerCase()
    if (lower.includes('/warn') || lower.includes('warning')) return 'warn'
    if (lower.includes('/error') || lower.includes('exception') || lower.includes('crash')) return 'error'
    if (lower.includes('/debug') || lower.includes('debug')) return 'debug'
    return 'info'
}

window.captureGameStdout = captureGameStdout
window.captureGameStderr = captureGameStderr

// ============================
// UI CONTROLLER
// ============================

let currentSource = 'game'
let currentFilter = ''
let activeLevels = new Set(['info', 'warn', 'error', 'debug'])
let autoScroll = true
let consoleInitialized = false

function initConsoleTab() {
    if (consoleInitialized) return
    consoleInitialized = true

    // Source tabs
    document.querySelectorAll('.consoleTabBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.consoleTabBtn').forEach(b => b.classList.remove('consoleTabActive'))
            btn.classList.add('consoleTabActive')
            currentSource = btn.getAttribute('data-log-source')
            renderLogs()
        })
    })

    // Level filter buttons
    document.querySelectorAll('.consoleLevelBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.getAttribute('data-level')
            if (activeLevels.has(level)) {
                activeLevels.delete(level)
                btn.classList.remove('consoleLevelActive')
            } else {
                activeLevels.add(level)
                btn.classList.add('consoleLevelActive')
            }
            renderLogs()
        })
    })

    // Text filter
    document.getElementById('consoleFilterInput').addEventListener('input', (e) => {
        currentFilter = e.target.value
        renderLogs()
    })

    // Clear
    document.getElementById('consoleClearBtn').addEventListener('click', () => {
        logStore.clear()
        renderLogs()
    })

    // Auto scroll toggle
    document.getElementById('consoleAutoScroll').addEventListener('change', (e) => {
        autoScroll = e.target.checked
    })

    // Copy all
    document.getElementById('consoleCopyBtn').addEventListener('click', () => {
        const text = getFilteredLogsText()
        _consoleClipboard.writeText(text)
        showCopyFeedback(document.getElementById('consoleCopyBtn'), '✓ Скопировано!')
    })

    // Export .txt
    document.getElementById('consoleExportTxtBtn').addEventListener('click', () => {
        exportLogs('txt')
    })

    // Export .md
    document.getElementById('consoleExportMdBtn').addEventListener('click', () => {
        exportLogs('md')
    })

    // Dev Tools buttons
    document.getElementById('devOpenDataFolder').addEventListener('click', () => {
        shell.openPath(remote.app.getPath('userData'))
    })

    document.getElementById('devOpenGameFolder').addEventListener('click', () => {
        const gameDir = path.join(ConfigManager.getDataDirectory(), 'instances')
        if (_consoleFs.existsSync(gameDir)) {
            shell.openPath(gameDir)
        } else {
            shell.openPath(ConfigManager.getDataDirectory())
        }
    })

    document.getElementById('devOpenLogsFolder').addEventListener('click', () => {
        const logsDir = path.join(ConfigManager.getDataDirectory(), 'instances')
        // Try to find logs folder in latest instance
        if (_consoleFs.existsSync(logsDir)) {
            const instances = _consoleFs.readdirSync(logsDir).filter(f => {
                return _consoleFs.statSync(path.join(logsDir, f)).isDirectory()
            })
            for (const inst of instances) {
                const logPath = path.join(logsDir, inst, 'logs')
                if (_consoleFs.existsSync(logPath)) {
                    shell.openPath(logPath)
                    return
                }
            }
        }
        shell.openPath(ConfigManager.getDataDirectory())
    })

    document.getElementById('devCopyDiagnostics').addEventListener('click', () => {
        const diag = buildDiagnosticsText()
        _consoleClipboard.writeText(diag)
        showCopyFeedback(document.getElementById('devCopyDiagnostics'), '✓ Скопировано!')
    })

    document.getElementById('devToggleDevTools').addEventListener('click', () => {
        remote.getCurrentWindow().webContents.toggleDevTools()
    })

    // Live log updates
    logStore.onEntry((entry) => {
        if (isConsoleTabVisible()) {
            appendLogLine(entry)
            updateLogCount()
        }
    })

    // Initial render
    renderLogs()
    updateDevToolsInfo()
    // Periodically update process info
    setInterval(updateDevToolsInfo, 5000)
}

function isConsoleTabVisible() {
    const tab = document.getElementById('settingsTabConsole')
    return tab && tab.style.display !== 'none'
}

function filterEntry(entry) {
    // Source filter
    if (currentSource !== 'all' && entry.source !== currentSource) return false
    // Level filter
    if (!activeLevels.has(entry.level)) return false
    // Text filter
    if (currentFilter) {
        // Check if regex pattern
        if (currentFilter.startsWith('/') && currentFilter.endsWith('/')) {
            try {
                const regex = new RegExp(currentFilter.slice(1, -1), 'i')
                if (!regex.test(entry.text)) return false
            } catch (e) {
                // Invalid regex, use as plain text
                if (!entry.text.toLowerCase().includes(currentFilter.toLowerCase())) return false
            }
        } else {
            if (!entry.text.toLowerCase().includes(currentFilter.toLowerCase())) return false
        }
    }
    return true
}

function renderLogs() {
    const container = document.getElementById('consoleLogContent')
    const logContainer = document.getElementById('consoleLogContainer')
    const entries = logStore.getAll().filter(filterEntry)

    if (entries.length === 0) {
        container.innerHTML = '<div id="consoleLogEmpty">Логи появятся после запуска игры или при работе лаунчера...</div>'
    } else {
        container.innerHTML = ''
        // Limit rendered entries for performance
        const startIdx = Math.max(0, entries.length - 2000)
        for (let i = startIdx; i < entries.length; i++) {
            container.appendChild(createLogLineElement(entries[i]))
        }
    }

    if (autoScroll) {
        logContainer.scrollTop = logContainer.scrollHeight
    }
    updateLogCount()
}

function appendLogLine(entry) {
    if (!filterEntry(entry)) return

    const container = document.getElementById('consoleLogContent')
    const logContainer = document.getElementById('consoleLogContainer')
    const emptyMsg = document.getElementById('consoleLogEmpty')
    if (emptyMsg) emptyMsg.remove()

    container.appendChild(createLogLineElement(entry))

    // Trim DOM if too many
    while (container.children.length > 2000) {
        container.removeChild(container.firstChild)
    }

    if (autoScroll) {
        logContainer.scrollTop = logContainer.scrollHeight
    }
}

function createLogLineElement(entry) {
    const div = document.createElement('div')
    div.className = `logLine level-${entry.level}`

    const time = document.createElement('span')
    time.className = 'logLineTime'
    time.textContent = formatTime(entry.time)

    const source = document.createElement('span')
    source.className = `logLineSource ${entry.source}`
    source.textContent = entry.source === 'game' ? '[MC]' : '[LN]'

    const text = document.createTextNode(entry.text)

    div.appendChild(time)
    div.appendChild(source)
    div.appendChild(text)
    return div
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
}

function updateLogCount() {
    const count = logStore.getAll().filter(filterEntry).length
    const el = document.getElementById('consoleLogCount')
    if (el) el.textContent = count + ' записей'
}

// ============================
// EXPORT FUNCTIONS
// ============================

function getFilteredLogsText() {
    const entries = logStore.getAll().filter(filterEntry)
    return entries.map(e => {
        const time = formatTime(e.time)
        const src = e.source === 'game' ? '[MC]' : '[LN]'
        const lvl = `[${e.level.toUpperCase()}]`
        return `${time} ${src} ${lvl} ${e.text}`
    }).join('\n')
}

function exportLogs(format) {
    const { dialog } = remote
    const defaultName = `launcher-logs-${new Date().toISOString().slice(0, 10)}`

    const filters = format === 'md'
        ? [{ name: 'Markdown', extensions: ['md'] }]
        : [{ name: 'Text files', extensions: ['txt'] }]

    dialog.showSaveDialog(remote.getCurrentWindow(), {
        title: 'Экспорт логов',
        defaultPath: path.join(remote.app.getPath('desktop'), `${defaultName}.${format}`),
        filters
    }).then(result => {
        if (!result.canceled && result.filePath) {
            let content
            if (format === 'md') {
                content = buildMarkdownExport()
            } else {
                content = getFilteredLogsText()
            }
            _consoleFs.writeFileSync(result.filePath, content, 'utf8')
        }
    })
}

function buildMarkdownExport() {
    const entries = logStore.getAll().filter(filterEntry)
    const lines = [
        `# Лог лаунчера — ${new Date().toLocaleString('ru-RU')}`,
        '',
        `**Версия лаунчера:** ${remote.app.getVersion()}`,
        `**ОС:** ${os.type()} ${os.release()} (${os.arch()})`,
        `**Записей:** ${entries.length}`,
        '',
        '---',
        '',
        '```'
    ]

    entries.forEach(e => {
        const time = formatTime(e.time)
        const src = e.source === 'game' ? '[MC]' : '[LN]'
        const lvl = `[${e.level.toUpperCase()}]`
        lines.push(`${time} ${src} ${lvl} ${e.text}`)
    })

    lines.push('```')
    return lines.join('\n')
}

function showCopyFeedback(btn, text) {
    const orig = btn.textContent
    btn.textContent = text
    setTimeout(() => { btn.textContent = orig }, 1500)
}

// ============================
// DIAGNOSTICS
// ============================

function updateDevToolsInfo() {
    // System info
    const sysEl = document.getElementById('devInfoSystem')
    if (sysEl) {
        const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)
        const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1)
        sysEl.textContent = [
            `ОС: ${os.type()} ${os.release()}`,
            `Архитектура: ${os.arch()}`,
            `CPU: ${os.cpus()[0]?.model || 'N/A'} (${os.cpus().length} потоков)`,
            `RAM: ${freeMem} ГБ свободно / ${totalMem} ГБ`
        ].join('\n')
    }

    // Java info
    const javaEl = document.getElementById('devInfoJava')
    if (javaEl) {
        try {
            const servId = ConfigManager.getSelectedServer()
            const javaPath = ConfigManager.getJavaExecutable(servId)
            const minRam = ConfigManager.getMinRAM(servId)
            const maxRam = ConfigManager.getMaxRAM(servId)
            javaEl.textContent = [
                `Путь: ${javaPath || 'Авто'}`,
                `Мин. RAM: ${minRam}`,
                `Макс. RAM: ${maxRam}`
            ].join('\n')
        } catch (e) {
            javaEl.textContent = 'Нет выбранного сервера'
        }
    }

    // Process info
    const procEl = document.getElementById('devInfoProcess')
    if (procEl) {
        if (typeof proc !== 'undefined' && proc !== null) {
            procEl.textContent = `PID: ${proc.pid}\nСтатус: Запущен`
            procEl.style.color = 'rgb(80, 200, 80)'
        } else {
            procEl.textContent = 'Игра не запущена'
            procEl.style.color = ''
        }
    }

    // Memory info
    const memEl = document.getElementById('devInfoMemory')
    if (memEl) {
        const procMem = process.memoryUsage()
        memEl.textContent = [
            `Heap: ${(procMem.heapUsed / 1048576).toFixed(1)} / ${(procMem.heapTotal / 1048576).toFixed(1)} МБ`,
            `RSS: ${(procMem.rss / 1048576).toFixed(1)} МБ`,
            `External: ${(procMem.external / 1048576).toFixed(1)} МБ`
        ].join('\n')
    }
}

function buildDiagnosticsText() {
    const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)
    const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1)
    const procMem = process.memoryUsage()
    const cpuModel = os.cpus()[0]?.model || 'N/A'
    const lines = [
        '=== Диагностика лаунчера ===',
        `Дата: ${new Date().toLocaleString('ru-RU')}`,
        `Версия лаунчера: ${remote.app.getVersion()}`,
        `Electron: ${process.versions.electron}`,
        `Node.js: ${process.version}`,
        `Chrome: ${process.versions.chrome}`,
        '',
        '--- Система ---',
        `ОС: ${os.type()} ${os.release()} (${os.arch()})`,
        `CPU: ${cpuModel} (${os.cpus().length} потоков)`,
        `RAM: ${freeMem} ГБ свободно / ${totalMem} ГБ всего`,
        '',
        '--- Память лаунчера ---',
        `Heap: ${(procMem.heapUsed / 1048576).toFixed(1)} / ${(procMem.heapTotal / 1048576).toFixed(1)} МБ`,
        `RSS: ${(procMem.rss / 1048576).toFixed(1)} МБ`,
        ''
    ]

    try {
        const servId = ConfigManager.getSelectedServer()
        const javaPath = ConfigManager.getJavaExecutable(servId)
        const minRam = ConfigManager.getMinRAM(servId)
        const maxRam = ConfigManager.getMaxRAM(servId)
        lines.push('--- Java ---')
        lines.push(`Путь: ${javaPath || 'Авто'}`)
        lines.push(`Мин. RAM: ${minRam}`)
        lines.push(`Макс. RAM: ${maxRam}`)
    } catch (e) {
        lines.push('--- Java ---')
        lines.push('Нет выбранного сервера')
    }

    lines.push('')
    lines.push(`Всего записей в журнале: ${logStore.entries.length}`)
    const errors = logStore.entries.filter(e => e.level === 'error')
    lines.push(`Из них ошибок: ${errors.length}`)
    if (errors.length > 0) {
        lines.push('')
        lines.push('--- Последние ошибки (до 20) ---')
        errors.slice(-20).forEach(e => {
            lines.push(`${formatTime(e.time)} [${e.source.toUpperCase()}] ${e.text}`)
        })
    }

    return lines.join('\n')
}
