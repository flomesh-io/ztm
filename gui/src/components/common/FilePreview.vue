<script setup>
import { computed, onMounted, ref } from 'vue';
import { isImage, isVideo,isAudio,isPdf,isText,checker,bitUnit,labels, colors,icons } from '@/utils/file';

const props = defineProps(['file','class']);
const fileContent = ref('');
const viewHeight = computed(() => windowHeight.value - 50);
const ext = computed(()=>{
	return props.file?.fileUrl.split(".")[props.file?.fileUrl.split(".").length-1]
})
//||  isPdf(ext.value)
const isSupported = computed(() => isImage(ext.value) || isVideo(ext.value) || isAudio(ext.value) || isText(ext.value) );

const fileType = computed(() => {
  if (isImage(ext.value)) return `image/${ext.value}`;
  if (isVideo(ext.value)) return `video/${ext.value}`;
  if (isAudio(ext.value)) return `audio/${ext.value}`;
  if (isText(ext.value)) return `text/plain`;
  if (isPdf(ext.value)) return 'application/pdf';
  return '';
});

const stateColor = ref(colors);
const stateLabel = computed(()=>(item)=>labels(item, true))
onMounted(()=>{
	if (isText(ext.value)) {
		fetch(props.file?.fileUrl.replace('http://127.0.0.1:7777',''))
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
  <div v-if="isSupported" class="preview-container" :class="props?.class || 'w-full'">
    <template v-if="isImage(ext)">
      <img :src="props.file?.fileUrl" alt="Image Preview" class="preview-image" width="100%"/>
    </template>
    <template v-else-if="isVideo(ext)">
      <video controls class="preview-video w-full" width="100%">
        <source :src="props.file?.fileUrl" :type="fileType" />
      </video>
    </template>
    <template v-else-if="isAudio(ext)">
      <audio controls class="preview-audio" :class="props?.class || 'w-full'">
        <source :src="props.file?.fileUrl" :type="fileType" />
      </audio>
    </template>
		<template v-else-if="isText(ext)">
			<pre class="preview-text w-full mx-2">{{ fileContent }}</pre>
		</template>
    <template v-else-if="isPdf(ext)">
      <iframe :src="props.file?.fileUrl" class="preview-pdf" width="100%" frameborder="0" :height="viewHeight" :class="props?.class || 'w-full'"></iframe>
    </template>
    <!-- Add more supported types here -->
  </div>
	<div v-else class="relative text-center file-block w-full" style="padding-top: 120px;" :key="hid">
			<img :src="checker({...props.file,name:props.file?.path})" class="pointer noEvent noSelect" height="40"  style="border-radius: 4px; overflow: hidden;margin: auto;"/>
			<div class="mt-1" v-tooltip="file">
				<b class="multiline-ellipsis noSelect">
					{{ props.file?.path }}
				</b>
			</div>
			<div class="mt-1"  v-if="props.file?.ext!='/' && props.file?.downloading!=null">
				<ProgressBar :value="props.file?.downloading*100" class="w-3rem" style="height: 6px;margin: auto;"><span></span></ProgressBar>
			</div>
			<Tag v-tooltip="props.file?.error?.message" v-if="props.file?.ext!='/' && props.file?.state!='synced'"  :severity="stateColor[stateLabel(props.file)]" class="py-0 px-1 mt-2" >
				{{stateLabel(detailData[file.path])}}
			</Tag>
			<div v-if="props.file?.ext!='/' && props.file?.size" class="text-sm opacity-60 mt-1">{{bitUnit(props.file?.size)}}</div>
	</div>
  <!-- <iframe v-else :src="props.file?.fileUrl" class="unsupported-file-preview" width="100%" frameborder="0" :height="viewHeight" :class="props?.class || 'w-full'"></iframe> -->
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
  background-color: var(--p-surface-ground);
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