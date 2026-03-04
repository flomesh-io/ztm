<template>
  <aside class="sidebar">
    <div class="workspace-header" @click="toggleDropdown" ref="headerRef">
      <div class="workspace-name">
        <span class="workspace-emoji">💬</span>
        <span class="workspace-text">{{ currentMesh }}</span>
      </div>
      <button class="workspace-dropdown">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path fill="currentColor" d="M6 8L1 3h10z"/>
        </svg>
      </button>
    </div>
    
    <div v-if="showDropdown" class="mesh-dropdown" :style="dropdownStyle">
      <div 
        v-for="mesh in meshes" 
        :key="mesh.name"
        class="mesh-item"
        :class="{ active: mesh.name === currentMesh }"
        @click="selectMesh(mesh.name)"
      >
        <span class="mesh-name">{{ mesh.name }}</span>
        <span class="mesh-status" :class="{ online: mesh.agent?.connected }"></span>
      </div>
    </div>
    
    <div class="sidebar-content">
			<div class="sidebar-section">
			  <div class="section-header">
			    <span class="section-arrow">▶</span>
			    <span class="section-title">My Agents</span>
			  </div>
			  
			  <div class="chat-list">
			    <div 
			      v-for="agent in openclawAgents" 
			      :key="agent.id"
			      class="chat-item"
			      :class="{ active: getChatIndex(agent.id, true) === activeChat }"
			      @click="$emit('selectOpenclaw', agent)"
			    >
			      <div class="chat-avatar-wrapper">
			        <div class="avatar-placeholder openclaw-avatar">
			          {{ agent.emoji }}
			        </div>
			      </div>
			      <div class="chat-info">
			        <span class="chat-name">{{ agent.name }}</span>
			      </div>
			    </div>
			  </div>
			</div>
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-arrow">▶</span>
          <span class="section-title">Claw Party</span>
          <button class="section-add" @click.stop="toggleUserPopup">+</button>
        </div>
        
        <div v-if="showUserPopup" class="user-popup" :style="userPopupStyle">
          <div class="user-popup-header">
            <span>选择用户 (已选{{ selectedUsers.length }}人)</span>
            <button class="close-btn" @click="showUserPopup = false">×</button>
          </div>
          <div class="user-list">
            <div 
              v-for="user in users" 
              :key="user.name"
              class="user-item"
              :class="{ selected: isUserSelected(user) }"
              @click="handleSelectUser(user)"
            >
              <input 
                type="checkbox" 
                :checked="isUserSelected(user)"
                @click.stop
                @change="handleSelectUser(user)"
              >
              <div class="user-avatar">{{ user.name[0] }}</div>
              <span class="user-name">{{ user.name }}</span>
              <span class="user-online-status" :class="{ online: user.endpoints?.instances?.[0]?.online }"></span>
            </div>
          </div>
          <div v-if="selectedUsers.length >= 1" class="user-popup-footer">
            <button class="create-group-btn" @click="handleCreateChat">
              {{ selectedUsers.length === 1 ? '创建单聊' : `创建群组 (${selectedUsers.length}人)` }}
            </button>
          </div>
        </div>
        
        <div class="chat-list">
          <div 
            v-for="(chat, index) in filteredChats" 
            :key="chat.id"
            class="chat-item"
            :class="{ active: getChatIndex(chat.id) === activeChat }"
            @click="$emit('select', getChatIndex(chat.id))"
						v-show="!chat?.isOpenclaw"
          >
            <div class="chat-avatar-wrapper">
              <div class="avatar-placeholder" :style="{ background: getAvatarColor(chat.name) }">
                {{ chat.name[0].toUpperCase() }}
              </div>
              <span v-if="chat.updated > 0" class="unread-badge">{{ chat.updated > 99 ? '99+' : chat.updated }}</span>
            </div>
            <div class="chat-info">
              <span class="chat-name">{{ chat.name }}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </aside>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { getAvatarColor } from '../utils/avatar'

const props = defineProps({
  chats: {
    type: Array,
    required: true
  },
  activeChat: {
    type: Number,
    default: null
  }
})

defineEmits(['select', 'selectOpenclaw'])

const currentMesh = inject('currentMesh')
const meshes = inject('meshes')
const openclawAgents = inject('openclawAgents')
const switchMesh = inject('switchMesh')
const fetchUsers = inject('fetchUsers')
const users = inject('users')
const selectUser = inject('selectUser')
const createGroupChat = inject('createGroupChat')

const showDropdown = ref(false)
const showUserPopup = ref(false)
const selectedUsers = ref([])
const dropdownStyle = ref({})
const userPopupStyle = ref({})
const headerRef = ref(null)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const toggleUserPopup = async () => {
  if (!showUserPopup.value) {
    await fetchUsers()
    selectedUsers.value = []
  }
  showUserPopup.value = !showUserPopup.value
}

