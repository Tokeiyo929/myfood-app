const api = require('../../utils/api');
let recorder = null;
let plugin = null;

try {
  plugin = requirePlugin('WechatSI');
} catch {}

Page({
  data: {
    settings: null,
    fileList: [],
    uploading: false, todayLoaded: false,
    todayRecords: [],
    commentingId: null,
    commentInput: '',
    comments: [],
    recording: false,
    voiceText: '',
  },

  onLoad() {
    this.loadConfig();
  },



  noop() {},

  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },
  onShow() {
    this.setTab();
    const app = getApp();
    if (app.globalData.cameraImagePath) {
      const path = app.globalData.cameraImagePath;
      app.globalData.cameraImagePath = null;
      this.setData({ fileList: [{ url: path }] });
      this.saveQuick(path, Date.now());
    }
    if (app.globalData.refreshList) { app.globalData.refreshList = false; this.loadToday(); } else if (!this.data.todayLoaded) { this.loadToday(); }
  },
  onUnload() {
    if (recorder) { try { recorder.stop(); } catch (e) {} }
  },

  initRecorder() {
    if (!plugin) return;
    try {
      recorder = plugin.getRecordRecognitionManager();
      const that = this;
      recorder.onStart = function() {
        that.setData({ recording: true, voiceText: '' });
      };
      recorder.onRecognize = function(res) {
        if (that.data.commentingId != null && res && res.result) that.setData({ voiceText: res.result });
      };
      recorder.onStop = function(res) {
        if (that.data.commentingId == null) return;
        const text = (res && res.result) || that.data.voiceText || '';
        that.setData({ recording: false });
        if (text) {
          const cur = that.data.commentInput;
          that.setData({ commentInput: cur ? cur + text : text });
        }
      };
      recorder.onError = function(res) {
        that.setData({ recording: false });
        wx.showToast({ title: res.msg || '语音识别失败', icon: 'none' });
      };
      recorder.onEnd = function() {
        that.setData({ recording: false });
      };
    } catch {}
  },

  startRecord() {
    this.initRecorder();
    if (!recorder) { wx.showToast({ title: '语音功能不可用', icon: 'none' }); return; }
    // recording 状态由 onStart 回调驱动，避免松手时按钮态不同步
    this.setData({ voiceText: '' });
    try {
      recorder.start({ duration: 30000, lang: 'zh_CN' });
    } catch (e) {
      this.setData({ recording: false });
    }
  },

  stopRecord() {
    if (!this.data.recording) return;
    try { if (recorder) recorder.stop(); } catch (e) {}
    // 无论插件回调是否及时到达，先复位按钮态
    this.setData({ recording: false });
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      this.setData({ settings: config });
      this.loadToday();
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
    }
  },

  async loadToday() {
    try {
      if (!this.data.settings) return;
      const result = await api.getFoods(1, this.data.settings.pagination.max_page_size, '', true);
      const records = (result.items || []).map(r => ({
        ...r,
        comments: r.comment || [],
      }));
      this.setData({ todayRecords: records, todayLoaded: true });
    } catch (e) {
      wx.showToast({ title: '今日记录加载失败', icon: 'none' });
    }
  },

  chooseImage() { this.pickImage(["album"]); },

  takePhoto() {
    getApp().globalData.cameraImagePath = null;
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  pickImage(sourceType) {
    const that = this;
    wx.chooseImage({ count: 1, sizeType: ["compressed"], sourceType, success: function(res){ var path = res.tempFilePaths && res.tempFilePaths[0]; if (!path) return; that.setData({ fileList: [{ url: path }] }); that.saveQuick(path, Date.now()); } });
  },

  async saveQuick(path, takenAt) {
    if (this.data.uploading) { wx.showToast({ title: '上传中', icon: 'none' }); return; }
    if (!this.data.settings) { wx.showToast({ title: '配置加载中', icon: 'none' }); return; }
    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中' });
    try {
      const upload = await api.compressAndUpload(path, this.data.settings.image, takenAt);
      const record = {
        name: '',
        brand_name: '',
        price: null,
        categories: [],
        ingredients: [],
        flavors: [],
        preference: this.data.settings.preferences.good.value,
        comment: [],
        image_path: upload.path,
        image_metadata: upload.metadata || {},
        client_key: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      };
      await api.submitFood(record);
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      api.removeTempFile(path);
      this.setData({ fileList: [], uploading: false });
      getApp().globalData.refreshList = true;
      this.loadToday();
    } catch (e) {
      wx.hideLoading();
      api.removeTempFile(path);
      this.setData({ uploading: false });
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  openComment(e) {
    const id = Number(e.currentTarget.dataset.id);
    const rec = this.data.todayRecords.find(r => Number(r.id) === id);
    if (!rec) return;
    this.setData({ commentingId: id, comments: rec.comments || [] });
  },

  closeComment() {
    this.stopRecord();
    this.setData({ commentingId: null, commentInput: '', recording: false });
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value });
  },

  async saveComment() {
    const text = (this.data.commentInput || '').trim();
    if (!text || this.data.commentingId == null) {
      wx.showToast({ title: '请输入评论', icon: 'none' });
      return;
    }
    const newComments = this.data.comments.concat([text]);
    wx.showLoading({ title: '保存中' });
    try {
      await api.addComment(this.data.commentingId, newComments);
      wx.hideLoading();
      this.setData({ comments: newComments, commentInput: '' });
      wx.showToast({ title: '已评论', icon: 'success' });
      this.loadToday();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },
});
