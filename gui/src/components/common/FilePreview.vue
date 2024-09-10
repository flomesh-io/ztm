<template>
  <div v-if="isSupported" class="preview-container" :class="class">
    <template v-if="isImage">
      <img :src="props.src" alt="Image Preview" class="preview-image" width="100%"/>
    </template>
    <template v-else-if="isVideo">
      <video controls class="preview-video" width="100%">
        <source :src="props.src" :type="fileType" />
      </video>
    </template>
    <template v-else-if="isAudio">
      <audio controls class="preview-audio" :class="class">
        <source :src="props.src" :type="fileType" />
      </audio>
    </template>
		<template v-else-if="isText">
			<pre class="preview-text w-full">{{ fileContent }}</pre>
		</template>
    <template v-else-if="isPdf">
      <iframe :src="props.src" class="preview-pdf" width="100%" frameborder="0" :height="viewHeight" :class="class"></iframe>
    </template>
    <!-- Add more supported types here -->
  </div>
  <iframe v-else :src="props.src" class="unsupported-file-preview" width="100%" frameborder="0" :height="viewHeight" :class="class"></iframe>
</template>

<script setup>
import { computed, onMounted } from 'vue';

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
const supportedFileTypes = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
  video: ['mp4', 'webm', 'ogg'],
  audio: ['mp3', 'wav', 'ogg'],
	text: ['txt', 'html', 'js', 'css', 'json', 'xml', 'md'],
  pdf: ['pdf']
  // Add more supported formats as needed
};

const isImage = computed(() => supportedFileTypes.image.includes(ext.value));
const isVideo = computed(() => supportedFileTypes.video.includes(ext.value));
const isAudio = computed(() => supportedFileTypes.audio.includes(ext.value));
const isPdf = computed(() => supportedFileTypes.pdf.includes(ext.value));
const isText = computed(() => supportedFileTypes.text.includes(props.ext));
const isSupported = computed(() => isImage.value || isVideo.value || isAudio.value || isText.value ||  isPdf.value);

const fileType = computed(() => {
  if (isImage.value) return `image/${ext.value}`;
  if (isVideo.value) return `video/${ext.value}`;
  if (isAudio.value) return `audio/${ext.value}`;
  if (isText.value) return `text/plain`;
  if (isPdf.value) return 'application/pdf';
  return '';
});
onMounted(()=>{
	if (isText.value) {
		fetch(props.fileUrl)
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

<style scoped>
.preview-container {
  display: flex;
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
  white-space: pre-wrap;
  word-wrap:break-word;
  background-color: #f5f5f5;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: auto;
}

.unsupported-file-preview {
  width: 100%;
  height: 100%;
  border: none;
}
</style>