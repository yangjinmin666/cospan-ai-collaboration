function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    connectionId: "",
    conversation: null,
    messages: [],
    draft: "",
    sending: false,
    scrollTop: 0,
  },

  onLoad(options) {
    this.setData({ connectionId: options.connectionId || "" });
  },

  onShow() {
    if (this.data.connectionId) this.load();
  },

  async load() {
    const app = getApp();
    try {
      const payload = await app.globalData.api.get(`/api/connections/${this.data.connectionId}/conversation`);
      const conversation = payload.conversation;
      const currentUserId = app.globalData.user?.id;
      const messages = (conversation.messages || []).map((message) => ({
        ...message,
        isMine: message.sender_id === currentUserId,
        timeLabel: formatTime(message.created_at),
      }));
      this.setData({ conversation, messages, scrollTop: messages.length * 220 + 9999 });
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      if (conversation.unread_count > 0 && lastMessage) {
        await app.globalData.api.patch(
          `/api/connections/${this.data.connectionId}/conversation`,
          { last_read_message_id: lastMessage.id },
        );
      }
      if (conversation.counterpart?.display_name) {
        wx.setNavigationBarTitle({ text: conversation.counterpart.display_name });
      }
    } catch (error) {
      wx.showToast({ title: error.message || "对话加载失败", icon: "none" });
    }
  },

  updateDraft(event) {
    this.setData({ draft: event.detail.value });
  },

  async sendMessage() {
    const text = String(this.data.draft || "").trim();
    if (!text || this.data.sending) return;
    this.setData({ sending: true });
    try {
      await getApp().globalData.api.post(
        `/api/connections/${this.data.connectionId}/messages`,
        { text, client_message_id: `mini-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      );
      this.setData({ draft: "" });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || "消息发送失败", icon: "none" });
    } finally {
      this.setData({ sending: false });
    }
  },
});
