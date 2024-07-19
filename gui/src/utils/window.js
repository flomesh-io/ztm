import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

const resize = (width,height,resizable) => {
	if(!!window.__TAURI_INTERNALS__ && getCurrentWindow().setSize){
		const label = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
		// getCurrentWindow().setSize(new LogicalSize(width, height));
		invoke('plugin:window|set_size', {
		    label,
		    value: {
					'Logical': {width,height}
				}
		});
	}
	if(!!window.__TAURI_INTERNALS__ && getCurrentWindow().setResizable){
		getCurrentWindow().setResizable(resizable);
	}
}

export {
	resize
};