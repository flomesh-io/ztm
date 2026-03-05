<template>
  <div class="chat-container">
    <ChatSidebar
      :chats="chats"
      :activeChat="activeChat"
      @select="selectChat"
      @selectOpenclaw="selectOpenclawAgent"
    />
    <ChatMain
      v-if="activeChat !== null && activeChat < chats.length"
      :chat="chats[activeChat]"
      :meshName="currentMesh"
      :currentUserName="currentMeshAgentUsername"
      :sending="sending"
      :openclawSessions="openclawSessions"
      v-model="newMessage"
      @send="sendMessage"
      @switchSession="(sessionId) => switchOpenclawSession(chats[activeChat], sessionId)"
    />
    <div v-else class="empty-state">
      <div class="empty-icon">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="40" fill="#E8E8E8"/>
          <path d="M40 20C29.5 20 21 28.5 21 39c0 7.3 4.2 13.7 10.5 17.5v5.5c0 2.2 1.8 4 4 4h9c2.2 0 4-1.8 4-4v-5.5c6.3-3.8 10.5-10.2 10.5-17.5C59 28.5 50.5 20 40 20z" fill="#4A154B"/>
        </svg>
      </div>
      <h2>Welcome to ClawParty!</h2>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide } from 'vue'
import ChatSidebar from './components/ChatSidebar.vue'
import ChatMain from './components/ChatMain.vue'
import { meshService, chatService, openclawService } from './services/chatService'

const meshes = ref([])
const openclawAgents = ref([])
const openclawSessions = ref([])
const currentMesh = ref('')
const currentMeshAgentUsername = ref('')
const chats = ref([])
const activeChat = ref(null)
const newMessage = ref('')
const sending = ref(false)
let chatsPollTimer = null

