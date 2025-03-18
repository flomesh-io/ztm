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
      if (err.stack) {
        output(err.stack)
        output('\n')
      }
    }

    function flush() {
      return [buffer, new StreamEnd]
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [
          {
            title: 'List all users and groups',
            usage: 'list',
            action: (args) => api.allGroups().then(groups => (
              api.allUsers().then(users => {
                var epLocal = endpoint.id
                printTable(users, {
                  'USERNAME': u => u.name,
                  'ENDPOINTS': u => {
                    var list = u.endpoints.instances.map(
                      inst => inst.name + (inst.id === epLocal ? ' (local)' : '')
                    ).join(', ')
                    var extra = u.endpoints.count - u.endpoints.instances.length
                    if (extra > 0) list += `... (and ${extra} more)`
                    return list
                  }
                })
                output('\n')
                printTable(groups, {
                  'GROUP': g => g.name,
                  'MEMBERS': g => g.users.join(', '),
                })
              })
            ))
          },

          {
            title: 'Create, change or delete a user group',
            usage: 'group <group name>',
            options: `
              --add-users     <username ...>  Add users to the group
              --remove-users  <username ...>  Remove users from the group
              --rename-group  <name>          Set a new group name
              --delete-group                  Delete the group
            `,
            action: (args) => api.allGroups().then(groups => {
              var name = args['<group name>']
              var add = args['--add-users']
              var remove = args['--remove-users']
              var rename = args['--rename-group']
              var group = groups.find(g => g.name === name)

              if (args['--delete-group']) {
                if (add || remove || rename) throw `Option --delete-group can only be used alone`
                if (!group) throw `Group not found: ${name}`
                return api.deleteGroup(group.id)
              }

              if (!add && !remove && !rename) {
                if (!group) throw `Group not found: ${name}`
                group.users.forEach(username => output(username + '\n'))
                return
              }

              if (!group) {
                if (rename || remove) throw `Group not found: ${name}`
                group = {
                  id: algo.uuid(),
                  name,
                  users: [],
                }
              }

              if (remove) {
                group.users = group.users.filter(
                  username => !remove.includes(username)
                )
              }

              if (add) {
                add.forEach(username => {
                  if (!group.users.includes(username)) {
                    group.users.push(username)
                  }
                })
              }

              if (rename) {
                group.name = rename
              }

              return api.setGroup(group.id, group.name, group.users)
            })
          },
        ]

      }).then(flush).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return Promise.resolve(flush())
    }

    function printTable(data, columns) {
      var cols = Object.entries(columns)
      var colHeaders = cols.map(i => i[0])
      var colFormats = cols.map(i => i[1])
      var colSizes = colHeaders.map(name => name.length)
      var rows = data.map((row, i) => colFormats.map(
        (format, j) => {
          var v = (format(row, i) || '').toString()
          colSizes[j] = Math.max(colSizes[j], v.length)
          return v
        }
      ))
      colHeaders.forEach((name, i) => output(name.padEnd(colSizes[i] + 2)))
      output('\n')
      rows.forEach(row => {
        row.forEach((v, i) => output(v.padEnd(colSizes[i] + 2)))
        output('\n')
      })
    }
  }
}
