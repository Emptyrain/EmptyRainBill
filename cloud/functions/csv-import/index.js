'use strict';

/**
 * CSV导入云函数
 * 支持解析支付宝导出的账单CSV文件并批量导入
 */

/**
 * 解析CSV文本为对象数组
 */
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  // 找到标题行（以"记录时间"开头）
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('记录时间')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return [];
  }

  const headers = parseCSVLine(lines[headerIndex]);
  const result = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index] ? values[index].trim() : '';
      });
      result.push(obj);
    }
  }

  return result;
}

/**
 * 解析CSV行
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * 将CSV记录转换为账单格式
 */
function convertToBill(record, categoryMapping, defaultCategories) {
  // 解析日期时间
  const datetime = record['记录时间'] || '';
  const dateMatch = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : datetime.substring(0, 10);

  // 确定类型
  const typeText = record['收支类型'] || '';
  let type = 'expense';
  if (typeText.includes('收入') || typeText === '不计收支') {
    type = 'income';
  } else if (typeText.includes('退款')) {
    type = 'income';
  }

  // 解析金额（元转分）
  const amountStr = record['金额'] || '0';
  const amountYuan = parseFloat(amountStr.replace(/[^\d.]/g, ''));
  const amountFen = Math.round(amountYuan * 100);

  // 映射分类
  const csvCategory = record['分类'] || '';
  let categoryId = categoryMapping[csvCategory];

  if (!categoryId) {
    // 使用默认分类
    const defaultCat = defaultCategories.find(c => c.type === type);
    categoryId = defaultCat ? defaultCat.id : '';
  }

  // 构建备注
  const note = record['备注'] || '';
  const account = record['账户'] || '';
  const fullNote = note + (account ? ` (${account})` : '');

  return {
    id: generateId(),
    date,
    type,
    amount: amountFen,
    categoryId,
    note: fullNote,
    syncStatus: 'synced',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'csv_import'
  };
}

/**
 * 生成唯一ID
 */
function generateId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 12);
  return `bill_${timestamp}_${randomStr}`;
}

/**
 * 获取CSV中的所有分类
 */
function extractCategories(records) {
  const categoryMap = {};

  records.forEach(record => {
    const category = record['分类'] || '其他';
    if (!categoryMap[category]) {
      categoryMap[category] = 0;
    }
    categoryMap[category]++;
  });

  return Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 生成默认分类映射
 */
function generateDefaultMapping(csvCategories, systemCategories) {
  const mapping = {};

  csvCategories.forEach(csvCat => {
    const csvName = csvCat.name;

    // 尝试匹配系统分类
    const matched = systemCategories.find(sysCat => {
      const sysName = sysCat.name.toLowerCase();
      const csvNameLower = csvName.toLowerCase();

      // 完全匹配
      if (sysName === csvNameLower) return true;

      // 包含匹配
      if (sysName.includes(csvNameLower) || csvNameLower.includes(sysName)) return true;

      // 关键词匹配
      const keywordMap = {
        '餐饮': ['餐', '食品', '外卖', '吃饭'],
        '交通': ['交通', '出行', '打车', '公交', '地铁'],
        '购物': ['购', '电商', '网购'],
        '娱乐': ['娱乐', '游戏', '休闲'],
        '居住': ['住房', '房租', '水电', '物业'],
        '通讯': ['通讯', '话费', '流量', '网络'],
        '医疗': ['医疗', '药', '医院', '健康'],
        '教育': ['教育', '学习', '培训', '书籍'],
        '工资': ['工资', '薪资', '薪水'],
        '奖金': ['奖金', '奖励', '绩效'],
        '理财': ['理财', '投资', '收益', '利息'],
        '兼职': ['兼职', '外快', '副业']
      };

      const keywords = keywordMap[sysCat.name] || [];
      return keywords.some(k => csvNameLower.includes(k));
    });

    if (matched) {
      mapping[csvName] = matched.id;
    }
  });

  return mapping;
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { action, data } = event;

  switch (action) {
    case 'parse':
      return await parseCSVFile(data);
    case 'import':
      return await importBills(data);
    case 'getCategories':
      return await getSystemCategories();
    default:
      return { success: false, message: '未知操作' };
  }
};

/**
 * 解析CSV文件
 */
async function parseCSVFile(data) {
  const { csvContent } = data;

  try {
    const records = parseCSV(csvContent);

    if (records.length === 0) {
      return {
        success: false,
        message: 'CSV文件格式错误或没有有效数据'
      };
    }

    // 提取分类
    const categories = extractCategories(records);

    return {
      success: true,
      data: {
        total: records.length,
        categories,
        preview: records.slice(0, 10) // 返回前10条预览
      }
    };
  } catch (err) {
    return {
      success: false,
      message: '解析CSV文件失败: ' + err.message
    };
  }
}

/**
 * 导入账单
 */
async function importBills(data) {
  const { csvContent, categoryMapping, defaultCategories, userId } = data;

  try {
    const records = parseCSV(csvContent);

    if (records.length === 0) {
      return {
        success: false,
        message: '没有有效的账单数据'
      };
    }

    // 转换为账单格式
    const bills = records.map(record =>
      convertToBill(record, categoryMapping || {}, defaultCategories || [])
    );

    // 这里应该保存到数据库
    // 由于是云函数，需要连接云数据库
    // 暂时返回转换后的数据，由前端保存到本地存储
    // 后续可以扩展为保存到云数据库

    return {
      success: true,
      data: {
        imported: bills.length,
        bills
      }
    };
  } catch (err) {
    return {
      success: false,
      message: '导入账单失败: ' + err.message
    };
  }
}

/**
 * 获取系统分类
 */
async function getSystemCategories() {
  // 返回系统默认分类
  const categories = {
    expense: [
      { id: 'cat_exp_1', name: '餐饮', icon: '🍚', type: 'expense' },
      { id: 'cat_exp_2', name: '交通', icon: '🚗', type: 'expense' },
      { id: 'cat_exp_3', name: '购物', icon: '🛒', type: 'expense' },
      { id: 'cat_exp_4', name: '娱乐', icon: '🎮', type: 'expense' },
      { id: 'cat_exp_5', name: '居住', icon: '🏠', type: 'expense' },
      { id: 'cat_exp_6', name: '通讯', icon: '📱', type: 'expense' },
      { id: 'cat_exp_7', name: '医疗', icon: '💊', type: 'expense' },
      { id: 'cat_exp_8', name: '教育', icon: '📚', type: 'expense' },
      { id: 'cat_exp_9', name: '其他', icon: '💰', type: 'expense' }
    ],
    income: [
      { id: 'cat_inc_1', name: '工资', icon: '💵', type: 'income' },
      { id: 'cat_inc_2', name: '奖金', icon: '🎁', type: 'income' },
      { id: 'cat_inc_3', name: '理财', icon: '📈', type: 'income' },
      { id: 'cat_inc_4', name: '兼职', icon: '💼', type: 'income' },
      { id: 'cat_inc_5', name: '其他', icon: '💰', type: 'income' }
    ]
  };

  return {
    success: true,
    data: categories
  };
}
