
<script setup>
import { watch, onMounted, computed, ref } from "vue";
import { useStore } from 'vuex';
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
// import "monaco-editor/esm/vs/editor/contrib/find/findController.js";

const props = defineProps(["content", "option", "height", "isReadonly", "id", "theme"]);
const emits = defineEmits(['enter','change']);
let inst = null;
const code = ref('');
const editor = ref(null);
const store = useStore();

const vsThemeMode = ref(computed(() => {
  const mode = 'night' || props.theme;
  let _vsTheme = 'vs'
  if(mode == 'light'){
    _vsTheme = 'vs';
  }else if(mode == 'night'){
    _vsTheme = 'vs-dark';
  }else {
    if (window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches ) {
      _vsTheme = 'vs-dark';
    }  else if (window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: light)').matches ) {
      _vsTheme = 'vs';
    }
  }
  return _vsTheme;
}));
watch(
  () => props.content,
  (n) => {
    if (n != code.value) {
      code.value = n;
      if(!!inst){
        try{
          inst.setValue(n);
        } catch (e) {}
      }
    }
  },{
    immediate: true
  }
);

watch(
  () => vsThemeMode.value,
  (n) => {
    if(!!inst){
      monaco.editor.setTheme(props.theme || n);
    }
  }
);
const init = () => {
  if(!!monaco.editor){
    inst = monaco.editor.create(editor.value, {
      value: props.content,
      theme: props.theme || vsThemeMode.value,
      language: props.option.mode,
      readOnly: props.isReadonly,
    });
    inst.onDidChangeModelContent(() => {
      const newValue = inst.getValue();
      code.value = newValue;
      emits("change", newValue);
    });
    inst.onKeyUp((e) => {
      if(e.code == "Enter"){
        emits("enter", inst.getValue());
      }
    });
  }
};
onMounted(() => {
  init();
})
</script>

<template>
  <div
    :id="props.id"
    ref="editor"
    :style="props.height ? 'height:' + props.height : 'height: 500px;'"
  />
</template>
