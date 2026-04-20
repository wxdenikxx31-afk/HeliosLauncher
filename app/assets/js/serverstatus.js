const net = require('net')

// Write a VarInt into a Buffer
function writeVarInt(val) {
    const buf = []
    do {
        let b = val & 0x7F
        val >>>= 7
        if (val !== 0) b |= 0x80
        buf.push(b)
    } while (val !== 0)
    return Buffer.from(buf)
}

// Read a VarInt from a Buffer at offset, returns { value, bytesRead }
function readVarInt(buf, offset) {
    let result = 0
    let shift = 0
    let bytesRead = 0
    while (offset + bytesRead < buf.length) {
        const b = buf[offset + bytesRead]
        result |= (b & 0x7F) << shift
        bytesRead++
        if ((b & 0x80) === 0) break
        shift += 7
        if (shift >= 32) throw new Error('VarInt too big')
    }
    return { value: result, bytesRead }
}

/**
 * Retrieves the status of a minecraft server using the modern
 * Server List Ping (SLP) protocol (Minecraft 1.7+).
 * 
 * @param {string} address The server address.
 * @param {number} port Optional. The port of the server. Defaults to 25565.
 * @returns {Promise.<Object>} A promise which resolves to an object containing
 * status information.
 */
exports.getStatus = function(address, port = 25565){

    if(port == null || port == ''){
        port = 25565
    }
    if(typeof port === 'string'){
        port = parseInt(port)
    }

    return new Promise((resolve, reject) => {
        const socket = net.connect(port, address, () => {
            // Build Handshake packet (packet ID 0x00)
            const hostBuf = Buffer.from(address, 'utf8')
            const portBuf = Buffer.alloc(2)
            portBuf.writeUInt16BE(port, 0)

            const handshakePayload = Buffer.concat([
                writeVarInt(0x00),   // Packet ID: Handshake
                writeVarInt(-1),     // Protocol version: -1 (ping any version)
                writeVarInt(hostBuf.length),
                hostBuf,
                portBuf,
                writeVarInt(1)       // Next state: 1 = Status
            ])
            const handshakePacket = Buffer.concat([
                writeVarInt(handshakePayload.length),
                handshakePayload
            ])

            // Build Status Request packet (packet ID 0x00, no fields)
            const statusReqPayload = writeVarInt(0x00)
            const statusReqPacket = Buffer.concat([
                writeVarInt(statusReqPayload.length),
                statusReqPayload
            ])

            socket.write(Buffer.concat([handshakePacket, statusReqPacket]))
        })

        socket.setTimeout(5000, () => {
            socket.destroy()
            reject({
                code: 'ETIMEDOUT',
                errno: 'ETIMEDOUT',
                address,
                port
            })
        })

        let buffer = Buffer.alloc(0)
        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data])
            try {
                let offset = 0

                // Read packet length
                const packetLen = readVarInt(buffer, offset)
                offset += packetLen.bytesRead

                // Not enough data yet
                if (buffer.length < offset + packetLen.value) return

                // Read packet ID
                const packetId = readVarInt(buffer, offset)
                offset += packetId.bytesRead

                if (packetId.value !== 0x00) {
                    socket.destroy()
                    resolve({ online: false })
                    return
                }

                // Read JSON string length
                const jsonLen = readVarInt(buffer, offset)
                offset += jsonLen.bytesRead

                // Not enough data for the full JSON string
                if (buffer.length < offset + jsonLen.value) return

                const jsonStr = buffer.slice(offset, offset + jsonLen.value).toString('utf8')
                const status = JSON.parse(jsonStr)

                socket.destroy()
                resolve({
                    online: true,
                    version: status.version ? status.version.name : 'Unknown',
                    motd: status.description
                        ? (typeof status.description === 'string'
                            ? status.description
                            : (status.description.text || ''))
                        : '',
                    onlinePlayers: status.players ? String(status.players.online) : '0',
                    maxPlayers: status.players ? String(status.players.max) : '0'
                })
            } catch(e) {
                // Not enough data yet — wait for more
            }
        })

        socket.on('error', (err) => {
            socket.destroy()
            reject(err)
            // ENOTFOUND = Unable to resolve.
            // ECONNREFUSED = Unable to connect to port.
        })
    })

}