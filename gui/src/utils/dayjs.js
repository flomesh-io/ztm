import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
const extend = (locale) => {
	if(locale == 'zh'){
		dayjs.locale('zh', {
			relativeTime: {
				future: '%s',
				past: '%s',
				s: '刚刚',
				m: '1 分钟前',
				mm: '%d 分钟前',
				h: '1 小时前',
				hh: '%d 小时前',
				d: '1 天前',
				dd: '%d 天前',
				M: '1 月前',
				MM: '%d 月前',
				y: '1 年前',
				yy: '%d 年前',
			}
		});
	} else {
		dayjs.locale('en', {
			relativeTime: {
				future: 'in %s',
				past: '%s',
				s: 'just',
				m: '1 min',
				mm: '%d mins',
				h: '1 hour',
				hh: '%d hours',
				d: '1 day',
				dd: '%d days',
				M: '1 mth',
				MM: '%d mths',
				y: '1 year',
				yy: '%d years',
			}
		});
	}
	dayjs.extend(relativeTime)
}

export {
	dayjs, extend
}