provide('currentMesh', currentMesh)

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 86400000) {
    return date.getHours().toString().padStart(2, '0') + ':' + 
           date.getMinutes().toString().padStart(2, '0')
  } else if (diff < 172800000) {
    return '昨天'
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

const parseChatData = (data) => {
  return data.map(item => {
    const name = item.peer || item.name || '未知'
    const latestMsg = item.latest?.message?.text || ''
    const firstLine = latestMsg.split('\n')[0].substring(0, 30)
    const isGroup = !!item.group
    
    return {
      id: item.group || item.peer || Math.random().toString(),
      name: name,
      time: formatTime(item.time),
      lastMessage: firstLine,
      updated: item.updated || 0,
      isGroup: isGroup,
      creator: item.creator || '',
      groupId: item.group || '',
      messages: item.latest ? [
        {
          text: item.latest.message?.text || '',
          time: formatTime(item.latest.time),
          isSent: false
        }
      ] : []
    }
  })
}

const fetchMeshes = async () => {
  try {
    const response = await meshService.getMeshes()
    meshes.value = response.data
    if (meshes.value.length > 0) {
      currentMesh.value = meshes.value[0].name
      currentMeshAgentUsername.value = meshes.value[0].agent?.username || ''
      await fetchChats()
    }
  } catch (error) {
    console.error('获取 meshes 失败:', error)
  }
}

const fetchOpenclawAgents = async () => {
  try {
    const response = await openclawService.getAgents()
    const agentsData = Array.isArray(response.data) ? response.data : []
    openclawAgents.value = agentsData.map(agent => ({
      id: agent.id,
      name: agent.identityName || agent.id,
      emoji: agent.identityEmoji || '🤖',
      model: agent.model,
      isOpenclaw: true
    }))
    
    agentsData.forEach(agent => {
      const existingChat = chats.value.find(c => c.isOpenclaw && c.agentId === agent.id)
      if (!existingChat) {
        chats.value.push({
          id: agent.id,
          agentId: agent.id,
          name: agent.identityName || agent.id,
          emoji: agent.identityEmoji || '🤖',
          time: '',
          lastMessage: '',
          updated: 0,
          messages: [],
          sessions: [],
          sessionId: null,
          isOpenclaw: true,
          isTemp: true
        })
      }
    })
  } catch (error) {
    console.error('获取 OpenClaw agents 失败:', error)
  }
}

const fetchChats = async () => {
  if (!currentMesh.value) return
  try {
    const response = await chatService.getChats(currentMesh.value)
    const newChats = parseChatData(response.data)
    
    const savedChatId = activeChat.value !== null ? chats.value[activeChat.value]?.id : null
    const savedIsOpenclaw = activeChat.value !== null ? chats.value[activeChat.value]?.isOpenclaw : false
    
    if (newChats.length > 0) {
      const existingChatNames = new Set(chats.value.map(c => c.name))
      const newChatNames = new Set(newChats.map(c => c.name))
      
      newChats.forEach(newChat => {
        const existingIndex = chats.value.findIndex(c => c.name === newChat.name && !c.isOpenclaw)
        if (existingIndex !== -1) {
          chats.value[existingIndex].time = newChat.time
          chats.value[existingIndex].lastMessage = newChat.lastMessage
          chats.value[existingIndex].updated = newChat.updated
          chats.value[existingIndex].isTemp = false
        } else {
          chats.value.push(newChat)
        }
      })
      
      for (let i = chats.value.length - 1; i >= 0; i--) {
        if (!chats.value[i].isOpenclaw && !newChatNames.has(chats.value[i].name) && !chats.value[i].isTemp) {
          chats.value.splice(i, 1)
        }
      }
      
      if (savedChatId !== null) {
        const newIndex = chats.value.findIndex(c => c.id === savedChatId && c.isOpenclaw === savedIsOpenclaw)
        if (newIndex !== -1) {
          activeChat.value = newIndex
        }
      } else if (activeChat.value === null && chats.value.length > 0) {
        activeChat.value = 0
      }
    }
  } catch (error) {
    console.error('获取聊天列表失败:', error)
  }
}

const selectChat = (index) => {
  activeChat.value = index
  if (chats.value[index]) {
    chats.value[index].updated = 0
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || activeChat.value === null || sending.value) return
  
  const chat = chats.value[activeChat.value]
  const text = newMessage.value
  sending.value = true
  
  try {
    if (chat.isOpenclaw) {
      if (!chat.messages) chat.messages = []
      sending.value = false
      const now = new Date()
      const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
      setTimeout(()=>{
				chat.messages.push({
				  text: '',
				  time: time,
				  sender: chat.name,
				  timestamp: now.getTime(),
				  isTyping: true
				})
			},300)
      
      const agentId = chat.agentId
      openclawService.sendMessage(agentId, text).then((response)=>{
				let replyText = response.data?.payloads?.[0]?.text || response.data?.result?.payloads?.[0]?.text;
				
				const typingIndex = chat.messages.findIndex(m => m.isTyping)
				if (typingIndex !== -1) {
					chat.messages.splice(typingIndex, 1)
				}
				if (replyText) {
					const replyTime = new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0')
					chat.messages.push({
						text: replyText,
						time: replyTime,
						sender: chat.name,
						timestamp: new Date().getTime(),
						isTemp: false
					})
					chat.lastMessage = replyText
					chat.time = replyTime
				}
			
			})
    } else if (chat.isGroup) {
      await chatService.sendGroupMessage(currentMesh.value, chat.creator, chat.groupId, text)
    } else {
      await chatService.sendMessage(currentMesh.value, chat.name, text)
    }
  } catch (error) {
    console.error('发送消息失败:', error)
  } finally {
    sending.value = false
  }
  
  const now = new Date()
  const time = now.getHours().toString().padStart(2, '0') + ':' + 
               now.getMinutes().toString().padStart(2, '0')
  
  if (!chat.messages) {
    chat.messages = []
  }
  
  chat.messages.push({
    text: text,
    time: time,
    sender: currentMeshAgentUsername.value,
    timestamp: now.getTime(),
    isTemp: true
  })
  
  chat.lastMessage = text
  chat.time = time
  
  newMessage.value = ''
}

const switchMesh = async (meshName) => {
  currentMesh.value = meshName
  const mesh = meshes.value.find(m => m.name === meshName)
  currentMeshAgentUsername.value = mesh?.agent?.username || ''
  chats.value = chats.value.filter(c => !c.isTemp)
  await fetchChats()
}

const users = ref([])

const fetchUsers = async () => {
  if (!currentMesh.value) return
  try {
    const response = await chatService.getUsers(currentMesh.value)
    users.value = response.data
  } catch (error) {
    console.error('获取用户列表失败:', error)
  }
}

const selectUser = async (user) => {
  const existingChat = chats.value.find(c => c.name === user.name)
  if (existingChat) {
    const index = chats.value.indexOf(existingChat)
    activeChat.value = index
    if (chats.value[index]) {
      chats.value[index].updated = 0
    }
  } else {
    const newChat = {
      id: 'dm-' + Date.now(),
      name: user.name,
      time: '',
      lastMessage: '',
      updated: 0,
      messages: [],
      isTemp: true
    }
    chats.value.unshift(newChat)
    activeChat.value = 0
  }
}

const selectOpenclawAgent = async (agent) => {
  const chat = chats.value.find(c => c.isOpenclaw && c.agentId === agent.id)
  if (chat) {
    activeChat.value = chats.value.indexOf(chat)
    if (!chat.sessions || chat.sessions.length === 0) {
      try {
        const response = await openclawService.getSessions(agent.id)
        const rawData = response.data
        let sessions = []
        try {
          const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
          sessions = parsed?.sessions || []
        } catch (e) {
          console.error('解析 sessions 失败:', e)
        }
        openclawSessions.value = sessions
        chat.sessions = sessions
        const defaultSessionId = sessions.length > 0 ? String(sessions[0].sessionId) : null
        if (defaultSessionId) {
          const historyResponse = await openclawService.getSessionHistory(agent.id, defaultSessionId)
          let historyData = null
          try {
            historyData = JSON.parse(`[${historyResponse.data.replaceAll('\n',',')}{}]`)
          } catch (e) {
            console.error('解析 history 失败:', e)
          }
					chat.messages = [];
          historyData.filter((n)=>n.type=='message').forEach((n,i)=>{
						console.log(n.message.content)
						const text = n.message.content.filter((n)=>n.type=='text')[0]?.text;
						if(!!text){
							chat.messages.push(
							{ 
								"text": n.message.content.filter((n)=>n.type=='text')[0]?.text, 
								"time": new Date(n.message.timestamp).toLocaleTimeString(), 
								"sender": n.message.role, "isSent": n.message.role=='user', "timestamp": n.message.timestamp }
							)
						}
					})
          chat.sessionId = defaultSessionId
        }
        chat.isTemp = false
      } catch (error) {
        console.error('获取 sessions 失败:', error)
      }
    }
  }
}

const switchOpenclawSession = async (chat, sessionId) => {
  try {
    const response = await openclawService.getSessionHistory(chat.agentId, sessionId)
    let data = null
    try {
      data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    } catch (e) {
      console.error('解析 history 失败:', e)
    }
    chat.messages = data?.messages || []
    chat.sessionId = sessionId
  } catch (error) {
    console.error('获取历史消息失败:', error)
  }
}

const createGroupChat = async (selectedUsers, groupName) => {
  if (!currentMesh.value || !currentMeshAgentUsername.value || selectedUsers.length < 2) return
  
  const creator = currentMeshAgentUsername.value
  const groupId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
  
  const members = [creator, ...selectedUsers.map(u => u.name)]
  
  try {
    await chatService.createGroup(currentMesh.value, creator, groupId, {
      name: groupName,
      members: members
    })
    
    await chatService.sendGroupMessage(currentMesh.value, creator, groupId, `${groupName} 已创建`)
    
    await fetchChats()
    
    const newChat = chats.value.find(c => c.groupId === groupId)
    if (newChat) {
      activeChat.value = chats.value.indexOf(newChat)
    }
  } catch (error) {
    console.error('创建群组失败:', error)
  }
}

provide('switchMesh', switchMesh)
provide('meshes', meshes)
provide('openclawAgents', openclawAgents)
provide('fetchUsers', fetchUsers)
provide('users', users)
provide('selectUser', selectUser)
provide('createGroupChat', createGroupChat)

const startChatsPolling = () => {
  stopChatsPolling()
  chatsPollTimer = setInterval(fetchChats, 3000)
}

const stopChatsPolling = () => {
  if (chatsPollTimer) {
    clearInterval(chatsPollTimer)
    chatsPollTimer = null
  }
}

onMounted(() => {
  fetchMeshes().then(() => {
    startChatsPolling()
  })
  fetchOpenclawAgents()
})

onUnmounted(() => {
  stopChatsPolling()
})
</script>

<style scoped>
.chat-container {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: var(--bg-primary);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-chat);
  color: var(--text-primary);
}

.empty-icon {
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 14px;
}

@media (max-width: 768px) {
  .chat-container {
    flex-direction: column;
  }
}
</style>
