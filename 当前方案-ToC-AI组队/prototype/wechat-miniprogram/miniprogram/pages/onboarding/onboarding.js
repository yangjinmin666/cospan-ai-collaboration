const {
  buildProfileInput,
  cleanList,
  PROFILE_STATUS_OPTIONS,
  PUBLIC_PROFILE_FIELDS,
  validateProfileInput,
} = require("../../utils/domain.js");

const PREFERENCE_OPTIONS = ["快速原型", "结对协作", "异步记录", "先聊清目标"];
const AVATARS = ["memoji-1", "memoji-2", "memoji-4", "memoji-5", "memoji-7", "memoji-9"];

function validHttpsUrl(value) {
  if (!String(value || "").trim()) return true;
  try {
    return new URL(String(value).trim()).protocol === "https:";
  } catch {
    return false;
  }
}

Page({
  data: {
    step: 0,
    progress: 25,
    headerTop: 52,
    statuses: PROFILE_STATUS_OPTIONS,
    preferences: PREFERENCE_OPTIONS,
    preferenceChoices: PREFERENCE_OPTIONS.map((label) => ({
      label,
      selected: label === "快速原型",
    })),
    avatars: AVATARS,
    saving: false,
    form: {
      platformLinks: { xiaohongshu: "", jike: "", github: "", linkedin: "" },
      projectTitle: "",
      projectUrl: "",
      projectSummary: "",
      displayName: "",
      role: "",
      status: PROFILE_STATUS_OPTIONS[0],
      skills: "",
      interests: "",
      availability: "",
      collaborationPreferences: ["快速原型"],
      vibe: "",
      avatar: "memoji-5",
      publicConfirmed: false,
    },
  },

  onLoad() {
    this.syncSafeHeader();
    this.hydrate();
  },

  syncSafeHeader() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu?.bottom) this.setData({ headerTop: menu.bottom + 8 });
    } catch {}
  },

  async hydrate() {
    const app = getApp();
    try {
      const me = await app.globalData.api.get("/api/me");
      const profile = (me.profiles || []).find((item) => item.event_id === app.globalData.eventId);
      const links = new Map((me.platform_links || []).map((item) => [item.platform, item.url]));
      const userName = me.user?.display_name || "";
      const displayName = /^(?:COSPAN|RALLY) 新朋友$/.test(userName) ? "" : userName;
      const collaborationPreferences = profile?.collaboration_preferences?.length
        ? profile.collaboration_preferences
        : ["快速原型"];
      this.setData({
        "form.displayName": displayName,
        "form.platformLinks.xiaohongshu": links.get("xiaohongshu") || "",
        "form.platformLinks.jike": links.get("jike") || "",
        "form.platformLinks.github": links.get("github") || "",
        "form.platformLinks.linkedin": links.get("linkedin") || "",
        "form.status": profile?.status || PROFILE_STATUS_OPTIONS[0],
        "form.role": profile?.role === "待完善协作资料" ? "" : (profile?.role || ""),
        "form.skills": (profile?.skills || []).join("，"),
        "form.interests": (profile?.interests || []).join("，"),
        "form.availability": profile?.availability === "待补充" ? "" : (profile?.availability || ""),
        "form.collaborationPreferences": collaborationPreferences,
        preferenceChoices: PREFERENCE_OPTIONS.map((label) => ({
          label,
          selected: collaborationPreferences.includes(label),
        })),
        "form.vibe": profile?.collaboration_need || "",
        "form.avatar": app.globalData.storage.get("cospan_profile_avatar") || "memoji-5",
      });
    } catch {}
  },

  updateField(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  updatePlatform(event) {
    this.setData({
      [`form.platformLinks.${event.currentTarget.dataset.platform}`]: event.detail.value,
    });
  },

  chooseStatus(event) {
    this.setData({ "form.status": event.currentTarget.dataset.status });
  },

  togglePreference(event) {
    const value = event.currentTarget.dataset.preference;
    const current = this.data.form.collaborationPreferences;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value].slice(0, 5);
    this.setData({
      "form.collaborationPreferences": next,
      preferenceChoices: PREFERENCE_OPTIONS.map((label) => ({
        label,
        selected: next.includes(label),
      })),
    });
  },

  chooseAvatar(event) {
    this.setData({ "form.avatar": event.currentTarget.dataset.avatar });
  },

  togglePublic(event) {
    this.setData({ "form.publicConfirmed": event.detail.value.length > 0 });
  },

  next() {
    if (this.data.step === 0) {
      const invalid = Object.values(this.data.form.platformLinks).some((url) => !validHttpsUrl(url));
      if (invalid) {
        wx.showToast({ title: "公开主页需使用 HTTPS 链接", icon: "none" });
        return;
      }
    }
    if (this.data.step === 1 && this.data.form.projectUrl && !validHttpsUrl(this.data.form.projectUrl)) {
      wx.showToast({ title: "项目链接需使用 HTTPS", icon: "none" });
      return;
    }
    if (this.data.step === 2) {
      if (
        !this.data.form.role.trim()
        || cleanList(this.data.form.skills).length < 3
        || cleanList(this.data.form.interests).length < 1
        || !this.data.form.vibe.trim()
        || !this.data.form.collaborationPreferences.length
      ) {
        wx.showToast({ title: "请补充角色、至少 3 项能力、关注方向和一句介绍", icon: "none" });
        return;
      }
    }
    if (this.data.step >= 3) {
      this.save();
      return;
    }
    const step = this.data.step + 1;
    this.setData({ step, progress: (step + 1) * 25 });
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });
  },

  secondary() {
    if (this.data.step === 3) {
      this.setData({ step: 2, progress: 75 });
      wx.pageScrollTo({ scrollTop: 0, duration: 180 });
      return;
    }
    const step = Math.min(3, this.data.step + 1);
    this.setData({ step, progress: (step + 1) * 25 });
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });
  },

  back() {
    if (this.data.step === 0) {
      this.skip();
      return;
    }
    const step = this.data.step - 1;
    this.setData({ step, progress: (step + 1) * 25 });
    wx.pageScrollTo({ scrollTop: 0, duration: 180 });
  },

  skip() {
    wx.switchTab({ url: "/pages/discover/discover" });
  },

  async save() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!form.publicConfirmed) {
      wx.showToast({ title: "请先确认公开范围", icon: "none" });
      return;
    }
    const projectEvidence = form.projectTitle || form.projectSummary || form.projectUrl
      ? `${form.projectUrl ? "【项目证据·链接】" : "【项目证据·标题】"}${form.projectTitle || "正在做的项目"}｜${form.projectSummary || "欢迎当面交流这个项目"}${form.projectUrl ? `｜${form.projectUrl.trim()}` : ""}`
      : "";
    const profile = buildProfileInput({
      displayName: form.displayName,
      role: form.role,
      status: form.status,
      skills: form.skills,
      interests: form.interests,
      availability: form.availability || "本场活动期间可沟通",
      collaborationPreferences: form.collaborationPreferences,
      collaborationNeed: form.vibe,
      evidence: projectEvidence ? [projectEvidence] : [],
    });
    const validation = validateProfileInput(profile);
    if (!validation.valid) {
      wx.showToast({ title: validation.message, icon: "none" });
      return;
    }
    const app = getApp();
    this.setData({ saving: true });
    try {
      await app.globalData.api.patch(`/api/events/${app.globalData.eventId}/profile`, profile);
      const publicPlatforms = Object.entries(form.platformLinks).filter(([, url]) => url.trim());
      for (const [platform, url] of publicPlatforms) {
        await app.globalData.api.put(`/api/me/platform-links/${platform}`, { url: url.trim() });
      }
      await app.globalData.api.patch(
        `/api/events/${app.globalData.eventId}/visibility`,
        {
          state: "VISIBLE",
          public_fields: PUBLIC_PROFILE_FIELDS.filter((field) => (
            field !== "platform_links" || publicPlatforms.length
          )),
        },
      );
      app.globalData.storage.set("cospan_profile_avatar", form.avatar);
      wx.switchTab({ url: "/pages/discover/discover" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
