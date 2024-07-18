<template>
  <div>
    <Monacoeditor
      id="ShellEditor"
      v-model:content="code"
      :option="cmOptions"
      @change="change"
      @enter="enter"
      :height="height"
      theme="vs-dark"
      :is-readonly="isReadonly"
    />
  </div>
</template>

<script>
import Monacoeditor from "./Monacoeditor.vue";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js";

export default {
  name: "ShellEditor",
  components: { Monacoeditor },
  props: ["value", "height", "isReadonly", "theme"],
  data() {
    return {
      code: "",
      cmOptions: {
        lineNumbers: true,
        lineWrapping: true,
        styleActiveLine: true,
        matchBrackets: true,
        mode: "shell",
        readOnly: false,
        lint: true,
      },
    };
  },

  watch: {
    value(value) {
      if (value !== this.code) {
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
        this.$emit("change", event);
      }
    },

    enter(event) {
      if (typeof event == "string") {
        let inline_val = event.split("\n");
        this.$emit("enter", inline_val[inline_val.length-2]);
      }
    },

    setValue() {
      this.code = this.value
        .replace(/"/g, "")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "	");
    },
  },
};
</script>
