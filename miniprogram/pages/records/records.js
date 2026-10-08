const api = require('../../utils/api');
let recorder = null;
let plugin = null;

try {
  plugin = requirePlugin('WechatSI');
} catch (e) {
  console.warn('WechatSI plugin not available', e);
}

Page({
  data: {
    settings: null,
    imagePath: '',
    fileList: [],
    uploading: false,
    todayRecords: [],
    commentingId: null,
    commentInput: '',
    comments: [],
    recording: false,
  },

  onLoad() {
    this.loadConfig();
    this.initRecorder();
  },


  setTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },
  onShow() {
    this.setTab();    this.loadToday();
  },

  onUnload() {
    if (recorder) { try { recorder.stop(); } catch (e) {} }
  },

  initRecorder() {
    if (!plugin) return;
    try {
      recorder = plugin.getRecordRecognitionManager();
      const that = this;
      recorder.onStop = function(res) {
        const text = res.result || '';
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
    } catch (e) {
      console.warn('init recorder failed', e);
    }
  },

  startRecord() {
    if (!recorder) { wx.showToast({ title: '语音功能不可用', icon: 'none' }); return; }
    this.setData({ recording: true });
    try {
      recorder.start({ duration: 30000, lang: 'zh_CN' });
    } catch (e) { this.setData({ recording: false }); }
  },

  stopRecord() {
    if (!recorder) return;
    try { recorder.stop(); } catch (e) { this.setData({ recording: false }); }
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
      const result = await api.getFoods(1, 100, '', true);
      const records = (result.items || []).map(r => ({
        ...r,
        comments: r.comment || [],
      }));
      this.setData({ todayRecords: records });
    } catch (e) {
      wx.showToast({ title: '今日记录加载失败', icon: 'none' });
    }
  },

  chooseImage(e) {
    const file = e.detail && e.detail.file;
    const path = file && (file.path || file.url);
    if (!path) return;
    this.saveQuick(path);
  },

  async saveQuick(path) {
    if (this.data.uploading) { wx.showToast({ title: '上传中', icon: 'none' }); return; }
    if (!this.data.settings) { wx.showToast({ title: '配置加载中', icon: 'none' }); return; }
    this.setData({ uploading: true });
    wx.showLoading({ title: '上传中' });
    try {
      const upload = await api.compressAndUpload(path, this.data.settings.image);
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
      this.setData({ imagePath: '', fileList: [], uploading: false });
      this.loadToday();
    } catch (e) {
      wx.hideLoading();
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
    this.setData({ commentInput: e.detail.value !== undefined ? e.detail.value : e.detail });
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
