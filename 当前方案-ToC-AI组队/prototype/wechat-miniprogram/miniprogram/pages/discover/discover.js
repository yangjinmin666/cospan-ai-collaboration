const { scopeData, scopePageMethods, syncDiscoveryScope } = require("../../utils/discovery-scope.js");
const discoveryFilters = require("../../utils/discovery-filters.js");
const { buildPersonDetail } = require("../../utils/person-detail.js");

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: resolve,
      fail: reject,
    });
  });
}

const SWIPE_SOUND_KEY = "cospan_swipe_sound_enabled";
const SWIPE_CUE_VOLUME = 0.27; // +5.1 dB versus 0.15; do not override device media volume.
const CARD_SWIPE_TRANSITION = "transform .2s ease, opacity .2s ease";
const swipeCueProfiles = Object.freeze({
  left: Object.freeze({ sweepStart: 680, sweepEnd: 430, airStart: 1500, airEnd: 850, settle: 360 }),
  right: Object.freeze({ sweepStart: 520, sweepEnd: 760, airStart: 950, airEnd: 1600, settle: 1040 }),
});

let swipeAudioContext = null;
let swipeNoiseBuffer = null;

function swipeSoundEnabled() {
  return getApp().globalData.storage.get(SWIPE_SOUND_KEY) !== false;
}

function getSwipeAudioContext() {
  if (swipeAudioContext && swipeAudioContext.state !== "closed") return swipeAudioContext;
  swipeAudioContext = null;
  swipeNoiseBuffer = null;
  try {
    swipeAudioContext = wx.createWebAudioContext?.() || null;
  } catch {
    swipeAudioContext = null;
  }
  return swipeAudioContext;
}

function getSwipeNoiseBuffer(context) {
  if (swipeNoiseBuffer) return swipeNoiseBuffer;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * 0.12));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
  }
  swipeNoiseBuffer = buffer;
  return buffer;
}

function scheduleSwipeCue(context, direction) {
  const profile = swipeCueProfiles[direction];
  if (!profile) return;
  const startAt = context.currentTime + 0.005;
  const endAt = startAt + 0.15;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(SWIPE_CUE_VOLUME, startAt + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, endAt);
  master.connect(context.destination);

  const sweep = context.createOscillator();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(profile.sweepStart, startAt);
  sweep.frequency.exponentialRampToValueAtTime(profile.sweepEnd, startAt + 0.115);
  sweep.connect(master);
  sweep.start(startAt);
  sweep.stop(endAt);

  const air = context.createBufferSource();
  const airFilter = context.createBiquadFilter();
  const airGain = context.createGain();
  air.buffer = getSwipeNoiseBuffer(context);
  airFilter.type = "bandpass";
  airFilter.Q.setValueAtTime(0.8, startAt);
  airFilter.frequency.setValueAtTime(profile.airStart, startAt);
  airFilter.frequency.exponentialRampToValueAtTime(profile.airEnd, startAt + 0.11);
  airGain.gain.setValueAtTime(0.16, startAt);
  airGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(master);
  air.start(startAt);
  air.stop(startAt + 0.12);

  const settleAt = startAt + 0.082;
  const settle = context.createOscillator();
  const settleGain = context.createGain();
  settle.type = "sine";
  settle.frequency.setValueAtTime(profile.settle, settleAt);
  settle.frequency.exponentialRampToValueAtTime(profile.settle * 0.92, endAt);
  settleGain.gain.setValueAtTime(0.0001, settleAt);
  settleGain.gain.exponentialRampToValueAtTime(direction === "right" ? 0.30 : 0.22, settleAt + 0.008);
  settleGain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  settle.connect(settleGain);
  settleGain.connect(master);
  settle.start(settleAt);
  settle.stop(endAt);
}

function primeSwipeAudio() {
  if (!swipeSoundEnabled()) return;
  const context = getSwipeAudioContext();
  if (context?.state === "suspended") Promise.resolve(context.resume?.()).catch(() => {});
}

