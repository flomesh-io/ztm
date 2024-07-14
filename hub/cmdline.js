export default function (argv, { commands, notes, help }) {
  var program = argv[0]
  argv = argv.slice(1)

  var isHelpCommand = false
  if (argv[0] === 'help') {
    isHelpCommand = true
    argv.shift()
  }

  var patterns = commands.map(cmd => cmd.usage ? tokenize(cmd.usage) : [])
  var best = 0
  var bestIndex = 0

  patterns.forEach((pattern, i) => {
    var len = matchCommand(pattern, argv)
    if (len > best) {
      best = len
      bestIndex = i
    }
  })

  var cmd = commands[bestIndex]
  var pattern = patterns[bestIndex]

  if (isHelpCommand) {
    var lines = ['']
    if (best > 0) {
      if (cmd.title) lines.push(cmd.title, '')
      if (cmd.options) {
        lines.push(`Usage: ${program} ${cmd.usage} [options...]`, '')
        lines.push(`Options:`, '', stripIndentation(cmd.options, 2))
      } else {
        lines.push(`Usage: ${program} ${cmd.usage}`)
      }
      if (cmd.notes) {
        lines.push('', stripIndentation(cmd.notes))
      }
    } else {
      var maxCommandWidth = 0
      commands.forEach(cmd => {
        if (cmd.usage.length > maxCommandWidth) {
          maxCommandWidth = cmd.usage.length
        }
      })
      lines.push(`Commands:`, '')
      commands.forEach(cmd => {
        lines.push(`  ${program} ${cmd.usage.padEnd(maxCommandWidth)}   ${cmd.title}`)
      })
      if (notes) {
        lines.push('', stripIndentation(notes))
      }
      lines.push('', `Type '${program} help <command>' for detailed info.`, '')
    }
    return help(lines.join('\n'), pattern.slice(0, best))
  }

  try {
    var rest = []
    var args = parseCommand(pattern, argv, rest)
    var opts = parseOptions(cmd.options, rest)
    return cmd.action({ ...args, ...opts })

  } catch (err) {
    println(err)
    var command = pattern.slice(0, best).join(' ')
    return Promise.reject(`${err}. Type '${program} help ${command}' for help info.`)
  }
}

function matchCommand(pattern, argv) {
  var i = argv.findIndex(
    (arg, i) => arg.startsWith('-') || arg !== pattern[i]
  )
  return i < 0 ? argv.length : i
}

function parseCommand(pattern, argv, rest) {
  var values = {}
  var i = argv.findIndex((arg, i) => {
    var tok = pattern[i]
    if (arg.startsWith('-')) return true
    if (!tok) throw `Excessive positional argument: ${arg}`
    if (tok.startsWith('[') || tok.startsWith('<')) {
      values[tok] = arg
    }
  })
  if (i < 0) i = argv.length
  argv.slice(i).forEach(arg => rest.push(arg))
  var tok = pattern[i]
  if (!tok || tok.startsWith('[')) return values
  if (!tok.startsWith('<')) return null
  throw `Missing argument ${tok}`
}

function parseOptions(format, argv) {
  var options = {}

  format.split('\n').map(
    line => line.trim()
  ).filter(
    line => line.startsWith('-')
  ).forEach(line => {
    var aliases = []
    var type
    tokenize(line).find(t => {
      if (t.startsWith('-')) {
        if (t.endsWith(',')) t = t.substring(0, t.length - 1)
        aliases.push(t)
      } else {
        if (t.endsWith('...]') || t.endsWith('...>')) type = 'array'
        else if (t.startsWith('[')) type = 'optional string'
        else if (t.startsWith('<')) type = 'string'
        else type = 'boolean'
        return true
      }
    })
    var option = { type }
    aliases.forEach(name => options[name] = option)
  })

  var currentOption

  argv.forEach(arg => {
    if (currentOption) {
      if (arg.startsWith('-')) {
        endOption(currentOption)
        currentOption = undefined
      } else {
        addOption(currentOption, arg)
        return
      }
    }
    if (arg.startsWith('--')) {
      currentOption = arg
    } else if (term.startsWith('-')) {
      if (term.length === 2) {
        currentOption = arg
      } else {
        addOption(term.substring(0, 2), term.substring(2))
      }
    } else {
      throw `Excessive positional argument: ${arg}`
    }
  })

  if (currentOption) endOption(currentOption)

  function addOption(name, value) {
    var option = options[name]
    if (!option) throw `Unrecognized option: ${name}`
    switch (option.type) {
      case 'boolean':
        throw `Excessive positional argument: ${value}`
      case 'string':
      case 'optional string':
        if ('value' in option) throw `Duplicated option value: ${value}`
        option.value = value
        break
      case 'array':
        option.value ??= []
        option.value.push(value)
        break
    }
  }

  function endOption(name) {
    var option = options[name]
    if (!option) throw `Unrecognized option: ${name}`
    switch (option.type) {
      case 'boolean':
        option.value = true
        break
      case 'string':
        if (!('value' in option)) throw `Missing option value: ${name}`
        break
      case 'optional string':
        if (!('value' in option)) option.value = ''
        break
    }
  }

  var values = {}

  Object.entries(options).forEach(
    ([name, option]) => {
      if ('value' in option) {
        values[name] = option.value
      }
    }
  )

  return values
}

function tokenize(str) {
  var tokens = str.split(' ').reduce(
    (a, b) => {
      if (typeof a === 'string') a = [a]
      var last = a.pop()
      if (last.startsWith('<')) {
        a.push(`${last} ${b}`)
        if (b.endsWith('>')) a.push('')
      } else if (last.startsWith('[')) {
        a.push(`${last} ${b}`)
        if (b.endsWith(']')) a.push('')
      } else {
        a.push(last, b)
      }
      return a
    }
  )
  return tokens instanceof Array ? tokens.filter(t => t) : [tokens]
}

function stripIndentation(s, indent) {
  var lines = s.split('\n')
  if (lines[0].trim() === '') lines.shift()
  var depth = lines[0].length - lines[0].trimStart().length
  var padding = ' '.repeat(indent || 0)
  return lines.map(l => padding + l.substring(depth)).join('\n')
}
