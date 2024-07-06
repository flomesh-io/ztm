export default function (argv, { commands }) {
  var program = argv[0]
  var cmd = argv[1]

  if (!cmd || cmd.startsWith('-')) {
    throw `missing command. Type '${program} help' for help`
  }

  var func = commands[cmd]
  if (!func) {
    throw `invalid command '${cmd}'. Type '${program} help' for help`
  }

  return func([program, ...argv.slice(2)])
}
