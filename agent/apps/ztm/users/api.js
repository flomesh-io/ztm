export default function ({ app, mesh }) {

  function watchGroups() {
    mesh.watch('/shared/root/groups').then((paths) => {
      paths.forEach(path => {
        mesh.read(path)
      })
      watchGroups()
    })
  }

  watchGroups()

  function setGroup(id, name, users) {
    return setGroupConfig(id, { name, users }).then(true)
  }

  function allGroups() {
    return getGroupConfig().then(
      config => config || null
    )
  }

  function getUserGroups(user) {
    return getGroupConfig().then(
      config => config.filter(
        g => g.users.includes(user)
      )
    )
  }

  function getGroup(id) {
    return getGroupConfig(id)
  }

  function deleteGroup(id) {
    return mesh.stat(`/shared/root/groups/${id}.json`).then(
      data => {
        if (data) {
          mesh.erase(`/shared/root/groups/${id}.json`)
          return true
        } else {
          return false
        }
      }
    )
  }

  function getGroupConfig(id) {
    if (id) {
      return mesh.read(`/shared/root/groups/${id}.json`).then(
        data => {
          try {
            var group = JSON.decode(data)
            group.id = id
            return group
          } catch {
            return null
          }
        }
      )
    } else {
      return mesh.dir(`/shared/root/groups`).then(
        filenames =>Promise.all(
          filenames.filter(fn => fn.endsWith('.json')).map(
            filename => {
              return mesh.read(`/shared/root/groups/${filename}`).then(
                data => {
                  try {
                    var group = JSON.decode(data)
                    group.id = filename.substring(0, filename.length - 5)
                    return group
                  } catch {
                    return null
                  }
                }
              )
            }
          )
        ).then(
          groups => groups.filter(g=>g)
        )
      )
    }
  }

  function setGroupConfig(id, config) {
    return mesh.write(`/shared/root/groups/${id}.json`, JSON.encode(config))
  }

  function allUsers() {
    return mesh.discoverUsers()
  }

  function getUser(username) {
    return getGroupConfig().then(
      groups => ({
        name: username,
        groups: groups.filter(
          g => g.users.includes(username)
        ).map(
          g => ({ id: g.id, name: g.name })
        )
      })
    )
  }

  return {
    allGroups,
    getGroup,
    setGroup,
    deleteGroup,
    getUserGroups,
    allUsers,
    getUser,
  }
}
