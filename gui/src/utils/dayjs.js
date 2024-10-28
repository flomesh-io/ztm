import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
const extend = (locale) => {
	if(locale == 'en'){
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