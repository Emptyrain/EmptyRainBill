const storage = require('../../utils/storage');

Page({
  data: {
    version: '1.0.0',
    billCount: 0,
    categoryCount: 0,
    lastSyncTime: '--'
  },

  async onLoad() {
    await this.loadData();
  },

  async onShow() {
    await this.loadData();
  },

  async loadData() {
    const bills = await storage.getValidBills();
    const categories = await storage.getValidCategories();
    const syncMeta = await storage.getSyncMeta();
    const pendingData = await storage.getPendingSyncData();

    this.setData({
      billCount: bills.length,
      categoryCount: categories.length,
      pendingBillCount: pendingData.bills.length,
      pendingCategoryCount: pendingData.categories.length,
      lastSyncTime: syncMeta.lastSyncTime ? this.formatTime(syncMeta.lastSyncTime) : '--'
    });
  },

  formatTime(timestamp) {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 导出数据
  async onExportData() {
    try {
      const bills = await storage.getValidBills();
      const categories = await storage.getValidCategories();

      const exportData = {
        bills,
        categories,
        exportTime: new Date().toISOString(),
        version: this.data.version
      };

      // 将数据转为JSON字符串
      const jsonStr = JSON.stringify(exportData, null, 2);

      // 复制到剪贴板
      my.setClipboard({
        text: jsonStr,
        success: () => {
          my.alert({
            title: '导出成功',
            content: '数据已复制到剪贴板，您可以粘贴保存到其他地方。'
          });
        }
      });
    } catch (err) {
      my.showToast({ content: '导出失败', type: 'fail' });
    }
  },

  // 清除数据
  onClearData() {
    my.confirm({
      title: '确认清除',
      content: '确定要清除所有本地数据吗？此操作不可恢复！',
      confirmText: '清除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          my.showLoading({ content: '清除中...' });

          try {
            // 清除账单数据
            await storage.saveBills([]);
            // 重置同步元数据
            await storage.saveSyncMeta({ lastSyncTime: 0, localVersion: 0 });

            my.hideLoading();
            my.showToast({ content: '清除成功', type: 'success' });

            await this.loadData();
          } catch (err) {
            my.hideLoading();
            my.showToast({ content: '清除失败', type: 'fail' });
          }
        }
      }
    });
  },

  // 反馈
  onFeedback() {
    my.alert({
      title: '意见反馈',
      content: '如有问题或建议，请联系开发者。'
    });
  },

  // CSV导入
  onImportCSV() {
    my.navigateTo({
      url: '/pages/csv-import/csv-import'
    });
  },

  // 上传数据到云端
  async onUpload() {
    my.showLoading({ content: '上传中...' });
    try {
      // TODO: 调用云函数上传数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      my.hideLoading();
      my.showToast({ content: '上传成功', type: 'success' });
      this.setData({
        lastSyncTime: this.formatTime(Date.now())
      });
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '上传失败', type: 'fail' });
    }
  },

  // 从云端拉取数据
  async onDownload() {
    my.showLoading({ content: '拉取中...' });
    try {
      // TODO: 调用云函数拉取数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      my.hideLoading();
      my.showToast({ content: '拉取成功', type: 'success' });
      this.setData({
        lastSyncTime: this.formatTime(Date.now())
      });
      await this.loadData();
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '拉取失败', type: 'fail' });
    }
  }
});
