/**
 * 通过用户名获取对应的 SVG 路径
 * @param {string} username - 用户名
 * @returns {string | null} - SVG 路径（如果存在），否则返回 null
 */

/**
 * 生成并存储 SVG，与用户名配对
 * @param {string} username - 用户名
 * @returns {Promise<string>} - 返回生成的 SVG 路径
 */

	
async function generateSvgAndSave(username) {
  // 如果已存在，直接返回路径
	if(!username || !username[0]){
		return
	}
  // 生成 SVG 内容
  const svgContent = generateSvgContent(username);

  // 存储 SVG 为 Blob URL
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  return url;
}

async function generateList(usernames) {
	const avatars = []
	for (var index in usernames) {
		const avatar = await generateSvgAndSave(usernames[index]);
		avatars.push([usernames[index], avatar]);
	}
	return avatars;
}
/**
 * 生成 SVG 内容
 * @param {string} username - 用户名
 * @returns {string} - SVG 字符串
 */
function generateSvgContent(username) {
  const initials = username[0].toUpperCase();
  const bgColor = generateBackgroundColor(username);
  const fontSize = 20;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <rect width="40" height="40" fill="${bgColor}" />
      <text x="20" y="22" text-anchor="middle" fill="#fff" font-size="${fontSize}" font-family="Arial" dy=".35em">${initials}</text>
    </svg>
  `;
}

/**
 * 生成背景颜色
 * @param {string} username - 用户名
 * @returns {string} - HSL 颜色字符串
 */
function generateBackgroundColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 70%, 60%)`;
}

export { generateSvgAndSave, generateList };