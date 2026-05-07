/**
 * 本地存储封装模块
 */

const STORAGE_KEYS = {
  BILLS: 'bills',
  CATEGORIES: 'categories',
  SYNC_META: 'sync_meta'
};

// 同步状态枚举
const SYNC_STATUS = {
  PENDING: 'pending',     // 新增未同步
  SYNCED: 'synced',       // 已同步
  MODIFIED: 'modified',   // 本地已修改
  DELETED: 'deleted'      // 已删除（待云端删除）
};

// 默认分类数据
const DEFAULT_CATEGORIES = {
  expense: [
    { id: 'cat_exp_1', name: '餐饮', icon: '🍚', type: 'expense', isDefault: true },
    { id: 'cat_exp_2', name: '交通', icon: '🚗', type: 'expense', isDefault: true },
    { id: 'cat_exp_3', name: '购物', icon: '🛒', type: 'expense', isDefault: true },
    { id: 'cat_exp_4', name: '娱乐', icon: '🎮', type: 'expense', isDefault: true },
    { id: 'cat_exp_5', name: '居住', icon: '🏠', type: 'expense', isDefault: true },
    { id: 'cat_exp_6', name: '通讯', icon: '📱', type: 'expense', isDefault: true },
    { id: 'cat_exp_7', name: '医疗', icon: '💊', type: 'expense', isDefault: true },
    { id: 'cat_exp_8', name: '教育', icon: '📚', type: 'expense', isDefault: true },
    { id: 'cat_exp_9', name: '其他', icon: '💰', type: 'expense', isDefault: true }
  ],
  income: [
    { id: 'cat_inc_1', name: '工资', icon: '💵', type: 'income', isDefault: true },
    { id: 'cat_inc_2', name: '奖金', icon: '🎁', type: 'income', isDefault: true },
    { id: 'cat_inc_3', name: '理财', icon: '📈', type: 'income', isDefault: true },
    { id: 'cat_inc_4', name: '兼职', icon: '💼', type: 'income', isDefault: true },
    { id: 'cat_inc_5', name: '其他', icon: '💰', type: 'income', isDefault: true }
  ]
};

/**
 * 异步获取存储数据
 */
function getStorage(key) {
  return new Promise((resolve) => {
    my.getStorage({
      key,
      success: (res) => resolve(res.data),
      fail: () => resolve(null)
    });
  });
}

/**
 * 异步设置存储数据
 */
function setStorage(key, data) {
  return new Promise((resolve, reject) => {
    my.setStorage({
      key,
      data,
      success: () => resolve(true),
      fail: (err) => reject(err)
    });
  });
}

// ==================== 分类相关 ====================

/**
 * 获取所有分类（原始数据，包含已删除标记）
 */
async function getCategories() {
  const data = await getStorage(STORAGE_KEYS.CATEGORIES);
  return data || [];
}

/**
 * 获取有效分类（过滤已删除的，用于显示）
 */
async function getValidCategories() {
  const categories = await getCategories();
  return categories.filter(c => c.syncStatus !== SYNC_STATUS.DELETED);
}

/**
 * 获取指定类型的分类
 */
async function getCategoriesByType(type) {
  const categories = await getValidCategories();
  return categories.filter(c => c.type === type);
}

/**
 * 根据ID获取分类
 */
async function getCategoryById(id) {
  const categories = await getCategories();
  return categories.find(c => c.id === id);
}

/**
 * 保存分类列表
 */
async function saveCategories(categories) {
  return setStorage(STORAGE_KEYS.CATEGORIES, categories);
}

/**
 * 初始化默认分类
 */
async function initDefaultCategories() {
  const existing = await getCategories();
  if (existing && existing.length > 0) {
    return existing;
  }

  const now = Date.now();
  const allCategories = [
    ...DEFAULT_CATEGORIES.expense.map(c => ({
      ...c,
      syncStatus: SYNC_STATUS.SYNCED,
      createdAt: now,
      updatedAt: now
    })),
    ...DEFAULT_CATEGORIES.income.map(c => ({
      ...c,
      syncStatus: SYNC_STATUS.SYNCED,
      createdAt: now,
      updatedAt: now
    }))
  ];
  await saveCategories(allCategories);
  return allCategories;
}

/**
 * 添加分类
 */
