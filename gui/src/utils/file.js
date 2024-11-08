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
import sharePng from "@/assets/img/files/share.png";
import txt from "@/assets/img/files/txt.png";
import zip from "@/assets/img/files/zip.png";
import userfolder from "@/assets/img/files/userfolder.png";
import { open } from '@tauri-apps/plugin-shell';
import { download } from '@tauri-apps/plugin-upload';
import { platform } from '@/utils/platform';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { create, remove, copyFile, writeFile as fsWriteFile, exists,mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { documentDir } from '@tauri-apps/api/path';
import toast from "@/utils/toast";
import exportFromJSON from 'export-from-json';
import { requestMeta } from '@/service/common/request';
import { invoke } from '@tauri-apps/api/core';
import { share } from 'tauri-plugin-share-api'

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
	} else if(isMobile()){
		const newAry = target.split("/");
		const newName = newAry[newAry.length-1];
		const oldName = dft?dft.split("/")[dft.split("/").length-1]:'';
		if(!!oldName && newName.split(".")[0].split('%20')[0] == oldName.split(".")[0]){
			newAry[newAry.length-1] = oldName;
			return decodeURI(newAry.join("/"));
		}else{
			return decodeURI(newName);
		}
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
	//share: sharePng,
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
const openFolder = (path) => {
	documentDir().then((dir)=>{
		if(platform() == 'ios'){
		} else if(platform() == 'android'){
		} else if(platform() == 'web'){
		} else {
			open(`${dir}/${path}`);
		}
	})
}
const mimeTypes = {
	"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
	"potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
	"ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
	"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"sldx": "application/vnd.openxmlformats-officedocument.presentationml.slide",
	"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
	"xlam": "application/vnd.ms-excel.addin.macroEnabled.12",
	"xlsb": "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
	"apk": "application/vnd.android.package-archive",
	"hqx": "application/mac-binhex40",
	"cpt": "application/mac-compactpro",
	"doc": "application/msword",
	"ogg": "audio/ogg",
	"pdf": "application/pdf",
	"rtf": "text/rtf",
	"mif": "application/vnd.mif",
	"xls": "application/vnd.ms-excel",
	"ppt": "application/vnd.ms-powerpoint",
	"odc": "application/vnd.oasis.opendocument.chart",
	"odb": "application/vnd.oasis.opendocument.database",
	"odf": "application/vnd.oasis.opendocument.formula",
	"odg": "application/vnd.oasis.opendocument.graphics",
	"otg": "application/vnd.oasis.opendocument.graphics-template",
	"odi": "application/vnd.oasis.opendocument.image",
	"odp": "application/vnd.oasis.opendocument.presentation",
	"otp": "application/vnd.oasis.opendocument.presentation-template",
	"ods": "application/vnd.oasis.opendocument.spreadsheet",
	"ots": "application/vnd.oasis.opendocument.spreadsheet-template",
	"odt": "application/vnd.oasis.opendocument.text",
	"odm": "application/vnd.oasis.opendocument.text-master",
	"ott": "application/vnd.oasis.opendocument.text-template",
	"oth": "application/vnd.oasis.opendocument.text-web",
	"sxw": "application/vnd.sun.xml.writer",
	"stw": "application/vnd.sun.xml.writer.template",
	"sxc": "application/vnd.sun.xml.calc",
	"stc": "application/vnd.sun.xml.calc.template",
	"sxd": "application/vnd.sun.xml.draw",
	"std": "application/vnd.sun.xml.draw.template",
	"sxi": "application/vnd.sun.xml.impress",
	"sti": "application/vnd.sun.xml.impress.template",
	"sxg": "application/vnd.sun.xml.writer.global",
	"sxm": "application/vnd.sun.xml.math",
	"sis": "application/vnd.symbian.install",
	"wbxml": "application/vnd.wap.wbxml",
	"wmlc": "application/vnd.wap.wmlc",
	"wmlsc": "application/vnd.wap.wmlscriptc",
	"bcpio": "application/x-bcpio",
	"torrent": "application/x-bittorrent",
	"bz2": "application/x-bzip2",
	"vcd": "application/x-cdlink",
	"pgn": "application/x-chess-pgn",
	"cpio": "application/x-cpio",
	"csh": "application/x-csh",
	"dvi": "application/x-dvi",
	"spl": "application/x-futuresplash",
	"gtar": "application/x-gtar",
	"hdf": "application/x-hdf",
	"jar": "application/java-archive",
	"jnlp": "application/x-java-jnlp-file",
	"js": "application/javascript",
	"json": "application/json",
	"ksp": "application/x-kspread",
	"chrt": "application/x-kchart",
	"kil": "application/x-killustrator",
	"latex": "application/x-latex",
	"rpm": "application/x-rpm",
	"sh": "application/x-sh",
	"shar": "application/x-shar",
	"swf": "application/x-shockwave-flash",
	"sit": "application/x-stuffit",
	"sv4cpio": "application/x-sv4cpio",
	"sv4crc": "application/x-sv4crc",
	"tar": "application/x-tar",
	"tcl": "application/x-tcl",
	"tex": "application/x-tex",
	"man": "application/x-troff-man",
	"me": "application/x-troff-me",
	"ms": "application/x-troff-ms",
	"ustar": "application/x-ustar",
	"src": "application/x-wais-source",
	"zip": "application/zip",
	"m3u": "audio/x-mpegurl",
	"ra": "audio/x-pn-realaudio",
	"wav": "audio/x-wav",
	"wma": "audio/x-ms-wma",
	"wax": "audio/x-ms-wax",
	"pdb": "chemical/x-pdb",
	"xyz": "chemical/x-xyz",
	"bmp": "image/bmp",
	"gif": "image/gif",
	"ief": "image/ief",
	"png": "image/png",
	"wbmp": "image/vnd.wap.wbmp",
	"ras": "image/x-cmu-raster",
	"pnm": "image/x-portable-anymap",
	"pbm": "image/x-portable-bitmap",
	"pgm": "image/x-portable-graymap",
	"ppm": "image/x-portable-pixmap",
	"rgb": "image/x-rgb",
	"xbm": "image/x-xbitmap",
	"xpm": "image/x-xpixmap",
	"xwd": "image/x-xwindowdump",
	"css": "text/css",
	"rtx": "text/richtext",
	"tsv": "text/tab-separated-values",
	"jad": "text/vnd.sun.j2me.app-descriptor",
	"wml": "text/vnd.wap.wml",
	"wmls": "text/vnd.wap.wmlscript",
	"etx": "text/x-setext",
	"mxu": "video/vnd.mpegurl",
	"flv": "video/x-flv",
	"wm": "video/x-ms-wm",
	"wmv": "video/x-ms-wmv",
	"wmx": "video/x-ms-wmx",
	"wvx": "video/x-ms-wvx",
	"avi": "video/x-msvideo",
	"movie": "video/x-sgi-movie",
	"ice": "x-conference/x-cooltalk",
	"3gp": "video/3gpp",
	"ai": "application/postscript",
	"aif": "audio/x-aiff",
	"aifc": "audio/x-aiff",
	"aiff": "audio/x-aiff",
	"asc": "text/plain",
	"atom": "application/atom+xml",
	"au": "audio/basic",
	"bin": "application/octet-stream",
	"cdf": "application/x-netcdf",
	"cgm": "image/cgm",
	"class": "application/octet-stream",
	"dcr": "application/x-director",
	"dif": "video/x-dv",
	"dir": "application/x-director",
	"djv": "image/vnd.djvu",
	"djvu": "image/vnd.djvu",
	"dll": "application/octet-stream",
	"dmg": "application/octet-stream",
	"dms": "application/octet-stream",
	"dtd": "application/xml-dtd",
	"dv": "video/x-dv",
	"dxr": "application/x-director",
	"eps": "application/postscript",
	"exe": "application/octet-stream",
	"ez": "application/andrew-inset",
	"gram": "application/srgs",
	"grxml": "application/srgs+xml",
	"gz": "application/x-gzip",
	"htm": "text/html",
	"html": "text/html",
	"ico": "image/x-icon",
	"ics": "text/calendar",
	"ifb": "text/calendar",
	"iges": "model/iges",
	"igs": "model/iges",
	"jp2": "image/jp2",
	"jpe": "image/jpeg",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"kar": "audio/midi",
	"lha": "application/octet-stream",
	"lzh": "application/octet-stream",
	"m4a": "audio/mp4a-latm",
	"m4p": "audio/mp4a-latm",
	"m4u": "video/vnd.mpegurl",
	"m4v": "video/x-m4v",
	"mac": "image/x-macpaint",
	"mathml": "application/mathml+xml",
	"mesh": "model/mesh",
	"mid": "audio/midi",
	"midi": "audio/midi",
	"mov": "video/quicktime",
	"mp2": "audio/mpeg",
	"mp3": "audio/mpeg",
	"mp4": "video/mp4",
	"mpe": "video/mpeg",
	"mpeg": "video/mpeg",
	"mpg": "video/mpeg",
	"mpga": "audio/mpeg",
	"msh": "model/mesh",
	"nc": "application/x-netcdf",
	"oda": "application/oda",
	"ogv": "video/ogv",
	"pct": "image/pict",
	"pic": "image/pict",
	"pict": "image/pict",
	"pnt": "image/x-macpaint",
	"pntg": "image/x-macpaint",
	"ps": "application/postscript",
	"qt": "video/quicktime",
	"qti": "image/x-quicktime",
	"qtif": "image/x-quicktime",
	"ram": "audio/x-pn-realaudio",
	"rdf": "application/rdf+xml",
	"rm": "application/vnd.rn-realmedia",
	"roff": "application/x-troff",
	"sgm": "text/sgml",
	"sgml": "text/sgml",
	"silo": "model/mesh",
	"skd": "application/x-koan",
	"skm": "application/x-koan",
	"skp": "application/x-koan",
	"skt": "application/x-koan",
	"smi": "application/smil",
	"smil": "application/smil",
	"snd": "audio/basic",
	"so": "application/octet-stream",
	"svg": "image/svg+xml",
	"t": "application/x-troff",
	"texi": "application/x-texinfo",
	"texinfo": "application/x-texinfo",
	"tif": "image/tiff",
	"tiff": "image/tiff",
	"tr": "application/x-troff",
	"txt": "text/plain",
	"vrml": "model/vrml",
	"vxml": "application/voicexml+xml",
	"webm": "video/webm",
	"webp": "image/webp",
	"wrl": "model/vrml",
	"xht": "application/xhtml+xml",
	"xhtml": "application/xhtml+xml",
	"xml": "application/xml",
	"xsl": "application/xml",
	"xslt": "application/xslt+xml",
	"xul": "application/vnd.mozilla.xul+xml"
  };
const openFile = (path) => {
	//{ read: true, write: false, baseDir: BaseDirectory.Home }
	if(platform() == 'ios'){
		invoke('shareFile', { url: path })
	} else if(platform() == 'android'){
		const ext = path.split('.').pop().toLowerCase()
		const mimeType = mimeTypes[ext];
		share(path, mimeType).then((res) => {
			console.log("share ok")
			console.log(res)
		}).catch((res) => {
			console.log("share err")
			console.log(res)
		})
		//toast.add({ severity: 'contrast', summary: 'Tips', detail: `Please go to the Files App: /ztm/ztmCloud folder to open it.`, life: 3000 });
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
		if(!!after){
			after(saveUrl);
			openFile(saveUrl);
		}
	}).catch((e2)=>{
		writeMobileFile('downloadError.txt',`error:${e2.toString()}\nurl:${fileUrl}\nsaveUrl:${saveUrl}`);
		if(!!after){
			after()
		}
	});
}
const saveFilePc = ({fileUrl,name, before,progressHandler,headers, after}) => {
	
	if(!!window.__TAURI_INTERNALS__){
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
					saveFileDownload({fileUrl, saveUrl,progressHandler,headers, after})
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
	} else {
		const link = document.createElement('a');
		link.href = fileUrl;
		link.download = name; 
		document.body.appendChild(link);
		link.click();
	}
}

