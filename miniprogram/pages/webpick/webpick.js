const api = require('../../utils/api');
Page({
  onMsg(e) {
    try {
      let d = e.detail && e.detail.data;
      if (typeof d === 'string') d = JSON.parse(d);
      if (d && d.exif) d = JSON.parse(d.exif);
      if (d && d.path) {
        api.submitFood({ name: '', brand_name: '', price: null, categories: [], ingredients: [], flavors: [], preference: '偏好吃', comment: [], image_path: d.path, image_metadata: d.metadata || {}, client_key: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) });
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(function() { wx.navigateBack(); }, 800);
      }
    } catch (err) {}
  },
  onErr() { wx.showToast({ title: '加载失败(需配业务域名)', icon: 'none' }); }
});
