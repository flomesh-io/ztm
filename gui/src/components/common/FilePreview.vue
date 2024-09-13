<script setup>
import { computed, onMounted, ref } from 'vue';
import { isImage, isVideo,isAudio,isPdf,isText } from '@/utils/file';

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  class: {
    type: String,
    required: 'w-full'
  }
});
const fileContent = ref('');
const viewHeight = computed(() => windowHeight.value - 50);
const ext = computed(()=>{
	return props.src.split(".")[props.src.split(".").length-1]
})

const isSupported = computed(() => isImage(ext.value) || isVideo(ext.value) || isAudio(ext.value) || isText(ext.value) ||  isPdf(ext.value));

const fileType = computed(() => {
  if (isImage(ext.value)) return `image/${ext.value}`;
  if (isVideo(ext.value)) return `video/${ext.value}`;
  if (isAudio(ext.value)) return `audio/${ext.value}`;
  if (isText(ext.value)) return `text/plain`;
  if (isPdf(ext.value)) return 'application/pdf';
  return '';
});
onMounted(()=>{
	if (isText(ext.value)) {
		fetch(props.src.replace('http://127.0.0.1:7777',''))
			.then(response => response.text())
			.then(text => {
				fileContent.value = text;
			})
			.catch(error => {
				console.error('Error loading text file:', error);
				fileContent.value = 'Error loading file';
			});
	}
})
</script>

<template>
  <div v-if="isSupported" class="preview-container" :class="class">
    <template v-if="isImage(ext)">
      <img :src="props.src" alt="Image Preview" class="preview-image" width="100%"/>
    </template>
    <template v-else-if="isVideo(ext)">
      <video controls class="preview-video w-full" width="100%">
        <source :src="props.src" :type="fileType" />
      </video>
    </template>
    <template v-else-if="isAudio(ext)">
      <audio controls class="preview-audio" :class="class">
        <source :src="props.src(ext)" :type="fileType" />
      </audio>
    </template>
		<template v-else-if="isText(ext)">
			<pre class="preview-text w-full mx-2">{{ fileContent }}</pre>
		</template>
    <template v-else-if="isPdf(ext)">
      <iframe :src="props.src" class="preview-pdf" width="100%" frameborder="0" :height="viewHeight" :class="class"></iframe>
    </template>
    <!-- Add more supported types here -->
  </div>
  <iframe v-else :src="props.src" class="unsupported-file-preview" width="100%" frameborder="0" :height="viewHeight" :class="class"></iframe>
</template>


<style scoped>
.preview-container {
  display: flex;
	width: 100%;
  justify-content: center;
  align-items: center;
}

.preview-image,
.preview-video,
.preview-audio,
.preview-pdf {
  max-width: 100%;
  max-height: 100%;
}

.preview-text {
  width: 100%;
  height: 100%;
	min-width: 300px;
	min-height: 300px;
	display: block;
	overflow-wrap: break-word;
	white-space: break-spaces;
  word-wrap:break-all;
  background-color: var(--surface-ground);
  padding: 10px;
  border: 0px solid #ccc;
  border-radius: 4px;
  overflow: auto;
}

.unsupported-file-preview {
  width: 100%;
  height: 100%;
  border: none;
}
</style>