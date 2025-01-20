import { ext, bitUnit, extIcon } from "./file.js";

const top = "13px";
const iconwidth = "2.2em";
const svgwidth = "1.3em";

const isDrak = () => {
	return window.matchMedia('(prefers-color-scheme: dark)').matches
}
const templates = {
	initClass(deepChat){
		const shadowRoot = deepChat.shadowRoot;
		if (shadowRoot) {
		  const style = document.createElement('style');
		  style.textContent = `
		    .any-file-message-bubble,.any-file-message-bubble+.name,.any-file-message-bubble+.name+.avatar-container{
					display:none
				}
		  `;
		  shadowRoot.appendChild(style);
		}
	},
	video({file, src}){
		return `
		<video src="${src}" controls width="400" autoPlay playsInline muted>
		    Not support <video>。
		</video>
		`
	},
	acceptFile({mesh, base, file, src}){
		const contentType = file?.contentType || file?.type;
		const tms = new Date().getTime();
		const id = `accept-${tms}`;
		return `
			<accept-file id="${id}" mesh="${mesh}" base="${base}" src="${src}" hash="${file?.hash}" size="${file?.size}" contentType="${contentType}" fileName="${file.name}">
				<img slot="icon" src="${extIcon(contentType)}" width="40px" height="40px"/>
				<div slot="title">${file.name}</div>
				<div style="font-size:8pt;opacity:0.7" slot="attrs">
					${bitUnit(file.size)}
				</div>
			</accept-file>
		`
	}
}
const chatTheme = (viewHeight) => {
	if(isDrak()){
		return `width: 100%;flex: 1;border: none;height:${viewHeight}px;background-color: #1c1c1c`;
	}else{
		return `width: 100%;flex: 1;border: none;height:${viewHeight}px`;
	}
}
const auxiliaryStyle = () => {
	if(isDrak()){
		return "::-webkit-scrollbar-thumb, ::-webkit-scrollbar-track { background-color: #1c1c1c;}";
	} else {
		return "::-webkit-scrollbar-thumb, ::-webkit-scrollbar-track { background-color: #ffffff;}";
	}
}

const inputAreaStyle = () => {
	if(isDrak()){
		return {"backgroundColor": "#18181b"};
	} else {
		return {"backgroundColor": "#F4F6F7"};
	}
}

const dragAndDrop = () => {
	if(isDrak()){
		return {"backgroundColor": "#408f702d", "border": "5px dashed #226340"};
	} else {
		return {"backgroundColor": "#80ff704d", "border": "5px dashed #52c360"};
	}
}

const nameStyle = (user, isMobile) => {
	const base = {"position":"absolute","width": isMobile?"60px":"60px","marginTop": "40px","whiteSpace":"wrap","wordBreak":"break-all","textAlign":"center",  "fontSize": "12px"}
	const offset = isMobile?"-5px":"-5px";
	const rtn = {};
	if(isDrak()){
		rtn['default'] = {
			"style": { ...base, "color": "white", "fontSize": "12px","left": offset}
		}
		rtn['user'] = {
			"text": user,
			"style": { ...base, "color": "white", "fontSize": "12px","right": offset,"left":"auto"}
		}
		rtn['system'] = {
			"text": "System",
			"style": { ...base, "color": "white", "fontSize": "12px","left": offset}
		}
	} else {
		rtn['default'] =  {
			"style": { ...base, "fontSize": "12px","left": offset}
		};
		rtn['user'] = {
			"text": user,
			"style": { ...base, "fontSize": "12px","right": offset,"left":"auto"}
		};
		rtn['system'] =  {
			"text": "System",
			"style": { ...base, "fontSize": "12px","left": offset}
		};
	}
	return rtn;
}

