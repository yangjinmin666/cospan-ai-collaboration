const { ACCESS_TOKEN_KEY } = require("../../utils/api.js");
const { buildProfileBlocks } = require("../../utils/profile-presenter.js");

const DEFAULT_PUBLIC_PROFILE_FIELDS = Object.freeze([
  "display_name",
  "avatar",
  "role",
  "status",
  "collaboration_need",
]);
const SWIPE_SOUND_KEY = "cospan_swipe_sound_enabled";
const FALLBACK_EVENT_NAME = "She Nicest 2026";

function visibilityPresentation(visible) {
  return visible
    ? {
      visibilityTitle: "展会内可见",
      visibilityCopy: "只展示你主动选择的公开字段，展会结束后自动隐藏。",
    }
    : {
      visibilityTitle: "已暂停展示",
      visibilityCopy: "当前不会出现在推荐、附近和展会名册中。",
    };
}

function confirmation(options) {
  return new Promise((resolve) => {
    wx.showModal({
      ...options,
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    });
  });
}

Page({
  data: {
    user: null,
    profile: null,
    loading: true,
    loadError: "",
    avatarClass: "memoji-5",
    eventName: FALLBACK_EVENT_NAME,
    navigationBottom: 60,
    visible: false,
    visibilityTitle: "已暂停展示",
    visibilityCopy: "当前不会出现在推荐、附近和展会名册中。",
    publicBlocks: [],
    publicBlockCount: 0,
    linkedPlatformCount: 0,
    saving: false,
    showSettings: false,
    linkSaving: "",
    linkForm: { website: "", github: "", xiaohongshu: "" },
    emailDetail: "未绑定 · 绑定后可换设备恢复账号",
    swipeSoundEnabled: true,
  },

  onLoad() {
    this.measureNavigation();
    const stored = getApp().globalData.storage.get(SWIPE_SOUND_KEY);
    this.setData({ swipeSoundEnabled: stored !== false });
  },

  onShow() {
    const tabBar = this.getTabBar?.();
    if (tabBar) tabBar.setData({ selected: 3 });
    this.load();
  },

  measureNavigation() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect?.();
      const windowInfo = wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {};
      const navigationBottom = menu?.bottom
        ? menu.bottom + 8
        : (windowInfo.statusBarHeight || 24) + 52;
      this.setData({ navigationBottom });
    } catch {
      this.setData({ navigationBottom: 60 });
    }
  },

  async load() {
    const app = getApp();
    this.setData({ loading: true, loadError: "" });
    try {
      const [me, eventsPayload, authMethods] = await Promise.all([
        app.globalData.api.get("/api/me"),
        app.globalData.api.get("/api/events"),
        app.globalData.api.get("/api/me/auth-methods").catch(() => null),
      ]);
      const profile = (me.profiles || []).find(
        (item) => item.event_id === app.globalData.eventId,
      ) || null;
      const platformLinks = me.platform_links || [];
      const links = new Map(platformLinks.map((item) => [item.platform, item.url]));
      const activeEvent = (eventsPayload.events || []).find(
        (item) => item.id === app.globalData.eventId,
      );
      const visible = profile?.visibility?.state === "VISIBLE";
      const publicBlocks = buildProfileBlocks(profile, platformLinks);
      const storedAvatar = app.globalData.storage.get("cospan_profile_avatar");
      const requestedAvatar = me.user?.avatar || storedAvatar || "memoji-5";
      app.globalData.user = me.user;
      this.setData({
        user: me.user,
        profile,
        avatarClass: /^memoji-(?:[1-9]|1[0-2])$/.test(requestedAvatar)
          ? requestedAvatar
          : "memoji-5",
        eventName: activeEvent?.name || FALLBACK_EVENT_NAME,
        visible,
        ...visibilityPresentation(visible),
        publicBlocks,
        publicBlockCount: publicBlocks.length,
        linkedPlatformCount: platformLinks.filter((item) => item?.url).length,
        emailDetail: authMethods?.email?.bound
          ? `${authMethods.email.masked_email || "已绑定"} · 可换设备登录`
          : "未绑定 · 绑定后可换设备恢复账号",
        linkForm: {
          website: links.get("website") || "",
          github: links.get("github") || "",
          xiaohongshu: links.get("xiaohongshu") || "",
        },
      });
    } catch (error) {
      this.setData({ loadError: error.message || "加载失败" });
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  retryLoad() {
    this.load();
  },

  openSettings() {
    this.setData({ showSettings: true });
  },

  closeSettings() {
    this.setData({ showSettings: false });
  },

  openPlatformSettings() {
    this.setData({ showSettings: false });
    wx.pageScrollTo({ selector: "#profile-platform-settings", duration: 280 });
  },

  updateLink(event) {
    this.setData({ [`linkForm.${event.currentTarget.dataset.platform}`]: event.detail.value });
  },

  async saveLink(event) {
    const platform = event.currentTarget.dataset.platform;
    const url = String(this.data.linkForm[platform] || "").trim();
    if (!url) {
      wx.showToast({ title: "请先填写公开主页链接", icon: "none" });
      return;
    }
    const publicFields = new Set(this.data.profile?.visibility?.public_fields || []);
    if (this.data.visible && publicFields.has("platform_links")) {
      const confirmed = await confirmation({
        title: "确认公开这个主页？",
        content: "你当前处于展会内可见状态。保存后，这个公开主页会立即出现在对外协作卡、推荐与现场名册中。",
        confirmText: "保存并公开",
        cancelText: "先不保存",
      });
      if (!confirmed) return;
    }
    this.setData({ linkSaving: platform });
    try {
      await getApp().globalData.api.put(`/api/me/platform-links/${platform}`, { url });
      wx.showToast({
        title: this.data.visible && publicFields.has("platform_links")
          ? "已保存并公开"
          : "链接已私密保存",
        icon: "success",
      });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || "链接保存失败", icon: "none" });
    } finally {
      this.setData({ linkSaving: "" });
    }
  },

  editProfile() {
    this.setData({ showSettings: false });
    wx.navigateTo({ url: "/pages/onboarding/onboarding" });
  },

  openSettingDetail(event) {
    const setting = event.currentTarget.dataset.setting;
    if (setting === "profile") return this.editProfile();
    if (setting === "platform" || setting === "authorization") {
      return this.openPlatformSettings();
    }
    if (setting === "device") {
      this.setData({ showSettings: false });
      wx.pageScrollTo({ selector: "#profile-device-preview", duration: 280 });
      return undefined;
    }
    const details = {
      email: ["登录邮箱", this.data.emailDetail],
      activity: ["展会与账号", `当前范围：${this.data.eventName}。公开状态可在“我的”页随时暂停。`],
    };
    const [title, content] = details[setting] || ["设置", "该设置将在正式版本继续开放。"];
    wx.showModal({ title, content, showCancel: false, confirmText: "知道了" });
    return undefined;
  },

  toggleSwipeSound() {
    const enabled = !this.data.swipeSoundEnabled;
    getApp().globalData.storage.set(SWIPE_SOUND_KEY, enabled);
    this.setData({ swipeSoundEnabled: enabled });
    wx.showToast({ title: enabled ? "滑动声效已开启" : "滑动声效已关闭", icon: "none" });
  },

  async toggleVisibility(event) {
    const app = getApp();
    const visible = typeof event?.detail?.value === "boolean"
      ? event.detail.value
      : !this.data.visible;
    this.setData({ saving: true });
    try {
      await app.globalData.api.patch(`/api/events/${app.globalData.eventId}/visibility`, visible
        ? {
          state: "VISIBLE",
          public_fields: this.data.profile?.visibility?.public_fields?.length
            ? this.data.profile.visibility.public_fields
            : DEFAULT_PUBLIC_PROFILE_FIELDS,
        }
        : { state: "PAUSED" });
      const profile = {
        ...this.data.profile,
        visibility: {
          ...(this.data.profile?.visibility || {}),
          state: visible ? "VISIBLE" : "PAUSED",
          public_fields: this.data.profile?.visibility?.public_fields?.length
            ? this.data.profile.visibility.public_fields
            : DEFAULT_PUBLIC_PROFILE_FIELDS,
        },
      };
      const publicBlocks = buildProfileBlocks(profile, Object.entries(this.data.linkForm)
        .filter(([, url]) => url)
        .map(([platform, url]) => ({ platform, url })));
      this.setData({
        profile,
        visible,
        publicBlocks,
        publicBlockCount: publicBlocks.length,
        ...visibilityPresentation(visible),
      });
    } catch (error) {
      const restored = !visible;
      this.setData({ visible: restored, ...visibilityPresentation(restored) });
      wx.showToast({ title: error.message || "更新失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async logout() {
    const app = getApp();
    await app.releasePresence();
    try {
      await app.globalData.api.delete("/api/auth/session");
    } catch {}
    app.globalData.storage.remove(ACCESS_TOKEN_KEY);
    app.globalData.user = null;
    wx.reLaunch({ url: "/pages/login/login" });
  },
});
