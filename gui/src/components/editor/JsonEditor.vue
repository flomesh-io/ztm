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
  props: ["value", "id", "height", "isReadonly", "noreset", "theme"],
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
    };
  },

  watch: {
    value(newVal) {
      if (newVal !== this.code) {
        this.setValue();
      }
    },
  },

  mounted() {
    this.setValue();
  },

  methods: {
    change(event) {
      if (typeof event == "string") {
        this.$emit("update:value", event);
        this.$emit("fetch", event);
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
