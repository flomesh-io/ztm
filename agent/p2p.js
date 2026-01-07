// P2P Connection Manager for ZTM
// Handles direct peer-to-peer connections with NAT traversal

import { discoverPublicAddress as stunDiscoverPublicAddress, connectP2P as stunConnectP2P, testConnectivity as stunTestConnectivity } from './nat.js'

var DEFAULT_STUN_SERVERS = [
    'stun.l.google.com',
    'stun1.l.google.com',
    'stun2.l.google.com',
]

var DEFAULT_P2P_PORT = 17778
var P2P_TIMEOUT = 10  // Seconds to attempt P2P before falling back

export default function (config, tlsOptions, logInfo, logError, stunServers, p2pPort) {
    // Use provided STUN servers or fall back to defaults
    var STUN_SERVERS = stunServers || DEFAULT_STUN_SERVERS
    var P2P_PORT = p2pPort || DEFAULT_P2P_PORT

    logInfo(`P2P initialized with STUN servers: ${STUN_SERVERS.join(', ')}`)
    logInfo(`P2P listening port: ${P2P_PORT}`)
    var myPublicAddress = null
    var myPrivateAddress = null
    var detectedLocalIP = null
    var p2pConnections = {}
    var p2pListening = false

    // Wrapper functions to call NAT functions with proper context
    function callStunDiscover(host, port) {
        try {
            return stunDiscoverPublicAddress(host, port, STUN)
        } catch (e) {
            logError(`Error calling STUN discover: ${e}`)
            return Promise.reject(e)
        }
    }

    function callStunConnect(pubIp, pubPort, privIp, privPort, localPort) {
        try {
            return stunConnectP2P(pubIp, pubPort, privIp, privPort, localPort)
        } catch (e) {
            logError(`Error calling STUN connect: ${e}`)
            return Promise.reject(e)
        }
    }

    function callStunTest(ip, port) {
        try {
            return stunTestConnectivity(ip, port)
        } catch (e) {
            logError(`Error calling STUN test: ${e}`)
            return Promise.reject(e)
        }
    }

    // Discover our public address via STUN
    function discoverPublicAddress() {
        if (myPublicAddress) {
            return Promise.resolve(myPublicAddress)
        }

        // Try multiple STUN servers
        function tryStun(servers) {
            if (servers.length === 0) {
                return Promise.reject('All STUN servers failed')
            }

            var server = servers[0]

            // Parse server string - support both "host" and "host:port" formats
            var host, port
            if (server.indexOf(':') > 0) {
                var parts = server.split(':')
                host = parts[0]
                port = Number.parseInt(parts[1]) || 3478
            } else {
                host = server
                port = 3478  // Default STUN port
            }

            return callStunDiscover(host, port).then(
                addr => {
                    myPublicAddress = addr
                    logInfo(`Discovered public address: ${addr.ip}:${addr.port}`)
                    return addr
                }
            ).catch(err => {
                logError(`STUN server ${server} failed: ${err}`)
                return tryStun(servers.slice(1))
            })
        }

        return tryStun(STUN_SERVERS)
    }

    // Get our private address
    function getPrivateAddress() {
        if (myPrivateAddress) {
            return myPrivateAddress
        }

        var localIp = '127.0.0.1'
        
        if (os.env['LOCAL_IP']) {
            localIp = os.env['LOCAL_IP']
        } else if (detectedLocalIP) {
            localIp = detectedLocalIP
        }

        myPrivateAddress = {
            ip: localIp,
            port: P2P_PORT
        }
        return myPrivateAddress
    }
    
    function setLocalIP(ip) {
        if (ip && ip !== '0.0.0.0') {
            detectedLocalIP = ip
            myPrivateAddress = null
            logInfo(`Detected local IP for P2P: ${ip}`)
        }
    }

    // Start P2P listener
    function startP2PListener(onConnection) {
        if (p2pListening) return

        logInfo(`Starting P2P listener on port ${P2P_PORT}`)
        
        // Validate port is a number
        var port = Number(P2P_PORT)
        if (!port || port <= 0 || port > 65535) {
            logError(`Invalid P2P port: ${P2P_PORT}`)
            return
        }

        pipy.listen(`0.0.0.0:${port}`, { idleTimeout: 0 }, $ => $
            .acceptTLS({
                certificate: tlsOptions.certificate,
                pqc: tlsOptions.pqc,
                trusted: tlsOptions.trusted,
            }).to($ => $
                .demuxHTTP().to($ => $
                    .pipe(onConnection)
                )
            )
        )

        p2pListening = true
    }

    // Check if IP is localhost
    function isLocalhost(ip) {
        return ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('127.')
    }

    // Check if two IPs are in the same /24 subnet
    function isSameSubnet(ip1, ip2) {
        var parts1 = ip1.split('.')
        var parts2 = ip2.split('.')
        if (parts1.length !== 4 || parts2.length !== 4) return false
        return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2]
    }

    // Direct TCP connection without UDP hole punching
    function directTCPConnect(ip, port) {
        logInfo(`Using direct TCP connection to ${ip}:${port}`)
        // For direct connections, just return the address
        // The actual connection will be established by the TLS pipeline
        return Promise.resolve({ ip: ip, port: port })
    }

    // Attempt P2P connection to peer
    function tryP2PConnection(peerInfo) {
        var epId = peerInfo.id

        logInfo(`Attempting P2P connection to ${peerInfo.name} (${epId})`)

        var connectionAttempt = discoverPublicAddress().then(ourPublic => {
            var ourPrivate = getPrivateAddress()

            logInfo(`Our addresses - Public: ${ourPublic.ip}:${ourPublic.port}, Private: ${ourPrivate.ip}:${ourPrivate.port}`)
            logInfo(`Peer addresses - Public: ${peerInfo.publicIp}:${peerInfo.publicPort}, Private: ${peerInfo.privateIp}:${peerInfo.privatePort}`)

            // Check if both are localhost
            if (isLocalhost(ourPrivate.ip) && isLocalhost(peerInfo.privateIp)) {
                logInfo(`Both endpoints on localhost, using direct TCP connection`)
                return directTCPConnect(peerInfo.privateIp, peerInfo.privatePort).then(result => {
                    logInfo(`Direct TCP connection established to ${peerInfo.name} via ${result.ip}:${result.port}`)
                    p2pConnections[epId] = {
                        ip: result.ip,
                        port: result.port,
                        established: Date.now(),
                        peerInfo: peerInfo
                    }
                    return {
                        address: `${result.ip}:${result.port}`,
                        isDirect: true
                    }
                })
            }

            // Check if both are on same subnet
            if (isSameSubnet(ourPrivate.ip, peerInfo.privateIp)) {
                logInfo(`Both endpoints on same subnet, using direct TCP connection`)
                return directTCPConnect(peerInfo.privateIp, peerInfo.privatePort).then(result => {
                    logInfo(`Direct TCP connection established to ${peerInfo.name} via ${result.ip}:${result.port}`)
                    p2pConnections[epId] = {
                        ip: result.ip,
                        port: result.port,
                        established: Date.now(),
                        peerInfo: peerInfo
                    }
                    return {
                        address: `${result.ip}:${result.port}`,
                        isDirect: true
                    }
                })
            }

            // Different networks, use UDP hole punching
            logInfo(`Endpoints on different networks, using UDP hole punching`)
            return callStunConnect(
                peerInfo.publicIp,
                peerInfo.publicPort,
                peerInfo.privateIp,
                peerInfo.privatePort,
                0
            ).then(result => {
                logInfo(`P2P connection established to ${peerInfo.name} via ${result.ip}:${result.port}`)
                p2pConnections[epId] = {
                    ip: result.ip,
                    port: result.port,
                    established: Date.now(),
                    peerInfo: peerInfo
                }
                return {
                    address: `${result.ip}:${result.port}`,
                    isDirect: true
                }
            })
        })

        var timeout = new Timeout(P2P_TIMEOUT).wait().then(() => {
            logInfo(`P2P connection to ${peerInfo.name} timed out after ${P2P_TIMEOUT}s`)
            return null
        })

        return Promise.race([connectionAttempt, timeout]).catch(err => {
            logError(`P2P connection to ${peerInfo.name} failed: ${err}`)
            return null
        })
    }

    // Test if P2P connection is still alive
    function testP2PConnection(epId) {
        var conn = p2pConnections[epId]
        if (!conn) return Promise.resolve(false)

        return callStunTest(conn.ip, conn.port).then(
            result => {
                if (!result.reachable) {
                    logInfo(`P2P connection to ${epId} is dead, removing`)
                    delete p2pConnections[epId]
                    return false
                }
                return true
            }
        )
    }

    // Get P2P connection if available
    function getP2PConnection(epId) {
        var conn = p2pConnections[epId]
        if (!conn) return null

        // Check if connection is recent (within 5 minutes)
        if (Date.now() - conn.established > 5 * 60 * 1000) {
            logInfo(`P2P connection to ${epId} is stale, will re-establish`)
            delete p2pConnections[epId]
            return null
        }

        return {
            address: `${conn.ip}:${conn.port}`,
            isDirect: true
        }
    }

    // Get our connection info to share with peers
    function getConnectionInfo() {
        return discoverPublicAddress().then(publicAddr => {
            logInfo(`getConnectionInfo: publicAddr = ${JSON.stringify(publicAddr)}`)
            var privateAddr = getPrivateAddress()
            logInfo(`getConnectionInfo: privateAddr = ${JSON.stringify(privateAddr)}`)
            
            if (!publicAddr || !publicAddr.ip) {
                return Promise.reject('Invalid public address')
            }
            if (!privateAddr || !privateAddr.ip || !privateAddr.port) {
                return Promise.reject('Invalid private address')
            }
            
            // Use P2P_PORT for both public and private, not the ephemeral STUN port
            return {
                publicIp: publicAddr.ip,
                publicPort: P2P_PORT,
                privateIp: privateAddr.ip,
                privatePort: privateAddr.port
            }
        })
    }

    return {
        startP2PListener,
        tryP2PConnection,
        testP2PConnection,
        getP2PConnection,
        getConnectionInfo,
        discoverPublicAddress,
        setLocalIP,
    }
}
