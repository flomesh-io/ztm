var $params
var $cliCtx

export default function service(routes) {
  routes = Object.entries(routes).map(
    ([k, v]) => ({
      match: k === '*' ? () => ({}) : new http.Match(k),
      pipelines: v,
    })
  )
  return pipeline($=>$
    .demuxHTTP().to($=>$
      .pipe(
        function (evt) {
          if (evt instanceof MessageStart) {
            var path = evt.head.path
            var route = routes.find(r => $params = r.match(path))?.pipelines
            if (!route) return response404
            return route[evt.head.method] || route['*'] || response405
          }
        },
        () => $params
      )
    )
  )
}

export function responder(f) {
  return pipeline($=>$
    .replaceMessage(req => {
      try {
        return f($params, req).catch(responseError)
      } catch (e) {
        return responseError(e)
      }
    })
  )
}

export function cliResponder(p) {
  return pipeline($=>$
    .acceptHTTPTunnel(req => {
      var url = new URL(req.head.path)
      $cliCtx = {
        argv: JSON.parse(URL.decodeComponent(url.searchParams.get('argv'))),
        cwd: URL.decodeComponent(url.searchParams.get('cwd')),
        endpoint: {
          id: url.searchParams.get('ep_id'),
          name: URL.decodeComponent(url.searchParams.get('ep_name')),
        }
      }
      return new Message({ status: 200 })
    }).to($=>$
      .onStart(new Data)
      .pipe(p, () => [$cliCtx])
    )
  )
}

export function response(status, body) {
  if (!body) return new Message({ status })
  if (typeof body === 'string') return responseCT(status, 'text/plain', body)
  if (body instanceof Data) return responseCT(status, 'application/octet-stream', body)
  return responseCT(status, 'application/json', JSON.encode(body))
}

function responseCT(status, ct, body) {
  return new Message(
    {
      status,
      headers: { 'content-type': ct }
    },
    body
  )
}

function responseError(e) {
  if (typeof e === 'object') {
    return response(e.status || 500, e)
  } else {
    return response(500, { status: 500, message: e })
  }
}

var response404 = pipeline($=>$.replaceMessage(new Message({ status: 404 })))
var response405 = pipeline($=>$.replaceMessage(new Message({ status: 405 })))
