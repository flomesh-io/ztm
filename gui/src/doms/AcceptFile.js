import { saveFile, downloadSpeed } from '@/utils/file';
class AcceptFile extends HTMLElement {
  constructor() {
    super();
		
		// 创建一个 Shadow DOM
		this.attachShadow({ mode: 'open' });
		
		this.shadowRoot.innerHTML = `
			<style>
				/* 内部样式 */
				.file-inner {
					padding:2px 6px;
					line-height:18px;
				}
				.state{
					padding:6px;
					cursor: pointer;
				}
				
				.loading,.done,.uploading{
					display:none;
				}
				.progress{
					position: absolute;
				  width: 36px;
				  height: 36px;
					text-align: center;
					font-size:8pt;
					opacity:0.8;
					line-height:36px;
				}
				.spinner{
					--size: 36px; 
					--progress-color: rgba(0, 0, 0, 0.4); 
					--background-color: rgba(0, 0, 0, 0.2);
					--progress: 0; /* 进度百分比 */
				
					width: var(--size);
					height: var(--size);
					border-radius: 50%;
					background: conic-gradient(
						var(--progress-color) calc(var(--progress) * 1%),
						var(--background-color) 0
					);
					transition: background 0.5s ease-out;
				}
				
				.uploader{
				  width: 28px;
				  height: 28px;
				  border: 4px solid rgba(0, 0, 0, 0.1);
				  border-top-color: #3498db;
				  border-radius: 50%;
				  animation: spin 1s linear infinite;
				}
				
				@keyframes spin {
				  to {
				    transform: rotate(360deg);
				  }
				}
			</style>
			<div class="download-button " style="display:flex">
				<slot name="icon"></slot>
				<div style="flex:1">
					<div class="file-inner">
						<slot name="title"> [File name] </slot>
						<slot name="attrs"> - </slot>
					</div>
				</div>
				<div class="state download">
					<svg t="1730616449487" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10987" width="30" height="30"><path d="M640 473.35424v-95.88736h-268.288v95.88736h-118.25152L506.88 726.77376l253.41952-253.41952H640zM371.712 276.21376h268.288v46.34624h-268.288zM371.712 194.82624h268.288v41.96352h-268.288z" fill="#ffffff" p-id="10988" data-spm-anchor-id="a313x.search_index.0.i13.a9e13a81DL4NdQ" class="selected"></path><path d="M146.432 806.912h720.896v40.96h-720.896z" fill="#ffffff" p-id="10989" data-spm-anchor-id="a313x.search_index.0.i14.a9e13a81DL4NdQ" class="selected"></path></svg>
				</div>
				<div class="state loading">
					<div class="spinner"></div>
				</div>
				<div class="state uploading">
					<div class="uploader"></div>
				</div>
				<div class="state done">
					<svg t="1730621033625" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="18207" width="26" height="26"><path d="M512 512m-512 0a512 512 0 1 0 1024 0 512 512 0 1 0-1024 0Z" fill="#D5F7E0" p-id="18208"></path><path d="M407.552 586.752L239.616 455.68 163.84 515.072l292.864 294.912c51.2-126.976 208.896-376.832 403.456-555.008l-18.432-40.96c-210.944 126.976-364.544 290.816-434.176 372.736z" fill="#0AAD06" p-id="18209"></path></svg>
				</div>
			</div>
		`;
  }
	
	// 监听自定义属性变化
	static get observedAttributes() {
		return ['content','state','progress','src','fileName','contentType','size'];
	}

	// 当属性变化时调用
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			this.updateElement();
		}
	}
	save() {
		if(!!window.__TAURI_INTERNALS__){
			saveFile({
				name:this.getAttribute('fileName'),
				fileUrl:this.getAttribute('src'),
				before:()=>{
					this.setAttribute('progress',0);
					this.updateProgress();
				},
				after:(resp)=>{
					if(resp){
						this.doneProgress();
					} else {
						this.resetProgress()
					}
				}
			})
		} else {
			const link = document.createElement('a');
			link.href = this.getAttribute('src');
			link.download = this.getAttribute('fileName'); 
			document.body.appendChild(link);
			link.click();
		}
	}
	// 初始化或更新元素内容和样式
	connectedCallback() {
		this.updateElement();
		this.shadowRoot.querySelector('.download').addEventListener('click', (e) => {
			this.save(e)
		});
		this.shadowRoot.querySelector('.done').addEventListener('click', (e) => {
			this.save(e)
		});
	}
	updateProgress() {
		this.updateElement('loading');
		setTimeout(()=>{
			const progress = (this.getAttribute('progress')||0)*1;
			const speed = downloadSpeed(this.getAttribute('size')*1);
			if(progress < 99){
				const next = (progress + speed) >= 100 ? 99 :(progress + speed);
				debugger
				this.setAttribute('progress', next);
				this.updateProgress();
			}
		},1000)
		
	}
	doneProgress() {
		this.setAttribute('progress',100);
		this.updateElement('loading');
	}
	resetProgress() {
		this.setAttribute('progress','');
		const download = this.shadowRoot.querySelector('.download');
		download.style.display = "block";
		const loading = this.shadowRoot.querySelector('.loading');
		loading.style.display = "none";
		const done = this.shadowRoot.querySelector('.done');
		done.style.display = "none";
	}
	// 更新元素的方法
	updateElement(state) {
		const container = this.shadowRoot.querySelector('.file-inner');
		const download = this.shadowRoot.querySelector('.download');
		const uploading = this.shadowRoot.querySelector('.uploading');
		if(state == 'loading'){
			download.style.display = "none";
			const progress = this.getAttribute('progress') * 1
			if(progress>=0 && progress<100){
				const loading = this.shadowRoot.querySelector('.loading');
				loading.style.display = "block";
				const spinner = this.shadowRoot.querySelector('.spinner');
				spinner.style.setProperty("--progress",progress<5?5:Math.floor(progress));
			} else if (progress>=100){
				const loading = this.shadowRoot.querySelector('.loading');
				loading.style.setProperty("--progress", 100);
				loading.style.display = "none";
				const done = this.shadowRoot.querySelector('.done');
				done.style.display = "block";
				const spinner = this.shadowRoot.querySelector('.spinner');
				spinner.style.setProperty("--progress", 100);
			}
		} else {
			if(!!this.getAttribute('src')){
				download.style.display = "block";
				uploading.style.display = "none";
			} else {
				uploading.style.display = "block";
				download.style.display = "none";
			}
		}
	}
}

export {
	AcceptFile
}