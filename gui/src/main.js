import { createApp } from 'vue';
import App from './App.vue';
import { initRouter } from "./router";
import store from "./store";
import PrimeVue from 'primevue/config';
// import 'primevue/resources/themes/aura-light-purple/theme.css'
import ToastService from 'primevue/toastservice';
import DialogService from 'primevue/dialogservice';
import ConfirmationService from 'primevue/confirmationservice';
import { useComponent } from './components';
import { useDirective } from './directives';
import bootstrap from "@/bootstrap";
import '@/assets/styles.scss';

const app = createApp(App);
app.use(PrimeVue, { ripple: true });
app.use(ToastService);
app.use(DialogService);
app.use(ConfirmationService);
useComponent(app);
useDirective(app);

async function setRouter() {
  const router = await initRouter({ store });
  app.use(router);
  app.mount("#app");
  bootstrap({ router, store });
}
setRouter();