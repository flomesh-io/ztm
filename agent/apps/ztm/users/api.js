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

  function setGroups(id, name, users) {
    return setGroupConfig(id, {id, name, users}).then(() => true)
  }

  function getGroups() {
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
    return getGroupConfig(id).then(
      config => config || null
    )
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
          return data && data.toString() ? JSON.decode(data) : null
        }
      )
    } else {
      var datas = []
      return mesh.dir(`/shared/root/groups`).then(
        files => Promise.all(
          files.map(file => mesh.read(`/shared/root/groups/${file}`).then(
            data => {
              if (data && data.toString()) {
                datas.push(JSON.decode(data))
              }
            }
          ))
        ).then(() => datas)
      )
    }
  }
  
  function setGroupConfig(id, config) {
    return mesh.write(`/shared/root/groups/${id}.json`, JSON.encode(config))
  }

  function allUsers() {
    return mesh.discover().then(
      endpoints => {
        var users = []
        var set = new Set
        endpoints.forEach(ep => {
          var user = ep.username
          if (!set.has(user)) {
            users.push(user)
            set.add(user)
          }
        })
        return users.sort()
      }
    )
  }
  
  return {
    getGroups,
    setGroups,
    getGroup,
    deleteGroup,
    getUserGroups,
    allUsers,
  }
}
