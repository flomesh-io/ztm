import AppLayout from '@/layout/AppLayout.vue';
const chat = {
  path: "/chat",
  name: "Chat",
	redirect: "/chat/rooms",
  children: [
		{
				path: '/chat/rooms',
				name: 'chat',
				component: () => import('@/views/chat/Main.vue')
		},
  ],
};
if(!window.__TAURI_INTERNALS__ ){
	chat.component = AppLayout;
}
export default chat;
