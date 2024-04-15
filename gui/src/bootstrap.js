import { loadInterceptors } from "@/service/common/request";
import interceptors from "@/service/common/axios-interceptors";
import guards from "@/router/guards";

let appOptions = {
  router: undefined,
  store: undefined,
};

function loadGuards(guards, options) {
  const { beforeEach, afterEach } = guards;
  const { router } = options;
  beforeEach.forEach((guard) => {
    if (guard && typeof guard === "function") {
      router.beforeEach((to, from, next) => guard(to, from, next, options));
    }
  });
  afterEach.forEach((guard) => {
    if (guard && typeof guard === "function") {
      router.afterEach((to, from) => guard(to, from, options));
    }
  });
}

function setAppOptions(options) {
  const { router, store } = options;
  appOptions.router = router;
  appOptions.store = store;
}

function bootstrap({ router, store }) {
  setAppOptions({ router, store });
  loadInterceptors(interceptors, { router, store });
  loadGuards(guards, { router, store });
}

export default bootstrap;
