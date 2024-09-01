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
const checker = (name, path, mirrorPaths) => {
	if(!!name && name.charAt(name.length-1) == "/" && isMirror(`${path}/${name.split('/')[0]}`,mirrorPaths)>-1){
		return ext.mirror;
	}else if((name=="users/" || path== 'users') && name.indexOf(".")==-1){
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
				_mirrorPaths.push(mirrorPath.replace(/^\//, ''))
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
	open(path);
}
const saveFile = () => {
	
}
export {
	ext, checker, bitUnit, openFile, isMirror
};