export default function ({ app, mesh }) {
  var CONFIG_PATHNAME = `/local/services.json`
  var localServices = {}
  var localRoutes = []

  app.onExit(() => {
    localServices = {}
    localRoutes = []
  })

  function checkResponse(res, f) {
    var status = res?.head?.status
    if (200 <= status && status <= 299) {
      return typeof f === 'function' ? f(res.body) : f
    }
    throw res?.head?.statusText || 'No response from peer'
  }

  function allServices(ep) {
    if (ep) {
      // Get the service list on a specific endpoint
      if (ep === app.endpoint.id) {
        return Promise.resolve(
          Object.entries(localServices).flatMap(
            ([kind, services]) => Object.entries(services).map(
              ([name, service]) => ({
                name,
                kind,
                protocol: service.protocol,
                metainfo: service.metainfo,
                target: service.target,
              })
            )
          )
        )
      } else {
        return mesh.request(ep, new Message(
          {
            method: 'GET',
            path: `/api/services`,
          }
        )).then(res => checkResponse(res, body => JSON.decode(body)))
      }
    } else {
      // Get all services in the mesh
      var pathPattern = new http.Match(getServiceFilePathname('{username}', '{ep}', '{kind}', '{name}'))
      return mesh.list(getServiceFilePathname()).then(
        files => Promise.all(Object.keys(files).map(
          filename => {
            var params = pathPattern(filename)
            if (params) {
              return mesh.read(filename).then(
                data => {
                  if (data) {
                    try {
                      return {
                        ...JSON.decode(data),
                        ...params,
                      }
                    } catch {}
                  }
                  return null
                }
              )
            }
            return null
          }
        )).then(
          infos => {
            var endpoints = {}
            infos = infos.filter(i=>i)
            infos.forEach(info => {
              var id = info.ep
              endpoints[id] ??= { id }
            })
            return mesh.discover(Object.keys(endpoints)).then(
              list => {
                list.filter(e=>e).forEach(ep => Object.assign(endpoints[ep.id], ep))
                return {
                  endpoints,
                  services: infos.map(
                    info => {
                      var ep = endpoints[info.ep]
                      if (ep?.username !== info.username) {
                        return null
                      }
                      return {
                        name: info.name,
                        kind: info.kind,
                        protocol: info.protocol,
                        metainfo: info.metainfo,
                        endpoint: {
                          id: ep.id,
                        },
                        localRoutes: findLocalRoutes(ep.id, info.kind, info.name),
                      }
                    }
                  ).filter(s=>s)
                }
              }
            )
          }
        )
      )
    }
  }

  function getService(ep, kind, name) {
    if (ep === app.endpoint.id) {
      var service = localServices[kind]?.[name]
      if (service) {
        return Promise.resolve({
          name,
          kind,
          protocol: service.protocol,
          metainfo: service.metainfo,
          target: service.target,
          localRoutes: findLocalRoutes(ep.id, kind, name),
        })
      }
      return Promise.resolve(null)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function setService(ep, kind, name, info) {
    if (ep === app.endpoint.id) {
      checkName(name)
      checkKind(kind)
      checkService(info)
      var service = {
        protocol: info.protocol,
        metainfo: info.metainfo,
        target: info.target,
      }
      localServices[kind] ??= {}
      localServices[kind][name] = service
      saveLocalConfig()
      publishService(kind, name, service)
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        },
        JSON.encode(info)
      )).then(checkResponse)
    }
  }

  function deleteService(ep, kind, name) {
    if (ep === app.endpoint.id) {
      var k = localServices[kind]
      if (k) delete k[name]
      saveLocalConfig()
      unpublishService(kind, name)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'DELETE',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        }
      )).then(checkResponse)
    }
  }

  function allRoutes(ep) {
    if (ep === app.endpoint.id) {
      var endpoints = {}
      localRoutes.forEach(r => {
        var id = r.service.endpoint.id
        if (id) endpoints[id] = { id }
      })
      return mesh.discover(Object.keys(endpoints)).then(
        list => {
          list.forEach(ep => endpoints[ep.id] = ep)
          return {
            endpoints,
            routes: localRoutes.map(
              r => ({
                path: r.path,
                service: {
                  name: r.service.name,
                  kind: r.service.kind,
                  endpoint: r.service.endpoint,
                }
              })
            )
          }
        }
      )
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/routes`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function getRoute(ep, path) {
    if (ep === app.endpoint.id) {
      if (!path.endsWith('/')) path += '/'
      var route = localRoutes.find(r => r.path === path)
      if (route) {
        return mesh.discover(route.service.endpoint.id).then(
          list => ({
            path: route.path,
            service: {
              name: route.service.name,
              kind: route.service.kind,
              endpoint: list.length > 0 ? list[0] : route.service.endpoint,
            }
          })
        )
      } else {
        return Promise.resolve(null)
      }
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: os.path.join(`/api/routes`, path),
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function setRoute(ep, path, info) {
    if (ep === app.endpoint.id) {
      checkPath(path)
      checkRoute(info)
      if (!path.endsWith('/')) path += '/'
      var service = {
        name: info.service.name,
        kind: info.service.kind,
        endpoint: { id: info.service.endpoint.id },
      }
      var i = localRoutes.findIndex(r => r.path >= path)
      if (localRoutes[i]?.path === path) {
        localRoutes[i].service = service
      } else if (i < 0) {
        localRoutes.push({ path, service })
      } else {
        localRoutes.splice(i, 0, { path, service })
      }
      saveLocalConfig()
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: os.path.join(`/api/routes`, path),
        },
        JSON.encode(info)
      )).then(checkResponse)
    }
  }

  function deleteRoute(ep, path) {
    if (ep === app.endpoint.id) {
      if (!path.endsWith('/')) path += '/'
      var i = localRoutes.findIndex(r => r.path === path)
      if (i >= 0) {
        localRoutes.splice(i, 1)
      }
      saveLocalConfig()
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'DELETE',
          path: os.path.join(`/api/routes`, path),
        }
      )).then(checkResponse)
    }
  }

  var $route

  var forwardService = pipeline($=>$
    .pipe(evt => {
      if (evt instanceof MessageStart) {
        var url = new URL(evt.head.path)
        var path = url.pathname
        if (path.startsWith('/svc/')) path = path.substring(4)
        var path2 = path.endsWith('/') ? path : path + '/'
        if ($route = localRoutes.findLast(r => path2.startsWith(r.path))) {
          var service = $route.service
          var basepath = `/api/forward/${service.kind}/${URL.encodeComponent(service.name)}`
          evt.head.path = os.path.join(basepath, path.substring($route.path.length)) + url.search
          return ($route.service.endpoint.id === app.endpoint.id ? 'local' : 'remote')
        } else {
          return '404'
        }
      }
    }, {
      'remote': ($=>$
        .muxHTTP(() => $route, { version: 2 }).to($=>$
          .pipe(() => mesh.connect($route.service.endpoint.id))
        )
      ),
      'local': $=>$.pipe(() => connectService),
      '404': $=>$.replaceMessage(new Message({ status: 404 })),
    })
  )

  var matchApiForwardKindName = new http.Match('/api/forward/{kind}/{name}')
  var matchApiForwardKindNameStar = new http.Match('/api/forward/{kind}/{name}/*')

  var $service
  var $serviceURL
  var $serviceTime

  var connectService = pipeline($=>$
    .pipe(evt => {
      if (evt instanceof MessageStart) {
        var url = new URL(evt.head.path)
        var params = matchApiForwardKindNameStar(url.pathname) || matchApiForwardKindName(url.pathname)
        if (params) {
          var kind = params.kind
          var name = URL.decodeComponent(params.name)
          evt.head.path = '/' + (params['*'] || '') + url.search
          $service = localServices[kind]?.[name]
        }
        if (!$service) return '404'
        if (isFilePath($service.target.address)) return 'stdio'
        return 'http'
      }
    }, {
      'http': ($=>$
        .handleMessageStart(msg => {
          $serviceURL = new URL($service.target.address)
          msg.head.path = os.path.join($serviceURL.pathname, msg.head.path)
          msg.head.headers.host = $serviceURL.hostname
          var headers = $service.target.headers
          if (headers && typeof headers === 'object') Object.assign(msg.head.headers, headers)
        })
        .pipe(() => $service.target.body ? 'alter' : 'bypass', {
          'alter': $=>$.replaceMessageBody(
            body => {
              try {
                return JSON.encode(
                  mergeObjects(
                    JSON.decode(body),
                    $service.target.body,
                  )
                )
              } catch {
                return body
              }
            }
          ),
          'bypass': $=>$,
        })
        .muxHTTP(() => $service).to($=>$
          .pipe(() => $serviceURL.protocol, {
            'http:': ($=>$
              .connect(() => `${$serviceURL.hostname}:${$serviceURL.port}`)
            ),
            'https:': ($=>$
              .connectTLS({ sni: () => $serviceURL.hostname }).to($=>$
                .connect(() => `${$serviceURL.hostname}:${$serviceURL.port}`)
              )
            ),
          })
        )
      ),
      'stdio': ($=>$
        .mux(() => $service).to($=>$
          .onStart(() => { $serviceTime = Date.now() })
          .handleData(() => $serviceTime = Date.now() )
          // TODO: Make this work without quitting pipy silently
          // .insert(() => killSpareService())
          .replaceMessage(
            msg => {
              try {
                var body = JSON.decode(msg.body)
              } catch {
                var body = null
              }
              return JSON.encode(body).push('\n')
            }
          )
          .exec(() => [$service.target.address, ...($service.target.argv || [])], {
            env: () => $service.target.env,
            onStart: (pid) => app.log(`Child process started (pid = ${pid}): ${$service.target.address}`),
            onExit: (code) => app.log(`Child process exited with result ${code}: ${$service.target.address}`),
          })
          .split('\n')
        )
      ),
      '404': $=>$.replaceMessage(new Message({ status: 404 })),
    })
  )

  function killSpareService() {
    if (Date.now() - $serviceTime > 10000) {
      return new StreamEnd
    } else {
      return new Timeout(1).wait().then(killSpareService)
    }
  }

  function getServiceFilePathname(username, ep, kind, name) {
    if (!username) {
      return `/shared/`
    } else if (!ep) {
      return `/shared/${username}/`
    } else if (!kind) {
      return `/shared/${username}/${ep}/`
    } else if (!name) {
      return `/shared/${username}/${ep}/${kind}/`
    } else {
      return `/shared/${username}/${ep}/${kind}/${name}/service.json`
    }
  }

  function findLocalRoutes(ep, kind, name) {
    return localRoutes.filter(
      r => (
        r.path &&
        r.service.name === name &&
        r.service.kind === kind &&
        r.service.endpoint.id === ep
      )
    ).map(
      r => ({
        path: r.path,
      })
    )
  }

  function saveLocalConfig() {
    mesh.write(CONFIG_PATHNAME, JSON.encode({
      services: localServices,
      routes: localRoutes.map(
        r => ({
          path: r.path,
          service: r.service,
        })
      ),
    }))
  }

  function publishService(kind, name, info) {
    mesh.write(
      getServiceFilePathname(app.username, app.endpoint.id, kind, name),
      JSON.encode({
        protocol: info.protocol,
        metainfo: info.metainfo,
      })
    )
  }

  function unpublishService(kind, name) {
    mesh.erase(
      getServiceFilePathname(app.username, app.endpoint.id, kind, name)
    )
  }

  mesh.read(CONFIG_PATHNAME).then(
    data => {
      try {
        var info = JSON.decode(data)
      } catch {}
      var services = info?.services
      var routes = info?.routes
      if (services && typeof services === 'object') {
        localServices = services
        Object.entries(localServices).forEach(
          ([kind, services]) => Object.entries(services).forEach(
            ([name, service]) => publishService(kind, name, service)
          )
        )
      }
      if (routes instanceof Array) {
        localRoutes = routes.filter(
          r => (
            typeof r === 'object' && r &&
            typeof r.path === 'string' &&
            typeof r.service === 'object' &&
            typeof r.service.name === 'string' &&
            typeof r.service.kind === 'string' &&
            typeof r.service.endpoint?.id === 'string'
          )
        )
        localRoutes.forEach(r => {
          if (!r.path.endsWith('/')) {
            r.path += '/'
          }
        })
      }
    }
  )

  return {
    allServices,
    getService,
    setService,
    deleteService,
    allRoutes,
    getRoute,
    setRoute,
    deleteRoute,
    forwardService,
    connectService,
  }
}

function mergeObjects(a, b) {
  Object.entries(b).forEach(
    ([k, v]) => {
      if (v && typeof v === 'object') {
        var val = a[k]
        if (val && typeof val === 'object') {
          return mergeObjects(val, v)
        }
      }
      a[k] = v
    }
  )
  return a
}

function isFilePath(str) {
  if (str.startsWith('/')) return true
  var drive = str.charCodeAt(0)
  if (
    (67 <= drive && drive <= 90) || // C..Z
    (99 <= drive && drive <= 122)   // c..z
  ) {
    str = str.substring(1)
    if (str.startsWith(':\\') || str.startsWith(':/')) return true
  }
  return false
}

function checkName(name) {
  if (typeof name !== 'string') throw `invalid name`
  if (name === '') throw `invalid empty name`
}

function checkKind(kind) {
  switch (kind) {
    case 'llm':
    case 'tool':
      return
    default: throw `invalid kind '${kind}'`
  }
}

function checkProtocol(protocol) {
  switch (protocol) {
    case 'openai':
    case 'mcp':
      return
    default: throw `invalid protocol '${protocol}'`
  }
}

function checkMetainfo(info) {
  if (!info) return
  if (typeof info !== 'object') throw `invalid metainfo`
  checkStringObject(info, 'metainfo')
}

function checkTarget(info) {
  if (typeof info !== 'object') throw `invalid target`
  if (!info.address) throw `missing target.address`
  Object.entries(info).forEach(
    ([k, v]) => {
      switch (k) {
        case 'address': return checkAddress(v)
        case 'headers': return checkStringObject(v, 'target.headers')
        case 'body': return checkObject(v, 'target.body')
        case 'argv': return checkStringArray(v, 'target.argv')
        case 'env': return checkStringObject(v, 'target.env')
        default: throw `redundant field 'target.${k}'`
      }
    }
  )
}

function checkObject(obj, prefix) {
  if (obj && typeof obj !== 'object') throw `object required in '${prefix}'`
}

function checkArray(obj, prefix) {
  if (obj && !(obj instanceof Array)) throw `array required in '${prefix}'`
}

function checkStringObject(obj, prefix) {
  checkObject(obj, prefix)
  if (obj) {
    Object.entries(obj).forEach(
      ([k, v]) => {
        if (typeof v !== 'string') {
          throw `invalid ${prefix}.${k}`
        }
      }
    )
  }
}

function checkStringArray(obj, prefix) {
  checkArray(obj, prefix)
  if (obj) {
    obj.forEach(
      (e, i) => {
        if (typeof e !== 'string') {
          throw `invalid ${prefix}[${i}]`
        }
      }
    )
  }
}

function checkAddress(addr) {
  if (typeof addr !== 'string') throw `invalid address`
  if (isFilePath(addr)) return
  if (addr.startsWith('http://') || addr.startsWith('https://')) {
    var url = new URL(addr)
    if (url.hostname === '') throw `malformed URL '${addr}'`
    return
  }
  throw `invalid address '${addr}'`
}

function checkPath(path) {
  if (
    typeof path !== 'string' ||
    path.length <= 1 ||
    !path.startsWith('/')
  ) throw `invalid path '${path}'`
}

function checkUUID(uuid) {
  if (
    typeof uuid !== 'string' ||
    uuid.length !== 36 ||
    uuid.charAt(8) != '-' ||
    uuid.charAt(13) != '-' ||
    uuid.charAt(18) != '-' ||
    uuid.charAt(23) != '-'
  ) throw `malformed UUID '${uuid}'`
}

function checkService(info) {
  if (!info.protocol) throw `missing protocol`
  if (!info.target?.address) throw `missing target.address`
  checkProtocol(info.protocol)
  checkMetainfo(info.metainfo)
  checkTarget(info.target)
}

function checkRoute(info) {
  checkName(info.service?.name)
  checkKind(info.service?.kind)
  checkUUID(info.service?.endpoint?.id)
}
