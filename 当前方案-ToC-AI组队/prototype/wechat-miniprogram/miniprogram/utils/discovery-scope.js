const SCOPE_KEY = "cospan_discovery_scope";
const scopeData = { scopeOpen: false, discoveryScope: "event", scopeEventId: "", scopeLabel: "当前展会" };

function resetEventData(page, pageName) {
  const resets = {
    discover: { allPeople: [], people: [], nearby: [], nearbyFocus: null, currentPerson: null, nextPerson: null, currentIndex: 0, showDetails: false, profileIncomplete: true },
    connections: { incoming: [], outgoing: [], connected: [], visibleIncoming: [], visibleOutgoing: [], visibleConnected: [] },
    collaboration: { projects: [], invitations: [], connections: [], showCreate: false },
    profile: { profile: null, visible: false, publicBlocks: [], publicBlockCount: 0 },
  };
  page.setData(resets[pageName]);
}

function syncDiscoveryScope(page, pageName, app) {
  const scope = app.globalData.discoveryScope || app.globalData.storage.get(SCOPE_KEY);
  const discoveryScope = scope === "nearby" ? "nearby" : "event";
  const changed = page.data.discoveryScope !== discoveryScope;
  const currentEvent = (page.data.eventChoices || []).find((item) => item.id === app.globalData.eventId);
  const eventName = currentEvent?.name || page.data.eventName;
  if (page.data.scopeEventId && page.data.scopeEventId !== app.globalData.eventId) resetEventData(page, pageName);
  page.setData({
    discoveryScope,
    eventName,
    scopeEventId: app.globalData.eventId,
    scopeLabel: discoveryScope === "nearby" ? "日常附近" : eventName,
    ...(pageName === "discover" && (changed || discoveryScope === "nearby")
      ? { mode: discoveryScope === "nearby" ? "nearby" : "recommend", showDetails: false } : {}),
  });
}

function setTabBarOverlay(page, overlayOpen) {
  const tabBar = page.getTabBar?.();
  if (tabBar) tabBar.setData({ overlayOpen: Boolean(overlayOpen) });
}

function scopePageMethods(pageName, appProvider, wxApi) {
  return {
    onHide() { this.closeScopeSelector(); },
    openEventSelector() {
      syncDiscoveryScope(this, pageName, appProvider());
      this.setData({ scopeOpen: true, filterOpen: false, showDetails: false, showSettings: false });
      setTabBarOverlay(this, true);
    },
    closeScopeSelector() {
      this.setData({ scopeOpen: false });
      setTabBarOverlay(this, false);
    },
    async selectDiscoveryScope(event) {
      const { scope, eventId } = event.detail || {};
      if (!["event", "nearby"].includes(scope)) return;
      const app = appProvider();
      const selected = (this.data.eventChoices || []).find((item) => item.id === eventId);
      if (!selected || (scope === "nearby" && eventId !== app.globalData.eventId)) return;
      const eventChanged = scope === "event" && eventId !== app.globalData.eventId;
      const scopeChanged = this.data.discoveryScope !== scope;
      if (pageName === "discover" && (eventChanged || scopeChanged)) this.stopNearby();
      if (eventChanged) {
        resetEventData(this, pageName);
        app.globalData.eventId = eventId;
      }
      app.globalData.discoveryScope = scope;
      app.globalData.storage.set(SCOPE_KEY, scope);
      this.setData({ scopeOpen: false, eventName: selected.name });
      setTabBarOverlay(this, false);
      syncDiscoveryScope(this, pageName, app);
      if (pageName === "discover") {
        if (eventChanged || scopeChanged) this.setData({
          currentIndex: 0, showDetails: false,
          currentPerson: eventChanged ? null : this.data.people[0] || null,
          nextPerson: eventChanged ? null : this.data.people[1] || null,
        });
        if (eventChanged) await this.load();
      } else if (eventChanged) {
        await this.load();
      }
    },
    manageScopeVisibility() {
      this.closeScopeSelector();
      if (pageName === "profile") {
        wxApi.pageScrollTo({ selector: "#profile-visibility", duration: 250 });
      } else {
        wxApi.switchTab({ url: "/pages/profile/profile" });
      }
    },
  };
}

module.exports = { SCOPE_KEY, scopeData, syncDiscoveryScope, scopePageMethods };
