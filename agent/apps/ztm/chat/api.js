export default function ({ app, mesh }) {
  var chats = []

  function findPeerChat(peer) {
    return chats.find(c => c.peer === peer)
  }

  function findGroupChat(creator, group) {
    return chats.find(c => c.creator === creator && c.group === group)
  }

  function newPeerChat(peer) {
    var chat = {
      peer,
      messages: [],
      updateTime: 0,
      checkTime: 0,
    }
    chats.push(chat)
    return chat
  }

  function newGroupChat(creator, group) {
    var chat = {
      creator,
      group,
      name: '',
      members: [],
      messages: [],
      updateTime: 0,
      checkTime: 0,
    }
    chats.push(chat)
    return chat
  }

  function mergeMessages(chat, messages) {
    messages.forEach(msg => {
      chat.messages.push(msg)
      if (msg.time > chat.updateTime) chat.updateTime = msg.time
    })
  }

  //
  // /apps/ztm/chat
  //   /users
  //     /<username>
  //   /shared
  //     /<username>
  //       /publish
  //         /peers
  //           /<username>
  //             /messages
  //               /<timestamp>.json
  //             /files
  //               /<hash>.json
  //               /<hash>
  //         /groups
  //           /<creator>
  //             /<uuid>
  //               /info.json
  //               /messages
  //                 /<timestamp>.json
  //               /files
  //                 /<hash>.json
  //                 /<hash>
  //

  var matchPublishPeerMsgs = new http.Match('/shared/{sender}/publish/peers/{receiver}/messages/*')
  var matchPublishGroupInfo = new http.Match('/shared/{sender}/publish/groups/{creator}/{group}/info.json')
  var matchPublishGroupMsgs = new http.Match('/shared/{sender}/publish/groups/{creator}/{group}/messages/*')

  mesh.list('/shared').then(paths => Promise.all(
    Object.keys(paths).map(path => readMessages(path))
  )).then(
    () => watchMessages()
  )

  function watchMessages() {
    mesh.watch('/shared').then(paths => Promise.all(
      paths.map(path => readMessages(path))
    ).then(() => watchMessages()))
  }

  function readMessages(path) {
    var params = matchPublishPeerMsgs(path)
    if (params) {
      return mesh.read(path).then(data => {
        if (data) {
          var me = app.username
          var sender = params.sender
          var receiver = params.receiver
          if (receiver === me) {
            var peer = sender
          } else if (sender === me) {
            var peer = receiver
          } else {
            return
          }
          var chat = findPeerChat(peer)
          if (!chat) chat = newPeerChat(peer)
          try {
            var messages = JSON.decode(data)
            messages.forEach(msg => msg.sender = sender)
            mergeMessages(chat, messages)
          } catch {}
        }
      })
    }
    var params = matchPublishGroupInfo(path)
    if (params) {
      return mesh.read(path).then(data => {
        if (data) {
          var sender = params.sender
          var creator = params.creator
          var group = params.group
          if (sender !== creator) return
          var chat = findGroupChat(creator, group)
          if (!chat) chat = newGroupChat(creator, group)
          try {
            var info = JSON.decode(data)
            if (info.name) chat.name = info.name
            if (info.members instanceof Array) chat.members = info.members
          } catch {}
          return mesh.acl(
            `/shared/${app.username}/publish/groups/${creator}/${group}`, {
              users: chat.members
            }
          )
        }
      })
    }
    var params = matchPublishGroupMsgs(path)
    if (params) {
      return mesh.read(path).then(data => {
        if (data) {
          var sender = params.sender
          var creator = params.creator
          var group = params.group
          var chat = findGroupChat(creator, group)
          if (!chat) chat = newGroupChat(creator, group)
          if (chat.creator === app.username || chat.members.includes(app.username)) {
            try {
              var messages = JSON.decode(data)
              messages.forEach(msg => msg.sender = sender)
              mergeMessages(chat, messages)
            } catch {}
          }
        }
      })
    }
    return Promise.resolve()
  }

  function publishMessage(dirname, message) {
    return mesh.dir(dirname).then(filenames => {
      var timestamps = filenames.filter(
        name => name.endsWith('.json')
      ).map(
        name => Number.parseFloat(name.substring(0, name.length - 5))
      ).filter(
        n => !Number.isNaN(n)
      )

      var t = message.time
      var i = timestamps.findLastIndex(ts => t >= ts)
      if (i < 0) {
        t = t - 60 * 1000
      } else {
        t = timestamps[i]
      }

      var filename = os.path.join(dirname, `${t}.json`)
      return mesh.read(filename).then(
        data => {
          if (data && data.size >= 1024 && message.time > timestamps[timestamps.length - 1]) {
            filename = os.path.join(dirname, `${message.time}.json`)
            data = null
          }
          if (!data) {
            return mesh.write(filename, JSON.encode([message]))
          }
          try {
            var list = JSON.decode(data)
          } catch {}
          if (!(list instanceof Array)) list = []
          list.push(message)
          return mesh.write(filename, JSON.encode(list))
        }
      )
    })
  }

  function allEndpoints() {
    return mesh.discover()
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

  function allChats() {
    return Promise.resolve(chats.filter(
      chat => chat.peer || (chat.group && chat.name)
    ).map(
      chat => {
        var updated = chat.updateTime > chat.checkTime
        var latest = chat.messages.reduce((a, b) => a.time > b.time ? a : b)
        if (chat.peer) {
          return {
            peer: chat.peer,
            time: chat.updateTime,
            updated,
            latest,
          }
        } else {
          return {
            group: chat.group,
            name: chat.name,
            time: chat.updateTime,
            updated,
            latest,
          }
        }
      }
    ))
  }

  function allPeerMessages(peer, since, before) {
    var chat = findPeerChat(peer)
    if (chat) {
      chat.checkTime = chat.updateTime
      return Promise.resolve(getMessagesBetween(chat.messages, since, before))
    } else {
      return Promise.resolve(null)
    }
  }

  function allGroupMessages(creator, group, since, before) {
    var chat = findGroupChat(creator, group)
    if (chat) {
      chat.checkTime = chat.updateTime
      return Promise.resolve(getMessagesBetween(chat.messages, since, before))
    } else {
      return Promise.resolve(null)
    }
  }

  function getMessagesBetween(messages, since, before) {
    since = since || 0
    before = before || Number.POSITIVE_INFINITY
    return messages.filter(
      msg => since <= msg.time && msg.time <= before
    )
  }

  function addPeerMessage(peer, type, content) {
    if (!peer) return Promise.resolve(false)
    var dirname = `/shared/${app.username}/publish/peers/${peer}/messages`
    return mesh.acl(dirname, { users: [peer] }).then(
      () => publishMessage(dirname, { time: Date.now(), type, content })
    ).then(
      () => true
    )
  }

  function getGroup(creator, group) {
    var chat = findGroupChat(creator, group)
    if (chat) {
      return Promise.resolve({
        creator,
        group,
        name: chat.name,
        members: chat.members,
      })
    } else {
      return Promise.resolve(null)
    }
  }

  function setGroup(creator, group, info) {
    if (creator !== app.username) return Promise.resolve(false)
    var chat = findGroupChat(creator, group)
    if (!chat) chat = newGroupChat(creator, group)
    if (info.name) chat.name = info.name
    if (info.members instanceof Array) chat.members = info.members
    var dirname = `/shared/${creator}/publish/groups/${creator}/${group}`
    return mesh.acl(dirname, { users: chat.members }).then(
      () => mesh.write(os.path.join(dirname, 'info.json'), JSON.encode(chat))
    ).then(
      () => true
    )
  }

  function addGroupMessage(creator, group, type, content) {
    var chat = findGroupChat(creator, group)
    if (!chat) return Promise.resolve(false)
    if (app.username !== creator && !chat.members.includes(app.username)) return Promise.resolve(false)
    var dirname = `/shared/${app.username}/publish/groups/${creator}/${group}`
    return mesh.acl(dirname, { users: chat.members }).then(
      () => publishMessage(os.path.join(dirname, 'messages'), { time: Date.now(), type, content })
    ).then(
      () => true
    )
  }

  return {
    allEndpoints,
    allUsers,
    allChats,
    allPeerMessages,
    addPeerMessage,
    allGroupMessages,
    getGroup,
    setGroup,
    addGroupMessage,
  }
}
