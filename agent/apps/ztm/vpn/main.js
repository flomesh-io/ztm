// zt-vpn app - Phase 1: TUN + 复用 proxy (tun2socks TCP)
// 客户端 TUN 截获流量, 解析 TCP, 通过 mesh 隧道转发到 exit proxy

export default function ({ app, mesh, utils }) {
  var flows = {}
  var tun = null

  // ============ 配置 ============
  // TUN 配置从 /local/config.json 读取, 缺省用测试值
  var tunConfig = {
    ip: '10.66.0.1',
    peer: '10.66.0.2',
    netmask: '255.255.255.255',
    mtu: 1500,
    route: '',  // 可选
  }

  // ============ IP/TCP 工具 ============

  function readUInt16(b, off) { return (b[off] << 8) | b[off+1] }
  function readUInt32(b, off) { return ((b[off]<<24)|(b[off+1]<<16)|(b[off+2]<<8)|b[off+3]) >>> 0 }
  function putUInt16(b, off, v) { b[off]=(v>>8)&0xff; b[off+1]=v&0xff }
  function putUInt32(b, off, v) { b[off]=(v>>>24)&0xff; b[off+1]=(v>>>16)&0xff; b[off+2]=(v>>>8)&0xff; b[off+3]=v&0xff }
  function ipToString(v) { return ((v>>>24)&0xff)+'.'+((v>>>16)&0xff)+'.'+((v>>>8)&0xff)+'.'+(v&0xff) }
  function ipToInt(s) {
    var p = s.split('.')
    return ((+p[0]<<24)|(+p[1]<<16)|(+p[2]<<8)|(+p[3])) >>> 0
  }
  function checksum(bytes, start, len) {
    var sum = 0, end = start + len
    for (var i = start; i + 1 < end; i += 2) sum += (bytes[i] << 8) | bytes[i + 1]
    if ((end - start) % 2 === 1) sum += bytes[end - 1] << 8
    for (var j = 0; j < 4 && (sum >> 16); j++) sum = (sum & 0xffff) + (sum >> 16)
    return (~sum) & 0xffff
  }

  function parseIPv4(b) {
    if (b.length < 20) return null
    if ((b[0] >> 4) !== 4) return null
    var ihl = (b[0] & 0x0f) * 4
    if (b.length < ihl) return null
    return {
      src: readUInt32(b, 12),
      dst: readUInt32(b, 16),
      proto: b[9],
      id: readUInt16(b, 4),
      ihl: ihl,
      bytes: b,
    }
  }

  function parseTCP(p) {
    if (p.length < 20) return null
    return {
      srcPort: readUInt16(p, 0),
      dstPort: readUInt16(p, 2),
      seq: readUInt32(p, 4),
      ack: readUInt32(p, 8),
      dataOffset: (p[12] >> 4) * 4,
      flags: p[13],
    }
  }

  function buildPacket(params) {
    var payload = params.payload || []
    var tcpLen = 20 + payload.length
    var tcpHdr = new Array(20)
    putUInt16(tcpHdr, 0, params.srcPort)
    putUInt16(tcpHdr, 2, params.dstPort)
    putUInt32(tcpHdr, 4, params.seq)
    putUInt32(tcpHdr, 8, params.ack)
    tcpHdr[12] = 0x50
    tcpHdr[13] = params.flags
    putUInt16(tcpHdr, 14, params.window || 65535)
    tcpHdr[16] = 0; tcpHdr[17] = 0
    tcpHdr[18] = 0; tcpHdr[19] = 0
    var pseudo = []
    putUInt32(pseudo, 0, params.src)
    putUInt32(pseudo, 4, params.dst)
    pseudo[8] = 0
    pseudo[9] = 6
    putUInt16(pseudo, 10, tcpLen)
    var tcpCk = checksum(pseudo.concat(tcpHdr).concat(payload), 0, pseudo.length + tcpLen)
    putUInt16(tcpHdr, 16, tcpCk)
    var ipLen = 20 + tcpLen
    var ipHdr = new Array(20)
    ipHdr[0] = 0x45
    ipHdr[1] = 0
    putUInt16(ipHdr, 2, ipLen)
    putUInt16(ipHdr, 4, params.id || 0)
    putUInt16(ipHdr, 6, 0)
    ipHdr[8] = 64
    ipHdr[9] = 6
    ipHdr[10] = 0; ipHdr[11] = 0
    putUInt32(ipHdr, 12, params.src)
    putUInt32(ipHdr, 16, params.dst)
    var ipCk = checksum(ipHdr, 0, 20)
    putUInt16(ipHdr, 10, ipCk)
    return new Data(ipHdr.concat(tcpHdr).concat(payload))
  }

  // ============ exit 发现 (复用 proxy targets) ============

  var proxyConfigPattern = new http.Match('/shared/{username}/{ep}/config.json')

  function discoverExit(host) {
    return mesh.list('/shared').then(
      files => {
        app.log(`[discover] /shared files: ${JSON.stringify(Object.keys(files))}`)
        var peers = []
        Object.keys(files).forEach(path => {
          var params = proxyConfigPattern(path)
          if (params) peers.push(params.ep)
        })
        return mesh.discover(peers)
      }
    ).then(
      peers => {
        app.log(`[discover] peers: ${peers ? JSON.stringify(peers.map(p => ({ id: p.id, name: p.name }))) : 'none'}`)
        return Promise.any(peers.map(
          ep => {
            if (!ep?.online) return Promise.reject(null)
            return mesh.request(ep.id, new Message({ path: '/api/config' })).then(res => {
              var config = res?.head?.status === 200 ? JSON.decode(res.body) : {}
              app.log(`[discover] ${ep.name} targets: ${JSON.stringify(config?.targets)}`)
              if (isExit(config, host)) return ep
              throw null
            })
          }
        ))
      }
    ).catch(err => {
      app.log(`[discover] ERROR: ${err && err.message ? err.message : err}`)
      return null
    })
  }

  function isExit(config, host) {
    if (IP.isV4(host) || IP.isV6(host)) {
      return hasIP(config?.targets, host)
    } else {
      return hasDomain(config?.targets, host)
    }
  }

  function hasDomain(list, host) {
    return list instanceof Array && list.some(
      domain => {
        if (domain.startsWith('*')) return host.endsWith(domain.substring(1))
        return host === domain
      }
    )
  }

  function hasIP(list, host) {
    return list instanceof Array && list.some(
      mask => {
        try {
          var m = new IPMask(mask)
          return m.contains(host)
        } catch {
          return false
        }
      }
    )
  }

  // ============ 流状态机 ============

  function flowKey(cIP, cP, sIP, sP) {
    return cIP + ':' + cP + '-' + sIP + ':' + sP
  }

  function createFlow(clientIP, clientPort, serverIP, serverPort, synSeq) {
    var serverISN = (Math.floor(Math.random() * 0xffffffff)) >>> 0
    var flow = {
      key: flowKey(clientIP, clientPort, serverIP, serverPort),
      clientIP: clientIP, clientPort: clientPort,
      serverIP: serverIP, serverPort: serverPort,
      clientISN: synSeq,
      serverISN: serverISN,
      clientNextSeq: (synSeq + 1) >>> 0,
      serverNextSeq: (serverISN + 1) >>> 0,
      state: 'SYN_SENT',
      conn: null,
      tunnelReady: false,
      pendingData: [],
    }
    flows[flow.key] = flow
    app.log(`VPN flow created: ${ipToString(clientIP)}:${clientPort} -> ${ipToString(serverIP)}:${serverPort}`)
    setupTunnel(flow)
    return flow
  }

  function setupTunnel(flow) {
    var host = ipToString(flow.serverIP)
    var port = flow.serverPort
    var target = host + ':' + port

    // 委托本地 proxy 监听端口处理 exit 发现和 mesh 转发
    // (proxy 的 HTTP 监听端 httpProxy 收到 CONNECT 后做 exit 发现)
    var proxyAddr = '127.0.0.1:' + (tunConfig.proxyPort || 10800)
    app.log(`Tunnel via local proxy ${proxyAddr} to ${target}`)

    var connectPeer = pipeline($=>$
      .onStart(new Data)
      .connectHTTPTunnel(
        new Message({ method: 'CONNECT', path: target })
      ).to($=>$
        .muxHTTP({ version: 1 }).to($=>$
          .connect(proxyAddr)
        )
      )
      .replaceData(d => {
        onTransportData(flow, d)
        return null
      })
      .handleStreamEnd(() => {
        app.log(`[resp] ${flow.key} stream end`)
        sendFin(flow)
        closeFlow(flow)
        return new StreamEnd
      })
    )

    flow.conn = connectPeer.connect()

    flow.tunnelReady = true
    // flush pending data
    flow.pendingData.forEach(b => {
      if (flow.conn) flow.conn.push(new Data(b))
    })
    flow.pendingData = []
    app.log(`Tunnel established for ${flow.key}`)
  }

  function handleClientPacket(ip, tcp, payload) {
    var key = flowKey(ip.src, tcp.srcPort, ip.dst, tcp.dstPort)
    var flow = flows[key]

    if (!flow) {
      if (tcp.flags & 0x02) {  // SYN
        flow = createFlow(ip.src, tcp.srcPort, ip.dst, tcp.dstPort, tcp.seq)
        sendSynAck(flow)
      }
      return
    }

    switch (flow.state) {
      case 'SYN_SENT':
        if (tcp.flags & 0x10) {  // ACK
          flow.state = 'ESTABLISHED'
          app.log(`VPN established: ${flow.key}`)
        }
        break
      case 'ESTABLISHED':
        if (payload.length > 0) {
          // 去重: seq 小于已确认发送位置的数据视为重发, 忽略
          if (tcp.seq >= flow.clientNextSeq) {
            if (flow.tunnelReady && flow.conn) {
              flow.conn.push(new Data(payload))
            } else {
              flow.pendingData.push(payload)
            }
            flow.clientNextSeq = (tcp.seq + payload.length) >>> 0
          } else {
            app.log(`[dup] ${flow.key} ignore retransmit seq=${tcp.seq} < next=${flow.clientNextSeq}`)
          }
        }
        if (tcp.flags & 0x01) {  // FIN
          flow.state = 'FIN_WAIT'
          if (flow.conn) flow.conn.close()
        }
        if (tcp.flags & 0x04) {  // RST
          closeFlow(flow)
        }
        break
      case 'FIN_WAIT':
        break
    }
  }

  function sendSynAck(flow) {
    var pkt = buildPacket({
      src: flow.serverIP, dst: flow.clientIP,
      srcPort: flow.serverPort, dstPort: flow.clientPort,
      seq: flow.serverISN, ack: flow.clientNextSeq,
      flags: 0x12,
    })
    tun.write(pkt)
  }

  function sendFin(flow) {
    var pkt = buildPacket({
      src: flow.serverIP, dst: flow.clientIP,
      srcPort: flow.serverPort, dstPort: flow.clientPort,
      seq: flow.serverNextSeq, ack: flow.clientNextSeq,
      flags: 0x11,
    })
    tun.write(pkt)
  }

  function onTransportData(flow, data) {
    if (flow.state !== 'ESTABLISHED' && flow.state !== 'FIN_WAIT') return
    var bytes = data.toArray ? data.toArray() : data
    var text = ''
    try { text = bytes.map(b => String.fromCharCode(b)).join('') } catch (e) {}
    app.log(`[resp] ${flow.key} got ${bytes.length}B: ${text.substring(0, 60)}`)
    // 分片发送, 避免超过 TUN MTU
    var chunkSize = 1400
    for (var off = 0; off < bytes.length; off += chunkSize) {
      var chunk = bytes.slice(off, off + chunkSize)
      var pkt = buildPacket({
        src: flow.serverIP, dst: flow.clientIP,
        srcPort: flow.serverPort, dstPort: flow.clientPort,
        seq: flow.serverNextSeq, ack: flow.clientNextSeq,
        flags: 0x18,
        payload: chunk,
      })
      flow.serverNextSeq = (flow.serverNextSeq + chunk.length) >>> 0
      tun.write(pkt)
    }
    // 精确 FIN: HTTP 响应完整(Content-Length/chunked/Connection:close)时立即关闭,
    // 避免 keep-alive 连接挂起导致 curl 等待超时
    if (!flow.finSent && checkHttpComplete(flow, bytes)) {
      app.log(`[resp] ${flow.key} HTTP complete, sending FIN`)
      flow.finSent = true
      sendFin(flow)
      closeFlow(flow)
      return
    }
    // 兜底 FIN: 非 HTTP 或无法解析时, 1s 无新数据则关闭
    if (!flow.finSent) {
      new Timeout(1000).wait().then(function () {
        if (flows[flow.key] !== flow) return
        if (flow.finSent) return
        flow.finSent = true
        app.log(`[resp] ${flow.key} idle timeout, sending FIN`)
        sendFin(flow)
        closeFlow(flow)
      })
    }
  }

  // HTTP/1.1 响应完整性检测 (跨包缓冲, 纯 substring/indexOf 兼容 pjs)
  function checkHttpComplete(flow, bytes) {
    var buf = flow.httpBuffer
    if (!buf) { buf = []; flow.httpBuffer = buf }
    for (var bi = 0; bi < bytes.length; bi++) buf.push(bytes[bi])
    if (flow.httpDone) return true
    var text = ''
    for (var ti = 0; ti < buf.length; ti++) text += String.fromCharCode(buf[ti])

    if (!flow.httpHeaderDone) {
      var idx = text.indexOf('\r\n\r\n')
      if (idx < 0) return false
      var head = text.substring(0, idx)
      flow.httpHeaderDone = true
      flow.httpHeaderLen = idx + 4
      var cli = head.indexOf('Content-Length:')
      if (cli < 0) cli = head.indexOf('content-length:')
      if (cli >= 0) {
        var rest = head.substring(cli + 15)
        var nl = rest.indexOf('\r')
        if (nl < 0) nl = rest.indexOf('\n')
        if (nl < 0) nl = rest.length
        var val = rest.substring(0, nl)
        var num = ''
        for (var p = 0; p < val.length; p++) {
          var ch = val.substring(p, p + 1)
          if (ch === '0' || ch === '1' || ch === '2' || ch === '3' || ch === '4' ||
              ch === '5' || ch === '6' || ch === '7' || ch === '8' || ch === '9') {
            num += ch
          }
        }
        if (num.length > 0) flow.httpContentLength = +num
      }
      var te = head.indexOf('Transfer-Encoding: chunked')
      if (te < 0) te = head.indexOf('transfer-encoding: chunked')
      if (te >= 0) {
        flow.httpChunked = true
      } else {
        var cc = head.indexOf('Connection: close')
        if (cc < 0) cc = head.indexOf('connection: close')
        if (cc >= 0) flow.httpClose = true
      }
    }
    var bodyRead = buf.length - flow.httpHeaderLen
    if (flow.httpContentLength !== undefined && bodyRead >= flow.httpContentLength) {
      flow.httpDone = true
      return true
    }
    if (flow.httpChunked && text.indexOf('0\r\n\r\n') >= 0) {
      flow.httpDone = true
      return true
    }
    if (flow.httpClose) {
      flow.httpDone = true
      return true
    }
    return false
  }

  function closeFlow(flow) {
    if (flow.conn) flow.conn.close()
    flow.finSent = true
    delete flows[flow.key]
  }

  // ============ TUN 主循环 ============

  function handleTunPacket(d) {
    var b = d.toArray()
    var ip = parseIPv4(b)
    if (!ip) return null
    if (ip.proto !== 6) return null  // 仅 TCP

    var ipPayload = b.slice(ip.ihl)
    var tcp = parseTCP(ipPayload)
    if (!tcp) return null
    var tcpPayload = ipPayload.slice(tcp.dataOffset)

    handleClientPacket(ip, tcp, tcpPayload)
    return null
  }

  // ============ 启动 ============

  // 清理残留的 TUN 接口 (含 10.66.0.1 的)
  function cleanupStaleTuns() {
    try {
      // Linux: 用 ip link 删除所有 tun 接口
      var out = pipy.exec(['sh', '-c', 'for t in $(ls /sys/class/net/ | grep "^tun"); do ip addr show $t 2>/dev/null | grep -q "10.66.0.1" && ip link del $t 2>/dev/null; done'])
      app.log(`Cleaned stale TUN interfaces`)
    } catch (e) {
      app.log(`Cleanup stale TUN warning: ${e}`)
    }
  }

  function start() {
    if (tun) {
      app.log(`VPN already started, skip`)
      return
    }
    cleanupStaleTuns()
    tun = pipy.tun({
      ip: tunConfig.ip,
      peer: tunConfig.peer,
      netmask: tunConfig.netmask,
      mtu: tunConfig.mtu,
      stripHeader: true,
    }, $=>$
      .replaceData(d => handleTunPacket(d))
    )
    app.log(`VPN TUN started: ${tunConfig.ip}`)
  }

  app.onExit(() => {
    // 销毁 TUN 接口
    try {
      if (os.platform === 'linux') {
        pipy.exec(['sh', '-c', 'for t in $(ls /sys/class/net/ | grep "^tun"); do ip link del $t 2>/dev/null; done'])
      }
    } catch (e) {}
  })

  start()

  // 必须返回非空 pipeline, 使 apps 的 entryPipeline 生效 (isRunning 依赖它)
  return pipeline($=>$)
}
