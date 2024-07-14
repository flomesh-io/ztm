var CONFIG_PATHNAME = `${os.home()}/.ztm.conf`

var config = null
try { config = JSON.decode(os.read(CONFIG_PATHNAME)) } catch {}
if (!config || typeof config !== 'object') config = {}

function getConfig() {
  return {
    agent: config.agent || 'localhost:7777',
  }
}

function Client(target) {
  var ha = new http.Agent(target)

  function check(res) {
    if (res.head.status >= 400) {
      var message
      try {
        var json = JSON.decode(res.body)
        message = json.message || res.body.toString()
      } catch {
        message = res.body.toString()
      }
      throw message || res.head.statusText
    }
    return res.body
  }

  return {
    host: () => target,
    get: (path) => ha.request('GET', path).then(check),
    post: (path, body) => ha.request('POST', path, null, body).then(check),
    delete: (path) => ha.request('DELETE', path).then(check),
  }
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

  agent: () => Client(getConfig().agent),
}
