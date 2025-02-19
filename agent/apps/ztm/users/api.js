export default function ({ app, mesh }) {

  function setGroups(id, name, users) {
    return getLocalConfig().then(config => {
      console.log(config)
      var group = config.find(g => g.id == id)
      if (group == null) {
        config.push({id, name, users})
      } else {
        group.name = name
        group.users = users
      }
      setLocalConfig(config)
      return true
    })
  }

  function getGroups() {
    return getLocalConfig().then(
      config => config || null
    )
  }

  function getUserGroups(user) {
    return getLocalConfig().then(
      config => config.filter(
        g => g.users.includes(user)
      )
    )
  }

  function getGroup(id) {
    return getLocalConfig().then(
      config => config.find(
        g => g.id == id
      ) || null
    )
  }

  function deleteGroup(id) {
    return getLocalConfig().then(config => {
      var i = config.findIndex(o => o.id === id)
      if (i >= 0) {
        config.splice(i, 1)
        setLocalConfig(config)
      }
    })
  }

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => data ? JSON.decode(data) : []
    )
  }
  
  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
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
