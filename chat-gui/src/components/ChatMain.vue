<template>
  <main class="chat-main">
    <ChatHeader :chat="chat" :openclawSessions="openclawSessions" @search="handleSearch" @switchSession="$emit('switchSession', $event)" />
    <div class="messages" ref="messagesContainer">
      <div class="date-divider">
        <span>{{ currentDate }}</span>
      </div>
      <div 
        v-for="(msg, index) in filteredMessages" 
        :key="index"
        class="message"
        :class="{ sent: isMessageSent(msg), typing: msg.isTyping }"
      >
        <div class="message-avatar">
          <div v-if="chat.isOpenclaw && !isMessageSent(msg) && !msg.isTyping" class="avatar-emoji">
            {{ chat.emoji }}
          </div>
          <div v-else-if="msg.isTyping && chat.isOpenclaw" class="avatar-emoji">
            {{ chat.emoji }}
          </div>
          <div v-else-if="!msg.isTyping" class="avatar-placeholder" :style="{ background: getAvatarColor(isMessageSent(msg) ? (currentUserName || 'You') : chat.name) }">
            {{ (isMessageSent(msg) ? (currentUserName || 'You') : chat.name)[0].toUpperCase() }}
          </div>
        </div>
        <div class="message-body">
          <div v-if="msg.isTyping" class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          <template v-else>
            <div class="message-header">
              <span class="message-author">{{ isMessageSent(msg) ? (currentUserName || 'You') : chat.name }}</span>
              <span class="message-time">{{ msg.time }}</span>
            </div>
            <div class="message-bubble">
              <div class="message-content" v-html="renderMarkdown(msg.text)"></div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <MessageInput :chatName="chat.name" :loading="sending" :modelValue="modelValue" @update:modelValue="$emit('update:modelValue', $event)" @send="$emit('send')" />
  </main>
</template>

<script setup>
import { ref, watch, nextTick, computed, onUnmounted } from 'vue'
import { marked } from 'marked'
import ChatHeader from './ChatHeader.vue'
import MessageInput from './MessageInput.vue'
import { chatService } from '../services/chatService'
import { getAvatarColor } from '../utils/avatar'

marked.setOptions({
  breaks: true,
  gfm: true
})

const props = defineProps({
  chat: {
    type: Object,
    required: true
  },
  meshName: {
    type: String,
    default: ''
  },
  currentUserName: {
    type: String,
    default: ''
  },
  sending: {
    type: Boolean,
    default: false
  },
  openclawSessions: {
    type: Array,
    default: () => []
  },
  	
  modelValue: String
})

defineEmits(['send', 'update:modelValue', 'switchSession'])

const messagesContainer = ref(null)
let pollTimer = null
const searchQuery = ref('')

defineExpose({})

const currentDate = computed(() => {
  const now = new Date()
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  return now.toLocaleDateString('zh-CN', options)
})

const handleSearch = (query) => {
  searchQuery.value = query
}

const filteredMessages = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.chat.messages || []
  }
  const query = searchQuery.value.toLowerCase()
  return (props.chat.messages || []).filter(msg => 
    msg.text && msg.text.toLowerCase().includes(query)
  )
})

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

const renderMarkdown = (text) => {
  if (!text) return ''
  return marked.parse(text)
}

const isMessageSent = (msg) => {
  return msg.isSent || msg.sender === props.currentUserName
}

const parseMessages = (data) => {
  return data.map(item => ({
    text: item.message?.text || '',
    time: formatTime(item.time),
    sender: item.sender,
    isSent: item.sender === props.currentUserName,
    timestamp: item.time
  }))
}

const fetchMessages = async () => {
  if (!props.meshName || !props.chat.name) return
  
  try {
    let response
    if (props.chat.isGroup) {
      response = await chatService.getGroupMessages(props.meshName, props.chat.creator, props.chat.groupId)
    } else {
      response = await chatService.getMessages(props.meshName, props.chat.name)
    }
    const messages = parseMessages(response.data || [])
    props.chat.messages = messages
    scrollToBottom()
  } catch (error) {
    if (error.response?.status === 404) {
      props.chat.messages = []
    } else {
      console.error('获取消息失败:', error)
    }
  }
}

