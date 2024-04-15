<script setup>
import { useLayout } from '@/layout/composables/layout';
import { ref, computed } from 'vue';
import AppConfig from '@/layout/AppConfig.vue';
import PipyProxyService from '@/service/PipyProxyService';
import { setAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useToast } from "primevue/usetoast";
import { useRouter } from 'vue-router'
import { resetRoutes } from "@/router/index";
import XeyeSvg from "@/assets/img/logo.svg";
import { isAdmin } from "@/service/common/authority-utils";
import store from "@/store";


const router = useRouter()
const pipyProxyService = new PipyProxyService();
const user = ref('');
const password = ref('');
const toast = useToast();

const login = () => {
	if(!user.value || !password.value){
		return
	}
	pipyProxyService.login(user.value,password.value)
		.then(res => {
			if(res?.data?.token){
				store.commit('account/setUser', {id:user.value});
				setAuthorization({
					token: res.data.token,
					expireAt: 7
				}, AUTH_TYPE.BASIC);
				toast.add({ severity: 'success', summary: 'Login successfully.', group: 'login', life: 3000 });
				resetRoutes(router, store);
				setTimeout(()=>{
				  if(!!store.getters["account/redirect"]){
				    // router.push(store.getters["account/redirect"]);
						store.commit('account/setRedirect', null);
				  } 
					store.commit('account/setCollapsed', true);
				  router.push(isAdmin() ?'/root':'/root');
				},1000);
			} else {
				toast.add({ severity: 'error', summary: 'Login failed.', detail: 'User or password is wrong.', group: 'login', life: 3000 });
			}
		})
		.catch(err => {
			toast.add({ severity: 'error', summary: 'Login failed.', detail: 'Internal Server Error.', group: 'login', life: 3000 });
		}); 
}

const { layoutConfig } = useLayout();
const checked = ref(false);

const onClose = () => {
    visible.value = false;
}
</script>
<template>
    <div style="overflow: hidden;" class="surface-ground flex align-items-center justify-content-center  min-w-screen overflow-hidden">
        <Toast position="bottom-center" group="login" @close="onClose">
						<template #message="slotProps">
								<div class="flex flex-column align-items-start" style="flex: 1">
										<div class="flex align-items-center gap-2">
												<Avatar icon="pi pi-user" shape="circle" />
												<span class="font-bold text-900">{{user}}</span>
										</div>
										<div class="font-medium text-lg my-3 text-900">{{ slotProps.message.summary }}</div>
										<div v-if="slotProps.message.detail" class="font-medium text-sm my-3 text-900">{{ slotProps.message.detail }}</div>
										<Button v-if="slotProps.message.severity == 'success'" class="p-button-sm" label="Ok" @click="onClose()"></Button>
								</div>
						</template>
				</Toast>
				<svg style="opacity: 0.7;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 800" class="fixed left-0 top-0 min-h-screen min-w-screen" preserveAspectRatio="none"><rect fill="var(--primary-500)" width="1600" height="800"></rect><path fill="var(--primary-400)" d="M478.4 581c3.2 0.8 6.4 1.7 9.5 2.5c196.2 52.5 388.7 133.5 593.5 176.6c174.2 36.6 349.5 29.2 518.6-10.2V0H0v574.9c52.3-17.6 106.5-27.7 161.1-30.9C268.4 537.4 375.7 554.2
				        478.4 581z"></path><path fill="var(--primary-300)" d="M181.8 259.4c98.2 6 191.9 35.2 281.3 72.1c2.8 1.1 5.5 2.3 8.3 3.4c171 71.6 342.7 158.5 531.3 207.7c198.8 51.8 403.4 40.8 597.3-14.8V0H0v283.2C59 263.6 120.6 255.7 181.8 259.4z"></path><path fill="var(--primary-200)" d="M454.9 86.3C600.7 177 751.6 269.3 924.1 325c208.6 67.4 431.3 60.8 637.9-5.3c12.8-4.1 25.4-8.4 38.1-12.9V0H288.1c56 21.3 108.7 50.6 159.7 82C450.2 83.4 452.5 84.9 454.9 86.3z"></path><path fill="var(--primary-100)" d="M1397.5 154.8c47.2-10.6 93.6-25.3 138.6-43.8c21.7-8.9 43-18.8 63.9-29.5V0H643.4c62.9 41.7 129.7 78.2 202.1 107.4C1020.4 178.1 1214.2 196.1 1397.5 154.8z"></path></svg>
				<div class=" flex flex-column align-items-center justify-content-center" style="position: relative;border-radius: 0;z-index: 1000;">
            <div style="border-radius: 0px;">
                <div class="shadow w-full surface-card py-7 px-4 sm:px-8" style="border-radius: 0px;">
                    <div class="flex mb-5">
											<!-- <i class="pi pi-lock text-lg" style="font-size: 50px !important;"/> -->
                        <img :src="XeyeSvg" height="55" class="mr-3" alt="Xeye" />
												<div>
										    <div class=" text-3xl font-medium mb-2 font-bold" style="color: rgba(255, 255, 255, 1);">ZTMesh</div>
										    <span class=" font-medium" style="color: rgba(255, 255, 255, 0.9);">Sign in to continue</span>
												</div>
										</div>
                    <div>
											<InputGroup class="mb-3 w-24rem">
											    <InputGroupAddon>
											        <i class="pi pi-user"></i>
											    </InputGroupAddon>
											    <InputText id="email1" type="text" placeholder="User"  style="padding: 1rem" v-model="user" />
											</InputGroup>

											<InputGroup class="mb-3 w-full">
											    <InputGroupAddon>
											        <i class="pi pi-key"></i>
											    </InputGroupAddon>
											    <Password @keyup.enter="login" id="password1" v-model="password" placeholder="Password" :toggleMask="true"  inputClass="w-full" :inputStyle="{ padding: '1rem' }"></Password>
											</InputGroup>

                        <div class="flex align-items-center justify-content-between mb-5 gap-5">
                            <div class="flex align-items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1" style="color: rgba(255, 255, 255, 0.9);">Remember me</label>
                            </div>
                            <!-- <a class="font-medium no-underline ml-2 text-right cursor-pointer" style="color: var(--primary-color)">Forgot password?</a> -->
                        </div>
                        <Button @click="login" :disabled="user.length ==0 || password.length ==0" label="Sign In" class="w-full p-3 "></Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <AppConfig simple />
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
body{
	overflow: hidden !important;
}
.surface-card{
	overflow: hidden;
	box-shadow: none;
	background-color: rgba(255, 255, 255, 0) !important;
}
:deep(.p-inputgroup-addon){
	background-color: rgba(255, 255, 255, 0.6);
	border-right: none;
	border-width: 0;
}
:deep(.p-inputtext){
	background-color: rgba(255, 255, 255, 0.6);
	border-left: none;
	font-weight: bold;
	border-width: 0;
}
:deep(.p-inputtext::placeholder){
}
:deep(.p-inputtext:focus){
	outline-width: 0px;
}
:deep(.p-checkbox .p-checkbox-box){
	border-width: 0;
	border-color: rgba(255, 255, 255, 0.7);
	background-color: rgba(255, 255, 255, 0.3);
}
:deep(.p-checkbox:not(.p-disabled):has(.p-checkbox-input).p-highlight .p-checkbox-box){
	border-color: var(--primary-color);
	background: var(--primary-color);
}
:deep(.p-password .p-input-icon){
	display: none;
}
</style>
