<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { platform } from '@/utils/platform';
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

const props = defineProps(['small','files','error','loading','loader'])
const emits = defineEmits(['create', 'edit','load'])


const fileData = ref([]);
const formatFile = (ary, pre) => {
		props.files.forEach((file,idx)=>{
			const _file = {
				key:`${pre}${idx}`,
				name:file,
				loading:false,
				selected: false,
				ext:file.charAt(file.length-1) == "/"?"/":file.split(".")[file.split(".").length-1]
			}
			if(_file.ext == "/"){
				_file.children = [];
				_file.leaf = false;
			}
			ary.push(_file);
		})
}

watch(()=>props.files,()=>{
	fileData.value = [];
	if(!!props.files && props.files.length>0){
		formatFile(fileData.value,'');
	}
},{
	deep:true,
	immediate:true,
});

const filesFilter = computed(() => {
	return fileData.value.filter((file)=>{
		return (typing.value == '' || file.name.indexOf(typing.value)>=0 ) 
	})
});

const typing = ref('');
const actionMenu = ref();
const actions = ref([
    {
        label: 'Actions',
        items: [
            {
                label: 'Edit',
                icon: 'pi pi-pencil',
								command: () => {
								}
            },
        ]
    }
]);
const showAtionMenu = (event, file) => {
	actionMenu.value.toggle(event);
};
const layout = ref('grid');
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const emptyMsg = computed(()=>{
	return 'No file.'
});
const load = () => {
	emits('load',currentPath.value)
}
const create = () => {
	emits('create')
}

const edit = (d) => {
	emits('edit',d)
}

const fileLoading = ref({})


const onNodeExpand = (node) => {
    if (node.ext == "/") {
        node.loading = true;

        setTimeout(() => {

            node.children = [];

						formatFile(node.children,`${node.key}-`);
						node.loading = false;
      //       let _nodes = { ...nodes2.value };
						
      //       _nodes[parseInt(node.key, 10)] = { ..._node, loading: false };

      //       nodes2.value = _nodes;
        }, 500);
    }
};

const home = ref({ type: 'home',icon: 'pi pi-angle-left' });
const currentPath = ref('');
const itemsBreadcrumb = ref([
	{
		name: 'root',
		path: '',
		index:0,
	}
]);

const back = () => {
	if(window.parent){
		window.parent.location.href="/#/mesh/apps";
	}else{
		location.href="/#/mesh/apps";
	}
}
const showBack = computed(()=>{
	return platform() == 'ios' || platform() == 'android' || platform() == 'web'
})
const changePath = (item) => {
	if(item.index+1 < itemsBreadcrumb.value.length){
		itemsBreadcrumb.value.splice(item.index+1,itemsBreadcrumb.value.length-1-item.index)
	}
	currentPath.value = item.path;
	load();
}
const selectFile = (item) => {
	if(item.ext == "/"){
		const _name = item.name.split("/")[0];
		currentPath.value = !!currentPath.value?`${currentPath.value}/${_name}`:_name;
		itemsBreadcrumb.value.push({
			name:_name,
			path:currentPath.value,
			index:itemsBreadcrumb.value.length
		});
		
		load();
	} else {
		item.selected = !item.selected;
	}
}

</script>

<template>
	<div class="flex flex-row min-h-screen h-full"  :class="{'embed-ep-header':false}">
		<div  class="relative h-full w-full" >
			<AppHeader :child="true">
			
					<template #start>
						 <Breadcrumb v-if="props.mode != 'device'" :home="home" :model="itemsBreadcrumb">
								<template #item="{ item }">
									<Button  v-if="item.type=='home' && showBack" @click="back" icon="pi pi-angle-left" severity="secondary" text />
									<Button v-else @click="changePath(item)" :label="item.name" severity="secondary" text />
								</template>
								<template #separator> / </template>
						</Breadcrumb>
					</template>
					<template #center>
						<!-- <b>Files</b> -->
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="load"  :loading="loader"/>
						<Button icon="pi pi-plus"   @click="create"/>
					</template>
			</AppHeader>
			<Card class="nopd" v-if="!props.error">
				<template #content>
					<InputGroup class="search-bar" >
						<DataViewLayoutOptions v-model="layout" style="z-index: 2;"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type file name" rows="1" cols="30" />
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="props.loading"/>
			<ScrollPanel class="absolute-scroll-panel"  :style="{'top':'50px'}" v-else-if="filesFilter && filesFilter.length >0">
			<div class="text-center">
				<Tree v-if="layout == 'list'" @node-expand="onNodeExpand" loadingMode="icon" class="w-full file-block" :value="filesFilter" >
				    <template #default="slotProps">
							<div class="selector"   @click="selectFile(slotProps.node)" :class="{'active':slotProps.node.selected,'px-2':slotProps.node.selected,'py-1':slotProps.node.selected}" >
								<img :src="checker(slotProps.node.name)" class="pointer relative vertical-align-middle" width="20" height="20" style="top: -1px; overflow: hidden;margin: auto;"/>
								<b class="px-2 vertical-align-middle">{{ slotProps.node.name }}</b>
							</div>
				    </template>
				</Tree>
				<div v-else class="grid text-left px-3 m-0" v-if="filesFilter && filesFilter.length >0">
						<div class="col-4 md:col-2 xl:col-1 relative text-center file-block" v-for="(file,hid) in filesFilter" :key="hid">
							<div class="selector py-3" @click="selectFile(file)" :class="{'active':file.selected}" >
								<img :src="checker(file.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<ProgressSpinner v-if="file.loading" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="file">
									<b class="white-space-nowrap">
										<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
										{{ file.name }}
									</b>
								</div>
							</div>
					 </div>
				</div>
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg" :error="props.error"/>
		</div>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
:deep(.p-tabview-panels){
	padding: 0;
}
</style>