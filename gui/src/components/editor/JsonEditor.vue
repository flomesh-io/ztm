<template>
  <div>
    <Monacoeditor
      :id="id ? id : 'JsonEditor'"
      v-model:content="code"
      :option="cmOptions"
      @change="change"
      :height="height"
      :theme="theme"
      :is-readonly="isReadonly"
    />
  </div>
</template>

<script>
import Monacoeditor from "./Monacoeditor.vue";
import "monaco-editor/esm/vs/language/json/monaco.contribution";

export default {
  name: "JsonEditor",
  components: { Monacoeditor },
  props: ["value", "id", "height", "isReadonly", "noreset", "theme", 'type'],
  data() {
    return {
      code: "",
      cmOptions: {
        styleActiveLine: true,
        matchBrackets: false,
        readOnly: false,
        mode: "json",
        maxHighlightLength: Infinity,
        foldGutter: true,
        smartInder: false,
        lint: false,
      },
			emiting:0
    };
  },

  watch: {
    value: {
			handler(newVal) {
				if (this.type == 'object' && JSON.stringify(newVal) !== this.code){
					this.setObjValue();
				} else if (newVal !== this.code) {
					this.setValue();
				}
			},
			deep: true,
			immediate: true
		},
  },

  mounted() {
    this.setValue();
  },

  methods: {
    change(event) {
      if (typeof event == "string") {
				this.emiting++;
				const _emiting = this.emiting;
				setTimeout(()=>{
					if(this.emiting == _emiting){
						this.emiting = 0;
						if(this.type == 'object'){
							try {
								this.$emit("update:value", JSON.parse(event));
								this.$emit("fetch", JSON.parse(event));
							} catch (e) {}
						} else {
							this.$emit("update:value", event);
							this.$emit("fetch", event);
						}
					}
				},1500)
      }
    },

    setObjValue() {
      this.code = JSON.stringify(this.value);
      if (this.value == "") {
        this.code = this.value;
      } else {
        try {
          this.code = this.noreset
            ? JSON.stringify(this.value)
            : JSON.stringify(this.value, null, 2);
        } catch (e) {}
      }
    },
    setValue() {
      this.code = this.value;
      if (this.value == "") {
        this.code = this.value;
      } else {
        try {
          this.code = this.noreset
            ? this.value
            : JSON.stringify(JSON.parse(this.value), null, 2);
        } catch (e) {}
      }
    },
  },
};
</script>
