export default function ({ app, api, utils }) {
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
      return Promise.resolve(
        pipeline($=>$
          .replaceStreamStart([buffer, new StreamEnd])
        )
      )
    }

    return flush()
  }
}
