const storage = require('../../utils/storage');
const util = require('../../utils/util');
const cloud = require('../../utils/cloud');

Page({
  data: {
    currentStep: 1,
    fileName: '',
    fileSize: '',
    csvCategories: [],
    previewBills: [],
    totalCount: 0,
    expenseCount: 0,
    incomeCount: 0,
    canNext: false,
    importing: false,
    categoryMapping: {},
    csvRecords: [],
    allBills: [],
    fileBase64: '',
    cloudAvailable: true
  },

  async onLoad() {
    await this.loadCategories();
    this.checkCloudStatus();
  },

  checkCloudStatus() {
    var app = getApp();
    if (!app || !app.globalData || !app.globalData.cloudInitialized) {
      this.setData({ cloudAvailable: false });
      my.showModal({
        title: '提示',
        content: '云环境未初始化，无法使用CSV导入功能',
        showCancel: false,
        success: function() {
          my.navigateBack();
        }
      });
    }
  },

  async loadCategories() {
    var categories = await storage.getValidCategories();
    if (!categories) categories = [];
    this.setData({
      allCategories: categories,
      expenseCategories: categories.filter(function(c) { return c.type === 'expense'; }),
      incomeCategories: categories.filter(function(c) { return c.type === 'income'; })
    });
  },

  chooseFile() {
    var that = this;

    if (!this.data.cloudAvailable) {
      my.showToast({ content: '云环境未初始化', type: 'fail' });
      return;
    }

    my.chooseFileFromDisk({
      success: function(res) {
        console.log('选择文件成功:', res);
        if (res.apFilePath) {
          that.setData({
            fileName: res.fileName || 'CSV文件',
            fileSize: '解析中...'
          });
          that.readFileContent(res.apFilePath);
        }
      },
      fail: function(err) {
        console.error('选择文件失败:', err);
        if (err.error === 11 || err.error === 12) return;
        my.showToast({
          content: '选择失败: ' + (err.errorMessage || '请重试'),
          type: 'fail'
        });
      }
    });
  },

  readFileContent(filePath) {
    var that = this;

    my.getFileSystemManager().readFile({
      filePath: filePath,
      success: function(res) {
        var base64 = my.arrayBufferToBase64(res.data);
        that.sendToCloud(base64);
      },
      fail: function(err) {
        console.error('读取文件失败:', err);
        my.showToast({ content: '读取文件失败', type: 'fail' });
      }
    });
  },

  async sendToCloud(base64) {
    var that = this;

    my.showLoading({ content: '解析文件...' });

    try {
      var result = await cloud.callFunction('csv-import', {
        action: 'parse',
        data: { fileBase64: base64 }
      });

      my.hideLoading();

      if (!result.success) {
        my.showToast({ content: result.message || '解析失败', type: 'fail' });
        return;
      }

      var parseData = result.data;
      if (!parseData || !parseData.categories || !parseData.bills) {
        my.showToast({ content: '云函数返回数据异常', type: 'fail' });
        return;
      }

      var csvCategories = parseData.categories.map(function(cat) {
        var matched = that.matchCategory(cat.name);
        return {
          name: cat.name,
          count: cat.count,
          selectedIndex: matched ? matched.index : 0,
          selectedName: matched ? matched.name : '请选择',
          selectedId: matched ? matched.id : '',
          systemCategories: that.data.allCategories
        };
      });

      if (parseData.defaultMapping) {
        csvCategories.forEach(function(cat) {
          if (parseData.defaultMapping[cat.name] && !cat.selectedId) {
            cat.selectedId = parseData.defaultMapping[cat.name];
            for (var i = 0; i < cat.systemCategories.length; i++) {
              if (cat.systemCategories[i].id === parseData.defaultMapping[cat.name]) {
                cat.selectedName = cat.systemCategories[i].name;
                cat.selectedIndex = i;
                break;
              }
            }
          }
        });
      }

      var categoryMapping = {};
      csvCategories.forEach(function(cat) {
        if (cat.selectedId) {
          categoryMapping[cat.name] = cat.selectedId;
        }
      });

      that.setData({
        csvCategories: csvCategories,
        categoryMapping: categoryMapping,
        totalCount: parseData.total,
        canNext: true,
        fileSize: parseData.total + '条记录',
        csvRecords: parseData.bills,
        allBills: parseData.bills,
        fileBase64: base64
      });

    } catch (err) {
      my.hideLoading();
      console.error('云函数调用失败:', err);
      my.showToast({ content: '解析失败: ' + (err.message || '请检查网络'), type: 'fail' });
    }
  },

  matchCategory(csvName) {
    var categories = this.data.allCategories;
    var csvNameLower = csvName.toLowerCase();

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

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      if (cat.name === csvName) {
        return { id: cat.id, name: cat.name, index: i };
      }
      var keywords = keywordMap[cat.name] || [];
      for (var j = 0; j < keywords.length; j++) {
        if (csvNameLower.indexOf(keywords[j]) !== -1) {
          return { id: cat.id, name: cat.name, index: i };
        }
      }
    }
    return null;
  },

  onCategorySelect(e) {
    var index = e.currentTarget.dataset.index;
    var selectedIndex = e.detail.value;
    var csvCategories = this.data.csvCategories;
    var selected = csvCategories[index].systemCategories[selectedIndex];

    csvCategories[index].selectedIndex = selectedIndex;
    csvCategories[index].selectedName = selected.name;
    csvCategories[index].selectedId = selected.id;

    var categoryMapping = this.data.categoryMapping;
    categoryMapping[csvCategories[index].name] = selected.id;

    this.setData({ csvCategories: csvCategories, categoryMapping: categoryMapping });
  },

  nextStep() {
    if (this.data.currentStep === 1 && !this.data.csvRecords.length) {
      my.showToast({ content: '请先选择文件', type: 'fail' });
      return;
    }

    if (this.data.currentStep === 2) {
      this.generatePreview();
    }

    this.setData({ currentStep: this.data.currentStep + 1 });
  },

  prevStep() {
    this.setData({ currentStep: this.data.currentStep - 1 });
  },

  generatePreview() {
    var that = this;

    // 用当前映射重新设置 allBills 的分类
    var bills = this.data.allBills;
    var categoryMapping = this.data.categoryMapping;
    var allCategories = this.data.allCategories;

    bills.forEach(function(b) {
      if (b._csvCategory && categoryMapping[b._csvCategory]) {
        b.categoryId = categoryMapping[b._csvCategory];
      }
    });

    var categories = allCategories;
    var categoryMap = {};
    categories.forEach(function(c) { categoryMap[c.id] = c.name; });

    var expenseCount = 0, incomeCount = 0;
    bills.forEach(function(b) {
      if (b.type === 'expense') expenseCount++;
      else incomeCount++;
    });

    var previewBills = bills.slice(0, 10).map(function(b) {
      return {
        ...b,
        categoryName: categoryMap[b.categoryId] || '未分类',
        amountDisplay: util.fenToYuan(b.amount)
      };
    });

    that.setData({
      previewBills: previewBills,
      allBills: bills,
      expenseCount: expenseCount,
      incomeCount: incomeCount
    });
  },

  async doImport() {
    if (this.data.importing) return;

    this.setData({ importing: true });
    my.showLoading({ content: '导入中...' });

    try {
      var bills = this.data.allBills.map(function(b) {
        var clean = { ...b };
        delete clean._csvCategory;
        return clean;
      });
      var existingBills = await storage.getBills();

      var existingKeys = new Set(
        existingBills.map(function(b) { return b.date + '_' + b.amount + '_' + b.note; })
      );

      var newBills = bills.filter(function(b) {
        return !existingKeys.has(b.date + '_' + b.amount + '_' + b.note);
      });

      await storage.saveBills([...existingBills, ...newBills]);

      my.hideLoading();
      my.showToast({
        content: '成功导入' + newBills.length + '条记录',
        type: 'success'
      });

      setTimeout(function() { my.navigateBack(); }, 1500);
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '导入失败', type: 'fail' });
    } finally {
      this.setData({ importing: false });
    }
  }
});
