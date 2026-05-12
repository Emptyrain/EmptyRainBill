'use strict';

/**
 * CSV导入云函数
 * 接收base64编码的CSV文件，自动检测GBK/UTF-8编码并解析
 * 一次性返回：全部分类（供映射）+ 全部已转换账单
 */

/**
 * 检测并解码文本编码
 */
function decodeCSVContent(buffer) {
  var utf8Text = buffer.toString('utf8');

  if (utf8Text.indexOf('') === -1 && /[一-龥]/.test(utf8Text)) {
    return utf8Text;
  }

  try {
    var iconv = require('iconv-lite');
    return iconv.decode(buffer, 'gbk');
  } catch (e) {
    return utf8Text;
  }
}

/**
 * 解析CSV文本为对象数组
 */
function parseCSV(csvText) {
  var lines = csvText.split(/\r?\n/).filter(function(line) { return line.trim(); });

  if (lines.length < 2) return [];

  var headerIndex = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('记录时间') === 0) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 0;

  var headers = parseCSVLine(lines[headerIndex]);
  var result = [];

  for (var i = headerIndex + 1; i < lines.length; i++) {
    var values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      var obj = {};
      headers.forEach(function(header, index) {
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
  var result = [];
  var current = '';
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    var char = line[i];
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
 * 生成唯一ID
 */
function generateId() {
  var timestamp = Date.now();
  var randomStr = Math.random().toString(36).substring(2, 12);
  return 'bill_' + timestamp + '_' + randomStr;
}

/**
 * 将CSV记录转换为账单格式
 */
function convertToBill(record, categoryMapping, defaultCategories) {
  var datetime = record['记录时间'] || '';
  var dateMatch = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
  var date = dateMatch ? dateMatch[1] : datetime.substring(0, 10);

  var typeText = record['收支类型'] || '';
  var type = 'expense';
  if (typeText.indexOf('收入') !== -1 || typeText === '不计收支') {
    type = 'income';
  } else if (typeText.indexOf('退款') !== -1) {
    type = 'income';
  }

  var amountStr = record['金额'] || '0';
  var cleanAmount = amountStr.replace(/[,\s]/g, '');
  var amountYuan = parseFloat(cleanAmount) || 0;
  var amountFen = Math.round(amountYuan * 100);

  var csvCategory = record['分类'] || '';
  var categoryId = categoryMapping[csvCategory];

  if (!categoryId) {
    for (var i = 0; i < defaultCategories.length; i++) {
      if (defaultCategories[i].type === type) {
        categoryId = defaultCategories[i].id;
        break;
      }
    }
  }

  var note = record['备注'] || '';
  var account = record['账户'] || '';
  var fullNote = note + (account ? ' (' + account + ')' : '');

  return {
    id: generateId(),
    date: date,
    type: type,
    amount: amountFen,
    categoryId: categoryId,
    note: fullNote,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'csv_import',
    _csvCategory: csvCategory
  };
}

/**
 * 提取CSV中的分类
 */
function extractCategories(records) {
  var categoryMap = {};

  records.forEach(function(record) {
    var category = record['分类'] || '其他';
    if (!categoryMap[category]) {
      categoryMap[category] = 0;
    }
    categoryMap[category]++;
  });

  return Object.keys(categoryMap)
    .map(function(name) {
      return { name: name, count: categoryMap[name] };
    })
    .sort(function(a, b) { return b.count - a.count; });
}

/**
 * 智能分类映射
 */
function autoMapCategories(csvCategories, systemCategories) {
  var mapping = {};

  var keywordMap = {
    '餐饮': ['餐', '食品', '外卖', '吃饭'],
    '交通': ['交通', '出行', '打车', '公交', '地铁'],
    '购物': ['购', '电商', '网购', '生活日用'],
    '娱乐': ['娱乐', '游戏', '休闲'],
    '居住': ['住房', '房租', '水电', '物业', '住'],
    '通讯': ['通讯', '话费', '流量', '网络'],
    '医疗': ['医疗', '药', '医院', '健康'],
    '教育': ['教育', '学习', '培训', '书籍'],
    '工资': ['工资', '薪资', '薪水'],
    '奖金': ['奖金', '奖励', '绩效'],
    '理财': ['理财', '投资', '收益', '利息'],
    '兼职': ['兼职', '外快', '副业']
  };

  csvCategories.forEach(function(csvCat) {
    var csvName = csvCat.name;
    var csvNameLower = csvName.toLowerCase();

    for (var i = 0; i < systemCategories.length; i++) {
      if (systemCategories[i].name === csvName) {
        mapping[csvName] = systemCategories[i].id;
        return;
      }
    }

    for (var i = 0; i < systemCategories.length; i++) {
      var sysCat = systemCategories[i];
      var keywords = keywordMap[sysCat.name] || [];
      for (var j = 0; j < keywords.length; j++) {
        if (csvNameLower.indexOf(keywords[j]) !== -1) {
          mapping[csvName] = sysCat.id;
          return;
        }
      }
    }
  });

  return mapping;
}

/**
 * 系统默认分类
 */
function getSystemCategoriesList() {
  return [
    { id: 'cat_exp_1', name: '餐饮', type: 'expense' },
    { id: 'cat_exp_2', name: '交通', type: 'expense' },
    { id: 'cat_exp_3', name: '购物', type: 'expense' },
    { id: 'cat_exp_4', name: '娱乐', type: 'expense' },
    { id: 'cat_exp_5', name: '居住', type: 'expense' },
    { id: 'cat_exp_6', name: '通讯', type: 'expense' },
    { id: 'cat_exp_7', name: '医疗', type: 'expense' },
    { id: 'cat_exp_8', name: '教育', type: 'expense' },
    { id: 'cat_exp_9', name: '其他', type: 'expense' },
    { id: 'cat_inc_1', name: '工资', type: 'income' },
    { id: 'cat_inc_2', name: '奖金', type: 'income' },
    { id: 'cat_inc_3', name: '理财', type: 'income' },
    { id: 'cat_inc_4', name: '兼职', type: 'income' },
    { id: 'cat_inc_5', name: '其他', type: 'income' }
  ];
}

/**
 * 将账单按分类映射重新转换
 */
function convertAllBills(records, categoryMapping, systemCategories) {
  return records.map(function(record) {
    return convertToBill(record, categoryMapping, systemCategories);
  });
}

/**
 * 云函数入口
 */
exports.main = async function(event, context) {
  var action = event.action;
  var data = event.data;

  switch (action) {
    case 'parse':
      return await parseCSVFile(data);
    default:
      return { success: false, message: '未知操作' };
  }
};

/**
 * 解析CSV文件
 * 输入: base64
 * 输出: 分类列表(供用户映射) + 默认映射下的全部账单
 */
async function parseCSVFile(data) {
  var fileBase64 = data.fileBase64;

  try {
    var buffer = Buffer.from(fileBase64, 'base64');
    var csvText = decodeCSVContent(buffer);
    var records = parseCSV(csvText);

    if (records.length === 0) {
      return { success: false, message: 'CSV文件格式错误或没有有效数据' };
    }

    var categories = extractCategories(records);
    var systemCategories = getSystemCategoriesList();
    var defaultMapping = autoMapCategories(categories, systemCategories);

    // 用默认映射转换全部账单
    var bills = convertAllBills(records, defaultMapping, systemCategories);

    return {
      success: true,
      data: {
        total: records.length,
        categories: categories,
        defaultMapping: defaultMapping,
        bills: bills
      }
    };
  } catch (err) {
    return { success: false, message: '解析CSV文件失败: ' + err.message };
  }
}
