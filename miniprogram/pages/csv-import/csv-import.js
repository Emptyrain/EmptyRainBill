const storage = require('../../utils/storage');
const util = require('../../utils/util');

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
    categoryMapping: {}
  },

  onLoad() {
    this.loadCategories();
  },

  async loadCategories() {
    const categories = await storage.getValidCategories();
    this.setData({
      allCategories: categories,
      expenseCategories: categories.filter(c => c.type === 'expense'),
      incomeCategories: categories.filter(c => c.type === 'income')
    });
  },

  // 选择文件
  chooseFile() {
    const that = this;

    // 支付宝小程序从聊天记录选择文件
    my.chooseMessageFile({
      count: 1,
      type: 'file',
      extensions: ['csv'],
      success: (res) => {
        const file = res.tempFiles[0];
        that.setData({
          fileName: file.name || 'CSV文件',
          fileSize: '解析中...'
        });

        // 读取文件内容
        my.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: async (readRes) => {
            const content = readRes.data;
            await that.parseCSVContent(content);
          },
          fail: (err) => {
            // 尝试其他编码
            my.getFileSystemManager().readFile({
              filePath: file.path,
              success: async (readRes) => {
                // ArrayBuffer转字符串
                const decoder = new TextDecoder('gbk');
                const content = decoder.decode(readRes.data);
                await that.parseCSVContent(content);
              },
              fail: (err2) => {
                my.showToast({ content: '读取文件失败', type: 'fail' });
                console.error('读取文件失败:', err2);
              }
            });
          }
        });
      },
      fail: (err) => {
        // 如果chooseMessageFile失败，尝试其他方式
        that.tryAlternativeChoose();
      }
    });
  },

  // 备选方案：从相册选择（某些情况下可用）
  tryAlternativeChoose() {
    const that = this;

    // 尝试使用 my.chooseFile（需要小程序管理后台开通权限）
    my.chooseFile({
      count: 1,
      extension: ['.csv'],
      success: async (res) => {
        const file = res.apFilePaths[0];
        that.setData({
          fileName: file.split('/').pop() || 'CSV文件',
          fileSize: '解析中...'
        });

        // 读取文件
        my.getFileSystemManager().readFile({
          filePath: file,
          encoding: 'utf8',
          success: async (readRes) => {
            await that.parseCSVContent(readRes.data);
          },
          fail: (err) => {
            my.showToast({ content: '读取文件失败', type: 'fail' });
          }
        });
      },
      fail: (err) => {
        my.alert({
          title: '无法选择文件',
          content: '请将CSV文件发送到聊天中，然后从聊天记录选择文件。\n\n或使用电脑端小程序进行导入。'
        });
      }
    });
  },

  // 解析CSV内容（调用云函数）
  async parseCSVContent(content) {
    try {
      const result = await my.cloud.callFunction({
        name: 'csv-import',
        data: {
          action: 'parse',
          data: {
            csvContent: content
          }
        }
      });

      if (result.result.success) {
        const data = result.result.data;

        // 智能匹配分类
        const csvCategories = data.categories.map(cat => {
          const matched = this.matchCategory(cat.name);
          return {
            ...cat,
            selectedIndex: matched ? matched.index : 0,
            selectedName: matched ? matched.name : '请选择',
            selectedId: matched ? matched.id : '',
            systemCategories: this.data.allCategories
          };
        });

        // 构建分类映射
        const categoryMapping = {};
        csvCategories.forEach(cat => {
          if (cat.selectedId) {
            categoryMapping[cat.name] = cat.selectedId;
          }
        });

        this.setData({
          csvCategories,
          categoryMapping,
          totalCount: data.total,
          canNext: true,
          fileSize: `${data.total}条记录`,
          csvContent: content
        });

      } else {
        my.showToast({ content: result.result.message || '解析失败', type: 'fail' });
      }
    } catch (err) {
      console.error('云函数调用失败:', err);
      my.showToast({ content: '解析失败，请重试', type: 'fail' });
    }
  },

  // 智能匹配分类
  matchCategory(csvName) {
    const categories = this.data.allCategories;
    const csvNameLower = csvName.toLowerCase();

    const keywordMap = {
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

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (cat.name === csvName) {
        return { id: cat.id, name: cat.name, index: i };
      }
      const keywords = keywordMap[cat.name] || [];
      if (keywords.some(k => csvNameLower.includes(k))) {
        return { id: cat.id, name: cat.name, index: i };
      }
    }
    return null;
  },

  // 选择分类
  onCategorySelect(e) {
    const index = e.currentTarget.dataset.index;
    const selectedIndex = e.detail.value;
    const csvCategories = this.data.csvCategories;
    const selected = csvCategories[index].systemCategories[selectedIndex];

    csvCategories[index].selectedIndex = selectedIndex;
    csvCategories[index].selectedName = selected.name;
    csvCategories[index].selectedId = selected.id;

    const categoryMapping = this.data.categoryMapping;
    categoryMapping[csvCategories[index].name] = selected.id;

    this.setData({ csvCategories, categoryMapping });
  },

  // 下一步
  async nextStep() {
    if (this.data.currentStep === 1 && !this.data.csvContent) {
      my.showToast({ content: '请先选择文件', type: 'fail' });
      return;
    }

    if (this.data.currentStep === 2) {
      await this.generatePreview();
    }

    this.setData({ currentStep: this.data.currentStep + 1 });
  },

  // 上一步
  prevStep() {
    this.setData({ currentStep: this.data.currentStep - 1 });
  },

  // 生成预览（调用云函数）
  async generatePreview() {
    my.showLoading({ content: '生成预览...' });

    try {
      const result = await my.cloud.callFunction({
        name: 'csv-import',
        data: {
          action: 'import',
          data: {
            csvContent: this.data.csvContent,
            categoryMapping: this.data.categoryMapping,
            defaultCategories: this.data.allCategories
          }
        }
      });

      if (result.result.success) {
        const bills = result.result.data.bills;
        const categories = this.data.allCategories;

        const categoryMap = {};
        categories.forEach(c => { categoryMap[c.id] = c.name; });

        let expenseCount = 0, incomeCount = 0;
        bills.forEach(bill => {
          if (bill.type === 'expense') expenseCount++;
          else incomeCount++;
        });

        const previewBills = bills.slice(0, 10).map(bill => ({
          ...bill,
          categoryName: categoryMap[bill.categoryId] || '未分类',
          amountDisplay: util.fenToYuan(bill.amount)
        }));

        this.setData({
          previewBills,
          allBills: bills,
          expenseCount,
          incomeCount
        });
      }
    } catch (err) {
      console.error('生成预览失败:', err);
      my.showToast({ content: '生成预览失败', type: 'fail' });
    }

    my.hideLoading();
  },

  // 执行导入
  async doImport() {
    if (this.data.importing) return;

    this.setData({ importing: true });
    my.showLoading({ content: '导入中...' });

    try {
      const bills = this.data.allBills;
      const existingBills = await storage.getBills();

      const existingKeys = new Set(
        existingBills.map(b => `${b.date}_${b.amount}_${b.note}`)
      );

      const newBills = bills.filter(b =>
        !existingKeys.has(`${b.date}_${b.amount}_${b.note}`)
      );

      await storage.saveBills([...existingBills, ...newBills]);

      my.hideLoading();
      my.showToast({
        content: `成功导入${newBills.length}条记录`,
        type: 'success'
      });

      setTimeout(() => { my.navigateBack(); }, 1500);
    } catch (err) {
      console.error('导入失败:', err);
      my.hideLoading();
      my.showToast({ content: '导入失败', type: 'fail' });
    } finally {
      this.setData({ importing: false });
    }
  }
});
