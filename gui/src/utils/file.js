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

function convertToUint8Array(input) {
  let buffer;

  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input).buffer;
  } else if (typeof input === 'object' && input !== null) {
    const jsonString = JSON.stringify(input);
    buffer = new TextEncoder().encode(jsonString).buffer;
  } else if (input instanceof ArrayBuffer) {
    buffer = input;
  } else if (input instanceof Uint8Array) {
    return input;
  } else {
    throw new Error('Unsupported input type for conversion to Uint8Array');
  }
  return new Uint8Array(buffer);
}

const initWorkspace = () => {
	if(platform() == 'ios' || platform() == 'android'){
		create("Readme.txt", { baseDir: BaseDirectory.Document }).then((file)=>{
			file.write(new TextEncoder().encode("Welcome ZTM!")).then(()=>{
				file.close();
			});
		})
	}
}

const writeFile = (file, target, after) => {
	const reader = new FileReader();
	reader.onload = function(event) {
		const uint8Array = convertToUint8Array(event.target.result);
		create(target, { baseDir: BaseDirectory.Document }).then((file)=>{
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


const FileTypes = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
  video: ['mp4', 'webm', 'ogg'],
  audio: ['mp3', 'wav', 'ogg'],
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
      return convertToUint8Array(arrayBuffer);
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
			
			fetchFileAsUint8Array(fileUrl)
				.then(uint8Array => {
					create(targetUrl, { baseDir: BaseDirectory.Document }).then((file)=>{
						file.write(uint8Array).then(()=>{
							file.close();
							if(!!after){
								after()
							}
						});
					})
					// fsWriteFile(targetUrl, uint8Array, { baseDir: BaseDirectory.Document }).then(()=>{
					// 	if(!!after){
					// 		after()
					// 	}
					// });
				});
		})
	});
}

const downloadFile = ({
	ext, data, fileName, after
}) => {
	if(platform() == 'web'){
		let exportType = exportFromJSON.types[ext];
		exportFromJSON({ 
			data,
			fileName,
			exportType
		})
	} else {
		documentDir().then((defaultPath)=>{
			save({
				defaultPath:`${defaultPath}/${fileName}`,
				title: fileName,
				canCreateDirectories: true,
				filters: [{
					name: fileName,
					extensions: ext?[ext]:[]
				}]
			}).then((targetUrl)=>{
				let uint8Array = convertToUint8Array(data);
				create(targetUrl, { baseDir: BaseDirectory.Document }).then((file)=>{
					file.write(uint8Array).then(()=>{
						file.close();
						if(after){
							after()
						}
					});
				})
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
	initWorkspace, 
	writeFile, 
	saveFile, 
	downloadFile, 
	importFiles,
	isImage,
	isVideo,
	isAudio,
	isPdf,
	isText
};