const avatarColors = [
  '#e01e5a', // 红色
  '#2eb67d', // 绿色
  '#ecb22e', // 黄色
  '#1d9bd1', // 蓝色
  '#611f69', // 紫色
  '#36c5f0', // 天蓝
  '#f2c744', // 金色
  '#ff6b6b', // 珊瑚红
  '#4ecdc4', // 青绿
  '#9b59b6', // 紫红
  '#e67e22', // 橙色
  '#1abc9c', // 薄荷
]

export const getAvatarColor = (name) => {
  if (!name) return avatarColors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % avatarColors.length
  return avatarColors[index]
}
