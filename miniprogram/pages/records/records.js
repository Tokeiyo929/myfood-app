const api = require('../../utils/api');

Page({
  data: {
    settings: null,
    dishName: '',
    imagePath: '',
    fileList: [],
  },

  onLoad() {
    this.loadConfig();
  },

  async loadConfig() {
    try {
      const config = await api.getConfig();
      this.setData({ settings: config });
    } catch (e) {
      wx.showToast({ title: '配置加载失败', icon: 'none' });
    }
  },

  onDishName(e) { this.setData({ dishName: e.detail }); },

  // 上传图片（必填）
  chooseImage(e) {
    const file = e.detail && e.detail.file;
    const path = file && (file.path || file.url);
    if (path) this.setData({ imagePath: path, fileList: [{ url: path }] });
  },
  removeImage() { this.setData({ imagePath: '', fileList: [] }); },

  // 保存记录（只上传图片，创建，其他字段留空）
  async submit() {
    if (!this.data.settings) {
      wx.showToast({ title: '配置加载中', icon: 'none' });
      return;
    }
    if (!this.data.imagePath) {
      wx.showToast({ title: '请上传图片', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      const upload = await api.compressAndUpload(this.data.imagePath, this.data.settings.image);
      const record = {
        name: this.data.dishName.trim(),
        brand_name: '',
        price: null,
        categories: [],
        ingredients: [],
        flavors: [],
        preference: this.data.settings.preferences.good.value,
        reason: '',
        image_path: upload.path,
        image_metadata: upload.metadata || {},
        client_key: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      };
      await api.submitFood(record);
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ imagePath: '', fileList: [], dishName: '' });
      // 通知历史页/详情页刷新
      getApp().globalData.refreshList = true;
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },
});
