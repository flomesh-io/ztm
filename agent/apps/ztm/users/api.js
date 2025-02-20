export default function ({ app, mesh }) {

  function watchGroups() {
    mesh.watch('/shared/root/publish/groups').then(paths => 
      console.log(paths)
    ).then(() => watchGroups())
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
    console.log('getUserGroups', user)
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
    return mesh.read(`/shared/root/publish/groups/${id}.json`).then(
      data => {
        if (data?.toString()) {
          mesh.erase(`/shared/root/publish/groups/${id}.json`)
          return true
        } else {
          return false
        }
      }
    )
  }

  function getGroupConfig(id) {
    if (id) {
      return mesh.read(`/shared/root/publish/groups/${id}.json`).then(
        data => {
          return data?.toString() ? JSON.decode(data) : null
        }
      )
    } else {
      var datas = []
      return mesh.dir(`/shared/root/publish/groups`).then(
        files => Promise.all(
          files.map(file => mesh.read(`/shared/root/publish/groups/${file}`).then(
            data => {
              if (data?.toString()) {
                datas.push(JSON.decode(data))
              }
            }
          ))
        ).then(() => datas)
      )
    }
  }
  
  function setGroupConfig(id, config) {
    return mesh.write(`/shared/root/publish/groups/${id}.json`, JSON.encode(config))
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
