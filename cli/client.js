var CONFIG_PATHNAME = `${os.home()}/.ztm.conf`

var config = null
try { config = JSON.decode(os.read(CONFIG_PATHNAME)) } catch {}
if (!config || typeof config !== 'object') config = {}

function getConfig() {
  return {
    agent: config.agent || 'localhost:7777',
  }
}

var agent = null

function getHost() {
  var host = getConfig().agent
  if (host.startsWith(':')) return 'localhost' + host
  if (!Number.isNaN(Number.parseInt(host))) return 'localhost:' + host
  return host
}

function getAgent() {
  if (!agent) {
    agent = new http.Agent(getHost())
  }
  return agent
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
  config: (c) => {
    if (c) {
      if (c.agent) config.agent = c.agent
      os.write(CONFIG_PATHNAME, JSON.encode(config, null, 2))
    } else {
      return getConfig()
    }
  },

  host: getHost,
  get: (path) => getAgent().request('GET', path).then(check),
  post: (path, body) => getAgent().request('POST', path, null, body).then(check),
  delete: (path) => getAgent().request('DELETE', path).then(check),
}
