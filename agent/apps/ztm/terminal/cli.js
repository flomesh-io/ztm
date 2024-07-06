import command from './command.js'
import options from './options.js'

var baseOptions = {
  defaults: {
    '--mesh': '',
    '--ep': '',
  }
}

var configOptions = {
  defaults: {
    '--shell': '',
  }
}

export default function ({ app, api }) {
  var $handler

  return pipeline($=>$
    .onStart(argv => main(argv).then(h => void ($handler = h)))
    .pipe(() => $handler)
  )

  function main(argv) {
    var buffer = new Data

    function output(str) {
      buffer.push(str)
    }

    function error(err) {
      output('ztm: ')
      output(err.message || err.toString())
      output('\n')
    }

    function flush() {
      return pipeline($=>$.replaceStreamStart([buffer, new StreamEnd]))
    }

    var endpoints = null

    function allEndpoints() {
      if (endpoints) return Promise.resolve(endpoints)
      return api.allEndpoints().then(list => (endpoints = list))
    }

    function selectEndpoint(name) {
      if (name) {
        return allEndpoints().then(endpoints => {
          var ep = endpoints.find(ep => ep.id === name)
          if (ep) return ep
          var list = endpoints.filter(ep => ep.name === name)
          if (list.length === 1) return list[0]
          if (list.length === 0) throw `endpoint '${name}' not found`
          throw `ambiguous endpoint name '${name}'`
        })
      } else {
        return Promise.resolve(app.endpoint)
      }
    }

    try {
      return command(['ztm terminal', ...argv], {
        commands: {

          'config': (argv) => {
            var rest = []
            var opts = options(argv, baseOptions, rest)
            return selectEndpoint(opts['--ep']).then(ep => {
              if (rest.length === 0) {
                return api.getEndpointConfig(ep.id).then(config => {
                  output(`Shell: ${config.shell || '(default)'}\n`)
                }).then(flush)
              } else {
                Object.assign(opts, options([null, ...rest], configOptions))
                var config = {
                  shell: opts['--shell'],
                }
                return api.setEndpointConfig(ep.id, config).then(flush)
              }
            })
          },

          'open': (argv) => {
            var name = argv[1]
            if (!name) throw 'missing endpoint name'
            return selectEndpoint(name).then(ep => api.openTerminal(ep.id))
          },

        }
      }).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return Promise.resolve(flush())
    }
  }
}
