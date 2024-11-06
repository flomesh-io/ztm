import { saveFile, downloadSpeed, openFile } from '@/utils/file';
import { platform } from '@/utils/platform';
import { invoke } from '@tauri-apps/api/core';
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
					position:relative;
				}
				.done{
					position: absolute;
					top:12px;
					left:12px;
					opacity:0.9;
					z-index:3;
				}
				.loading,.done,.uploading{
					display:none;
				}
				.progress{
					position: absolute;
				  width: 30px;
				  height: 30px;
					text-align: center;
					font-size:8pt;
					opacity:0.8;
					line-height:30px;
				}
				.spinner {
					--size: 30px; 
					--progress-color: #4E315F; 
					--background-color: #82529D;
					--progress: 0; 
					
					width: var(--size);
					height: var(--size);
					border-radius: 50%;
					background-color: var(--background-color);
					position: relative;
					overflow: hidden;
				}
				
				.spinner-left {
				    position: absolute;
						z-index:2;
				    top: 0;
				    left: 0;
				    width: 100%;
				    height: 100%;
				    background-color: var(--progress-color);
				    clip-path: inset(0 50% 0 0); 
						transform: rotate(calc(180deg));
				    // transform-origin: center right; 
				    transition: transform 0.1s ease; 
				}
				
				.spinner-right {
						z-index:1;
				    position: absolute;
				    top: 0;
				    right: 0;
				    width: 100%;
				    height: 100%;
				    background-color: var(--progress-color);
				    clip-path: inset(0 50% 0 0); 
				    // transform-origin: center left;
				    transition: all 0.1s ease;
						opacity:1;
						transform: rotate(calc((var(--progress)) * 3.6deg));
				}
				
				.spinner[data-progress='less-than-50'] .spinner-left {
						z-index:1;
						transform: rotate(calc((var(--progress)) * 3.6deg));
				}
				.spinner[data-progress='less-than-50'] .spinner-right {
						z-index:2;
				    background-color: var(--background-color);
				    transform: rotate(calc(0deg));
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
			<div class="download-button" style="display:flex;padding-top:3px">
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
					<div class="spinner">
							<div class="spinner-half spinner-left"></div>
							<div class="spinner-half spinner-right"></div>
					</div>
					<div class="done">
						<svg t="1730900409120" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="73357" width="18" height="18"><path d="M947.3 434.1L609.7 96.4c-11.8-9.6-31.8-0.9-32.5 14.5v2.1l0.1 143c-296.6 31.7-478 190.5-508.1 530-0.2 2.4-0.4 4.9-0.6 7.3 1.3 12.9 17.1 21.4 28.5 16 1.8-1.3 3.7-2.6 5.5-3.9 137.7-97 296.3-164 475-165.6l0.1 142v4.7c1.7 14.6 20.7 22.4 32.2 13.4l3.5-3.5L946.6 463c0.1-0.1 0.2-0.1 0.2-0.2l0.9-0.9c0.1-0.1 0.1-0.2 0.2-0.2 7.2-9.3 7-18.5-0.6-27.6z" p-id="73358" data-spm-anchor-id="a313x.search_index.0.i59.a9e13a81DL4NdQ" class="selected" fill="#ffffff"></path><path d="M576.1 111v2-2zM608.7 96.4l3 3c-0.9-1.1-1.9-2.1-3-3z" fill="#22B573" p-id="73359"></path></svg>
					</div>
				</div>
				<div class="state uploading">
					<div class="uploader"></div>
				</div>
			</div>
		`;
  }
	
	// 监听自定义属性变化
	static get observedAttributes() {
		return ['content','state','progress','src','fileName','contentType','size','url'];
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
					this.updateElement('loading');
				},
				after:(url)=>{
					setTimeout(()=>{
						if(url){
							this.setAttribute('url',url);
							this.doneProgress();
							if(platform() == 'ios'){
								invoke('shareFile', { url })
							}
						} else {
							this.resetProgress()
						}
					},600)
				},
				progressHandler:(resp)=>{
					const size = this.getAttribute('size') * 1;
					const percent = Math.floor((resp?.progress * 100)/size);
					this.setAttribute('progress',percent<5?5:percent);
					this.updateElement('loading');
				},
				headers: {
					"Content-type": this.getAttribute('contentType')
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
			const url = this.getAttribute('url');
			if(url){
				if(platform() == 'ios'){
					invoke('shareFile', { url })
				} else if (platform() == 'android'){
					//todo
				} else {
					openFile(url)
				}
			} else {
				this.resetProgress();
			}
		});
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
			const spinner = this.shadowRoot.querySelector('.spinner');
			const progress = this.getAttribute('progress') * 1
			if(progress>=0 && progress<100){
				const loading = this.shadowRoot.querySelector('.loading');
				loading.style.display = "block";
				const done = this.shadowRoot.querySelector('.done');
				done.style.display = "none";
				spinner.style.setProperty("--progress",progress<5?5:Math.floor(progress));
			} else if (progress>=100){
				const loading = this.shadowRoot.querySelector('.loading');
				loading.style.setProperty("--progress", 100);
				loading.style.display = "block";
				const done = this.shadowRoot.querySelector('.done');
				done.style.display = "block";
				spinner.style.setProperty("--progress", 100);
			}
			if (progress <= 50) {
				spinner.setAttribute('data-progress', 'less-than-50');
			} else {
				spinner.removeAttribute('data-progress');
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