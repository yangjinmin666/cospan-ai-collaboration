const { scopeData, scopePageMethods, syncDiscoveryScope } = require("../../utils/discovery-scope.js");

function decorate(request, index) {
  const counterpart = request.counterpart || {};
  return {
    ...request,
    lastMessageText: request.last_message?.text || "",
    sourceLabel: request.source === "nfc" ? "碰卡建联" : "双方确认",
    contextDetail: request.context_label || "现场建联",
    counterpart: {
      ...counterpart,
      initials: String(counterpart.display_name || "合").slice(0, 1),
      avatarClass: /^memoji-(?:[1-9]|1[0-2])$/.test(counterpart.avatar || "")
        ? counterpart.avatar
        : `memoji-${(index % 12) + 1}`,
    },
  };
}

Page({
  ...scopePageMethods("connections", getApp, wx),
  data: {
    ...scopeData,
    incoming: [],
    outgoing: [],
    connected: [],
    visibleIncoming: [],
    visibleOutgoing: [],
    visibleConnected: [],
    filter: "all",
    eventName: "COSPAN 现场",
    eventChoices: [],
    loading: true,
    navigationTop: 44,
  },

  onLoad() {
    this.measureNavigation();
  },

  onShow() {
    syncDiscoveryScope(this, "connections", getApp());
    const tabBar = this.getTabBar?.();
    if (tabBar) tabBar.setData({ selected: 1 });
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  measureNavigation() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect?.();
      const windowInfo = wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {};
      const navigationTop = menu?.top
        ? menu.top
        : (windowInfo.statusBarHeight || 24) + 6;
      this.setData({ navigationTop });
    } catch {
      this.setData({ navigationTop: 44 });
    }
  },

  async load() {
    const app = getApp();
    const eventId = app.globalData.eventId;
    const loadVersion = (this.loadVersion || 0) + 1;
    this.loadVersion = loadVersion;
    this.setData({ loading: true });
    try {
      const query = { event_id: eventId };
      const [incomingPayload, outgoingPayload, eventsPayload] = await Promise.all([
        app.globalData.api.get("/api/connections/requests", { ...query, direction: "incoming" }),
        app.globalData.api.get("/api/connections/requests", { ...query, direction: "outgoing" }),
        app.globalData.api.get("/api/events"),
      ]);
      if (eventId !== app.globalData.eventId || loadVersion !== this.loadVersion) return;
      const incomingAll = (incomingPayload.requests || []).map(decorate);
      const outgoingAll = (outgoingPayload.requests || []).map(decorate);
      const connectedMap = new Map();
      [...incomingAll, ...outgoingAll]
        .filter((item) => item.status === "ACCEPTED" && item.connection_id)
        .forEach((item) => connectedMap.set(item.connection_id, item));
      const incoming = incomingAll.filter((item) => item.status === "REQUESTED");
      const outgoing = outgoingAll.filter((item) => item.status === "REQUESTED");
      const connected = [...connectedMap.values()];
      const currentEvent = (eventsPayload.events || []).find(
        (item) => item.id === eventId,
      );
      this.setData({
        incoming,
        outgoing,
        connected,
        eventName: currentEvent?.name || "COSPAN 现场",
        eventChoices: eventsPayload.events || [],
      });
      this.applyFilter(this.data.filter, { incoming, outgoing, connected });
      syncDiscoveryScope(this, "connections", getApp());
    } catch (error) {
      wx.showToast({ title: error.message || "连接同步失败", icon: "none" });
    } finally {
      if (loadVersion === this.loadVersion) this.setData({ loading: false });
    }
  },

  selectFilter(event) {
    this.applyFilter(event.currentTarget.dataset.filter);
  },

  applyFilter(filter, source = this.data) {
    const pendingVisible = filter !== "connected";
    const connectedVisible = filter !== "pending";
    this.setData({
      filter,
      visibleIncoming: pendingVisible ? source.incoming : [],
      visibleOutgoing: pendingVisible ? source.outgoing : [],
      visibleConnected: connectedVisible ? source.connected : [],
    });
  },

  async resolveRequest(event) {
    const { requestId, action } = event.currentTarget.dataset;
    try {
      await getApp().globalData.api.patch(`/api/connections/requests/${requestId}`, { action });
      const labels = { accept: "已建立连接", reject: "已婉拒", cancel: "已撤回" };
      wx.showToast({ title: labels[action] || "已更新", icon: action === "accept" ? "success" : "none" });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  },

  openConversation(event) {
    const { connectionId } = event.currentTarget.dataset;
    if (!connectionId) return;
    wx.navigateTo({ url: `/pages/conversation/conversation?connectionId=${connectionId}` });
  },

  goDiscover() {
    wx.switchTab({ url: "/pages/discover/discover" });
  },

  goCollaboration() {
    wx.switchTab({ url: "/pages/collaboration/collaboration" });
  },
});
