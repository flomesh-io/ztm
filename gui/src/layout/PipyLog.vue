<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
const store = useStore();
const logs = computed(() => {
	return store.getters['account/logs']
});
const emits = defineEmits(['close']);
const hide = () => {
	emits('close','')
}
const clear = () => {
	store.commit('account/setLogs',null);
}
const level = ref('Error');
</script>

<template>
	<ScrollPanel class="container">
	<div class="container_pannel">
	    <div class="container_terminal"></div>
			
			<div class="flex actions">
				<Button  v-tooltip.left="'Clear'"  severity="help" text rounded aria-label="Filter" @click="clear" >
					<i class="iconfont icon-clear" />
				</Button>
				<Button  v-tooltip.left="'Close'"  severity="help" text rounded aria-label="Filter" @click="hide" >
					<i class="pi pi-times " />
				</Button>
			</div>
	   <!-- <div class="terminal_toolbar">
	        <div class="butt">
	            <button class="btn btn-color"></button>
	            <button class="btn"></button>
	            <button class="btn"></button>
	        </div>
	        <p class="user">johndoe@admin: ~</p>
	    </div> -->
	    <div class="terminal_body py-2">
	        <div class="terminal_promt mt-1">
	            <span class="terminal_user">pipy@log: </span>
	            <span class="terminal_location">~</span>
							<div class="flex flex-wrap gap-3 px-3">
							    <div class="flex align-items-center ">
							        <RadioButton v-model="level" inputId="ingredient1" name="pizza" value="All" />
							        <label for="ingredient1" class="ml-2 text-white-alpha-90">All</label>
							    </div>
							    <div class="flex align-items-center">
							        <RadioButton v-model="level" inputId="ingredient2" name="pizza" value="Error" />
							        <label for="ingredient2" class="ml-2 text-white-alpha-90">Error</label>
							    </div>
							</div>

	        </div>
	        <div class="terminal_content px-1 mb-2 mt-2">
						<div 
							v-if="!!logs && logs.length>0" 
							v-for="(log,i) in logs" 
							:key="i"
							v-show="log.level == level || level == 'All'">{{log.msg}}</div>
	        </div>
	        <div class="terminal_promt" v-if="!!logs && logs.length>0">
	            <span class="terminal_user">pipy@log: </span>
	            <span class="terminal_location">~</span>
	            <span class="terminal_bling">$</span>
	            <span class="terminal_cursor"></span>
	        </div>
	    </div>
	</div>
	</ScrollPanel>
</template>

<style lang="scss" scoped>
	.container {
		width: 100%;
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
	}
	:deep(.p-scrollpanel-bar.p-scrollpanel-bar-y){
		opacity: 0.5;
	}
	.actions{
		position: fixed;
		top: 0px;
		right: 10px;
		:deep(.p-button){
			padding-left: 5px;
			padding-right: 5px;
		}
	}
	:deep(.p-radiobutton .p-radiobutton-box){
		background-color: #41403A;
	}
	.terminal_toolbar {
	  display: flex;
	  height: 30px;
	  align-items: center;
	  padding: 0 8px;
	  box-sizing: border-box;
	  border-top-left-radius: 5px;
	  border-top-right-radius: 5px;
	  background: linear-gradient(#504b45 0%, #3c3b37 100%);
	}
	
	.butt {
	  display: flex;
	  align-items: center;
	}
	
	.btn {
	  display: flex;
	  justify-content: center;
	  align-items: center;
	  padding: 0;
	  margin-right: 5px;
	  font-size: 8px;
	  height: 12px;
	  width: 12px;
	  box-sizing: border-box;
	  border: none;
	  border-radius: 100%;
	  background: linear-gradient(#7d7871 0%, #595953 100%);
	  text-shadow: 0px 1px 0px rgba(255,255,255,0.2);
	  box-shadow: 0px 0px 1px 0px #41403A, 0px 1px 1px 0px #474642;
	}
	
	.btn-color {
	  background: #ee411a;
	}
	
	.btn:hover {
	  cursor: pointer;
	}
	
	.btn:focus {
	  outline: none;
	}
	
	.butt--exit {
	  background: linear-gradient(#f37458 0%, #de4c12 100%);
	}
	
	.user {
	  color: #d5d0ce;
	  margin-left: 6px;
	  font-size: 14px;
	  line-height: 15px;
	}
	.container_pannel{
		background: rgba(56, 4, 40, 0.9);
		min-height: 100%;
	}
	.terminal_body {
	  height: calc(100%);
	  padding-top: 2px;
	  margin-top: 0px;
	  font-size: 12px;
	  border-bottom-left-radius: 5px;
	  border-bottom-right-radius: 5px;
	}
	.terminal_content{
		color: rgba(255,255,255,0.8);
	}
	.terminal_promt {
	  display: flex;
	}
	
	.terminal_promt span {
	  margin-left: 4px;
	}
	
	.terminal_user {
	  color: #7eda28;
	}
	
	.terminal_location {
	  color: #4878c0;
	}
	
	.terminal_bling {
	  color: #dddddd;
	}
	
	.terminal_cursor {
	  display: block;
	  height: 14px;
	  width: 5px;
	  margin-left: 10px;
	  animation: curbl 1200ms linear infinite;
	}
	
	@keyframes curbl {
	  
	  0% {
	    background: #ffffff;
	  }
	
	  49% {
	    background: #ffffff;
	  }
	
	  60% {
	    background: transparent;
	  }
	
	  99% {
	    background: transparent;
	  }
	
	  100% {
	    background: #ffffff;
	  }
	} 
</style>
