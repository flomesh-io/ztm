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
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { create, copyFile, writeFile as fsWriteFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { documentDir } from '@tauri-apps/api/path';
import toast from "@/utils/toast";
import exportFromJSON from 'export-from-json';
import { requestMeta } from '@/service/common/request';

function convertToUint8Array(input) {
  if (typeof input === 'string') {
		//.buffer
    return new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    new Uint8Array(input);
	}else if (typeof input === 'object' && input !== null) {
    const jsonString = JSON.stringify(input);
    return new TextEncoder().encode(jsonString);
  } else {
    throw new Error('Unsupported input type for conversion to Uint8Array');
  }
}
const isMobile = () => {
	return platform() == 'ios' || platform() == 'android';
}

const getSavePath = (target, oldName) => {
	if(!!target){
		return oldName;
	} else if(isMobile()){
		const newName = target.split("/")[target.split("/").length-1];
		// if(target.toLowerCase().indexOf('library/cache')>-1 || target.toLowerCase().indexOf('libraries/cache')>-1){
		// 	return decodeURI(target)
		// }else 
		if(!!oldName && newName.split(".")[0].split('%20')[0] == oldName.split(".")[0]){
			return oldName;
		}else{
			return decodeURI(newName);
		}
	} else {
		return target;
	}
}
const writeMobileFile = (name, append) => {
	if(isMobile()){
		create(name, { 
			write:true, 
			create:true, 
			baseDir: BaseDirectory.Document,
		}).then((file)=>{
			file.write(new TextEncoder().encode(append)).then(()=>{
				file.close();
			});
		})
	}
}

const writeFile = (file, target, after) => {
	const reader = new FileReader();
	reader.onload = function(event) {
		const uint8Array = convertToUint8Array(event.target.result);
		create(getSavePath(target), {
			write:true, 
			create:true, 
			baseDir: BaseDirectory.Document ,
		}).then((file)=>{
			file.write(uint8Array).then(()=>{
				file.close();
				if(!!after){
					after()
				}
			});
		})
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
	svg: img,
	png: img,
	jpeg: img,
	jpg: img,
	mp3,
	wav: mp3,
	mp4: mp4,
	mov: mp4,
	ppt,
	txt,
	md: txt,
	zip,
	tar: zip,
	rar: zip,
	"7z": zip,
};


const FileTypes = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
  video: ['mp4', 'webm', 'ogg', 'mov'],
  audio: ['mp3', 'wav'],
	text: ['txt', 'html', 'js', 'css', 'json', 'xml', 'md'],
  pdf: ['pdf']
  // Add more supported formats as needed
};

const isImage = (val) => FileTypes.image.includes(val);
const isVideo = (val) => FileTypes.video.includes(val);
const isAudio = (val) => FileTypes.audio.includes(val);
const isPdf = (val) => FileTypes.pdf.includes(val);
const isText = (val) => FileTypes.text.includes(val);


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
	if(typeof(value) != 'number'){
		return value;
	} else if(value>(1024 * 1024 * 1024)){
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
	if(isMobile()){
		toast.add({ severity: 'contrast', summary: 'Tips', detail: `Please go to the Files App: /ztm/ztmCloud folder to open it.`, life: 3000 });
	} else if(platform() == 'web'){
		toast.add({ severity: 'contrast', summary: 'Tips', detail: `Please go to ${path} to open it.`, life: 3000 });
	} else {
		open(path);
	}
}
const saveFile = (fileUrl, before, after) => {
	const filePathAry = fileUrl.split("/");
	const name = filePathAry[filePathAry.length-1];
	const ext = name.split(".")[1];
	
	documentDir().then((defaultPath)=>{
		save({
			defaultPath:`${defaultPath}/${name}`,
			title: name,
			canCreateDirectories: true,
			filters: [{
				name,
				extensions: ext?[ext]:[]
			}]
		}).then((targetUrl)=>{
			if(!!before){
				before()
			}
			requestMeta(fileUrl)
				.then(arrayBuffer => {
					setTimeout(()=>{
						create(getSavePath(targetUrl, name), {
							write:true, 
							create:true, 
							baseDir: BaseDirectory.Document ,
						}).then((file)=>{
							file.write(convertToUint8Array(arrayBuffer)).then(()=>{
								file.close();
								if(!!after){
									after()
								}
							});
						}).catch((e2)=>{
							writeMobileFile('saveFileReqError2.txt',e2.toString());
							if(!!after){
								after()
							}
						});
					},300)
					// fsWriteFile(targetUrl, uint8Array, { baseDir: BaseDirectory.Document }).then(()=>{
					// 	if(!!after){
					// 		after()
					// 	}
					// });
				}).catch((e)=>{
					writeMobileFile('saveFileReqError.txt',e.toString());
					if(!!after){
						after()
					}
				});
		})
	});
}
const downloadFile = ({
	ext, data, fileName, after
}) => {
	const newFileName = ext?`${fileName}.${ext}`:fileName;
	if(platform() == 'web'){
		let exportType = exportFromJSON.types[ext];
		exportFromJSON({ 
			data,
			fileName:newFileName,
			exportType
		})
	} else {
		documentDir().then((dir)=>{
			save({
				defaultPath:`${dir}/${newFileName}`,
				title: fileName,
				canCreateDirectories: true,
				filters: [{
					name: fileName,
					extensions: ext?[ext]:[]
				}]
			}).then((targetUrl)=>{
				let uint8Array = convertToUint8Array(data);
				setTimeout(()=>{
					create(getSavePath(targetUrl, newFileName), { 
						write:true, 
						create:true, 
						baseDir: BaseDirectory.Document ,
					}).then((file)=>{
						
						file.write(uint8Array).then(()=>{
							file.close();
							if(after){
								after()
							}
						});
					})
				},300)
				// fsWriteFile(targetUrl, uint8Array, { baseDir: BaseDirectory.Document }).then(()=>{
				// 	if(!!after)
				// 	after()
				// });
			})
		})
	}
}
const importFiles = ({
	path, multiple, before, after
}) => {
	const options = {
		multiple: multiple,
	}
	documentDir().then((dir)=>{
		options.defaultPath = dir;
		openDialog(options).then((selected)=>{
			if (selected === null) {
				if(after){
					after([])
				}
			} else {
				const selecteds = Array.isArray(selected)?selected:[selected];
				// user selected multiple files
				let saved = 0;
				if(before){
					before()
				}
				const _targets = [];
				selecteds.forEach((file)=>{
					const _file_ary = file.split("/");
					const _name = _file_ary[_file_ary.length-1];
					const _target = `${path || dir}/${_name}`;
					_targets.push(_target);
					copyFile(file, _target, { fromPathBaseDir: BaseDirectory.Document, toPathBaseDir: BaseDirectory.Document }).then(()=>{
						saved++;
						if(saved == selecteds.length){
							if(after){
								after(_targets)
							}
						}
					});
				})
			}
		})
	
	})
}
export {
	ext, 
	checker, 
	bitUnit, 
	openFile, 
	isMirror, 
	writeMobileFile, 
	convertToUint8Array,
	writeFile, 
	saveFile, 
	getSavePath,
	downloadFile, 
	importFiles,
	isImage,
	isVideo,
	isAudio,
	isPdf,
	isText
};