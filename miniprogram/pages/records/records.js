const api = require('../../utils/api');

Page({
  data: {
    settings: null,
    imagePath: '',
    fileList: [],
    uploading: false,
    todayRecords: [],
    // comment 弹层
    commentingId: null,
    commentInput: '',
    comments: [],
  },

  onLoad() {
    this.loadConfig();
  },

  onShow() {
    this.loadToday();
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

  // 加载今日记录
  async loadToday() {
    try {
      if (!this.data.settings) return;
      const limit = this.data.settings.pagination.page_size;
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

  // 选图后自动保存
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
        reason: '',
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

  // 点击今日记录 -> 打开 comment 弹层
  openComment(e) {
    const id = Number(e.currentTarget.dataset.id);
    const rec = this.data.todayRecords.find(r => Number(r.id) === id);
    if (!rec) return;
    this.setData({ commentingId: id, comments: rec.comments || [] });
  },

  closeComment() {
    this.setData({ commentingId: null, commentInput: '' });
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value !== undefined ? e.detail.value : e.detail });
  },

  // 保存一条 comment（追加到列表）
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