const saveFileMobile = ({fileUrl,name,base, before,progressHandler,headers, after}) => {
	
	if(!!window.__TAURI_INTERNALS__){
		const filePathAry = fileUrl.split("/");
		const title = name||filePathAry[filePathAry.length-1];
		const ext = title.split(".")[1];
		
		documentDir().then((dir)=>{
			const defaultPath = `${dir}/${base}/${title}`;
			// const defaultPath = `${dir}/${title}`;
			if(!!before){
				before()
			}
			saveFileDownload({fileUrl, saveUrl:defaultPath,progressHandler,headers, after})
		});
	} else {
		const link = document.createElement('a');
		link.href = fileUrl;
		link.download = name; 
		document.body.appendChild(link);
		link.click();
	}
}

const saveFile = ({fileUrl,name,base, before,progressHandler,headers, after}) => {
	if(!fileUrl){
		return
	}
	if(platform() == 'ios'){
		saveFileMobile({fileUrl,name,base, before,progressHandler,headers, after})
	} else {
		saveFilePc({fileUrl,name, before,progressHandler,headers, after})
	}
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
const fsInit = () => {
	writeMobileFile('Readme.txt', `Welcome ZTM workspace!`);
	
	exists('ztmChat', { baseDir: BaseDirectory.Document }).then((has)=>{
		if(!has){
			mkdir('ztmChat', { baseDir: BaseDirectory.Document });
		}
	})
	
	exists('ztmDownloads', { baseDir: BaseDirectory.Document }).then((has)=>{
		if(!has){
			mkdir('ztmDownloads', { baseDir: BaseDirectory.Document });
		}
	})
}

const folderInit = (pathAry, base) => {
	const rootPath = pathAry.join("/");
	exists(rootPath, { baseDir: BaseDirectory.Document }).then((has2)=>{
		if(!has2){
			mkdir(rootPath, { baseDir: BaseDirectory.Document }).then(()=>{
				exists(`${rootPath}/${base}`, { baseDir: BaseDirectory.Document }).then((has)=>{
					if(!has){
						mkdir(`${rootPath}/${base}`, { baseDir: BaseDirectory.Document });
					}
				})
			})
		} else {
			exists(`${rootPath}/${base}`, { baseDir: BaseDirectory.Document }).then((has)=>{
				if(!has){
					mkdir(`${rootPath}/${base}`, { baseDir: BaseDirectory.Document });
				}
			})
		}
	})
}
const existsFile = (path, name, callback) => {
	exists(`${path}/${name}`, { baseDir: BaseDirectory.Document }).then((has)=>{
		if(has){
			documentDir().then((dir)=>{
				callback(`${dir}/${path}/${name}`,`${dir}/${path}`)
			})
		}	else {
			callback("")
		}
	})
}
export {
	fsInit,
	folderInit,
	existsFile,
	ext, 
	checker, 
	bitUnit, 
	openFile, 
	openFolder,
	icons,
	labels,
	colors,
	writeMobileFile, 
	convertToUint8Array,
	writeFile, 
	saveFile, 
	saveFileMobile,
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