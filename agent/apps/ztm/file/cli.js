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
            title: 'Edit the access control list',
            usage: 'acl <pathname>',
            options: `
              --set-all       <writable|readonly|block|default>  Set access for all users
              --set-writable  <username ...>                     Add writable access for users
              --set-readonly  <username ...>                     Add readonly access for users
              --set-block     <username ...>                     Block access for users
              --set-default   <username ...>                     Reset access to default for users
            `,
            action: (args) => api.getACL(endpoint.id).then(acl => {
            })
          },
          {
            title: 'List all files in a directory',
            usage: 'ls [<pathname>]',
            action: (args) => {
            }
          },
          {
            title: 'Copy files or directories',
            usage: 'cp <source> <destination>',
            options: `
              -R, -r, --recursive    Copy directories recursively
            `,
            action: (args) => {}
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
