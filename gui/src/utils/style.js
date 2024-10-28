const top = "13px";
const iconwidth = "2.2em";
const svgwidth = "1.3em";

const isDrak = () => {
	return window.matchMedia('(prefers-color-scheme: dark)').matches
}
const chatTheme = (viewHeight) => {
	if(isDrak()){
		return `width: 100%;flex: 1;border: none;height:${viewHeight}px;background-color: #292929`;
	}else{
		return `width: 100%;flex: 1;border: none;height:${viewHeight}px`;
	}
}
const auxiliaryStyle = () => {
	if(isDrak()){
		return "::-webkit-scrollbar-thumb { background-color: #333333;}";
	} else {
		return "::-webkit-scrollbar-thumb { background-color: #f5f5f5;}";
	}
}

const inputAreaStyle = () => {
	if(isDrak()){
		return {"backgroundColor": "#333333"};
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

const nameStyle = (user) => {
	const base = {"position":"absolute","width": "50px","marginTop": "40px","whiteSpace":"wrap","wordBreak":"break-all","textAlign":"center",  "fontSize": "12px"}
	if(isDrak()){
		return {
			default: {
				"style": { ...base, "color": "white", "fontSize": "12px","left": "5px"}
			},
			user: {
				"text": user,
				"style": { ...base, "color": "white", "fontSize": "12px","right": "5px","left":"auto"}
			},
			system: {
				"text": "System",
				"style": { ...base, "color": "white", "fontSize": "12px","left": "5px"}
			}
		}
	} else {
		return {
			default: {
				"style": { ...base, "fontSize": "12px","left": "5px"}
			},
			user: {
				"text": user,
				"style": { ...base, "fontSize": "12px","right": "5px","left":"auto"}
			},
			system: {
				"text": "System",
				"style": { ...base, "fontSize": "12px","left": "5px"}
			}
		}
	}
}

const messageStyles = () => {
	
	if(isDrak()){
		return {
			"default": {
				system: {"bubble": {"backgroundColor": "#545454", "color": "white"}},
				user: {"bubble": {"backgroundColor": "#9855f7", "color": "white"}}
			}
		};
	} else {
		return {
			"default": {
				system: {"bubble": {"backgroundColor": "#f5f5f5",}},
				user: {"bubble": {"backgroundColor": "#9855f7", "color": "white"}}
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
						"borderRadius": "25px",
						
					},
					"hover": {"backgroundColor": "#555555","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"},
					"click": {"backgroundColor": "#555555","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"}
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
						"borderRadius": "25px",
						
					},
					"hover": {"backgroundColor": "#f4f3ff","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"},
					"click": {"backgroundColor": "#f4f3ff","boxShadow": "0px 0.3px 0.9px rgba(0, 0, 0, 0.12), 0px 1.6px 3.6px rgba(0, 0, 0, 0.16)"}
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
	return {
		"button": {
			"default": {
				"container": {"default": {
					top,
					"left": (position=='inside-left' || position=='outside-left') ? space : 'auto',
					"right": (position=='inside-right' || position=='outside-right') ? space : 'auto',
					"borderRadius": "20px", "width": iconwidth, "height": iconwidth}},
				"svg": {"styles": {"default": {"fontSize": svgwidth}}}
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
					"borderTop": "1px solid #555555",
					"backgroundColor": "#333333",
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

const avatarStyle = {"avatar":{"position":"relative","width": "30px","height": "30px","top":"-10px"}};

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
	chatTheme
}