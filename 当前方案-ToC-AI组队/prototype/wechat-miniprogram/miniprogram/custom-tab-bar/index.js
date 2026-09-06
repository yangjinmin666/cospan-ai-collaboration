Component({
  data: {
    selected: 0,
    overlayOpen: false,
    list: [
      { pagePath: "/pages/discover/discover", text: "发现", icon: "discover" },
      { pagePath: "/pages/connections/connections", text: "连接", icon: "connections" },
      { pagePath: "/pages/collaboration/collaboration", text: "协作", icon: "collaboration" },
      { pagePath: "/pages/profile/profile", text: "我的", icon: "profile" }
    ]
  },

  methods: {
    switchTab(event) {
      const { path, index } = event.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
