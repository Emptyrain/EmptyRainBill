/**
 * 云同步封装模块
 */

const storage = require('./storage');

let cloudContext = null;
let cloudEnvId = null;

/**
 * 初始化云环境
 */
async function initCloud(envId) {
  if (cloudContext) {
    return cloudContext;
  }

  cloudEnvId = envId;
  cloudContext = await my.cloud.createCloudContext({
    env: envId
  });

  await cloudContext.init();
  return cloudContext;
}

/**
 * 获取云上下文
 */
function getCloudContext() {
  return cloudContext;
}

/**
 * 调用云函数
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    if (!cloudContext) {
      reject(new Error('云环境未初始化'));
      return;
    }

    cloudContext.callFunction({
      name,
      data,
      success: (res) => resolve(res.result),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 上传数据到云端（只上传待同步的数据）
 */
async function uploadToCloud(userId) {
  // 获取待同步的数据
  const pendingData = await storage.getPendingSyncData();

  // 如果没有待同步数据，直接返回
  if (pendingData.bills.length === 0 && pendingData.categories.length === 0) {
    return { success: true, message: '没有待同步的数据' };
  }

  const result = await callFunction('sync', {
    action: 'upload',
    userId,
    data: pendingData
  });

  if (result.success) {
    // 标记已同步的数据
    const billIds = pendingData.bills.map(b => b.id);
    const categoryIds = pendingData.categories.map(c => c.id);

    await storage.markAsSynced('bill', billIds);
    await storage.markAsSynced('category', categoryIds);
    await storage.updateSyncTime();
  }

  return {
    ...result,
    uploadedBills: pendingData.bills.length,
    uploadedCategories: pendingData.categories.length
  };
}

/**
 * 从云端下载数据
 */
async function downloadFromCloud(userId) {
  const result = await callFunction('sync', {
    action: 'download',
    userId
  });

  if (result.success && result.data) {
    // 合并云端数据到本地
    await mergeCloudData(result.data);
    await storage.updateSyncTime();
  }

  return result;
}

/**
 * 合并云端数据
 */
async function mergeCloudData(cloudData) {
  // 合并分类
  if (cloudData.categories && cloudData.categories.length > 0) {
    const localCategories = await storage.getCategories();
    const mergedCategories = mergeArray(localCategories, cloudData.categories, 'id');
    await storage.saveCategories(mergedCategories);
  }

  // 合并账单
  if (cloudData.bills && cloudData.bills.length > 0) {
    const localBills = await storage.getBills();
    const mergedBills = mergeArray(localBills, cloudData.bills, 'id');
    await storage.saveBills(mergedBills);
  }
}

/**
 * 合并两个数组（按updatedAt判断更新）
 * 云端数据默认标记为已同步
 */
function mergeArray(localArr, cloudArr, keyField) {
  const map = new Map();

  // 先添加本地数据
  localArr.forEach(item => {
    map.set(item[keyField], item);
  });

  // 合并云端数据
  cloudArr.forEach(item => {
    const existing = map.get(item[keyField]);
    // 云端数据标记为已同步
    const cloudItem = { ...item, syncStatus: storage.SYNC_STATUS.SYNCED };

    if (!existing || item.updatedAt > existing.updatedAt) {
      map.set(item[keyField], cloudItem);
    }
  });

  return Array.from(map.values());
}

/**
 * 全量同步（双向）
 */
async function fullSync(userId) {
  try {
    // 先上传本地数据
    await uploadToCloud(userId);

    // 再下载云端数据
    await downloadFromCloud(userId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取同步状态
 */
async function getSyncStatus() {
  const meta = await storage.getSyncMeta();
  return {
    lastSyncTime: meta.lastSyncTime,
    localVersion: meta.localVersion,
    isInitialized: !!cloudContext
  };
}

/**
 * 清除云环境（用于重新初始化）
 */
function clearCloudContext() {
  cloudContext = null;
  cloudEnvId = null;
}

module.exports = {
  initCloud,
  getCloudContext,
  callFunction,
  uploadToCloud,
  downloadFromCloud,
  fullSync,
  getSyncStatus,
  clearCloudContext
};
