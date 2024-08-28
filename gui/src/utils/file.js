import excel from "@/assets/img/files/excel.png";
import word from "@/assets/img/files/word.png";
import file from "@/assets/img/files/file.png";
import folder from "@/assets/img/files/folder1.png";
import img from "@/assets/img/files/img2.png";
import mp3 from "@/assets/img/files/mp3.png";
import mp4 from "@/assets/img/files/mp4.png";
import pdf from "@/assets/img/files/pdf.png";
import ppt from "@/assets/img/files/ppt.png";
import share from "@/assets/img/files/share.png";
import txt from "@/assets/img/files/txt.png";
import zip from "@/assets/img/files/zip.png";

const ext = {
	default: file,
	folder: folder,
	share: share,
	xls: excel,
	xlsx: excel,
	doc: word,
	docx: word,
	pdf: pdf,
	pdfx: pdf,
	jpeg: img,
	jpg: img,
	mp3: mp3,
	wav: mp3,
	mp4: mp4,
	ppt: ppt,
	txt: txt,
	md: txt,
	zip: zip,
	tar: zip,
	rar: zip,
	"7z": zip,
};
const checker = (name) => {
	if(name.charAt(name.length-1) == "/"){
		return ext.folder
	} else if(name.indexOf(".")>-1) {
		const nameAry = name.split("/");
		const _name = nameAry[nameAry.length -1];
		const _ext = _name.split(".")[_name.split(".").length-1]
		return ext[_ext] || ext.default
	} else {
		return ext.default;
	}
}
export {
	ext, checker
};