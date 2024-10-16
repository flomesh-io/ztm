export default function ({ app, mesh }) {
  function allEndpoints() {
    return mesh.discover()
  }

  function statFile(ep, pathname, username) {
    if (ep === app.endpoint.id) {
      pathname = os.path.normalize(pathname)
      if (!canRead(pathname, username)) return Promise.resolve(null)
      var s = os.stat(pathname)
      if (s) {
        var stat = {
          size: s.size,
          atime: s.atime,
          mtime: s.mtime,
          ctime: s.ctime,
        }
        if (s.isDirectory()) {
          stat.dir = os.readDir(pathname)
          return Promise.resolve(stat)
        } else if (s.isFile()) {
          return Promise.resolve(stat)
        }
      }
      return Promise.resolve(null)
    } else {
      return mesh.request(ep, new Message({
        method: 'GET',
        path: os.path.join('/api/files', encodePathname(pathname)),
      })).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function createFiles(ep, pathname, username, filenames) {
    if (ep === app.endpoint.id) {
      pathname = os.path.normalize(pathname)
      if (!canWrite(pathname, username)) return Promise.resolve(false)
      filenames.forEach(name => {
        try {
          if (name.endsWith('/')) {
            os.mkdir(os.path.join(pathname, name.substring(0, name.length - 1)))
          } else {
            os.write(os.path.join(pathname, name), new Data)
          }
        } catch {}
      })
      return Promise.resolve(true)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: os.path.join('/api/files', encodePathname(pathname)),
        }, JSON.encode({ dir: filenames })
      )).then(res => res?.head?.status === 201)
    }
  }

  function deleteFile(ep, pathname, username) {
    if (ep === app.endpoint.id) {
      pathname = os.path.normalize(pathname)
      if (!canWrite(pathname, username)) return Promise.resolve(false)
      var s = os.stat(pathname)
      if (s) {
        if (s.isDirectory()) {
          os.rmdir(pathname, { recursive: true })
        } else {
          os.rm(pathname)
        }
      }
      return Promise.resolve(true)
    } else {
      return mesh.request(ep, new Message({
        method: 'DELETE',
        path: os.path.join('/api/files', encodePathname(pathname)),
      })).then(res => res?.head?.status === 204)
    }
  }

  var $endpoint
  var $pathname
  var $username

  var downloadFile = pipeline($=>$
    .onStart(p => {
      $endpoint = p.endpoint
      $pathname = os.path.normalize(p.pathname)
      $username = p.username
    })
    .replaceData()
    .pipe(
      () => {
        if ($endpoint === app.endpoint.id) {
          if (canRead($pathname, $username)) {
            return 'local'
          } else {
            return 'reject'
          }
        } else {
          return 'remote'
        }
      }, {
      'local': ($=>$
        .read(() => $pathname)
        .replaceStreamStart(evt => [new MessageStart, evt])
        .replaceStreamEnd(new MessageEnd)
      ),
      'remote': ($=>$
        .handleMessage(req => req.head.path = os.path.join('/api/file-data', encodePathname($pathname)))
        .muxHTTP().to($=>$.pipe(() => mesh.connect($endpoint)))
      ),
      'reject': ($=>$.replaceMessage(new Message({ status: 403 })))
    })
  )

  var uploadFile = pipeline($=>$
    .onStart(p => {
      $endpoint = p.endpoint
      $pathname = os.path.normalize(p.pathname)
      $username = p.username
    })
    .pipe(
      () => {
        if ($endpoint === app.endpoint.id) {
          if (canWrite($pathname, $username)) {
            return 'local'
          } else {
            return 'reject'
          }
        } else {
          return 'remote'
        }
      }, {
      'local': ($=>$
        .tee(() => $pathname)
        .replaceData()
        .replaceMessage(new Message({ status: 201 }))
      ),
      'remote': ($=>$
        .handleMessage(req => req.head.path = os.path.join('/api/file-data', encodePathname($pathname)))
        .muxHTTP().to($=>$.pipe(() => mesh.connect($endpoint)))
      ),
      'reject': ($=>$.replaceData().replaceMessage(new Message({ status: 403 })))
    })
  )

  var transfers = {}

  function allTransfers(ep, username) {
    if (ep === app.endpoint.id) {
      return Promise.resolve(
        Object.entries(transfers).filter(([k, v]) => canRead(k, username) && v.state === 'working')
      )
    } else {
      return mesh.request(ep, new Message({
        method: 'GET',
        path: '/api/transfers',
      })).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function getTransfer(ep, pathname, username) {
    if (ep === app.endpoint.id) {
      pathname = os.path.normalize(pathname)
      if (canRead(pathname, username)) {
        return Promise.resolve(transfers[pathname] || null)
      } else {
        return null
      }
    } else {
      return mesh.request(ep, new Message({
        method: 'GET',
        path: os.path.join('/api/transfers', encodePathname(pathname)),
      })).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function startTransfer(ep, pathname, source, sourcePath, username) {
    if (ep === app.endpoint.id) {
      sourcePath = os.path.normalize(sourcePath)
      pathname = os.path.normalize(pathname)
      if (!canWrite(pathname, username)) return Promise.resolve(false)
      if (transfers[pathname]?.state === 'working') return Promise.resolve(false)
      var queue = []
      var searches = [sourcePath]
      var visits = new Set
      var transfer = transfers[pathname] = {
        queue,
        current: null,
        copied: [],
        state: 'working',
      }
      var localBase = pathname
      if (os.stat(localBase)?.isDirectory?.()) {
        localBase = os.path.join(localBase, os.path.basename(sourcePath))
      }
      function findFiles() {
        var searchFilename = searches.shift()
        if (searchFilename) {
          return statFile(source, searchFilename, username).then(
            stat => {
              if (stat?.dir) {
                stat.dir.forEach(name => {
                  var sourceFilename = os.path.join(searchFilename, name)
                  if (sourceFilename.endsWith('/')) {
                    sourceFilename = sourceFilename.substring(0, sourceFilename.length - 1)
                    if (!visits.has(sourceFilename)) {
                      visits.add(sourceFilename)
                      searches.push(sourceFilename)
                    }
                  } else {
                    queue.push(sourceFilename)
                  }
                })
              } else if (stat) {
                queue.push(searchFilename)
              }
              return findFiles()
            }
          )
        }
      }
      return findFiles().then(() => {
        if (queue.length > 0) {
          function transferFile() {
            var remoteFilename = queue.shift()
            if (remoteFilename) {
              transfer.current = remoteFilename
              var relativePath = remoteFilename.substring(sourcePath.length)
              var localFilename = os.path.join(localBase, relativePath)
              app.log(`Downloading ${localFilename} from ep ${source}`)
              try {
                os.mkdir(os.path.dirname(localFilename), { recursive: true, force: true })
                pipeline($=>$
                  .onStart(new Message({ method: 'GET', path: '/' }))
                  .pipe(downloadFile, () => ({
                    endpoint: source,
                    pathname: remoteFilename,
                    username,
                  }))
                  .pipe(
                    evt => {
                      if (evt instanceof MessageStart) {
                        return evt.head?.status === 200 ? 'ok' : 'error'
                      }
                    }, {
                      'ok': $=>$.tee(localFilename),
                      'error': $=>$.replaceData(),
                    }
                  )
                  .replaceData()
                  .replaceMessage(new StreamEnd)
                ).spawn().then(() => {
                  transfer.copied.push(localFilename)
                  transferFile()
                })
              } catch {
                transfer.state = 'error'
              }
            } else {
              transfer.current = null
              transfer.state = 'done'
            }
          }
          transferFile()
          return Promise.resolve(true)
        } else {
          delete transfers[pathname]
          return Promise.resolve(false)
        }
      })
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: os.path.join('/api/transfers', encodePathname(pathname)) + '?source=' + source,
        },
        sourcePath
      )).then(res => res?.head?.status === 201)
    }
  }

  function abortTransfer(ep, pathname, username) {
    if (ep === app.endpoint.id) {
      pathname = os.path.normalize(pathname)
      if (canWrite(pathname, username)) {
        var transfer = transfers[pathname]
        if (transfer) {
          if (transfer.state === 'working') {
            transfer.state = 'abort'
          } else {
            delete transfers[pathname]
          }
          return Promise.resolve(true)
        }
      }
      return Promise.resolve(false)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'DELETE',
          path: os.path.join('/api/transfers', encodePathname(pathname)),
        }
      )).then(res => res?.head?.status === 204)
    }
  }

  function canRead(pathname, username) {
    return username === app.username
  }

  function canWrite(pathname, username) {
    return username === app.username
  }

  return {
    allEndpoints,
    statFile,
    createFiles,
    deleteFile,
    downloadFile,
    uploadFile,
    allTransfers,
    getTransfer,
    startTransfer,
    abortTransfer,
  }
}

function encodePathname(pathname) {
  return pathname.split('/').map(s => URL.encodeComponent(s)).join('/')
}
