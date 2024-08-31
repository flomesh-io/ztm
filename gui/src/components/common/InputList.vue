<template>
  <div v-if="!table">
    <Button
			icon="pi pi-plus"
      size="small"
      v-if="d.length == 0"
			:label="placeholder"
      @click="add"
    />
    <div
      v-else
      :size="space"
      class="w-full flex"
      style="flex-direction: column;gap: 0.5rem;"
    >
      <div
        v-for="(item, index) in d"
				:class="itemClass"
        :key="index"
      >
        <div
          class="flex"
          :style="width?`max-width:${width}px`:''"
        >
					<slot
						:item="item"
						:listIndex="index"
					/>
          <div
            class="font-left pl-1"
						style="width: 73px;"
            v-if="!readonly"
          >
            <Button
							size="small"
							icon="pi pi-minus"
							severity="secondary"
              v-if="d.length > min"
              @click="remove(item)"
              class="ml-1"
            />
            <Button
							size="small"
							icon="pi pi-plus"
              v-if="d.length - 1 == index"
              @click="add"
              shape="circle"
              class="ml-1"
            />
          </div>
        </div>
      </div>	
    </div>		
  </div>
  <div v-else>
		<DataTable :value="d" tableStyle="min-width: 50rem">
			<Column v-for="(col,ci) in columns" :key="ci" :field="lowerCaseOne(col.name)" :header="col.name"></Column>
			<Column field="name" header="Name"></Column>
			<Column field="category" header="Category"></Column>
			<Column field="quantity" header="Quantity"></Column>
		</DataTable>
  </div>
</template>

<script>
export default {
  name: "InputList",
  props:['placeholder','itemClass','table','columns','d','attrs','customAdd', 'width', 'xlButton', "readonly", "min", "space"],
  data() {
    return {
    };
  },

  computed: {
  },
  mounted() {
    setTimeout(()=>{
      if(this.d.length == 0 && this.min != 0){
        this.add();
      }
    }, 500)
  },

  methods: {
		lowerCaseOne(str) {
		    return str.charAt(0).toLowerCase() + str.slice(1);
		},
    remove(item) {
			this.$emit('remove', item?.id);
      let index = this.d.indexOf(item);
      if (index !== -1) {
        this.d.splice(index, 1);
      }
    },

    add() {
			let newD = {};
			if(!this.customAdd){
				if(typeof(this.attrs) == 'string'){
					newD = this.attrs;
				}else{
					newD = JSON.parse(JSON.stringify(this.attrs)) || {};
				}
				this.d.push(newD);
			}
			this.$emit('add', newD)
    },

  },
};
</script>