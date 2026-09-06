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
        const detail = error?.errMsg || "";
        const failure = /url not in domain list|not in.*legal.*domain|不在.*合法域名/i.test(detail)
          ? ["DOMAIN_NOT_ALLOWED", "微信拦截了当前预览的服务地址，请联系开发者更新预览配置。"]
          : /ssl|certificate|cert_authority|cert_date/i.test(detail)
            ? ["TLS_ERROR", "服务安全连接失败，请稍后重试或联系开发者。"]
            : /timeout/i.test(detail)
              ? ["REQUEST_TIMEOUT", "请求等待超时，请刷新确认结果后再重试"]
              : ["NETWORK_ERROR", "无法连接 COSPAN 服务，请检查网络"];
        reject(new ApiError(failure[1], { code: failure[0] }));
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