const messageStyles = () => {
	const innerContainer = {"position": "relative"}//,"paddingTop":"5px","paddingBottom":"5px"};
	const bubbleStyle = {
		"wordBreak": "break-all",
		// "marginTop":"15px","marginBottom":"15px"
	}
	if(isDrak()){
		return {
			"default": {
				ai: {
					innerContainer,
					"bubble": {"backgroundColor": "#545454", "color": "white", ...bubbleStyle},
				},
				system: {
					innerContainer,
					"bubble": {"backgroundColor": "#545454", "color": "white", ...bubbleStyle},
				},
				user: {
					innerContainer,
					"bubble": {"backgroundColor": "#9855f7", "color": "white", ...bubbleStyle},
				}
			}
		};
	} else {
		return {
			"default": {
				ai: {
					innerContainer,
					"bubble": {"backgroundColor": "#f5f5f5", ...bubbleStyle},
				},
				system: {
					innerContainer,
					"bubble": {"backgroundColor": "#f5f5f5", ...bubbleStyle},
				},
				user: {
					innerContainer,
					"bubble": {"backgroundColor": "#9855f7", "color": "white", ...bubbleStyle},
				}
			}
		};
	}
}

const attachmentContainerStyle = () => {
	if(isDrak()){
		return {
			"backgroundColor": "rgba(20,20,20,0.5)","top": "-45px"
		}
	} else {
		return {
			"backgroundColor": "rgba(230,230,230,0.5)","top": "-45px"
		}
	}
}
const submitStyle = (position, space)=>{
	
	if(isDrak()){
		
		return {
			position,
			"submit": {
				"container": {
					"default": {
						top,
						"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
						"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
						"width": iconwidth,
						"height": iconwidth,
						"borderRadius": "3px",
						
					},
					"hover": {"backgroundColor": "#555555","boxShadow": "none"},
					"click": {"backgroundColor": "#555555","boxShadow": "none"}
				},
				"svg": {
					"styles": {
						"default": {
							"fontSize": svgwidth,
							"filter": "brightness(10) saturate(100%) invert(100%) sepia(100%) saturate(100%) hue-rotate(100deg) brightness(100%) contrast(100%)",
						}
					}
				}
					
			}
		}
	} else {
		
		return {
			position,
			"submit": {
				"container": {
					"default": {
						top,
						"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
						"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
						"width": iconwidth,
						"height": iconwidth,
						"borderRadius": "3px",
						
					},
					"hover": {"backgroundColor": "#f4f3ff","boxShadow": "none"},
					"click": {"backgroundColor": "#f4f3ff","boxShadow": "none"}
				},
				"svg": {
					"styles": {
						"default": {
							"fontSize": svgwidth,
						}
					}
				}
					
			}
		}
	}
}
const micStyle= (position, space)=>{
	let filter = "";
	if(isDrak()){
		filter = "brightness(0) saturate(100%) invert(100%) sepia(99%) saturate(1%) hue-rotate(343deg) brightness(100%) contrast(101%)"
	} else {
		filter = "brightness(0) saturate(100%) invert(1%) sepia(99%) saturate(1%) hue-rotate(343deg) brightness(100%) contrast(101%)"
	} 
	return {
    // "files": {
    //   "format": "mp3",
    //   "acceptedFormats": ".mp3"
    // },
		"button": {
			"default": {
				"container": {
					"default": {
						top,
						"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
						"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
						"borderRadius": "3px", "width": iconwidth, "height": iconwidth,
					},
				},
				"svg": {
					"styles": {
						"default": {
							"fontSize": svgwidth,
							filter
						},
					},
				}
			},
			"active": {
				"container": {
					"default": {
						"right": "10px",
						"zIndex": 10,
						"backgroundColor": "#9855f7"
					},
					"hover": {"backgroundColor": "#7855c7"},
					"click": {"backgroundColor": "#7855c7"}
				},
				"svg": {
					"styles": {
						"default": {
							"filter": "brightness(0) saturate(100%) invert(100%) sepia(99%) saturate(1%) hue-rotate(343deg) brightness(100%) contrast(101%)"
						}
					}
				}
			},
			position
		}
	}
}
const menuStyle = (position, space)=>{
	
	if(isDrak()){
		
		return {
			"button": {
				position,
				"styles": {
					"container": {
						"default": {
							top,
							"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
							"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
							"width": iconwidth,
							"height": iconwidth,
							
						},
						"hover": {"backgroundColor": "#333333"},
						"click": {"backgroundColor": "#333333"}
					},
					"svg": {"styles": {"default": {
						"fontSize": svgwidth, 
						// "fill": "black",
						"filter": "brightness(10) saturate(100%) invert(100%) sepia(100%) saturate(100%) hue-rotate(100deg) brightness(100%) contrast(100%)",
					}}}
				}
			}
		}
	} else {
		
		return {
			"button": {
				position,
				"styles": {
					"container": {
						"default": {
							top,
							"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
							"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
							"width": iconwidth,
							"height": iconwidth,
						},
						"hover": {"backgroundColor": "#f4f3ff"},
						"click": {"backgroundColor": "#f7edff"}
					},
					"svg": {"styles": {"default": {"fontSize": svgwidth}}}
				}
			}
		}
	}
}
const dropupStyles = () => {
	
	if(isDrak()){
		return {
			"button": {
				"position": "inside-left",
				"styles": {
					"container": {
						"default": {
							"position": "absolute",
							"top": "-40px",
							"width": "2.2em",
							"height": "2.2em",
						},
						"hover": {"backgroundColor": "#333333"},
						"click": {"backgroundColor": "#333333"}
					},
					"svg": {"styles": {"default": {"fontSize": "1.3em"}}}
				}
			},
			"menu": {
				"container": {
					"boxShadow": "#e2e2e2 0px 1px 3px 2px"
				},
				"item": {
					"hover": {
						"backgroundColor": "#333333"
					},
					"click": {
						"backgroundColor": "#333333"
					}
				},
				"iconContainer": {
					"width": "1.8em"
				},
				"text": {
					"fontSize": "1.05em"
				}
			}
		}
	} else {
		return {
			"button": {
				"position": "inside-left",
				"styles": {
					"container": {
						"default": {
							"position": "absolute",
							"top": "-40px",
							"width": "2.2em",
							"height": "2.2em",
						},
						"hover": {"backgroundColor": "#f4f3ff"},
						"click": {"backgroundColor": "#f7edff"}
					},
					"svg": {"styles": {"default": {"fontSize": "1.3em"}}}
				}
			},
			"menu": {
				"container": {
					"boxShadow": "#e2e2e2 0px 1px 3px 2px"
				},
				"item": {
					"hover": {
						"backgroundColor": "#f4f3ff"
					},
					"click": {
						"backgroundColor": "#f4f3ff"
					}
				},
				"iconContainer": {
					"width": "1.8em"
				},
				"text": {
					"fontSize": "1.05em"
				}
			}
		}
	}
}

