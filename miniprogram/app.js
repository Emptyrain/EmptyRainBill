const storage = require('./utils/storage');
const cloud = require('./utils/cloud');
const config = require('./config/index.json');

App({
  async onLaunch(options) {
    // 初始化默认分类
    await storage.initDefaultCategories();

    // 初始化云环境
    await this.initCloud();

    console.log('应用启动完成');
  },

  async initCloud() {
    try {
      await cloud.initCloud(config.cloudEnvId);
      this.globalData.cloudInitialized = true;
      console.log('云环境初始化成功');
    } catch (err) {
      this.globalData.cloudInitialized = false;
      console.error('云环境初始化失败:', err);
    }
  },

  onShow(options) {
    // 应用显示时的处理
  },

  globalData: {
    userInfo: null,
    cloudEnvId: config.cloudEnvId,
    cloudInitialized: false
  }
});
