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
					<svg t="1730720588146" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="29082" width="30" height="30"><path d="M490.666667 490.666667m-490.666667 0a490.666667 490.666667 0 1 0 981.333333 0 490.666667 490.666667 0 1 0-981.333333 0Z" fill="#82529d" p-id="29083" data-spm-anchor-id="a313x.search_index.0.i25.a9e13a81DL4NdQ" class=""></path><path d="M647.381333 473.002667a26.88 26.88 0 0 0-24.917333-17.877334h-53.632c-0.298667 0-0.341333-0.512-0.341333-0.810666V327.125333a28.714667 28.714667 0 0 0-27.093334-29.610666h-78.592a28.501333 28.501333 0 0 0-26.922666 29.610666v127.146667c0 0.298667-0.298667 0.853333-0.554667 0.853333H382.506667a26.794667 26.794667 0 0 0-24.917334 17.834667 30.762667 30.762667 0 0 0 5.845334 31.744l120.021333 129.877333a25.6 25.6 0 0 0 38.4 0l120.021333-129.834666a30.72 30.72 0 0 0 5.504-31.744z" fill="#ffffff" p-id="29084"></path><path d="M661.077333 667.690667H343.808a13.269333 13.269333 0 1 0 0 26.496h317.269333a13.269333 13.269333 0 1 0 0-26.496z" fill="#ffffff" p-id="29085"></path></svg>
				</div>
				<div class="state loading">
					<div class="spinner"></div>
				</div>
				<div class="state uploading">
					<div class="uploader"></div>
				</div>
				<div class="state done">
					<svg t="1730621033625" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="18207" width="26" height="26"><path d="M512 512m-512 0a512 512 0 1 0 1024 0 512 512 0 1 0-1024 0Z" fill="#D5F7E0" p-id="18208"></path><path d="M407.552 586.752L239.616 455.68 163.84 515.072l292.864 294.912c51.2-126.976 208.896-376.832 403.456-555.008l-18.432-40.96c-210.944 126.976-364.544 290.816-434.176 372.736z" fill="#0AAD06" p-id="18209"></path></svg>
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
					this.setAttribute('progress',5);
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
			const progress = (this.getAttribute('progress')||5)*1;
			const speed = downloadSpeed(this.getAttribute('size')*1);
			if(progress>0 && progress < 99){
				const next = (progress + speed) >= 100 ? 99 :(progress + speed);
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
		this.setAttribute('progress',0);
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