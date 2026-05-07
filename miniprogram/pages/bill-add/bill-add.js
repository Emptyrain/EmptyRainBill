const storage = require('../../utils/storage');
const util = require('../../utils/util');

Page({
  data: {
    type: 'expense', // expense | income
    categories: [],
    selectedCategoryId: '',
    amount: '',
    date: '',
    note: '',
    isEdit: false,
    editBillId: null,
    maxDate: '',
    // 分摊相关
    enableInstallment: false,
    installmentType: 'month', // month | day
    installmentStartDate: '',
    installmentEndDate: '',
    installmentCount: 0,
    installmentAmountPer: 0,
    showInstallmentPicker: false,
    // 表单验证
    errors: {}
  },

  async onLoad(options) {
    const today = util.getToday();
    const maxDate = today;

    // 编辑模式
    if (options.id) {
      const bill = await storage.getBillById(options.id);
      if (bill) {
        // 如果是分摊子账单，需要加载父账单信息
        if (bill.isInstallmentChild && bill.installmentParentId) {
          const parentBill = await storage.getBillById(bill.installmentParentId);
          if (parentBill) {
            this.setData({
              isEdit: true,
              editBillId: parentBill.id,
              type: parentBill.type,
              amount: util.fenToYuan(parentBill.amount),
              date: parentBill.date,
              note: parentBill.note || '',
              selectedCategoryId: parentBill.categoryId,
              enableInstallment: true,
              installmentType: parentBill.installmentType,
              installmentStartDate: parentBill.installmentRange.start,
              installmentEndDate: parentBill.installmentRange.end,
              installmentCount: parentBill.installmentCount,
              installmentAmountPer: util.fenToYuan(Math.floor(parentBill.amount / parentBill.installmentCount))
            });
          }
        } else {
          this.setData({
            isEdit: true,
            editBillId: options.id,
            type: bill.type,
            amount: util.fenToYuan(bill.amount),
            date: bill.date,
            note: bill.note || '',
            selectedCategoryId: bill.categoryId
          });
        }
        my.setNavigationBar({ title: '编辑账单' });
      }
    } else {
      // 新增模式，默认今天
      this.setData({
        date: today,
        maxDate,
        installmentStartDate: today,
        installmentEndDate: today
      });
    }

    await this.loadCategories();
  },

  async loadCategories() {
    const categories = await storage.getCategoriesByType(this.data.type);
    this.setData({
      categories,
      selectedCategoryId: this.data.selectedCategoryId || (categories[0] ? categories[0].id : '')
    });
  },

  // 切换类型
  async onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.type) return;

    this.setData({
      type,
      selectedCategoryId: '' // 切换类型时清空已选分类
    });
    await this.loadCategories();
  },

  // 金额输入
  onAmountInput(e) {
    let value = e.detail.value;
    // 限制小数点后两位
    if (value.indexOf('.') !== -1) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length > 2) {
        value = parseFloat(value).toFixed(2);
      }
    }
    this.setData({
      amount: value,
      'errors.amount': ''
    });
    this.calculateInstallment();
  },

  // 选择分类
  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      selectedCategoryId: id,
      'errors.category': ''
    });
  },

  // 选择日期
  onDateChange(e) {
    this.setData({
      date: e.detail.value
    });
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    });
  },

  // 开启/关闭分摊
  onInstallmentToggle() {
    const enableInstallment = !this.data.enableInstallment;
    this.setData({ enableInstallment });
    if (enableInstallment) {
      this.calculateInstallment();
    }
  },

  // 分摊类型切换
  onInstallmentTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ installmentType: type });
    this.calculateInstallment();
  },

  // 分摊开始日期
  onInstallmentStartChange(e) {
    this.setData({ installmentStartDate: e.detail.value });
    this.calculateInstallment();
  },

  // 分摊结束日期
  onInstallmentEndChange(e) {
    this.setData({ installmentEndDate: e.detail.value });
    this.calculateInstallment();
  },

  // 计算分摊
  calculateInstallment() {
    const { amount, installmentType, installmentStartDate, installmentEndDate } = this.data;
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum <= 0 || !installmentStartDate || !installmentEndDate) {
      this.setData({
        installmentCount: 0,
        installmentAmountPer: 0
      });
      return;
    }

    const startDate = new Date(installmentStartDate);
    const endDate = new Date(installmentEndDate);

    if (startDate > endDate) {
      this.setData({
        installmentCount: 0,
        installmentAmountPer: 0
      });
      return;
    }

    let count = 0;
    if (installmentType === 'month') {
      // 计算月数
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12
        + (endDate.getMonth() - startDate.getMonth()) + 1;
      count = months;
    } else if (installmentType === 'day') {
      // 计算天数
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      count = diffDays;
    }

    const amountInFen = util.yuanToFen(amount);
    const amountPer = Math.floor(amountInFen / count);

    this.setData({
      installmentCount: count,
      installmentAmountPer: util.fenToYuan(amountPer)
    });
  },

  // 表单验证
  validateForm() {
    const errors = {};
    let isValid = true;

    // 金额验证
    const amount = parseFloat(this.data.amount);
    if (!this.data.amount || isNaN(amount) || amount <= 0) {
      errors.amount = '请输入有效金额';
      isValid = false;
    }

    // 分类验证
    if (!this.data.selectedCategoryId) {
      errors.category = '请选择分类';
      isValid = false;
    }

    // 分摊验证
    if (this.data.enableInstallment) {
      if (!this.data.installmentStartDate || !this.data.installmentEndDate) {
        errors.installment = '请选择分摊时间范围';
        isValid = false;
      }
      if (this.data.installmentStartDate > this.data.installmentEndDate) {
        errors.installment = '开始日期不能晚于结束日期';
        isValid = false;
      }
      if (this.data.installmentCount <= 0) {
        errors.installment = '分摊数量无效';
        isValid = false;
      }
    }

    this.setData({ errors });
    return isValid;
  },

  // 保存账单
  async onSave() {
    if (!this.validateForm()) {
      return;
    }

    my.showLoading({ content: '保存中...' });

    try {
      const billData = {
        type: this.data.type,
        amount: util.yuanToFen(this.data.amount),
        categoryId: this.data.selectedCategoryId,
        date: this.data.date,
        note: this.data.note
      };

      if (this.data.isEdit) {
        // 编辑模式：需要判断当前编辑的是哪种账单
        const currentBill = await storage.getBillById(this.data.editBillId);

        if (this.data.enableInstallment) {
          // 开启分摊
          if (currentBill && currentBill.isInstallment) {
            // 原来就是分摊账单，更新分摊配置
            billData.installmentType = this.data.installmentType;
            billData.installmentRange = {
              start: this.data.installmentStartDate,
              end: this.data.installmentEndDate
            };
            await storage.updateInstallmentBills(this.data.editBillId, billData);
          } else {
            // 原来是普通账单，转为分摊账单
            // 先删除原账单
            await storage.deleteBill(this.data.editBillId);
            // 再创建分摊账单
            await storage.addInstallmentBills(billData, {
              type: this.data.installmentType,
              startDate: this.data.installmentStartDate,
              endDate: this.data.installmentEndDate,
              count: this.data.installmentCount
            });
          }
        } else {
          // 未开启分摊
          if (currentBill && currentBill.isInstallment) {
            // 原来是分摊账单，取消分摊，创建普通账单
            await storage.cancelInstallment(this.data.editBillId);
            await storage.addBill(billData);
          } else {
            // 原来就是普通账单，直接更新
            await storage.updateBill(this.data.editBillId, billData);
          }
        }
        my.hideLoading();
        my.showToast({ content: '修改成功', type: 'success' });
        setTimeout(() => {
          my.navigateBack();
        }, 1500);
      } else {
        // 新增模式
        if (this.data.enableInstallment) {
          // 创建分摊账单
          await storage.addInstallmentBills(billData, {
            type: this.data.installmentType,
            startDate: this.data.installmentStartDate,
            endDate: this.data.installmentEndDate,
            count: this.data.installmentCount
          });
        } else {
          await storage.addBill(billData);
        }
        my.hideLoading();
        my.showToast({ content: '保存成功', type: 'success' });
        // 清空表单继续记账
        const today = util.getToday();
        this.setData({
          amount: '',
          note: '',
          date: today,
          enableInstallment: false,
          installmentCount: 0,
          installmentAmountPer: 0
        });
      }
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '保存失败', type: 'fail' });
      console.error('保存账单失败:', err);
    }
  },

  // 删除账单（编辑模式）
  onDelete() {
    if (!this.data.isEdit) return;

    my.confirm({
      title: '确认删除',
      content: this.data.enableInstallment ? '删除将取消整个分摊，所有分摊明细都会被删除，确定要删除吗？' : '确定要删除这条账单吗？',
      success: async (res) => {
        if (res.confirm) {
          my.showLoading({ content: '删除中...' });
          try {
            await storage.deleteBill(this.data.editBillId);
            my.hideLoading();
            my.showToast({ content: '删除成功', type: 'success' });
            setTimeout(() => {
              my.navigateBack();
            }, 1500);
          } catch (err) {
            my.hideLoading();
            my.showToast({ content: '删除失败', type: 'fail' });
          }
        }
      }
    });
  }
});
