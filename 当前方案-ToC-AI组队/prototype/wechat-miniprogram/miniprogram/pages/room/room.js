const { firstClaimableTask } = require("../../utils/domain.js");
const { addAgentPresentation, agentErrorMessage } = require("../../utils/room-agent.js");

Page({
  data: {
    projectId: "",
    room: null,
    working: false,
    loading: false,
    loadError: "",
    actionError: "",
    actionTaskId: "",
    agentTaskId: "",
  },

  onLoad(options) {
    this.setData({ projectId: options.projectId || "" });
  },

  onShow() {
    this._visible = true;
    if (this.data.projectId) return this.load();
    else this.setData({ loadError: "缺少项目信息，请返回协作页面重新进入。" });
  },

  onHide() {
    this._visible = false;
    clearTimeout(this._pollTimer);
  },

  onUnload() { this.onHide(); },

  async load({ silent = false } = {}) {
    clearTimeout(this._pollTimer);
    if (!this.data.projectId) return false;
    const app = getApp();
    this.setData({ loading: true });
    try {
      const room = await app.globalData.api.get(`/api/projects/${this.data.projectId}/room`);
      const currentUserId = app.globalData.user?.id;
      const memberNames = new Map(
        (room.members || []).map((member) => [member.user_id, member.display_name]),
      );
      const claimableTask = firstClaimableTask(room.tasks || []);
      room.tasks = (room.tasks || []).map((task) => ({
        ...task,
        ownerName: task.confirmed_owner_id
          ? (memberNames.get(task.confirmed_owner_id) || "已有负责人")
          : "待领取",
        canClaim: task.status === "PROPOSED" && !task.confirmed_owner_id,
        claimLabel: task.id === claimableTask?.id ? "建议你先领取" : "我来负责",
        canStart: task.status === "ACCEPTED"
          && task.confirmed_owner_id === currentUserId
          && room.starter_pack?.status === "CONFIRMED",
        canComplete: task.status === "IN_PROGRESS" && task.confirmed_owner_id === currentUserId,
      }));
      room.canConfirmPlan = Boolean(
        room.starter_pack && room.starter_pack.status !== "CONFIRMED"
      );
      this.setData({ room: addAgentPresentation(room, currentUserId), loadError: "" });
      return true;
    } catch (error) {
      this.setData({ loadError: error.message || "空间加载失败，请重试。" });
      if (!silent) wx.showToast({ title: "空间加载失败，请重试", icon: "none" });
      return false;
    } finally {
      this.setData({ loading: false });
      if (this._visible && this.data.room?.hasPendingAgent && !this.data.loadError) {
        this._pollTimer = setTimeout(() => this.load({ silent: true }), 3000);
      }
    }
  },

  async generatePlan() {
    await this.runAction(async () => {
      await getApp().globalData.api.post(
        `/api/projects/${this.data.projectId}/starter-pack`,
        {},
        { timeout: 35000 },
      );
      wx.showToast({ title: "任务建议已生成", icon: "success" });
    });
  },

  async claimTask(event) {
    const taskId = event.currentTarget.dataset.taskId;
    await this.runAction(async () => {
      await getApp().globalData.api.patch(`/api/tasks/${taskId}`, { action: "claim" });
      wx.showToast({ title: "任务已领取", icon: "success" });
    });
  },

  async confirmPlan() {
    await this.runAction(async () => {
      const result = await getApp().globalData.api.post(
        `/api/projects/${this.data.projectId}/plan-confirmations`,
        {},
      );
      wx.showToast({
        title: `${result.confirmation_progress.confirmed}/${result.confirmation_progress.required} 已确认`,
        icon: "none",
      });
    });
  },

  async moveTask(event) {
    const { taskId, action } = event.currentTarget.dataset;
    await this.runAction(async () => {
      await getApp().globalData.api.patch(`/api/tasks/${taskId}`, { action });
      wx.showToast({ title: action === "start" ? "已开始执行" : "已完成", icon: "success" });
    });
  },

  async requestAgent(event) {
    const taskId = event.currentTarget.dataset.taskId;
    const task = this.data.room?.tasks.find((item) => item.id === taskId);
    if (this.data.working || this.data.loading || this.data.loadError || !task?.canRunAgent) return;
    const { api, storage, user } = getApp().globalData;
    const storageKey = `cospan_agent_attempt:${user.id}:${taskId}`;
    // Keep the same attempt after an ambiguous timeout, including page/app restarts.
    const attempt = storage.get(storageKey)
      || `mini-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage.set(storageKey, attempt);
    this.setData({ agentTaskId: taskId, actionTaskId: taskId });
    await this.runAction(async () => {
      const result = await api.post(`/api/tasks/${taskId}/agent-runs`, {}, {
        timeout: 35000,
        headers: { "x-idempotency-key": attempt },
      });
      if (!result.agent_run) throw new Error("尚未取得生成结果，请刷新查看。");
      storage.remove(storageKey);
      if (result.agent_run.status === "FAILED") {
        const failure = new Error("AI 生成失败，请稍后重试。");
        failure.code = result.agent_run.error_code;
        throw failure;
      }
      wx.showToast({
        title: result.agent_run.status === "REVIEW_PENDING" ? "简报已生成，待你确认" : "已同步生成状态",
        icon: "none",
      });
    });
    this.setData({ agentTaskId: "" });
  },

  async reviewAgent(event) {
    const { runId, decision } = event.currentTarget.dataset;
    const run = this.findAgentRun(runId);
    if (this.data.working || !run?.canReview || !["APPROVED", "REJECTED"].includes(decision)) return;
    const approved = decision === "APPROVED";
    const confirmed = await this.confirmAgentAction(approved ? "采纳这份简报？" : "不采纳这份简报？",
      approved ? "请先核对内容。采纳只确认这份简报，不会自动完成任务。" : "原简报会保留，你可以重新发起调研。");
    if (!confirmed) return;
    this.setData({ actionTaskId: run.task_id });
    await this.runAction(async () => {
      await getApp().globalData.api.post(`/api/agent-runs/${runId}/review`, { decision });
      wx.showToast({ title: approved ? "已采纳简报" : "已标记未采纳", icon: "none" });
    });
  },

  async cancelAgent(event) {
    const { runId } = event.currentTarget.dataset;
    const run = this.findAgentRun(runId);
    if (this.data.working || !run?.canCancel) return;
    if (!await this.confirmAgentAction("取消这次生成？", "这次结果将不再进入确认流程；已发生的模型调用可能仍会计费。")) return;
    this.setData({ actionTaskId: run.task_id });
    await this.runAction(async () => {
      await getApp().globalData.api.post(`/api/agent-runs/${runId}/cancel`, {});
      wx.showToast({ title: "已取消生成", icon: "none" });
    });
  },

  findAgentRun(runId) {
    for (const task of this.data.room?.tasks || []) {
      const run = task.agentRuns.find((item) => item.id === runId);
      if (run) return run;
    }
    return null;
  },

  confirmAgentAction(title, content) {
    return new Promise((resolve) => wx.showModal({
      title, content, confirmText: "确认", confirmColor: "#343c46",
      success: (result) => resolve(Boolean(result.confirm)), fail: () => resolve(false),
    }));
  },

  async runAction(action) {
    if (this.data.working || this.data.loading || this.data.loadError) return;
    this.setData({ working: true, actionError: "" });
    try {
      await action();
    } catch (error) {
      this.setData({ actionError: agentErrorMessage(error) });
      wx.showToast({ title: "操作未完成，请查看提示", icon: "none" });
    } finally {
      // Mutations may have reached the server even when the response was lost.
      await this.load({ silent: true });
      this.setData({ working: false });
    }
  },
});
