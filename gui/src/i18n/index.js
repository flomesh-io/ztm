import { createI18n } from 'vue-i18n';

// 导入语言文件
import en from './en.json';
import zh from './zh.json';

const messages = {
  en,
  zh,
};
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let tzLang = 'en';
if (timeZone === "Asia/Shanghai" || timeZone === "Asia/Chongqing") {
	tzLang = 'zh'
} else if (timeZone === "Asia/Hong_Kong") {
	tzLang = 'zh'
}
const defaultLang = localStorage.getItem('lang')|| tzLang ||import.meta.env.VITE_APP_LANG;
// 创建 i18n 实例
const i18n = createI18n({
  locale: defaultLang, 
  fallbackLocale: 'en', 
  messages,
});

export default i18n;