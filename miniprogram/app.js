const storage = require('./utils/storage');

App({
  async onLaunch(options) {
    // 初始化默认分类
    await storage.initDefaultCategories();
    console.log('应用启动完成');
  },

  onShow(options) {
    // 应用显示时的处理
  },

  globalData: {
    userInfo: null,
    cloudEnvId: 'env-xxxxx' // 云环境ID，请修改为自己的
  }
});
