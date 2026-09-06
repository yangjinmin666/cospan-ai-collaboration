const { ACCESS_TOKEN_KEY } = require("../../utils/api.js");
const { loginWithWechat } = require("../../utils/auth.js");
const { animateFrame } = require("../../utils/splash-frame.js");

const AUTO_LOGIN_DELAY_MS = 1600;
const SPLASH_MIN_VISIBLE_MS = 2400;
const SPLASH_EXIT_DURATION_MS = 360;
const CONTACT_SCENE_FALLBACK_TOP_PX = 72;

function getContactSceneTop() {
  try {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const windowInfo = typeof wx.getWindowInfo === "function"
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync();
    const statusBarHeight = Number(windowInfo.statusBarHeight) || 0;
    const navigationBottom = Number(menuButton.bottom) || statusBarHeight + 44;
    return Math.ceil(Math.max(
      navigationBottom + 8,
      statusBarHeight + 56,
    ));
  } catch {
    return CONTACT_SCENE_FALLBACK_TOP_PX;
  }
}

Page({
  data: {
    loading: false,
    loginError: false,
    loginErrorMessage: "",
    isExiting: false,
    frameReady: false,
    contactSceneTop: CONTACT_SCENE_FALLBACK_TOP_PX,
  },

  async onLoad() {
    this.splashStartedAt = Date.now();
    this.splashReadyAt = Date.now() + SPLASH_MIN_VISIBLE_MS;
    this.setData({ contactSceneTop: getContactSceneTop() });
    const app = getApp();
    if (!app.globalData.storage.get(ACCESS_TOKEN_KEY)) {
      this.scheduleAutoLogin();
      return;
    }
    try {
      const me = await app.globalData.api.get("/api/me");
      app.globalData.user = me.user;
      this.navigateAfterSplash("/pages/discover/discover");
    } catch (error) {
      if (error.statusCode === 401) {
        app.globalData.storage.remove(ACCESS_TOKEN_KEY);
        this.scheduleAutoLogin();
      } else {
        this.setData({ loginError: true, loginErrorMessage: error.message || "连接未完成，请稍后重试。" });
      }
    }
  },

  onReady() {
    this.createSelectorQuery().select("#splash-frame").fields({ node: true, size: true }).exec(results => {
      if (this.splashDisposed) return;
      const surface = results?.[0];
      if (!surface?.node || !surface.width || !surface.height) return;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.stopFrame = animateFrame(surface.node, surface.width, surface.height, info.pixelRatio || 1, this.splashStartedAt || Date.now());
        this.setData({ frameReady: true });
      } catch {
        // Keep the aligned static fallback on runtimes without Canvas 2D.
        this.stopFrame?.();
      }
    });
  },

  onUnload() {
    this.splashDisposed = true;
    this.stopFrame?.();
    clearTimeout(this.autoLoginTimer);
    clearTimeout(this.splashReadyTimer);
    clearTimeout(this.splashExitTimer);
  },

  scheduleAutoLogin() {
    clearTimeout(this.autoLoginTimer);
    this.autoLoginTimer = setTimeout(() => this.login(), AUTO_LOGIN_DELAY_MS);
  },

  navigateAfterSplash(url) {
    clearTimeout(this.splashReadyTimer);
    clearTimeout(this.splashExitTimer);
    const remaining = Math.max(0, (this.splashReadyAt || Date.now()) - Date.now());
    this.splashReadyTimer = setTimeout(() => {
      this.setData({ isExiting: true });
      this.splashExitTimer = setTimeout(() => {
        wx.reLaunch({ url });
      }, SPLASH_EXIT_DURATION_MS);
    }, remaining);
  },

  async login() {
    if (this.data.loading) return;
    const app = getApp();
    this.setData({ loading: true, loginError: false, loginErrorMessage: "" });
    try {
      const session = await loginWithWechat({
        wxApi: wx,
        api: app.globalData.api,
        storage: app.globalData.storage,
      });
      app.globalData.user = session.user;
      this.navigateAfterSplash(
        session.is_new_user
          ? "/pages/onboarding/onboarding"
          : "/pages/discover/discover",
      );
    } catch (error) {
      this.setData({ loginError: true, loginErrorMessage: error.message || "登录未完成，请重试。" });
      wx.showToast({ title: error.message || "登录失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
});
