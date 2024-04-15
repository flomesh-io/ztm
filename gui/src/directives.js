import StyleClass from 'primevue/styleclass';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import BadgeDirective from 'primevue/badgedirective';

export function useDirective(app){
	app.directive('tooltip', Tooltip);
	app.directive('badge', BadgeDirective);
	app.directive('ripple', Ripple);
	app.directive('styleclass', StyleClass);
}
