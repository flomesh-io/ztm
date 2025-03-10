export default function ({ app, mesh, api, utils }) {
  return pipeline($=>$
    .onStart(ctx => main(ctx))
  )

  function main({ argv, cwd, endpoint }) {
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
      return Promise.resolve([buffer, new StreamEnd])
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [
          {
            title: 'List all files in a directory',
            usage: 'ls <pathname>',
            action: (args) => {
              var pathname = os.path.normalize(args['<pathname>'])
              return api.statFile(endpoint.id, pathname, app.username).then(
                stat => {
                  if (!stat) throw `No such file or directory on ${endpoint.name}: ${pathname}`
                  if (!stat.dir) return [{ name: os.path.basename(pathname), size: stat.size, time: stat.mtime }]
                  return Promise.all(
                    stat.dir.sort().map(
                      name => api.statFile(endpoint.id, os.path.join(pathname, name), app.username).then(
                        stat => stat && { name, size: stat.size, time: stat.mtime }
                      )
                    )
                  ).then(
                    stats => stats.filter(s=>s)
                  )
                }
              ).then(list => {
                output(printTable(list, {
                  'NAME': s => s.name,
                  'SIZE': s => s.size,
                  'DATE': s => new Date(s.time * 1000).toString(),
                }))
              })
            }
          },
          {
            title: 'Copy files or directories',
            usage: 'cp <[src-ep:]pathname> <[dst-ep:]pathname>',
            action: (args) => {
              var pair = [
                args['<[src-ep:]pathname>'],
                args['<[dst-ep:]pathname>'],
              ].map(pathname => {
                var i = pathname.indexOf(':')
                var host = pathname.substring(0,i)
                pathname = pathname.substring(i+1)
                return { host, pathname }
              })
              return Promise.all(pair.map(
                ({ host, pathname }) => {
                  if (host) {
                    return mesh.discover(host, host).then(endpoints => {
                      var list = endpoints.filter(ep => ep.name === host)
                      if (list.length === 0) list = endpoints.filter(ep => ep.id === host)
                      if (list.length > 1) throw 'Ambiguous endpoint name: ' + host
                      if (list.length < 1) throw 'Endpoint not found: ' + host
                      return {
                        host: list[0].id,
                        pathname,
                      }
                    })
                  } else {
                    return Promise.resolve({
                      host: app.endpoint.id,
                      pathname: os.path.resolve(cwd, pathname),
                    })
                  }
                }
              )).then(
                ([src, dst]) => (
                  api.startTransfer(
                    dst.host, dst.pathname,
                    src.host, src.pathname,
                    app.username
                  ).then(ret => {
                    if (!ret) throw 'Cannot copy files'
                    function wait() {
                      return new Timeout(1).wait().then(
                        () => api.getTransfer(dst.host, dst.pathname, app.username)
                      ).then(transfer => {
                        var state = transfer?.state
                        if (state === 'working') return wait()
                        api.abortTransfer(dst.host, dst.pathname, app.username)
                        if (state === 'error') throw 'Failed to copy files'
                        transfer?.copied?.forEach?.(filename => output(filename + '\n'))
                        switch (state) {
                          case 'done': output('Done\n'); break
                          case 'abort': output('Aborted\n'); break
                        }
                      })
                    }
                    return wait()
                  })
                )
              )
            }
          },
        ]

      }).then(flush).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return flush()
    }
  }
}

function printTable(data, columns) {
  var output = new Data
  var cols = Object.entries(columns)
  var colHeaders = cols.map(i => i[0])
  var colFormats = cols.map(i => i[1])
  var colSizes = colHeaders.map(name => name.length)
  var rows = data.map(row => colFormats.map(
    (format, i) => {
      var v = (format(row) || '').toString()
      colSizes[i] = Math.max(colSizes[i], v.length)
      return v
    }
  ))
  colHeaders.forEach((name, i) => {
    output.push(name.padEnd(colSizes[i]))
    output.push('  ')
  })
  output.push('\n')
  rows.forEach(row => {
    row.forEach((v, i) => {
      output.push(v.padEnd(colSizes[i]))
      output.push('  ')
    })
    output.push('\n')
  })
  return output
}
