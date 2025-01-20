<template>
  <div class="avatar-wrapper" :style="{ width: `${props.size}px`, height: `${props.size}px` }">
    <img :src="avatarUrl" :alt="props.username" class="avatar" />
  </div>
</template>

<script setup>
import { useStore } from 'vuex';
import { ref, watch, onMounted,computed } from "vue";
import { generateSvgAndSave } from "@/utils/svgAvatar"; // 引入工具方法

const store = useStore();

// const toggleLeft = () => {
// 	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
// }
// Props: 用户名和宽度
const props = defineProps({
  username: {
    type: String,
    required: '',
  },
  size: {
    type: Number,
    default: 40, // 默认宽度
  },
});


// 监听用户名变化并生成新的 SVG
async function updateAvatar() {
	if(!avatarUrl.value){
		const url = await generateSvgAndSave(props.username); 
		store.commit('account/setAvatar', [props.username, url]);
	}
}
const avatarUrl = computed(()=>{
	return store.getters['account/avatars'][props.username]
})

// 初始化时生成 SVG
onMounted(updateAvatar);

// 监听 `username` 和 `width` 的变化
watch(
  () => props.username,
  () => {
    updateAvatar(); // 用户名变化时重新生成 SVG
  }
);

</script>

<style scoped>
.avatar-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 防止溢出 */
  border-radius: 50%; /* 圆形边框 */
}
.avatar {
  width: 100%;
  height: 100%;
  object-fit: contain; /* 确保内容完整显示 */
}
</style>