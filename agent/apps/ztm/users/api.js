export default function ({ app, mesh }) {

  function setGroups(id, name, users) {
    return getLocalConfig().then(config => {
      if (id == null) {
        id = algo.uuid()
        config.push({id, name, users})
      } else {
        var group = config.find(g => g.id == id)
        group.name = name
        group.users = users
      }
      setLocalConfig(config)
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

  return {
    getGroups,
    setGroups,
    getGroup,
    deleteGroup,
    getUserGroups,
  }
}
