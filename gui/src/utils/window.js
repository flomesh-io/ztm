import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

const resize = (width,height,resizable) => {
	if(!!window.__TAURI_INTERNALS__ 
	&& platform() != 'android' 
	&& platform() != 'ios' ){
		if(getCurrentWindow().setSize){
			// const label = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
			getCurrentWindow().setSize(new LogicalSize(width, height));
			// invoke('plugin:window|set_size', {
			//     label,
			//     value: {
			// 			'Logical': {width,height}
			// 		}
			// });
		}
		if(getCurrentWindow().setResizable){
			getCurrentWindow().setResizable(resizable);
		}
	}
}

const position = (width,height) => {
	if(!!window.__TAURI_INTERNALS__
	&& platform() != 'android' 
	&& platform() != 'ios' ){
		if(getCurrentWindow().setPosition){
			getCurrentWindow().setPosition(new LogicalPosition(width,height));
		}
	}
}

export {
	resize, position
};