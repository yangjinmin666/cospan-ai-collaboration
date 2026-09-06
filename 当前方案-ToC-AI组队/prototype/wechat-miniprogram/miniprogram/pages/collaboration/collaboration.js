const { cleanList } = require("../../utils/domain.js");
const { scopeData, scopePageMethods, syncDiscoveryScope } = require("../../utils/discovery-scope.js");

Page({
  ...scopePageMethods("collaboration", getApp, wx),
  data: {
    ...scopeData,
    projects: [],
    invitations: [],
    connections: [],
    eventName: "现场活动",
    eventChoices: [],
    navigationTop: 44,
    showCreate: false,
    creating: false,
    expandedInvites: {},
    loading: false,
    loadError: "",
    projectForm: {
      title: "",
      summary: "",
      roleTitle: "",
      roleSkills: "",
    },
  },

  onLoad() {
    this.measureNavigation();
  },

  onShow() {
    syncDiscoveryScope(this, "collaboration", getApp());
    const tabBar = this.getTabBar?.();
    if (tabBar) tabBar.setData({ selected: 2 });
    this.load();
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
    this.setData({ loading: true, loadError: "" });
    try {
      const query = { event_id: eventId };
      const [projects, invitations, incoming, outgoing, eventsPayload] = await Promise.all([
        app.globalData.api.get("/api/projects", query),
        app.globalData.api.get("/api/team-invitations", {
          ...query,
          direction: "incoming",
          status: "PENDING",
        }),
        app.globalData.api.get("/api/connections/requests", {
          ...query,
          direction: "incoming",
          status: "ACCEPTED",
        }),
        app.globalData.api.get("/api/connections/requests", {
          ...query,
          direction: "outgoing",
          status: "ACCEPTED",
        }),
        app.globalData.api.get("/api/events"),
      ]);
      if (eventId !== app.globalData.eventId || loadVersion !== this.loadVersion) return;
      const connectionMap = new Map();
      [...(incoming.requests || []), ...(outgoing.requests || [])].forEach((request) => {
        connectionMap.set(request.counterpart.id, request.counterpart);
      });
      const connections = [...connectionMap.values()];
      const currentEvent = (eventsPayload.events || []).find(
        (item) => item.id === eventId,
      );
      const mappedProjects = (projects.projects || []).map((project) => {
        const members = new Set((project.members || []).map((member) => member.user_id));
        const openRoles = (project.role_needs || []).filter(
          (need) => need.remaining_capacity > 0,
        );
        const inviteCandidates = connections.filter((person) => !members.has(person.id));
        const inviteOptions = inviteCandidates.flatMap((person) => openRoles.map((role) => ({
          key: `${person.id}:${role.id}`,
          inviteeId: person.id,
          displayName: person.display_name,
          roleNeedId: role.id,
          roleTitle: role.title,
        })));
        return {
          ...project,
          statusLabel: ({ FORMING: "组队中", ACTIVE: "进行中", ARCHIVED: "已归档" })[project.status] || "待更新",
          membershipLabel: ({ ORIGINATOR: "发起人", LEADER: "负责人", MEMBER: "成员" })[project.my_membership?.membership_role] || "成员",
          inviteOptions: project.my_membership.membership_role === "MEMBER"
            ? []
            : inviteOptions,
        };
      });
      this.setData({
        projects: mappedProjects,
        invitations: invitations.invitations || [],
        connections,
        eventName: currentEvent?.name || "现场活动",
        eventChoices: eventsPayload.events || [],
      });
      syncDiscoveryScope(this, "collaboration", getApp());
    } catch (error) {
      this.setData({ loadError: error.message || "暂时无法更新，请重试" });
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      if (loadVersion === this.loadVersion) this.setData({ loading: false });
    }
  },

  toggleInviteOptions(event) {
    const id = event.currentTarget.dataset.projectId;
    this.setData({ expandedInvites: { ...this.data.expandedInvites, [id]: !this.data.expandedInvites[id] } });
  },

  toggleCreate() {
    this.setData({ showCreate: !this.data.showCreate });
  },

  updateProjectField(event) {
    this.setData({ [`projectForm.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  async createProject() {
    if (this.data.creating) return;
    const form = this.data.projectForm;
    const skills = cleanList(form.roleSkills);
    if (!form.title.trim() || !form.roleTitle.trim() || !skills.length) {
      wx.showToast({ title: "请补齐项目和缺口信息", icon: "none" });
      return;
    }
    const app = getApp();
    this.setData({ creating: true });
    try {
      const result = await app.globalData.api.post("/api/projects", {
        event_id: app.globalData.eventId,
        title: form.title.trim(),
        summary: form.summary.trim(),
        role_need: {
          title: form.roleTitle.trim(),
          skills,
          capacity: 2,
        },
      });
      this.setData({ showCreate: false });
      wx.navigateTo({ url: `/pages/room/room?projectId=${result.project.id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "创建失败", icon: "none" });
    } finally {
      this.setData({ creating: false });
    }
  },

  async acceptInvitation(event) {
    const invitationId = event.currentTarget.dataset.invitationId;
    try {
      const result = await getApp().globalData.api.patch(
        `/api/team-invitations/${invitationId}`,
        { action: "accept" },
      );
      wx.navigateTo({ url: `/pages/room/room?projectId=${result.invitation.project_id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "接受失败", icon: "none" });
    }
  },

  async inviteCandidate(event) {
    const project = this.data.projects.find(
      (item) => item.id === event.currentTarget.dataset.projectId,
    );
    const option = project?.inviteOptions.find(
      (item) => item.key === event.currentTarget.dataset.optionKey,
    );
    if (!project || !option) return;
    try {
      await getApp().globalData.api.post(`/api/projects/${project.id}/invitations`, {
        invitee_id: option.inviteeId,
        role_need_id: option.roleNeedId,
      });
      wx.showToast({ title: "入队邀请已发出", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "邀请失败", icon: "none" });
    }
  },

  openRoom(event) {
    wx.navigateTo({
      url: `/pages/room/room?projectId=${event.currentTarget.dataset.projectId}`,
    });
  },
});
