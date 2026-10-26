Page({
  data: { flash: 'off' },
  onReady() {
    this.cameraCtx = wx.createCameraContext();
  },
  toggleFlash() {
    this.setData({ flash: this.data.flash === 'off' ? 'torch' : 'off' });
  },
  takePhoto() {
    if (!this.cameraCtx) this.cameraCtx = wx.createCameraContext();
    this.cameraCtx.takePhoto({
      quality: 'high',
      success(res) {
        getApp().globalData.cameraImagePath = res.tempImagePath;
        wx.navigateBack();
      },
      fail() {
        wx.showToast({ title: '拍照失败', icon: 'none' });
      }
    });
  },
  cancel() {
    wx.navigateBack();
  }
});
