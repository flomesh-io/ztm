export default function ({ app, mesh }) {

  function watchGroups() {
    mesh.watch('/shared/root/publish/groups').then(paths => 
      console.log(paths)
    ).then(() => watchGroups())
  }
  watchGroups()

  function setGroups(id, name, users) {
    return getGroupConfig().then(config => {
      var group = config.find(g => g?.id == id)
      if (group == null) {
        config.push({id, name, users})
      } else {
        group.name = name
        group.users = users
      }
      setGroupConfig(id, config)
      return true
    })
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
    return getGroupConfig().then(
      config => config.find(
        g => g?.id == id
      ) || null
    )
  }

  function deleteGroup(id) {
    return getGroupConfig().then(config => {
      var i = config.findIndex(o => o?.id === id)
      if (i >= 0) {
        config.splice(i, 1)
        setGroupConfig(id, config)
      } else {
        return false;
      }
      return true;
    })
  }

  function getGroupConfig() {
    return mesh.read(`/shared/root/publish/groups/config.json`).then(
      data => data ? JSON.decode(data) : []
    )
  }
  
  function setGroupConfig(id, config) {
    mesh.write(`/shared/root/publish/groups/config.json`, JSON.encode(config))
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
