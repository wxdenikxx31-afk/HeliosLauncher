const { DistributionAPI } = require('helios-core/common')
const got = require('got')
const fs = require('fs-extra')

const ConfigManager = require('./configmanager')

// Old WesterosCraft url.
// exports.REMOTE_DISTRO_URL = 'http://mc.westeroscraft.com/WesterosCraftLauncher/distribution.json'
exports.REMOTE_DISTRO_URL = 'https://wxdenikxx31-afk.github.io/Universalkraft-full/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

// Strip UTF-8 BOM from strings (GitHub Pages may serve files with BOM)
function stripBOM(str) {
    return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str
}

// Monkey-patch pullRemote to handle BOM in JSON response + add timeout
const origPullRemote = api.pullRemote.bind(api)
api.pullRemote = async function() {
    try {
        const res = await got.get(exports.REMOTE_DISTRO_URL, {
            responseType: 'text',
            timeout: {
                request: 15000
            },
            retry: {
                limit: 1
            }
        })
        const data = JSON.parse(stripBOM(res.body))
        return { data, responseStatus: 0 }
    } catch(e) {
        // If our custom request failed, try original helios-core method
        try {
            return await origPullRemote()
        } catch(e2) {
            return { data: null, responseStatus: 1 }
        }
    }
}

// Monkey-patch readDistributionFromFile to handle BOM in local file
const origReadFile = api.readDistributionFromFile.bind(api)
api.readDistributionFromFile = async function(path) {
    if(await fs.pathExists(path)) {
        try {
            const raw = await fs.readFile(path, 'utf-8')
            return JSON.parse(stripBOM(raw))
        } catch(e) {
            return null
        }
    }
    return null
}

exports.DistroAPI = api