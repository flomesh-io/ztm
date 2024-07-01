export default function () {

  var serveUser = pipeline($=>$
    .serveHTTP(new Message('hi, user'))
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
