export default function () {

  var $argv

  var serveUser = pipeline($=>$
    .demuxHTTP().to($=>$
      .pipe(
        function (evt) {
          if (evt instanceof MessageStart) {
            var head = evt.head
            if (head.method === 'CONNECT' && head.path.startsWith('/cli?argv=')) {
              $argv = JSON.parse(URL.decodeComponent(head.path.substring(10)))
              return 'cli'
            } else {
              return 'gui'
            }
          }
        }, {
          'cli': ($=>$
            .acceptHTTPTunnel(() => new Message({ status: 200 })).to($=>$
              .onStart(() => [JSON.encode($argv), new StreamEnd])
            )
          ),
          'gui': ($=>$
            .replaceMessage(new Message('hi, user'))
          )
        }
      )
    )
  )

  var servePeer = pipeline($=>$
    .serveHTTP(new Message('hi, peer'))
  )

  var $ctx

  return pipeline($=>$
    .onStart(c => void ($ctx = c))
    .pipe(() => {
      switch ($ctx.source) {
        case 'user': return serveUser
        case 'peer': return servePeer
      }
    })
  )
}
