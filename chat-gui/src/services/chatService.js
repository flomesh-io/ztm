import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const meshService = {
  getMeshes() {
    return api.get('/meshes')
  }
}

export const chatService = {
  getChats(meshName) {
    return api.get(`/meshes/${meshName}/apps/ztm/chat/api/chats`)
  },
  
  getUsers(meshName) {
    return api.get(`/meshes/${meshName}/users?limit=100`)
  },
  
  getMessages(meshName, peer) {
    return api.get(`/meshes/${meshName}/apps/ztm/chat/api/peers/${peer}/messages`)
  },
  
  getMessagesSince(meshName, peer, since) {
    return api.get(`/meshes/${meshName}/apps/ztm/chat/api/peers/${peer}/messages?since=${since}`)
  },
  
  getGroupMessages(meshName, creator, groupId) {
    return api.get(`/meshes/${meshName}/apps/ztm/chat/api/groups/${creator}/${groupId}/messages`)
  },
  
  getGroupMessagesSince(meshName, creator, groupId, since) {
    return api.get(`/meshes/${meshName}/apps/ztm/chat/api/groups/${creator}/${groupId}/messages?since=${since}`)
  },
  
  sendMessage(meshName, peer, text) {
    return api.post(`/meshes/${meshName}/apps/ztm/chat/api/peers/${peer}/messages`, { text })
  },
  
  sendGroupMessage(meshName, creator, groupId, text) {
    return api.post(`/meshes/${meshName}/apps/ztm/chat/api/groups/${creator}/${groupId}/messages`, { text })
  },
  
  createGroup(meshName, creator, groupId, data) {
    return api.post(`/meshes/${meshName}/apps/ztm/chat/api/groups/${creator}/${groupId}`, data)
  }
}

export default api