const pollMessages = async () => {
  if (!props.meshName || !props.chat.name) return
  
  const sinceTimestamp = Date.now() - (30 * 1000)
  
  try {
    let response
    if (props.chat.isGroup) {
      response = await chatService.getGroupMessagesSince(props.meshName, props.chat.creator, props.chat.groupId, sinceTimestamp)
    } else {
      response = await chatService.getMessagesSince(props.meshName, props.chat.name, sinceTimestamp)
    }
    if (response.data?.length > 0) {
      const newMessages = parseMessages(response.data)
      newMessages.forEach(newMsg => {
        const existingIndex = props.chat.messages.findIndex(m => 
          m.sender === newMsg.sender && m.text === newMsg.text
        )
        if (existingIndex !== -1) {
          if (props.chat.messages[existingIndex].isTemp) {
            props.chat.messages[existingIndex] = newMsg
          }
        } else {
          props.chat.messages.push(newMsg)
        }
      })
      scrollToBottom()
    }
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error('轮询消息失败:', error)
    }
  }
}

const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(pollMessages, 1000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => props.chat.name, () => {
  if (props.chat.name) {
    fetchMessages().then(() => {
      startPolling()
    })
  }
}, { immediate: true })

watch(() => props.chat.messages?.length, () => {
  scrollToBottom()
}, { immediate: true })

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-chat);
  min-width: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.date-divider {
  display: flex;
  align-items: center;
  margin: 28px 0 20px;
  padding-top: 20px;
}

.date-divider::before,
.date-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
}

.date-divider span {
  padding: 0 16px;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.message {
  display: flex;
  padding: 2px 0;
  margin-top: 20px;
  position: relative;
}

.message:hover {
  background: rgba(0, 0, 0, 0.02);
}

.message.sent {
  flex-direction: row-reverse;
}

.message-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.message.sent .message-avatar {
  margin-right: 0;
  margin-left: 12px;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  cursor: pointer;
}

.avatar-placeholder:hover {
  opacity: 0.9;
}

.avatar-emoji {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
}

.message-body {
  flex: 1;
  min-width: 0;
  max-width: 80%;
}

.message.sent .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-header {
  display: flex;
  align-items: baseline;
  margin-bottom: 4px;
}

.message.sent .message-header {
  flex-direction: row-reverse;
}

.message-author {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  margin-right: 8px;
  cursor: pointer;
}

.message-author:hover {
  text-decoration: underline;
}

.message.sent .message-author {
  margin-right: 0;
  margin-left: 8px;
}

.message-time {
  color: var(--text-dim);
  font-size: 11px;
}

.message-bubble {
  background: #f2f0f0;
  border-radius: 12px;
  padding: 11px 15px;
  position: relative;
  max-width: 600px;
  width: fit-content;
}

.message.sent .message-bubble {
  background: var(--slack-purple);
}

.message.sent .message-bubble::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  border: 8px solid transparent;
  border-right-color: var(--slack-purple);
}

.message:not(.sent) .message-bubble::before {
  content: '';
  position: absolute;
  right: -8px;
  top: 12px;
  border: 8px solid transparent;
  border-left-color: #f2f0f0;
}

.message-content {
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.4667;
  word-wrap: break-word;
}

.message.sent .message-content {
  color: #ffffff;
}

.message-content :deep(p) {
  margin: 0 0 8px 0;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(code) {
  background: rgba(0, 0, 0, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: 13px;
}

.message.sent .message-content :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-content :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-content :deep(pre code) {
  background: none;
  padding: 0;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-content :deep(blockquote) {
  border-left: 3px solid var(--text-secondary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--text-secondary);
}

.message-content :deep(a) {
  color: var(--slack-blue);
  text-decoration: none;
}

.message.sent .message-content :deep(a) {
  color: #fff;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-hover);
  border-radius: 8px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

.message-content :deep(strong) {
  font-weight: 700;
}

.message-content :deep(em) {
  font-style: italic;
}

@media (max-width: 768px) {
  .chat-main {
    height: calc(100vh - 48px);
  }
  
  .message-body {
    max-width: 85%;
  }
}
</style>
