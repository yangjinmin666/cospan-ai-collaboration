const { ApiError, createApiClient } = require("./api.js");

function createStorage(wxApi) {
  return {
    get: (key) => wxApi.getStorageSync(key),
    set: (key, value) => wxApi.setStorageSync(key, value),
    remove: (key) => wxApi.removeStorageSync(key),
  };
}

function createRequest(wxApi) {
  return (options) => new Promise((resolve, reject) => {
    wxApi.request({
      ...options,
      timeout: Number.isFinite(options.timeout)
        ? Math.max(1000, Math.min(options.timeout, 60_000)) : 12_000,
      success: resolve,
      fail: (error) => {
        const timedOut = /timeout/i.test(error?.errMsg || "");
        reject(new ApiError(timedOut
          ? "请求等待超时，请刷新确认结果后再重试"
          : "无法连接 COSPAN 服务，请检查网络", {
          code: timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        }));
      },
    });
  });
}

function createRuntime({ wxApi, baseUrl }) {
  const storage = createStorage(wxApi);
  const api = createApiClient({
    baseUrl,
    request: createRequest(wxApi),
    storage,
    onUnauthorized: () => wxApi.reLaunch({ url: "/pages/login/login" }),
  });
  return { api, storage };
}

module.exports = { createRuntime };
