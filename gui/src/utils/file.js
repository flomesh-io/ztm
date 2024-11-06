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
import { download } from '@tauri-apps/plugin-upload';
import { platform } from '@/utils/platform';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { create, remove, copyFile, writeFile as fsWriteFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { documentDir } from '@tauri-apps/api/path';
import toast from "@/utils/toast";
import exportFromJSON from 'export-from-json';
import { requestMeta } from '@/service/common/request';
import { extension } from "mime-types";

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

const getSavePath = (target, dft) => {
	if(!target){
		return dft;
	// } else if(isMobile()){
	// 	const newName = target.split("/")[target.split("/").length-1];
	// 	const oldName = dft?dft.split("/")[dft.split("/").length-1]:'';
	// 	// if(target.toLowerCase().indexOf('library/cache')>-1 || target.toLowerCase().indexOf('libraries/cache')>-1){
	// 	// 	return decodeURI(target)
	// 	// }else 
	// 	if(!!oldName && newName.split(".")[0].split('%20')[0] == oldName.split(".")[0]){
	// 		return dft;
	// 	}else{
	// 		return decodeURI(newName);
	// 	}
	} else {
		return decodeURI(target);
	}
}
// const androidRoot = "/storage/emulated/0/com.flomesh.ztm"
const createFile = (name) => {
	if(platform() == 'android'){
		//fix Android forbidden path
		return create(name, {
			write:true, 
			create:true, 
			baseDir: BaseDirectory.Document,
		})
	} else {
		return create(name, {
			write:true, 
			create:true, 
			baseDir: BaseDirectory.Document,
		})
	}
}
const writeMobileFile = (name, append) => {
	if(isMobile()){
		createFile(name).then((file)=>{
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

const extIcon = (contentType) => {
	if(contentType && contentType.split("/")[1]){
		return ext[contentType.split("/")[1]] || ext.default
	} else {
		return ext.default;
	}
}
const isImage = (val) => FileTypes.image.includes(val?.toLocaleLowerCase());
const isVideo = (val) => FileTypes.video.includes(val?.toLocaleLowerCase());
const isAudio = (val) => FileTypes.audio.includes(val?.toLocaleLowerCase());
const isPdf = (val) => FileTypes.pdf.includes(val?.toLocaleLowerCase());
const isText = (val) => FileTypes.text.includes(val?.toLocaleLowerCase());


const checker = (item) => {
	const name = item?.name;
	const path = item?.path || '';
	const pathAry = path.split("/");
	if(item.isMirror){
		return ext.mirror;
	}else if((name=="users/" || (pathAry.length == 3 && pathAry[1] == "users")) && name.indexOf(".")==-1){
		return ext.userfolder;
	} else if(!!name && name.charAt(name.length-1) == "/"){
		return ext.folder;
	} else if(!!name && name.indexOf(".")>-1) {
		const nameAry = name.split("/");
		const _name = nameAry[nameAry.length -1];
		const _ext = _name.split(".")[_name.split(".").length-1]
		return ext[_ext?.toLowerCase()] || ext.default
	} else {
		return ext.default;
	}
}

const icons = (item)=>{
	if(!!item.ext && item && item.state != "new" && !item?.error && isImage(item.ext) && item.fileUrl){
		return item.fileUrl;
	} else {
		return checker(item);
	}
}
function chatFileType(contentType) {
    if (!contentType || typeof contentType !== 'string') {
        return "any";
    }
    if (/^image\//.test(contentType)) {
        return "image";
    } else if (/^audio\//.test(contentType)) {
        return "audio";
    } else if ((platform() != 'macos' && platform() != 'ios') && /^video\//.test(contentType)) {
        return "video";
    } else {
        return "any";
    }
}

const bitUnit = (value)=> {
	if(isNaN(value)){
		return "0B";
	}else if(typeof(value) != 'number'){
		return value;
	} else if(value>(1024 * 1024 * 1024)){
		return (value*100/(1024 * 1024 * 1024)).toFixed(0)/100 + "GB";
	} else if(value>(1024 * 1024)){
		return (value/(1024 * 1024)).toFixed(0) + "MB";
	} else if(value>1024){
		return (value/1024).toFixed(0) + "KB";
	} else {
		return (value*1).toFixed(0) + "B";
	}
}
const downloadSpeed = (value)=> {
	if(isNaN(value)){
		return 99;
	}else if(typeof(value) != 'number'){
		return 99;
	}else{
		const mb = (value/(1024 * 1024)).toFixed(2);
		return (100 / mb).toFixed(2) *1;
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
const saveFileDownload = ({fileUrl, saveUrl, progressHandler,headers, after}) => {
	download(fileUrl, saveUrl, (progress, total) => {
		if(progressHandler){
			progressHandler(progress, total)
		}
	},headers).then((resp)=>{
		debugger
		if(!!after){
			after(true)
		}
	}).catch((e2)=>{
		writeMobileFile('downloadError.txt',e2.toString());
		if(!!after){
			after()
		}
	});
}
const saveFile = ({fileUrl,name, before,progressHandler,headers, after}) => {
	if(!fileUrl){
		return
	}
	const filePathAry = fileUrl.split("/");
	const title = name||filePathAry[filePathAry.length-1];
	const ext = title.split(".")[1];
	
	documentDir().then((dir)=>{
		const defaultPath = `${dir}/${title}`;
		save({
			defaultPath,
			title,
			canCreateDirectories: true,
			filters: [{
				name: title,
				extensions: ext?[ext]:[]
			}]
		}).then((targetUrl)=>{
			if(targetUrl){
				if(!!before){
					before()
				}
				const saveUrl = getSavePath(targetUrl, defaultPath);
				remove(saveUrl).then(()=>{
					saveFileDownload({fileUrl, saveUrl,progressHandler,headers, after})
				}).catch(()=>{
					saveFileDownload({fileUrl, saveUrl,progressHandler,headers, after})
				})
			}
			// requestMeta(fileUrl)
			// 	.then(arrayBuffer => {
			// 		setTimeout(()=>{
			// 			create(getSavePath(targetUrl, name), {
			// 				write:true, 
			// 				create:true, 
			// 				baseDir: BaseDirectory.Document ,
			// 			}).then((file)=>{
			// 				file.write(convertToUint8Array(arrayBuffer)).then(()=>{
			// 					file.close();
			// 					if(!!after){
			// 						after()
			// 					}
			// 				});
			// 			}).catch((e2)=>{
			// 				writeMobileFile('saveFileReqError2.txt',e2.toString());
			// 				if(!!after){
			// 					after()
			// 				}
			// 			});
			// 		},300)
			// 		// fsWriteFile(targetUrl, uint8Array, { baseDir: BaseDirectory.Document }).then(()=>{
			// 		// 	if(!!after){
			// 		// 		after()
			// 		// 	}
			// 		// });
			// 	}).catch((e)=>{
			// 		writeMobileFile('saveFileReqError.txt',e.toString());
			// 		if(!!after){
			// 			after()
			// 		}
			// 	});
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
				if(targetUrl){
					let uint8Array = convertToUint8Array(data);
					setTimeout(()=>{
						const saveUrl = getSavePath(targetUrl, newFileName);
						remove(saveUrl).then(()=>{
							create(saveUrl, { 
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
						}).catch(()=>{
							create(saveUrl, {
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
						})
					},300)
				}
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
					const _name =  decodeURI( _file_ary[_file_ary.length-1]);
					const _target = `${path || dir}/${_name}`;
					_targets.push(_name);
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

const labels = (item, undownload)=>{
	if(!!item?.error){
		return item.error?.message.indexOf('404')>=0?'not find':'error'
	} else if(item?.downloading!=null && !undownload){
		return 'downloading'
	} else {
		return item?.state||''
	}
}
const colors = {
	new:'warn',
	changed:'warn',
	synced:'success',
	error: 'danger',
	'not find': 'secondary',
	downloading: 'contrast',
	missing: 'secondary',
	outdated: 'secondary'
}
export {
	ext, 
	checker, 
	bitUnit, 
	openFile, 
	icons,
	labels,
	colors,
	writeMobileFile, 
	convertToUint8Array,
	writeFile, 
	saveFile, 
	getSavePath,
	downloadFile, 
	importFiles,
	downloadSpeed,
	chatFileType,
	extIcon,
	isImage,
	isVideo,
	isAudio,
	isPdf,
	isText
};