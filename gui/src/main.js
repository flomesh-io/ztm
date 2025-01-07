// import 'vite/modulepreload-polyfill'
import { createApp } from 'vue';
import App from './App.vue';
import { initRouter } from "./router";
import store from "./store";
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import DialogService from 'primevue/dialogservice';
import ConfirmationService from 'primevue/confirmationservice';
import { useComponent } from './components';
import { useDirective } from './directives';
import rulesReg from './rules/reg';
import bootstrap from "@/bootstrap";
import MyPreset from './theme';
import '@/assets/styles.scss';
import 'virtual:svg-icons-register';
import i18n from './i18n';

const app = createApp(App);
app.use(PrimeVue, { 
	ripple: true ,
	theme: {
		preset: MyPreset,
		options: {
				prefix: '',
				darkModeSelector: 'system',
				cssLayer: false
		}
	}
});

app.mixin({
  mounted() {
    document.querySelectorAll('button:not(.link)').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
      });
    });
  }
});

useComponent(app);
useDirective(app);
app.use(store);
app.use(ToastService);
app.use(DialogService);
app.use(ConfirmationService);
app.use(i18n);

async function setRouter() {
  const router = await initRouter({ store });
  app.use(router);
  app.mount("#app");
  bootstrap({ router, store });
}
setRouter();