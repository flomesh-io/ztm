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
      newCount: 0,
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
      newCount: 0,
      updateTime: 0,
      checkTime: 0,
    }
    chats.push(chat)
    return chat
  }

  function mergeMessages(chat, messages) {
    messages.forEach(msg => {
      var sender = msg.sender
      var time = msg.time
      if (!chat.messages.find(m => m.time === time && m.sender === sender)) {
        chat.messages.push(msg)
        if (sender !== app.username) chat.newCount++
        if (time > chat.updateTime) chat.updateTime = time
      }
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
  //         /groups
  //           /<creator>
  //             /<uuid>
  //               /info.json
  //               /messages
  //                 /<timestamp>.json
  //         /files
  //           /<hash>
  //

  var matchPublishPeerMsgs = new http.Match('/shared/{sender}/publish/peers/{receiver}/messages/*')
  var matchPublishGroupInfo = new http.Match('/shared/{sender}/publish/groups/{creator}/{group}/info.json')
  var matchPublishGroupMsgs = new http.Match('/shared/{sender}/publish/groups/{creator}/{group}/messages/*')

  mesh.acl(`/shared/${app.username}/publish`, { all: 'block' })

  mesh.list('/shared').then(paths => Promise.all(
    Object.keys(paths).map(path => readMessages(path, true))
  )).then(
    () => watchMessages()
  )

  function watchMessages() {
    mesh.watch('/shared').then(paths => Promise.all(
      paths.map(path => readMessages(path, false))
    ).then(() => watchMessages()))
  }

  function readMessages(path, initial) {
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
          if (initial) chat.newCount = 0
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
          try {
            var messages = JSON.decode(data)
            messages.forEach(msg => msg.sender = sender)
            mergeMessages(chat, messages)
          } catch {}
          if (initial) chat.newCount = 0
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

      var time = Date.now()
      var t = time
      var i = timestamps.findLastIndex(ts => t >= ts)
      if (i < 0) {
        t = t - 60 * 1000
      } else {
        t = timestamps[i]
      }

      var filename = os.path.join(dirname, `${t}.json`)
      return mesh.read(filename).then(
        data => {
          if (data && data.size >= 1024 && time > timestamps[timestamps.length - 1]) {
            filename = os.path.join(dirname, `${time}.json`)
            data = null
          }
          if (!data) {
            return mesh.write(filename, JSON.encode([{ time, message }]))
          }
          try {
            var list = JSON.decode(data)
          } catch {}
          if (!(list instanceof Array)) list = []
          list.push({ time, message })
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
        var updated = chat.newCount
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
            creator: chat.creator,
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
      chat.newCount = 0
      return Promise.resolve(getMessagesBetween(chat.messages, since, before))
    } else {
      return Promise.resolve(null)
    }
  }

  function allGroupMessages(creator, group, since, before) {
    var chat = findGroupChat(creator, group)
    if (chat) {
      chat.checkTime = chat.updateTime
      chat.newCount = 0
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

  function addPeerMessage(peer, message) {
    if (!peer) return Promise.resolve(false)
    var dirname = `/shared/${app.username}/publish/peers/${peer}/messages`
    return mesh.acl(dirname, { users: { [peer]: 'readonly' }}).then(
      () => publishMessage(dirname, message)
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
    return mesh.acl(dirname, { users: Object.fromEntries(chat.members.map(name => [name, 'readonly'])) }).then(
      () => mesh.write(os.path.join(dirname, 'info.json'), JSON.encode(chat))
    ).then(
      () => true
    )
  }

  function addGroupMessage(creator, group, message) {
    var chat = findGroupChat(creator, group)
    if (!chat) return Promise.resolve(false)
    if (app.username !== creator && !chat.members.includes(app.username)) return Promise.resolve(false)
    var dirname = `/shared/${app.username}/publish/groups/${creator}/${group}`
    return mesh.acl(dirname, { users: Object.fromEntries(chat.members.map(name => [name, 'readonly'])) }).then(
      () => publishMessage(os.path.join(dirname, 'messages'), message)
    ).then(
      () => true
    )
  }

  function addFile(data) {
    var h = new crypto.Hash('sha256')
    h.update(data)
    h.update(data.size.toString())
    var hash = h.digest().toString('hex')
    return mesh.write(`/shared/${app.username}/publish/files/${hash}`, data).then(
      () => hash
    )
  }

  function getFile(owner, hash) {
    return mesh.read(`/shared/${owner}/publish/files/${hash}`)
  }

  function delFile(owner, hash) {
    mesh.erase(`/shared/${owner}/publish/files/${hash}`)
    return Promise.resolve(true)
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
    addFile,
    getFile,
    delFile,
  }
}