async function addCategory(category) {
  const categories = await getCategories();
  categories.push({
    ...category,
    syncStatus: SYNC_STATUS.PENDING,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return saveCategories(categories);
}

/**
 * 更新分类
 */
async function updateCategory(id, updates) {
  const categories = await getCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index !== -1) {
    const oldStatus = categories[index].syncStatus;
    categories[index] = {
      ...categories[index],
      ...updates,
      syncStatus: oldStatus === SYNC_STATUS.SYNCED ? SYNC_STATUS.MODIFIED : oldStatus,
      updatedAt: Date.now()
    };
    return saveCategories(categories);
  }
  return false;
}

/**
 * 删除分类（标记为待同步删除）
 */
async function deleteCategory(id) {
  const categories = await getCategories();
  const category = categories.find(c => c.id === id);
  if (category && category.isDefault) {
    return false; // 默认分类不可删除
  }

  if (!category) return false;

  if (category.syncStatus === SYNC_STATUS.PENDING) {
    // 本地新增未同步的，直接删除
    const filtered = categories.filter(c => c.id !== id);
    return saveCategories(filtered);
  } else {
    // 已同步的，标记为删除状态
    const index = categories.findIndex(c => c.id === id);
    categories[index] = {
      ...categories[index],
      syncStatus: SYNC_STATUS.DELETED,
      updatedAt: Date.now()
    };
    return saveCategories(categories);
  }
}

// ==================== 账单相关 ====================

/**
 * 获取所有账单（原始数据，包含已删除标记）
 */
async function getBills() {
  const data = await getStorage(STORAGE_KEYS.BILLS);
  return data || [];
}

/**
 * 获取有效账单（过滤已删除的，用于显示）
 */
async function getValidBills() {
  const bills = await getBills();
  return bills.filter(b => b.syncStatus !== SYNC_STATUS.DELETED);
}

/**
 * 根据ID获取账单
 */
async function getBillById(id) {
  const bills = await getBills();
  return bills.find(b => b.id === id);
}

/**
 * 保存账单列表
 */
async function saveBills(bills) {
  return setStorage(STORAGE_KEYS.BILLS, bills);
}

/**
 * 添加账单
 */
async function addBill(bill) {
  const bills = await getBills();
  const now = Date.now();
  const newBill = {
    ...bill,
    id: bill.id || generateBillId(),
    syncStatus: SYNC_STATUS.PENDING,
    createdAt: now,
    updatedAt: now
  };
  bills.push(newBill);
  await saveBills(bills);
  return newBill;
}

/**
 * 更新账单
 */
async function updateBill(id, updates) {
  const bills = await getBills();
  const index = bills.findIndex(b => b.id === id);
  if (index !== -1) {
    const oldStatus = bills[index].syncStatus;
    bills[index] = {
      ...bills[index],
      ...updates,
      syncStatus: oldStatus === SYNC_STATUS.SYNCED ? SYNC_STATUS.MODIFIED : oldStatus,
      updatedAt: Date.now()
    };
    return saveBills(bills);
  }
  return false;
}

/**
 * 删除账单（标记为待同步删除）
 */
async function deleteBill(id) {
  const bills = await getBills();
  const bill = bills.find(b => b.id === id);

  if (!bill) return false;

  if (bill.syncStatus === SYNC_STATUS.PENDING) {
    // 本地新增未同步的，直接删除
    const filtered = bills.filter(b => b.id !== id);
    return saveBills(filtered);
  } else {
    // 已同步的，标记为删除状态
    const index = bills.findIndex(b => b.id === id);
    bills[index] = {
      ...bills[index],
      syncStatus: SYNC_STATUS.DELETED,
      updatedAt: Date.now()
    };
    return saveBills(bills);
  }
}

/**
 * 根据条件查询账单
 */
async function queryBills(options = {}) {
  const bills = await getValidBills();
  let result = [...bills];

  // 时间范围筛选
  if (options.startDate && options.endDate) {
    result = result.filter(b => b.date >= options.startDate && b.date <= options.endDate);
  }

  // 类型筛选
  if (options.type) {
    result = result.filter(b => b.type === options.type);
  }

  // 分类筛选
  if (options.categoryId) {
    result = result.filter(b => b.categoryId === options.categoryId);
  }

  // 按日期降序排序
  result.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt - a.createdAt;
  });

  return result;
}

/**
 * 按日期分组账单
 */
async function getBillsGroupedByDate(options = {}) {
  const bills = await queryBills(options);
  const groups = {};

  bills.forEach(bill => {
    if (!groups[bill.date]) {
      groups[bill.date] = [];
    }
    groups[bill.date].push(bill);
  });

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      bills: groups[date]
    }));
}

/**
 * 计算统计数据
 */
async function calculateStats(options = {}) {
  const bills = await queryBills(options);
  let totalExpense = 0;
  let totalIncome = 0;

  bills.forEach(bill => {
    if (bill.type === 'expense') {
      totalExpense += bill.amount;
    } else {
      totalIncome += bill.amount;
    }
  });

  return {
    totalExpense,
    totalIncome,
    balance: totalIncome - totalExpense,
    count: bills.length
  };
}

/**
 * 按分类统计
 */
