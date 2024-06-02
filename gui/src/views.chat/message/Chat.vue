<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import 'deep-chat';
onActivated(()=>{
})
const emits = defineEmits(['back']);
const props = defineProps(['ep']);
const initialMessages = ref([
	{"text": "Hey, how are you?", "role": "user"},
	{"text": "I am doing great, thanks.", "role": "ai"},
	{"text": "What is the meaning of life?", "role": "user"},
	{"text": "Seeking fulfillment and personal growth.", "role": "ai"}
]);
const user = ref({ id: '123', name: 'John Doe' })

const sendMessage = (text) => {
	alert(text)
}
const handleFileUpload = (file) => {
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 36);

const back = () => {
	emits('back')
}
const hasMediaDevices = computed(() => !!navigator.mediaDevices && false);
//navigator.mediaDevices
</script>

<template>
	<AppHeader :back="back">
	    <template #center>
				<Status :run="true" />
	      <b>client (root)</b>
	    </template>
	
	    <template #end> 
				<Button icon="pi pi-print" class="mr-2" severity="secondary" text />
				<Button icon="pi pi-user" severity="secondary" text />
			</template>
	</AppHeader>
	<div style="width: 100%;height: 100%;flex: 1;margin: 0;display: flex;flex-direction: column;">
	<deep-chat
		style="width: 100%;flex: 1;border: none"
		:style="{'height': `${viewHeight}px`}"
	  :initialMessages="initialMessages"
		:messageStyles='{
			"default": {
				"user": {"bubble": {"backgroundColor": "#9855f7"}}
		}}'
		:avatars="true"
		:inputAreaStyle='{"backgroundColor": "#F4F6F7"}'
		:textInput='{
			placeholder: { text: "Welcome to the demo!" },
			"styles": {
				"container": {
					"backgroundColor": "#fefefe",
					"border": "none",
					"boxShadow": "none"
				},
				"text": {"padding": "10px", "paddingLeft": "15px", "paddingRight": "34px"}
			}
		}'
		:submitButtonStyles='{
			"position": "outside-right",
			"submit": {
				"container": {
					"default": {
						"top": "13px",
						"width": "1.6em",
						"height": "1.6em",
						"justifyContent": "center",
						"display": "flex",
						"borderRadius": "25px",
						"padding": "0.5em",
						"color": "#fff",
						"backgroundColor": "unset",
						
					},
					"hover": {"backgroundColor": "#f4f3ff","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"},
					"click": {"backgroundColor": "#f4f3ff","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"}
				},
				"svg": {
					"content": "<?xml version=\"1.0\" encoding=\"utf-8\"?> <svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m21.426 11.095-17-8A.999.999 0 0 0 3.03 4.242L4.969 12 3.03 19.758a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81zM5.481 18.197l.839-3.357L12 12 6.32 9.16l-.839-3.357L18.651 12l-13.17 6.197z\"/></svg>",
					"styles": {
						"default": {
							"width": "1.5em",
							"filter":
								"brightness(0) saturate(100%) invert(10%) sepia(86%) saturate(6044%) hue-rotate(205deg) brightness(100%) contrast(100%)"
						}
					}
				}
					
			}
		}'
		:microphone='hasMediaDevices?{
			"button": {
				"default": {
					"container": {"default": {"bottom": "1em", "right": "0.6em", "borderRadius": "20px", "width": "1.9em", "height": "1.9em"}},
					"svg": {"styles": {"default": {"bottom": "0.35em", "left": "0.35em"}}}
				},
				"position": "inside-right"
			}
		}:false'
		auxiliaryStyle="
			::-webkit-scrollbar-thumb {
				background-color: #9855f7;
		}"
		:dropupStyles='{
			"button": {
				"styles": {
					"container": {
						"default": {
							"width": "2.2em",
							"height": "2.2em",
						},
						"hover": {"backgroundColor": "#f4f3ff"},
						"click": {"backgroundColor": "#f7edff"}
					},
					"svg": {"styles": {"default": {"fontSize": "1.3em"}}}
				}
			},
			"menu": {
				"container": {
					"boxShadow": "#e2e2e2 0px 1px 3px 2px"
				},
				"item": {
					"hover": {
						"backgroundColor": "#f4f3ff"
					},
					"click": {
						"backgroundColor": "#f4f3ff"
					}
				},
				"iconContainer": {
					"width": "1.8em"
				},
				"text": {
					"fontSize": "1.05em"
				}
			}
		}'
		:demo="true"
		:stream="true"
		:images='{
		
			"button": {
				"styles": {
					"container": {
						"default": {
							"width": "2.2em",
							"height": "2.2em",
						},
						"hover": {"backgroundColor": "#f4f3ff"},
						"click": {"backgroundColor": "#f7edff"}
					},
					"svg": {"styles": {"default": {"fontSize": "1.3em"}}}
				}
			},
			
		}'
		:camera='hasMediaDevices?{"button": {"position": "dropup-menu"}}:false'
	  />
	</div>
</template>

<style lang="scss">
	
	#container{
		height: 100%;
	}
	.outside-left{
		bottom: 1em !important;
	}
</style>