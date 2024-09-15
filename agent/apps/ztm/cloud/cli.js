export default function ({ api, utils }) {
  return pipeline($=>$
    .onStart(ctx => main(ctx))
  )

  function main({ argv, endpoint }) {
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
            title: 'Change endpoint settings',
            usage: 'config',
            options: `
              --local-dir       <pathname>      Set the local directory to mirror the cloud files
              --add-mirror      <pathname ...>  Start auto-downloading the given files or directories
              --remove-mirror   <pathname ...>  Stop auto-downloading the given files or directories
            `,
            action: (args) => api.getEndpointConfig(endpoint.id).then(config => {
              var changed = false

              if ('--local-dir' in args) {
                config.localDir = os.path.resolve(args['--local-dir'])
                changed = true
              }

              if ('--add-mirror' in args) {
                if (!(config.mirrorPaths instanceof Array)) config.mirrorPaths = []
                args['--add-mirror'].forEach(path => {
                  path = os.path.normalize(path)
                  if (!config.mirrorPaths.includes(path)) {
                    config.mirrorPaths.push(path)
                  }
                })
                changed = true
              }

              if ('--remove-mirror' in args && config.mirrorPaths instanceof Array) {
                args['--remove-mirror'].forEach(path => {
                  path = os.path.normalize(path)
                  config.mirrorPaths = config.mirrorPaths.filter(p => p !== path)
                })
                changed = true
              }

              if (changed) {
                return api.setEndpointConfig(endpoint.id, config).then(
                  () => api.getEndpointConfig(endpoint.id).then(printConfig)
                )
              } else {
                return Promise.resolve(printConfig(config))
              }

              function printConfig(config) {
                output(`Endpoint: ${endpoint.name} (${endpoint.id})\n`)
                output(`Local Directory: ${config.localDir}\n`)
                if (config.mirrorPaths instanceof Array && config.mirrorPaths.length > 0) {
                  output('Auto Mirror Paths:\n')
                  config.mirrorPaths.forEach(path => output(`  ${path}\n`))
                } else {
                  output('Auto Mirror Paths: (none)\n')
                }
              }
            })
          },
          {
            title: 'List files and directories in the cloud',
            usage: 'ls [<pathname>]',
            options: `
              -h, --hash   Show file hashes
            `,
            action: (args) => {
              var pathname = os.path.normalize(args['[<pathname>]'] || '/')
              return api.getFileStat(pathname).then(stat => {
                if (!stat) {
                  error(`cloud: file or directory not found: ${pathname}`)
                  return null
                }
                if (stat.list) {
                  return Promise.all(stat.list.map(
                    name => api.getFileStat(os.path.join(pathname, name)).then(
                      stat => [name, stat]
                    )
                  ))
                } else {
                  return [[os.path.basename(pathname), stat]]
                }
              }).then(list => {
                if (!list) return
                var format = {
                  'NAME': ([name]) => name,
                  'STATE': ([_, stat]) => stat.downloading ? 'downloading' : (stat.state || '-'),
                  'SIZE': ([_, stat]) => stat.list ? '-' : stat.size,
                  'DATE': ([_, stat]) => stat.time ? new Date(stat.time).toString() : '-',
                  'SOURCES': ([_, stat]) => stat.list ? '-' : (stat.sources?.length || '0'),
                }
                if (args['--hash']) format['HASH'] = ([_, stat]) => stat.hash || '-'
                format['SHARED'] = ([_, stat]) => {
                  if (stat.access?.all === 'readonly') return 'All Users'
                  if (stat.access?.users) {
                    return Object.entries(
                      stat.access.users
                    ).filter(([k, v]) => v === 'readonly').map(([k]) => k).join(', ')
                  }
                  return '-'
                }
                output(printTable(list.filter(i=>i), format))
              })
            }
          },
          {
            title: 'Set shared access of a file',
            usage: 'share <pathname>',
            options: `
              --set-all       <readonly|block|default>  Set access for all users
              --set-readonly  <username ...>            Add readonly access for users
              --set-block     <username ...>            Block access for users
              --set-default   <username ...>            Reset access to default for users
            `,
            action: (args) => {
              var pathname = os.path.normalize(args['<pathname>'] || '/')
              var setAll = args['--set-all']
              var setReadonly = args['--set-readonly']
              var setBlock = args['--set-block']
              var setDefault = args['--set-default']
              if (setAll && setAll !== 'readonly' && setAll !== 'block' && setAll !== 'default') {
                error('cloud: invalid --set-all')
                return Promise.resolve()
              }
              if (setAll || setReadonly || setBlock || setDefault) {
                return api.getACL(pathname).then(acl => {
                  acl = acl || {}
                  var users = acl.users || {}
                  if (setAll) {
                    acl.all = (setAll === 'default' ? null : setAll)
                  }
                  if (setDefault) {
                    setDefault.forEach(username => delete users[username])
                  }
                  if (setReadonly) {
                    setReadonly.forEach(username => users[username] = 'readonly')
                  }
                  if (setBlock) {
                    setBlock.forEach(username => users[username] = 'block')
                  }
                  if (Object.keys(users).length > 0) {
                    acl.users = users
                  } else {
                    acl.users = null
                  }
                  return api.setACL(pathname, acl).then(printACL)
                })
              } else {
                return api.getFileStat(pathname).then(stat => {
                  if (!stat) {
                    error(`cloud: file or directory not found: ${pathname}`)
                    return
                  }
                  printACL(stat.access)
                })
              }
              function printACL(acl) {
                output(`Pathname: ${pathname}\n`)
                output(`All Users: ${acl?.all || '(default)'}\n`)
                var users = Object.entries(acl?.users || {})
                var readonly = users.filter(([_, v]) => v === 'readonly').map(([k]) => k)
                var block = users.filter(([_, v]) => v === 'block').map(([k]) => k)
                if (readonly.length > 0) output(`Read-Only Users: ${readonly.join(', ')}\n`)
                if (block.length > 0) output(`Blocked Users: ${block.join(', ')}\n`)
              }
            }
          },
          {
            title: 'Upload a file to the cloud',
            usage: 'upload <pathname>',
            action: (args) => {
              var pathname = os.path.normalize(args['<pathname>'])
              return api.getFileStat(pathname).then(stat => {
                if (!stat) {
                  error(`cloud: file or directory not found: ${pathname}`)
                  return
                }
                if (stat.list) {
                  error(`cloud: directory uploading not supported: ${pathname}`)
                  return
                }
                return api.uploadFile(pathname).then(ret => {
                  if (ret) {
                    output(`File uploaded: ${pathname}\n`)
                  } else {
                    error(`cloud: cannot upload file: ${pathname}`)
                  }
                })
              })
            }
          },
          {
            title: 'Download a file from the cloud',
            usage: 'download [<pathname>]',
            options: `
              -l, --list                 List all files that are being downloaded currently
                  --cancel               Cancel the on-going download
              -o, --output  <pathname>   Save the downloaded file to a specified location
            `,
            action: (args) => {
              var pathname = args['[<pathname>]']
              var isCancel = args['--cancel']
              var isListing = args['--list']
              var outputFilename = args['--output']
              if (!pathname && !isListing) {
                error(`cloud: missing pathname`)
                return Promise.resolve()
              }
              if (pathname && isListing) {
                error(`cloud: redundant pathname while using option --list`)
                return Promise.resolve()
              }
              if (isCancel) {
                if (outputFilename) {
                  error(`cloud: cannot use --cancel and --output together`)
                  return Promise.resolve()
                }
                api.cancelDownload(pathname)
                return Promise.resolve()
              } else if (isListing) {
                return api.listDownloads().then(
                  list => output(printTable(list, {
                    'PATH': f => f.path,
                    'SIZE': f => f.size,
                    'PROGRESS': f => Math.floor(f.downloading * 100) + '%',
                    'ERROR': f => f.error || '-',
                  }))
                )
              } else if (outputFilename) {
                pathname = os.path.normalize(pathname)
                if (pathname.startsWith('/')) pathname = pathname.substring(1)
                return pipeline($=>$
                  .onStart(new Message)
                  .pipe(api.streamFile, () => ({ '*': pathname }))
                  .pipe(
                    function (evt) {
                      if (evt instanceof MessageStart) {
                        if (evt.head?.status === 200) {
                          return 'save'
                        } else {
                          error(`cloud: file not found: /${pathname}`)
                          return 'fail'
                        }
                      }
                    }, {
                      'save': ($=>$
                        .replaceMessageStart()
                        .replaceMessageEnd(new StreamEnd)
                        .tee(outputFilename)
                      ),
                      'fail': ($=>$.replaceStreamStart(new StreamEnd))
                    }
                  )
                  .replaceMessageEnd()
                ).spawn()
              } else {
                pathname = os.path.normalize(pathname)
                return api.downloadFile(pathname)
              }
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