async function getStatsByCategory(type, options = {}) {
  const bills = await queryBills({ ...options, type });
  const categories = await getValidCategories();
  const stats = {};

  bills.forEach(bill => {
    if (!stats[bill.categoryId]) {
      const cat = categories.find(c => c.id === bill.categoryId);
      stats[bill.categoryId] = {
        categoryId: bill.categoryId,
        categoryName: cat ? cat.name : '未知',
        categoryIcon: cat ? cat.icon : '❓',
        total: 0,
        count: 0
      };
    }
    stats[bill.categoryId].total += bill.amount;
    stats[bill.categoryId].count++;
  });

  const result = Object.values(stats).sort((a, b) => b.total - a.total);
  const totalAmount = result.reduce((sum, item) => sum + item.total, 0);

  return result.map(item => ({
    ...item,
    percentage: totalAmount > 0 ? (item.total / totalAmount * 100).toFixed(1) : 0
  }));
}

/**
 * 生成账单ID
 */
function generateBillId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 12);
  return `bill_${timestamp}_${randomStr}`;
}

// ==================== 同步元数据 ====================

/**
 * 获取同步元数据
 */
async function getSyncMeta() {
  const data = await getStorage(STORAGE_KEYS.SYNC_META);
  return data || {
    lastSyncTime: 0,
    localVersion: 0
  };
}

/**
 * 保存同步元数据
 */
async function saveSyncMeta(meta) {
  return setStorage(STORAGE_KEYS.SYNC_META, meta);
}

/**
 * 更新同步时间
 */
async function updateSyncTime() {
  const meta = await getSyncMeta();
  meta.lastSyncTime = Date.now();
  meta.localVersion = (meta.localVersion || 0) + 1;
  return saveSyncMeta(meta);
}

// ==================== 同步状态查询 ====================

/**
 * 获取待同步的账单（新增、修改、删除）
 */
async function getPendingBills() {
  const bills = await getBills();
  return bills.filter(b =>
    b.syncStatus === SYNC_STATUS.PENDING ||
    b.syncStatus === SYNC_STATUS.MODIFIED ||
    b.syncStatus === SYNC_STATUS.DELETED
  );
}

/**
 * 获取待同步的分类（新增、修改、删除）
 */
async function getPendingCategories() {
  const categories = await getCategories();
  return categories.filter(c =>
    c.syncStatus === SYNC_STATUS.PENDING ||
    c.syncStatus === SYNC_STATUS.MODIFIED ||
    c.syncStatus === SYNC_STATUS.DELETED
  );
}

/**
 * 获取所有待同步数据
 */
async function getPendingSyncData() {
  const [bills, categories] = await Promise.all([
    getPendingBills(),
    getPendingCategories()
  ]);
  return { bills, categories };
}

/**
 * 标记数据为已同步
 */
async function markAsSynced(type, ids) {
  if (type === 'bill') {
    const bills = await getBills();
    ids.forEach(id => {
      const bill = bills.find(b => b.id === id);
      if (bill && bill.syncStatus !== SYNC_STATUS.DELETED) {
        bill.syncStatus = SYNC_STATUS.SYNCED;
      }
    });
    // 移除已同步删除的数据
    const filtered = bills.filter(b => b.syncStatus !== SYNC_STATUS.DELETED || !ids.includes(b.id));
    await saveBills(filtered);
  } else if (type === 'category') {
    const categories = await getCategories();
    ids.forEach(id => {
      const cat = categories.find(c => c.id === id);
      if (cat && cat.syncStatus !== SYNC_STATUS.DELETED) {
        cat.syncStatus = SYNC_STATUS.SYNCED;
      }
    });
    // 移除已同步删除的数据
    const filtered = categories.filter(c => c.syncStatus !== SYNC_STATUS.DELETED || !ids.includes(c.id));
    await saveCategories(filtered);
  }
}

/**
 * 清除已删除的数据（同步完成后调用）
 */
async function clearDeletedData() {
  const [bills, categories] = await Promise.all([
    getBills(),
    getCategories()
  ]);

  const filteredBills = bills.filter(b => b.syncStatus !== SYNC_STATUS.DELETED);
  const filteredCategories = categories.filter(c => c.syncStatus !== SYNC_STATUS.DELETED);

  await Promise.all([
    saveBills(filteredBills),
    saveCategories(filteredCategories)
  ]);
}

module.exports = {
  STORAGE_KEYS,
  SYNC_STATUS,
  getStorage,
  setStorage,
  // 分类
  getCategories,
  getValidCategories,
  getCategoriesByType,
  getCategoryById,
  saveCategories,
  initDefaultCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  // 账单
  getBills,
  getValidBills,
  getBillById,
  saveBills,
  addBill,
  updateBill,
  deleteBill,
  queryBills,
  getBillsGroupedByDate,
  calculateStats,
  getStatsByCategory,
  // 同步
  getSyncMeta,
  saveSyncMeta,
  updateSyncTime,
  getPendingBills,
  getPendingCategories,
  getPendingSyncData,
  markAsSynced,
  clearDeletedData
};
