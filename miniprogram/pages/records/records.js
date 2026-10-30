const api = require('../../utils/api');
const DataBus = require('../../utils/databus');
const setCurrentTab = require('../../utils/tab');
const voice = require('../../utils/voice');

Page({
  data: {
    settings: null,
    fileList: [],
    uploading: false,
    todayRecords: [],
    commentingId: null,
    commentInput: '',
    comments: [],
    recording: false,
    voiceText: '',
  },

  onLoad() {
    this.loadConfig();
    voice.ensurePermission(); // 提前申请录音权限，避免按下才弹权限等 5-6 秒
  },



  noop() {},

  onShow() {
    setCurrentTab(this);
    this.attachVoice();
    const app = getApp();
    if (app.globalData.cameraImagePath) {
      const path = app.globalData.cameraImagePath;
      app.globalData.cameraImagePath = null;
      this.setData({ fileList: [{ url: path }] });
      this.saveQuick(path, Date.now());
    }
    if (DataBus.stale('records', this) && this.data.settings) { this.loadToday(); }
  },
  onHide() {
    this.detachVoice();
  },
  onUnload() {
    this.detachVoice();
  },

  // 页面成为"当前语音接收者"：回调只在这一处注册，切页时自动切走
  attachVoice() {
    if (!this._voiceHandlers) {
      const that = this;
      this._voiceHandlers = {
        onStart() {
          that.setData({ recording: true, voiceText: '' });
        },
        onRecognize(res) {
          if (that.data.commentingId != null && res && res.result) that.setData({ voiceText: res.result });
        },
        onStop(res) {
          const text = (res && res.result) || that.data.voiceText || '';
          that.setData({ recording: false });
          if (that.data.commentingId == null) return; // 面板已关，忽略结果
          if (text) {
            const cur = that.data.commentInput;
            that.setData({ commentInput: cur ? cur + text : text });
          }
        },
        onError(res) {
          that.setData({ recording: false });
          wx.showToast({ title: (res && res.msg) || '语音识别失败', icon: 'none' });
        },
      };
    }
    voice.attach(this._voiceHandlers);
  },

  // 离开页面：切走接收者，并强制停止录音，杜绝"切页后录音没停、按钮一直红"
  detachVoice() {
    if (this._voiceHandlers) voice.detach(this._voiceHandlers);
    voice.stop();
    this.setData({ recording: false });
  },

  startRecord() {
    if (!voice.isAvailable()) { wx.showToast({ title: '语音功能不可用', icon: 'none' }); return; }
    this.setData({ recording: true, voiceText: '' }); // 按下立即反馈，不等 onStart
    if (!voice.start()) {
      this.setData({ recording: false });
      wx.showToast({ title: '语音识别失败', icon: 'none' });
    }
  },

  stopRecord() {
    // 无条件停止：即使 onStart 还没回调（初始化慢），也要停掉录音
    voice.stop();
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
      this.setData({ todayRecords: records });
      DataBus.fresh('records', this);
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
      DataBus.touch('records');
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
      DataBus.touch('records');   // 让详情页等其它页面知道评论变了
      this.loadToday();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },
});