const handleSelectUser = (user) => {
  const index = selectedUsers.value.findIndex(u => u.name === user.name)
  if (index === -1) {
    selectedUsers.value.push(user)
  } else {
    selectedUsers.value.splice(index, 1)
  }
}

const isUserSelected = (user) => {
  return selectedUsers.value.some(u => u.name === user.name)
}

const handleCreateChat = async () => {
  if (selectedUsers.value.length === 0) return
  
  if (selectedUsers.value.length === 1) {
    await selectUser(selectedUsers.value[0])
  } else {
    await handleCreateGroup()
  }
  selectedUsers.value = []
  showUserPopup.value = false
}

const handleCreateGroup = async () => {
  if (selectedUsers.value.length < 2) return
  
  const groupName = selectedUsers.value.map(u => u.name).join(',')
  await createGroupChat(selectedUsers.value, groupName)
}

const selectMesh = async (meshName) => {
  await switchMesh(meshName)
  showDropdown.value = false
}

const handleClickOutside = (event) => {
  if (headerRef.value && !headerRef.value.contains(event.target) && !event.target.closest('.mesh-dropdown')) {
    showDropdown.value = false
  }
  if (!event.target.closest('.user-popup') && !event.target.closest('.section-add')) {
    showUserPopup.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const searchQuery = ref('')

const filteredChats = computed(() => {
  if (!searchQuery.value) return props.chats
  const query = searchQuery.value.toLowerCase()
  return props.chats.filter(chat => 
    chat.name.toLowerCase().includes(query) ||
    chat.lastMessage.toLowerCase().includes(query)
  )
})

const getChatIndex = (chatId, isOpenclaw = false) => {
  return props.chats.findIndex(chat => chat.id === chatId && Boolean(chat.isOpenclaw) === isOpenclaw)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--slack-purple);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
}

.workspace-header {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
}

.workspace-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-emoji {
  font-size: 18px;
}

.workspace-text {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.workspace-dropdown {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workspace-dropdown:hover {
  background: rgba(255, 255, 255, 0.2);
}

.mesh-dropdown {
  position: absolute;
  top: 48px;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin: 4px 8px;
  z-index: 100;
  overflow: hidden;
}

.mesh-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.mesh-item:hover {
  background: var(--bg-hover);
}

.mesh-item.active {
  background: var(--slack-aubergine);
  color: #fff;
}

.mesh-name {
  font-size: 14px;
  font-weight: 500;
}

.mesh-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.mesh-status.online {
  background: var(--slack-green);
}

.workspace-header {
  cursor: pointer;
  position: relative;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.sidebar-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 4px 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
}

.section-header:hover {
  color: #fff;
}

.section-arrow {
  font-size: 8px;
  margin-right: 6px;
  transition: transform 0.15s;
}

.section-title {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 11px;
}

.section-add {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  font-weight: 400;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-add:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.user-popup {
  position: absolute;
  top: 90px;
  left: 8px;
  right: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.user-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.user-popup-header span {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.user-list {
  overflow-y: auto;
  max-height: 250px;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.user-item:hover {
  background: var(--bg-hover);
}

.user-item.selected {
  background: #f0f0ff;
}

.user-item input[type="checkbox"] {
  margin-right: 10px;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(135deg, #1d9bd1, #2eb67d);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  margin-right: 10px;
}

.user-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.user-online-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.user-online-status.online {
  background: var(--slack-green);
}

.user-popup-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border-subtle);
}

.create-group-btn {
  width: 100%;
  padding: 10px;
  background: var(--slack-purple);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.create-group-btn:hover {
  background: var(--slack-aubergine);
}

.chat-list {
  margin-top: 2px;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 5px 16px;
  height: 42px;
  cursor: pointer;
  transition: background 0.1s;
  margin-bottom: 5px;
}

.chat-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chat-item.active {
  background: var(--slack-aubergine);
}

.chat-avatar-wrapper {
  position: relative;
  margin-right: 10px;
}

.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.openclaw-avatar {
  background: linear-gradient(135deg, #ff6b6b, #ffa500);
  font-size: 18px;
}

.status-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background: var(--slack-green);
  border-radius: 50%;
  border: 2px solid var(--slack-purple);
}

.unread-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  background: #e01e5a;
  border-radius: 9px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border: 2px solid var(--slack-purple);
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-name {
  color: #e8e8e8;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item.active .chat-name {
  color: #fff;
  font-weight: 700;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    height: 48px;
    flex-direction: row;
    align-items: center;
  }
  
  .workspace-header {
    width: 180px;
    border-bottom: none;
    box-shadow: none;
  }
  
  .sidebar-content {
    display: none;
  }
}
</style>
