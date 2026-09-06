Component({
  properties: {
    visible: { type: Boolean, value: false },
    scope: { type: String, value: "event" },
    eventId: { type: String, value: "" },
    events: { type: Array, value: [] },
  },
  methods: {
    close() { this.triggerEvent("close"); },
    preventScroll() {},
    selectEvent(event) {
      const eventId = event.currentTarget.dataset.eventId;
      if (!(this.data.events || []).some((item) => item.id === eventId)) return;
      this.triggerEvent("selectscope", { scope: "event", eventId });
    },
    selectNearby() {
      if (!(this.data.events || []).some((item) => item.id === this.data.eventId)) return;
      this.triggerEvent("selectscope", { scope: "nearby", eventId: this.data.eventId });
    },
    manageVisibility() { this.triggerEvent("managevisibility"); },
  },
});