const inputStyle = (isMobile) => {
	
	if(isDrak()){
		return {
			"styles": {
				"container": {
					"width": "100%",
					"margin": "0",
					"border": "unset",
					"wordBreak": "break-all",
					"borderTop": "1px solid #333333",
					"backgroundColor": "#18181B",
					"color": "#e8e8e8",
					"borderRadius": "0px",
					"boxShadow": "unset"
				},
				"text": {
					"fontSize": "1.05em",
					"paddingTop": "50px",
					"minHeight":!!isMobile?"100px":"100px",
					"paddingBottom": "13px",
					"paddingLeft": "12px",
					"paddingRight": "2.4em"
				}
			},
			"placeholder": {"text": "Type a message...", "style": {"color": "#bcbcbc"}}
		}
	} else {
		return {
			"styles": {
				"container": {
					"width": "100%",
					"margin": "0",
					"border": "unset",
					"wordBreak": "break-all",
					"borderTop": "1px solid #d5d5d5",
					"borderRadius": "0px",
					"boxShadow": "unset"
				},
				"text": {
					"fontSize": "1.05em",
					"paddingTop": "50px",
					"minHeight":!!isMobile?"100px":"100px",
					"paddingBottom": "13px",
					"paddingLeft": "12px",
					"paddingRight": "2.4em"
				}
			},
			"placeholder": {"text": "Type a message...", "style": {"color": "#bcbcbc"}}
		}
	}
}

const avatarStyle = {"avatar":{
	
	// "marginTop": "15px",
	"marginBottom": "10px",
	"marginLeft": "10px",
	"marginRight": "10px",
	"position":"relative",
	"borderRadius": "50%",
	"width": "30px",
	"height": "30px",
	"top":"-5px",
	"padding": "0px",
}};

export default{
	submitStyle, 
	micStyle, 
	menuStyle, 
	inputStyle, 
	avatarStyle, 
	dropupStyles, 
	isDrak,
	auxiliaryStyle,
	inputAreaStyle,
	dragAndDrop,
	nameStyle,
	messageStyles,
	attachmentContainerStyle,
	chatTheme,
	templates
}