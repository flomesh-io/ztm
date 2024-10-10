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
  }
}

function encodePathname(pathname) {
  return pathname.split('/').map(s => URL.encodeComponent(s)).join('/')
}
