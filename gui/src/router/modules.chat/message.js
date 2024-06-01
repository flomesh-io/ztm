const message = {
  path: "message",
  name: "Message",
	redirect: "/message/list",
  children: [
		{
				path: '/message/list',
				name: 'message',
				component: () => import('@/views.chat/message/MessageList.vue')
		},
  ],
};

export default message;
