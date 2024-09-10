import excel from "@/assets/img/files/excel.png";
import word from "@/assets/img/files/word.png";
import file from "@/assets/img/files/file.png";
import folder from "@/assets/img/files/folder.png";
import img from "@/assets/img/files/img2.png";
import mp3 from "@/assets/img/files/mp3.png";
import mp4 from "@/assets/img/files/mp4.png";
import pdf from "@/assets/img/files/pdf.png";
import ppt from "@/assets/img/files/ppt.png";
import mirror from "@/assets/img/files/mirror.png";
import share from "@/assets/img/files/share.png";
import txt from "@/assets/img/files/txt.png";
import zip from "@/assets/img/files/zip.png";
import userfolder from "@/assets/img/files/userfolder.png";
import { open } from '@tauri-apps/plugin-shell';
import { platform } from '@/utils/platform';
import { save } from '@tauri-apps/plugin-dialog';
import { create, writeFile as fsWriteFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { documentDir } from '@tauri-apps/api/path';
import toast from "@/utils/toast";

const initWorkspace = () => {
	if(platform() == 'ios' || platform() == 'android'){
		create("Readme.txt", { baseDir: BaseDirectory.Document }).then((file)=>{
			file.write(new TextEncoder().encode("Welcome ZTM!")).then(()=>{
				file.close();
			});
		})
	}
}

const writeFile = (file, target, callback) => {
	const reader = new FileReader();
	reader.onload = function(event) {
		const arrayBuffer = event.target.result; 
		const data = new Uint8Array(arrayBuffer);
		fsWriteFile(target, data, { baseDir: BaseDirectory.Document }).then(()=>{
			if(!!callback)
			callback()
		});
	};
	reader.readAsArrayBuffer(file);
}
const ext = {
	default: file,
	folder,
	userfolder,
	share,
	xls: excel,
	xlsx: excel,
	doc: word,
	docx: word,
	mirror,
	pdf,
	pdfx: pdf,
	png: img,
	jpeg: img,
	jpg: img,
	mp3,
	wav: mp3,
	mp4: mp4,
	ppt,
	txt,
	md: txt,
	zip,
	tar: zip,
	rar: zip,
	"7z": zip,
};
const isImg = (val) => {
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(val);
}
const checker = (item, mirrorPaths) => {
	const name = item?.name;
	const path = item?.path || '';
	const pathAry = path.split("/");
	if(!!name && name.charAt(name.length-1) == "/" && isMirror(`${path}/${name.split('/')[0]}`,mirrorPaths)>-1){
		return ext.mirror;
	}else if((name=="users/" || (pathAry.length == 3 && pathAry[1] == "users")) && name.indexOf(".")==-1){
		return ext.userfolder;
	} else if(!!name && name.charAt(name.length-1) == "/"){
		return ext.folder;
	} else if(!!name && name.indexOf(".")>-1) {
		const nameAry = name.split("/");
		const _name = nameAry[nameAry.length -1];
		const _ext = _name.split(".")[_name.split(".").length-1]
		return ext[_ext] || ext.default
	} else {
		return ext.default;
	}
}
const isMirror = (path, mirrorPaths) => {
	const _mirrorPaths = [];
	if(!!mirrorPaths){
		mirrorPaths.forEach((mirrorPath)=>{
			if(!!mirrorPath){
				_mirrorPaths.push(mirrorPath)
			}
		})
	};
	if(!!_mirrorPaths){
		return _mirrorPaths.findIndex((_mirrorPath)=>_mirrorPath==path)
	} else {
		return -1
	}
}
const bitUnit = (value)=> {
	if(value>(1024 * 1024 * 1024)){
		return (value/(1024 * 1024 * 1024)).toFixed(0) + "GB";
	} else if(value>(1024 * 1024)){
		return (value/(1024 * 1024)).toFixed(0) + "MB";
	} else if(value>1024){
		return (value/1024).toFixed(0) + "KB";
	} else {
		return value*1 + "B";
	}
}
const openFile = (path) => {
	//{ read: true, write: false, baseDir: BaseDirectory.Home }
	if(platform() == 'ios' || platform() == 'android'){
		toast.add({ severity: 'contrast', summary: 'Tips', detail: `Please go to the Files App: /ztm/ztmCloud folder to open it.`, life: 3000 });
	} else if(platform() == 'web'){
		toast.add({ severity: 'contrast', summary: 'Tips', detail: `Please go to ${path} to open it.`, life: 3000 });
	} else {
		open(path);
	}
}
function fetchFileAsUint8Array(fileUrl) {
  return fetch(fileUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch the file: ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then(arrayBuffer => {
      return new Uint8Array(arrayBuffer);
    })
    .catch(error => {
      console.error('Error fetching or processing the file:', error);
      throw error;
    });
}
const saveFile = (fileUrl, before, after) => {
	const filePathAry = fileUrl.split("/");
	const name = filePathAry[filePathAry.length-1];
	const ext = name.split(".")[1];
	save({
	  filters: [{
	    name,
	    extensions: ext?[ext]:[]
	  }]
	}).then((targetUrl)=>{
		if(!!before)
		before
		fetchFileAsUint8Array(fileUrl)
		  .then(uint8Array => {
				writeFile(uint8Array,targetUrl,()=>{
					if(!!after)
					after
				});
		  });
	})
	
}
export {
	ext, checker, bitUnit, openFile, isMirror, initWorkspace, writeFile,saveFile, isImg
};