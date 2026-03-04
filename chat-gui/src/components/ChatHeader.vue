<template>
  <header class="chat-header">
    <div class="header-left">
      <h3 class="channel-name">
        <span class="channel-icon">#</span>
        {{ chat.name }}
      </h3>
      <div class="header-divider"></div>
      <div class="header-info">
        <span class="topic">{{ chat.lastMessage }}</span>
      </div>
    </div>
    <div class="header-right">
      <div class="header-icons">
        <div v-if="chat.isOpenclaw && openclawSessions && openclawSessions.length > 0" class="session-select-wrapper">
          <select 
            class="session-select" 
            :value="chat.sessionId" 
            @change="$emit('switchSession', $event.target.value)"
          >
            <option v-for="session in openclawSessions" :key="String(session.sessionId)" :value="String(session.sessionId)">
              {{ String(session.sessionId).slice(0, 8) }}
            </option>
          </select>
        </div>
        <!-- <button class="header-btn" title="成员">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 8a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/>
            <path d="M14 10a2 2 0 11-4 0 2 2 0 014 0z" opacity="0.5"/>
          </svg>
        </button> -->
       <!-- <button class="header-btn" title="搜索">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="9" r="7"/>
            <path d="M16 16l-3-3"/>
          </svg>
        </button> -->
        <button class="header-btn" title="设置">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </button>
      </div>
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
        </svg>
        <input type="text" v-model="searchQuery" placeholder="搜索消息">
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  chat: {
    type: Object,
    required: true
  },
  openclawSessions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['search', 'switchSession'])

const searchQuery = ref('')

watch(searchQuery, (val) => {
  emit('search', val)
})
</script>

<style scoped>
.chat-header {
  height: var(--header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.channel-name {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.channel-icon {
  color: var(--text-dim);
}

.header-divider {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.15);
  margin: 0 12px;
}

.header-info {
  min-width: 0;
}

.topic {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  display: block;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-select-wrapper {
  display: flex;
  align-items: center;
}

.session-select {
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}

.session-select:hover {
  background: #fff;
  border-color: var(--slack-blue);
}

.header-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-box {
  position: relative;
}

.search-box input {
  width: 180px;
  padding: 6px 12px 6px 32px;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.15s;
}

.search-box input:focus {
  width: 240px;
  background: #fff;
  border-color: var(--slack-blue);
}

.search-box input::placeholder {
  color: var(--text-secondary);
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .search-box {
    display: none;
  }
  
  .header-divider,
  .header-info {
    display: none;
  }
}
</style>
