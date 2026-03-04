var CONFIG_PATHNAME = `${os.home()}/.ztm.conf`

var config = null
try { config = JSON.decode(os.read(CONFIG_PATHNAME)) } catch {}
if (!config || typeof config !== 'object') config = {}

function getConfig() {
  return {
    trial: config.trial || 'https://clawparty.flomesh.io:7779',
  }
}

var trial = null

function getHost() {
  var host = os.env.ZTM_TRIAL || getConfig().trial
  if (host.startsWith(':')) return 'https://clawparty.flomesh.io' + host
  if (!Number.isNaN(Number.parseInt(host))) return 'https://clawparty.flomesh.io:' + host
  if (!host.includes('://')) return 'https://' + host
  return host
}

function getTlsOptions(host) {
  if (host.startsWith('https://')) {
    return {
      tls: {
        verify: (ok, cert) => true,
      }
    }
  }
  return null
}

function getTrial() {
  if (!trial) {
    var host = getHost()
    var options = getTlsOptions(host)
    
    var url = new URL(host)
    var target = url.hostname + (url.port ? ':' + url.port : '')
    
    trial = new http.Agent(target, options)
  }
  return trial
}

function check(res) {
  if (res.head.status >= 400) {
    var message
    try {
      var json = JSON.decode(res.body)
      message = json.message || res.body.toString()
    } catch {
      message = res.body.toString()
    }
    throw {
      status: res.head.status,
      message: message || res.head.statusText,
    }
  }
  return res.body
}

export default {
  host: getHost,
  post: (path, body) => getTrial().request('POST', path, { 'Content-Type': 'application/json' }, body).then(check),
}