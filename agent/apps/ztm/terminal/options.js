export default function (argv, { defaults, shorthands }, unknown) {
  var args = []
  var opts = {}
  var lastOption

  argv.forEach(
    function (term, i) {
      if (i === 0) return
      if (lastOption) {
        if (term.startsWith('-')) {
          addOption(lastOption, undefined)
          lastOption = undefined
        } else {
          addOption(lastOption, term)
          lastOption = undefined
          return
        }
      }
      if (term.startsWith('--')) {
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

  if (lastOption) addOption(lastOption, undefined)

  function processOption(name, value) {
    var k = shorthands?.[name] || name
    if (typeof defaults[k] === 'boolean') {
      opts[k] = true
    } else if (value) {
      addOption(k, value)
    } else {
      lastOption = name
    }
  }

  function addOption(name, value) {
    var k = shorthands?.[name] || name
    if (k in defaults) {
      if (value === undefined) throw `Value missing for option ${name}`
      switch (typeof defaults[k]) {
        case 'number': opts[k] = Number.parseFloat(value); if (Number.isNaN(opts[k])) opts[k] = value; break
        case 'string': opts[k] = value; break
        case 'object': (opts[k] ??= []).push(value); break
      }
    } else if (unknown instanceof Array) {
      unknown.push(name)
      if (value !== undefined) unknown.push(value)
    } else {
      throw `unrecognized option ${name}`
    }
  }

  return { args, ...defaults, ...opts }
}