function playSwipeCue(direction) {
  if (!swipeSoundEnabled()) return;
  const context = getSwipeAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    Promise.resolve(context.resume?.())
      .then(() => scheduleSwipeCue(context, direction))
      .catch(() => {});
    return;
  }
  scheduleSwipeCue(context, direction);
}

// Same two-ring visual layout as mobile Web; positions are not map coordinates.
function decorateRadar(people) {
  return people.slice(0, 11).map((person, index, shown) => {
    const innerCount = shown.length > 8 ? Math.ceil(shown.length * .36) : Math.min(shown.length, 3);
    const inner = index < innerCount;
    const ringIndex = inner ? index : index - innerCount;
    const ringTotal = inner ? innerCount : Math.max(shown.length - innerCount, 1);
    const angle = ((inner ? -22 : -82) + ringIndex * 360 / ringTotal) * Math.PI / 180;
    const radius = inner ? 25 : 38;
    return { ...person, radarStyle: `left:${(50 + Math.cos(angle) * radius).toFixed(2)}%;top:${(50 + Math.sin(angle) * radius).toFixed(2)}%;` };
  });
}

Page({
  ...scopePageMethods("discover", getApp, wx),
  data: {
    ...scopeData,
    allPeople: [],
    people: [],
    nearby: [],
    allNearby: [],
    loading: true,
    nearbyEnabled: false,
    nearbyRequesting: false,
    nearbyError: "",
    profileIncomplete: false,
    eventName: "现场活动",
    eventChoices: [],
    showEmptyPeople: false,
    currentIndex: 0,
    currentPerson: null,
    nextPerson: null,
    showDetails: false,
    detailExpanded: false,
    detailProfile: {},
    mode: "recommend",
    filterOpen: false,
    filters: discoveryFilters.defaults(),
    filterDraft: discoveryFilters.defaults(),
    filterCount: 0,
    filterPreviewCount: 0,
    filterStatusOptions: [],
    filterRoleOptions: [],
    filterHourOptions: discoveryFilters.hourOptions,
    filterDistanceOptions: discoveryFilters.distanceOptions,
    statusChoices: ["未组队", "有 Idea 找人", "团队缺人", "已组队但可交流"],
    skillChoices: [],
    userInitials: "我",
    cardTransform: "translateX(0) rotate(0deg)",
    cardOpacity: 1,
    cardTransition: "transform .2s ease, opacity .2s ease",
    cardDragging: false,
    swipeDirection: "",
    swipeProgress: 0,
    navigationTop: 44,
    userAvatarClass: "memoji-6",
    nearbyFocus: null,
  },

  onLoad() {
    this.measureNavigation();
  },

  onShow() {
    this.pageVisible = true;
    syncDiscoveryScope(this, "discover", getApp());
    const tabBar = this.getTabBar?.();
    if (tabBar) tabBar.setData({ selected: 0 });
    this.load();
  },

  onHide() {
    this.closePersonDetails();
    this.closeFilters();
    this.closeScopeSelector();
    this.pageVisible = false;
    this.stopNearby();
  },

  onUnload() {
    this.pageVisible = false;
    this.stopNearby();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    const app = getApp();
    const eventId = app.globalData.eventId;
    const loadVersion = (this.loadVersion || 0) + 1;
    this.loadVersion = loadVersion;
    this.setData({ loading: true });
    try {
      const me = await app.globalData.api.get("/api/me");
      app.globalData.user = me.user;
      const ownProfile = (me.profiles || []).find(
        (profile) => profile.event_id === eventId,
      );
      const profileIncomplete = !ownProfile
        || !Array.isArray(ownProfile.skills)
        || ownProfile.skills.length < 3;
      const [events, discover] = await Promise.all([
        app.globalData.api.get("/api/events"),
        app.globalData.api.get(`/api/events/${eventId}/discover`),
      ]);
      if (eventId !== app.globalData.eventId || loadVersion !== this.loadVersion) return;
      const allPeople = (discover.people || []).map((person, index) => ({
        ...person,
        recommendation: {
          ...(person.recommendation || {}),
          reasons: Array.isArray(person.recommendation?.reasons)
            ? person.recommendation.reasons
            : [],
        },
        initials: String(person.display_name || "合").slice(0, 1),
        avatarClass: /^memoji-(?:[1-9]|1[0-2])$/.test(person.avatar || "")
          ? person.avatar
          : `memoji-${(index % 12) + 1}`,
        skillsText: (person.skills || []).join(" / "),
        interestsText: (person.interests || []).join("、"),
        evidenceText: Array.isArray(person.evidence) && person.evidence.length
          ? person.evidence[0]
          : "协作资料已完成",
      }));
      const people = this.filterPeople(allPeople, this.data.filters);
      const currentIndex = people.length
        ? Math.min(this.data.currentIndex, people.length - 1)
        : 0;
      const activeEvent = (events.events || []).find(
        (event) => event.id === eventId,
      );
      this.setData({
        eventName: activeEvent?.name || "现场活动",
        eventChoices: events.events || [],
        profileIncomplete,
        userInitials: String(me.user?.display_name || "我").slice(0, 1),
        userAvatarClass: /^memoji-(?:[1-9]|1[0-2])$/.test(me.user?.avatar || "")
          ? me.user.avatar
          : "memoji-6",
        allPeople,
        people,
        currentIndex,
        currentPerson: people[currentIndex] || null,
        nextPerson: people.length > 1
          ? people[(currentIndex + 1) % people.length]
          : null,
        cardTransform: "translateX(0) rotate(0deg)",
        cardOpacity: 1,
        cardTransition: "transform .2s ease, opacity .2s ease",
        cardDragging: false,
        swipeDirection: "",
        swipeProgress: 0,
        showDetails: false,
        showEmptyPeople: people.length === 0,
        skillChoices: [...new Set(allPeople.flatMap((person) => person.skills || []))].slice(0, 12),
      });
      syncDiscoveryScope(this, "discover", getApp());
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      if (loadVersion === this.loadVersion) this.setData({ loading: false });
    }
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

  filterPeople(people, filters) {
    return discoveryFilters.filterPeople(people.map(person => ({
      ...this.data.allPeople.find(item => item.user_id === person.user_id), ...person,
    })), filters);
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (this.data.discoveryScope === "nearby" && mode !== "nearby") return;
    if (mode !== "nearby") this.stopNearby();
    this.setData({
      mode,
      showDetails: false,
      ...(mode === "recommend"
        ? {
          currentPerson: this.data.people[this.data.currentIndex] || null,
          nextPerson: this.data.people.length > 1
            ? this.data.people[(this.data.currentIndex + 1) % this.data.people.length]
            : null,
        }
        : {}),
    });
  },

  openFilters() {
    this.updateFilterDraft(discoveryFilters.copy(this.data.filters));
    this.setData({ filterOpen: true });
    this.getTabBar?.()?.setData({ overlayOpen: true });
  },

  preventFilterBackgroundScroll() {},

  closeFilters() {
    this.setData({ filterOpen: false });
    this.getTabBar?.()?.setData({ overlayOpen: false });
  },

  filterSource() {
    if (this.data.mode !== "nearby") return this.data.allPeople;
    // Supplement nearby responses with already authorized evidence from discovery.
    return this.data.allNearby.map(person => ({
      ...this.data.allPeople.find(item => item.user_id === person.user_id), ...person,
    }));
  },

  updateFilterDraft(input) {
    const draft = discoveryFilters.copy(input);
    this.setData({
      filterDraft: draft,
      filterPreviewCount: this.filterPeople(this.filterSource(), draft).length,
      filterStatusOptions: discoveryFilters.statusOptions.map(item => ({ ...item, selected: draft.statuses.includes(item.value) })),
      filterRoleOptions: discoveryFilters.roleOptions.map(item => ({ ...item, selected: draft.roles.includes(item.value) })),
    });
  },

  toggleFilterChoice(event) {
    const { group, value } = event.currentTarget.dataset;
    const options = group === "statuses" ? discoveryFilters.statusOptions : group === "roles" ? discoveryFilters.roleOptions : [];
    if (!options.some(item => item.value === value)) return;
    const draft = discoveryFilters.copy(this.data.filterDraft);
    draft[group] = draft[group].includes(value) ? draft[group].filter(item => item !== value) : [...draft[group], value];
    this.updateFilterDraft(draft);
  },

  setFilterValue(event) {
    const { field, value } = event.currentTarget.dataset;
    const draft = discoveryFilters.copy(this.data.filterDraft);
    if (field === "minimumHours" && [0, 2, 4, 8].includes(Number(value))) draft.minimumHours = Number(value);
    if (field === "distance" && ["event", "nearby", "very_near"].includes(value)) draft.distance = value;
    this.updateFilterDraft(draft);
  },

  toggleFilterEvidence() {
    this.updateFilterDraft({ ...this.data.filterDraft, evidenceRequired: !this.data.filterDraft.evidenceRequired });
  },

  resetFilterDraft() {
    this.updateFilterDraft(discoveryFilters.defaults());
  },

  confirmFilters() {
    this.applyFilters(discoveryFilters.copy(this.data.filterDraft));
    this.closeFilters();
  },

  chooseStatusFilter(event) {
    const value = event.currentTarget.dataset.value;
    this.applyFilters({
      ...this.data.filters,
      status: this.data.filters.status === value ? "" : value,
    });
  },

  chooseSkillFilter(event) {
    const value = event.currentTarget.dataset.value;
    this.applyFilters({
      ...this.data.filters,
      skill: this.data.filters.skill === value ? "" : value,
    });
  },

  resetFilters() {
    this.applyFilters(discoveryFilters.defaults());
  },

  applyFilters(filters) {
    const people = this.filterPeople(this.data.allPeople, filters);
    const nearby = decorateRadar(this.filterPeople(this.data.allNearby, filters));
    this.setData({
      filters,
      filterCount: discoveryFilters.count(filters),
      people,
      nearby,
      nearbyFocus: nearby[0] || null,
      currentIndex: 0,
      currentPerson: people[0] || null,
      nextPerson: people.length > 1 ? people[1] : null,
      showEmptyPeople: people.length === 0,
      showDetails: false,
      cardTransform: "translateX(0) rotate(0deg)",
      cardOpacity: 1,
      cardTransition: "none",
      cardDragging: false,
      swipeDirection: "",
      swipeProgress: 0,
    });
  },

  openDirectoryPerson(event) {
    const currentIndex = this.data.people.findIndex(
      (person) => person.user_id === event.currentTarget.dataset.userId,
    );
    if (currentIndex < 0) return;
    this.setData({
      currentIndex,
      currentPerson: this.data.people[currentIndex],
      nextPerson: this.data.people.length > 1
        ? this.data.people[(currentIndex + 1) % this.data.people.length]
        : null,
      showDetails: true,
    });
    this.openPersonDetails();
  },

  async requestConnection(event) {
    const sent = await this.sendConnection(event.currentTarget.dataset.userId);
    if (!sent) return false;
    if (this.data.mode === "recommend") this.nextPerson();
    else this.closePersonDetails();
    this.getTabBar?.()?.setData({ overlayOpen: false });
    return true;
  },

  async sendConnection(userId) {
    if (this.data.profileIncomplete) {
      this.openOnboarding();
      return false;
    }
    const app = getApp();
    const person = [...this.data.people, ...this.data.nearby].find(
      (item) => item.user_id === userId,
    );
    if (!person) return false;
    try {
      await app.globalData.api.post("/api/connections/requests", {
        recipient_id: person.user_id,
        event_id: app.globalData.eventId,
        source: "link",
        message: `我对你的「${person.role || "协作方向"}」很感兴趣，想现场认识一下。`,
      });
      wx.showToast({ title: "认识请求已发出", icon: "success" });
      return true;
    } catch (error) {
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
      return false;
    }
  },

  nextPerson() {
    if (!this.data.people.length) return;
    this.cardDidSwipe = false;
    const currentIndex = (this.data.currentIndex + 1) % this.data.people.length;
    this.setData({
      currentIndex,
      currentPerson: this.data.people[currentIndex],
      nextPerson: this.data.people.length > 1
        ? this.data.people[(currentIndex + 1) % this.data.people.length]
        : null,
      showDetails: false,
      cardTransform: "translateX(0) rotate(0deg)",
      cardOpacity: 1,
      cardTransition: "none",
      cardDragging: false,
      swipeDirection: "",
      swipeProgress: 0,
    });
  },

  toggleDetails() {
    if (this.cardDidSwipe) {
      this.cardDidSwipe = false;
      return;
    }
    if (this.data.showDetails) this.closePersonDetails();
    else this.openPersonDetails();
  },

  openPersonDetails() {
    if (!this.data.currentPerson) return;
    this.setData({
      showDetails: true,
      detailExpanded: false,
      detailProfile: buildPersonDetail(this.data.currentPerson, this.data.discoveryScope),
    });
    this.getTabBar?.()?.setData({ overlayOpen: true });
  },

  closePersonDetails() {
    this.setData({ showDetails: false, detailExpanded: false });
    this.getTabBar?.()?.setData({ overlayOpen: false });
  },

  expandPersonDetails() {
    this.setData({ detailExpanded: true });
  },

  startDetailGesture(event) {
    const touch = event.touches?.[0];
    this.detailGesture = touch ? { x: touch.clientX, y: touch.clientY, handle: event.currentTarget.dataset.handle } : null;
  },

  endDetailGesture(event) {
    const touch = event.changedTouches?.[0], start = this.detailGesture;
    this.detailGesture = null;
    if (!touch || !start) return;
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      this.closePersonDetails();
    } else if (dy < -45) {
      this.expandPersonDetails();
    } else if (dy > 60 && (start.handle || !this.data.detailExpanded)) {
      if (this.data.detailExpanded) this.setData({ detailExpanded: false });
      else this.closePersonDetails();
    }
  },

  startCardSwipe(event) {
    if (this.cardAnimating) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    primeSwipeAudio();
    this.swipeStartX = touch.clientX;
    this.swipeStartY = touch.clientY;
    this.swipeDeltaX = 0;
    this.swipeAxis = "";
    this.cardDidSwipe = false;
    this.setData({
      cardTransition: "none",
      cardDragging: true,
      swipeDirection: "",
      swipeProgress: 0,
    });
  },

  moveCardSwipe(event) {
    const touch = event.touches?.[0];
    if (!touch || this.swipeStartX === undefined) return;
    const deltaX = touch.clientX - this.swipeStartX;
    const deltaY = touch.clientY - this.swipeStartY;
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);
    if (!this.swipeAxis) {
      if (Math.max(distanceX, distanceY) < 6) return;
      this.swipeAxis = distanceY > distanceX ? "vertical" : "horizontal";
    }
    if (this.swipeAxis !== "horizontal") return;
    this.swipeDeltaX = deltaX;
    if (distanceX > 7) this.cardDidSwipe = true;
    const rotation = Math.max(-12, Math.min(12, deltaX * .035));
    this.setData({
      cardTransform: `translateX(${deltaX}px) rotate(${rotation}deg)`,
      swipeDirection: deltaX > 0 ? "right" : deltaX < 0 ? "left" : "",
      swipeProgress: Math.min(Math.abs(deltaX) / 90, 1),
    });
  },

  animateCardTo(target, onCommitted) {
    this.setData({
      cardTransition: CARD_SWIPE_TRANSITION,
      cardDragging: false,
    }, () => {
      const commitTarget = () => this.setData(target, onCommitted);
      if (typeof wx.nextTick === "function") wx.nextTick(commitTarget);
      else setTimeout(commitTarget, 0);
    });
  },

  resetCardPosition(onCommitted) {
    this.swipeStartX = undefined;
    this.swipeStartY = undefined;
    this.swipeDeltaX = 0;
    this.swipeAxis = "";
    this.animateCardTo({
      cardTransform: "translateX(0) rotate(0deg)",
      cardOpacity: 1,
      swipeDirection: "",
      swipeProgress: 0,
    }, onCommitted);
  },

  cancelCardSwipe() {
    this.cardDidSwipe = false;
    this.resetCardPosition();
  },

  endCardSwipe() {
    const deltaX = Number(this.swipeDeltaX || 0);
    const swipeAxis = this.swipeAxis;
    this.swipeStartX = undefined;
    this.swipeStartY = undefined;
    this.swipeDeltaX = 0;
    this.swipeAxis = "";
    if (swipeAxis !== "horizontal" || Math.abs(deltaX) < 72) {
      this.resetCardPosition();
      return;
    }
    const direction = deltaX > 0 ? 1 : -1;
    if (direction > 0 && this.data.profileIncomplete) {
      this.resetCardPosition();
      this.openOnboarding();
      return;
    }
    playSwipeCue(direction > 0 ? "right" : "left");
    this.cardAnimating = true;
    const personId = this.data.currentPerson?.user_id;
    this.animateCardTo({
      cardTransform: `translateX(${direction * 125}%) rotate(${direction * 12}deg)`,
      cardOpacity: 0,
      swipeDirection: direction > 0 ? "right" : "left",
      swipeProgress: 1,
    }, () => {
      if (direction < 0) {
        setTimeout(() => {
          this.nextPerson();
          this.cardAnimating = false;
        }, 190);
        return;
      }
      void this.completePositiveSwipe(personId);
    });
  },

  async completePositiveSwipe(personId) {
    const [sent] = await Promise.all([
      personId ? this.sendConnection(personId) : Promise.resolve(false),
      new Promise((resolve) => setTimeout(resolve, 190)),
    ]);
    if (sent) this.nextPerson();
    else {
      this.resetCardPosition(() => {
        this.cardDidSwipe = false;
        this.cardAnimating = false;
      });
      return;
    }
    this.cardAnimating = false;
  },

  async toggleNearby(event) {
    if (this.data.nearbyRequesting && event.detail.value) return;
    if (this.data.profileIncomplete) {
      this.setData({ nearbyEnabled: false });
      this.openOnboarding();
      return;
    }
    if (!event.detail.value) {
      this.stopNearby();
      return;
    }
    const generation = (this.nearbyGeneration || 0) + 1;
    this.nearbyGeneration = generation;
    if (this.locationTimer) clearInterval(this.locationTimer);
    this.locationTimer = null;
    this.setData({ nearbyRequesting: true, nearbyError: "" });
    try {
      const published = await this.publishLocation(generation);
      if (!published || !this.isNearbyRequestActive(generation)) return;
      this.setData({ nearbyEnabled: true, nearbyRequesting: false });
      this.locationTimer = setInterval(() => {
        this.publishLocation(generation).catch(() => {
          if (!this.isNearbyRequestActive(generation)) return;
          this.stopNearby();
          this.setData({ nearbyError: "定位更新失败，请检查网络或定位权限后重试。" });
        });
      }, 60_000);
    } catch (error) {
      if (!this.isNearbyRequestActive(generation)) return;
      this.stopNearby();
      const permissionDenied = /auth deny|auth denied|authorize|permission|定位权限/i.test(error?.errMsg || error?.message || "");
      this.setData({ nearbyEnabled: false, nearbyError: permissionDenied
        ? "请允许使用定位，再开启附近发现。"
        : "暂时无法更新附近，请检查网络或定位服务后重试。" });
      if (permissionDenied) wx.showModal({
        title: "需要你授权位置",
        content: "只在小程序前台发布短时定位，离开页面就会删除。",
        confirmText: "去设置",
        success: ({ confirm }) => confirm && wx.openSetting(),
      });
    }
  },

  toggleNearbyFromButton() {
    this.toggleNearby({ detail: { value: !this.data.nearbyEnabled } });
  },

  selectNearbyPerson(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.nearby[index]) return;
    this.setData({ nearbyFocus: this.data.nearby[index] });
  },

  nextNearbyPerson() {
    if (!this.data.nearby.length) return;
    const currentIndex = Math.max(
      0,
      this.data.nearby.findIndex((person) => (
        person.user_id === this.data.nearbyFocus?.user_id
      )),
    );
    this.setData({
      nearbyFocus: this.data.nearby[(currentIndex + 1) % this.data.nearby.length],
    });
  },

  openNearbyDetails() {
    if (!this.data.nearbyFocus) return;
    this.setData({ currentPerson: this.data.nearbyFocus });
    this.openPersonDetails();
  },

  openOnboarding() {
    wx.navigateTo({ url: "/pages/onboarding/onboarding" });
  },

  isNearbyRequestActive(generation) {
    return this.pageVisible && generation === this.nearbyGeneration;
  },

  async publishLocation(generation = this.nearbyGeneration) {
    const app = getApp();
    const eventId = app.globalData.eventId;
    const location = await getLocation();
    if (!this.isNearbyRequestActive(generation) || eventId !== app.globalData.eventId) return false;
    await app.globalData.api.put(`/api/events/${eventId}/presence`, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_m: location.accuracy,
    });
    if (!this.isNearbyRequestActive(generation) || eventId !== app.globalData.eventId) {
      // An in-flight upload still belongs to its original exhibition, not the newly selected one.
      await app.globalData.api.delete(`/api/events/${eventId}/presence`).catch(() => {});
      return false;
    }
    app.globalData.presenceActive = true;
    const nearby = await app.globalData.api.get(
      `/api/events/${eventId}/nearby`,
    );
    if (!this.isNearbyRequestActive(generation) || eventId !== app.globalData.eventId) return false;
    const allNearby = (nearby.nearby || []).map((person, index) => ({
        ...person,
        initials: String(person.display_name || "合").slice(0, 1),
        avatarClass: /^memoji-(?:[1-9]|1[0-2])$/.test(person.avatar || "")
          ? person.avatar
          : `memoji-${(index % 12) + 1}`,
        distanceLabel: person.distance?.label || "附近",
        status: person.status || "附近可见",
        skills: Array.isArray(person.skills) ? person.skills : [],
        interestsText: (person.interests || []).join("、"),
        evidenceText: Array.isArray(person.evidence) && person.evidence.length
          ? person.evidence[0]
          : "已公开协作资料",
        recommendation: {
          ...(person.recommendation || {}),
          reasons: Array.isArray(person.recommendation?.reasons)
            ? person.recommendation.reasons
            : ["你们正在补齐的能力方向互补，适合现场聊一聊。"],
        },
      }));
    const decoratedNearby = decorateRadar(this.filterPeople(allNearby, this.data.filters));
    this.setData({
      allNearby,
      nearby: decoratedNearby,
      nearbyFocus: decoratedNearby.find((person) => (
        person.user_id === this.data.nearbyFocus?.user_id
      )) || decoratedNearby[0] || null,
    });
    return true;
  },

  stopNearby() {
    this.nearbyGeneration = (this.nearbyGeneration || 0) + 1;
    if (this.locationTimer) clearInterval(this.locationTimer);
    this.locationTimer = null;
    const app = getApp();
    if (app.globalData.presenceActive) app.releasePresence();
    this.setData({ nearbyEnabled: false, nearbyRequesting: false, nearbyError: "", allNearby: [], nearby: [], nearbyFocus: null });
  },
});
