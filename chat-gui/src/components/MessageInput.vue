<template>
  <div class="input-area">
    <div class="editor-wrapper">
      <div class="editor-toolbar">
        <button class="toolbar-btn" @click="insertFormat('**', '**')" title="粗体 (Ctrl+B)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.21 13c2.106 0 3.412-1.087 3.412-2.823 0-1.306-.984-2.283-2.324-2.386v-.055a2.176 2.176 0 0 0 1.852-2.14c0-1.51-1.162-2.46-3.014-2.46H3.843V13H8.21zM5.908 4.674h1.696c.963 0 1.517.451 1.517 1.244 0 .834-.629 1.32-1.73 1.32H5.908V4.673zm0 6.788V8.598h1.73c1.216 0 1.88.492 1.88 1.415 0 .943-.643 1.449-1.832 1.449H5.907z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('*', '*')" title="斜体 (Ctrl+I)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.991 11.674 9.53 4.455c.123-.595.246-.71 1.347-.807l.11-.52H7.211l-.11.52c1.06.096 1.128.212 1.005.807L6.57 11.674c-.123.595-.246.71-1.346.806l-.11.52h3.774l.11-.52c-1.06-.095-1.129-.211-1.006-.806z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('`', '`')" title="行内代码">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('```\n', '\n```')" title="代码块">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
            <path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 9.5H5a1 1 0 0 0 0 2h1.354a.5.5 0 0 0 .354-.854l-.854-.854z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('[', '](url)')" title="链接">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
            <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('\n- ', '')" title="无序列表">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('\n1. ', '')" title="有序列表">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
            <path d="M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.312.382.738.327.648-.062 1.129-.533 1.11-1.23-.005-.272.245-.435.76-.532.255-.048.492-.152.687-.2a.626.626 0 0 1 .226-.103.507.507 0 0 1 .339.14c.14.172.224.394.224.646 0 .197-.064.345-.224.461-.18.11-.414.165-.687.159H1.969c-.52 0-.82-.225-.848-.567-.03-.38-.196-.694-.437-.859-.247-.17-.566-.263-.863-.263-.478 0-.87.147-1.16.438-.287.29-.432.7-.432 1.14v.474h2.145z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('\n> ', '')" title="引用">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6zm0 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-6z"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="insertFormat('~~', '~~')" title="删除线">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.527 13.164c-2.153 0-3.589-1.107-3.705-2.81h1.23c.144 1.06 1.254 1.562 2.49 1.562 1.41 0 2.39-.751 2.39-1.961 0-.964-.697-1.541-1.841-1.844H9.88c.093.593.468 1.025 1.303 1.025.86 0 1.536-.468 1.697-1.306H11.5c-.11.625-.564.961-1.482.961-.943 0-1.694-.593-1.694-1.598 0-1.193.751-1.905 2.207-1.905 1.454 0 2.248.752 2.248 2.058 0 .768-.421 1.296-.984 1.296l-1.627-.016z"/>
            <path d="M1.5 8.5a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 0 1h-12a.5.5 0 0 1-.5-.5z"/>
          </svg>
        </button>
        <span class="toolbar-divider"></span>
        <span class="toolbar-spacer"></span>
        <button 
          class="toolbar-btn send-btn" 
          @click="$emit('send')" 
          :disabled="loading"
          :class="{ loading: loading }"
          title="发送 (Ctrl+Enter)"
        >
          <svg v-if="!loading" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
          </svg>
          <svg v-else class="loading-icon" width="18" height="18" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="40" stroke-dashoffset="10"/>
          </svg>
        </button>
      </div>
      <div class="editor-content">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
          @keydown="handleKeydown"
          :placeholder="`发送消息到 #${chatName || 'channel'}`"
          rows="3"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  chatName: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send', 'update:modelValue'])

const textareaRef = ref(null)

const insertFormat = (prefix, suffix) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = props.modelValue
  const selectedText = text.substring(start, end)
  
  const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end)
  emit('update:modelValue', newText)
  
  setTimeout(() => {
    textarea.focus()
    if (selectedText) {
      textarea.setSelectionRange(start + prefix.length, end + prefix.length)
    } else {
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    }
  }, 0)
}

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    insertFormat('**', '**')
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    insertFormat('*', '*')
  } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
    e.preventDefault()
    emit('send')
  }
}
</script>

<style scoped>
.input-area {
  padding: 0 20px 24px;
}

.editor-wrapper {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.15s;
}

.editor-wrapper:focus-within {
  border-color: var(--slack-blue);
  box-shadow: 0 0 0 1px var(--slack-blue);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: #f8f8f8;
  border-bottom: 1px solid var(--border-subtle);
  gap: 2px;
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-primary);
}

.toolbar-btn.send-btn {
  background: var(--slack-purple);
  color: #fff;
  margin-left: auto;
}

.toolbar-btn.send-btn:hover {
  background: var(--slack-aubergine);
}

.toolbar-btn.send-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.toolbar-btn.send-btn.loading {
  opacity: 0.7;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--border-light);
  margin: 0 4px;
}

.toolbar-spacer {
  flex: 1;
}

.editor-content {
  background: #fff;
}

.editor-content textarea {
  width: 100%;
  min-height: 80px;
  max-height: 200px;
  padding: 12px 14px;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}

.editor-content textarea::placeholder {
  color: var(--text-secondary);
}
</style>
