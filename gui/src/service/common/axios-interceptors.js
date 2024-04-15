import Cookie from './cookie'

const resp401 = {
  onFulfilled(response, options) {
    const { message } = options;
    if (response.code === 401) {
      message.error("No permission");
    }
    return response;
  },
  onRejected(error, options) {
    const { message } = options;
    const { response } = error;
    if (response.status === 401) {
      message.error("No permission");
    }
    return Promise.reject(error);
  },
};

const resp403 = {
  onFulfilled(response, options) {
    const { message } = options;
    if (response.code === 403) {
      message.error("Request denied");
    }
    return response;
  },
  onRejected(error, options) {
    const { message } = options;
    const { response } = error;
    if (response.status === 403) {
      message.error("Request denied");
    }
    return Promise.reject(error);
  },
};

const reqCommon = {
  onFulfilled(config) {
    const { url, xsrfCookieName } = config;
    if (
      url.indexOf("login") === -1 &&
      xsrfCookieName &&
      !Cookie.get("Authorization")
    ) {
      // message.warning("The authentication token has expired. Please log in again");
    }
    return config;
  },
  onRejected(error, options) {
    const { message } = options;
    message.error(error.message);
    return Promise.reject(error);
  },
};

export default {
  request: [reqCommon],
  response: [resp401, resp403],
};
