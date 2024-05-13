export default function (argv, { defaults, shorthands }) {
  var args = []
  var opts = {}
  var lastOption

  argv.forEach(
    function (term, i) {
      if (i === 0) return
      if (lastOption) {
        if (term.startsWith('-')) throw `Value missing for option ${lastOption}`
        addOption(lastOption, term)
        lastOption = undefined
      } else if (term.startsWith('--')) {
        var kv = term.split('=')
        processOption(kv[0], kv[1])
      } else if (term.startsWith('-')) {
        if (term.length === 2) {
          processOption(term)
        } else {
          processOption(term.substring(0, 2), term.substring(2))
        }
      } else {
        args.push(term)
      }
    }
  )

  function processOption(name, value) {
    var k = shorthands[name] || name
    if (!(k in defaults)) throw `invalid option ${k}`
    if (typeof defaults[k] === 'boolean') {
      opts[k] = true
    } else if (value) {
      addOption(k, value)
    } else {
      lastOption = name
    }
  }

  function addOption(name, value) {
    var k = shorthands[name] || name
    switch (typeof defaults[k]) {
      case 'number': opts[k] = Number.parseFloat(value); break
      case 'string': opts[k] = value; break
      case 'object': (opts[k] ??= []).push(value); break
    }
  }

  return { args, ...defaults, ...opts }
}
