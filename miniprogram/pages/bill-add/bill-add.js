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
    // 数字键盘相关
    showKeyboard: false,
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
        this.setData({
          isEdit: true,
          editBillId: options.id,
          type: bill.type,
          amount: util.fenToYuan(bill.amount),
          date: bill.date,
          note: bill.note || '',
          selectedCategoryId: bill.categoryId
        });
        my.setNavigationBar({ title: '编辑账单' });
      }
    } else {
      // 新增模式，默认今天
      this.setData({
        date: today,
        maxDate
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
        await storage.updateBill(this.data.editBillId, billData);
        my.hideLoading();
        my.showToast({ content: '修改成功', type: 'success' });
        setTimeout(() => {
          my.navigateBack();
        }, 1500);
      } else {
        await storage.addBill(billData);
        my.hideLoading();
        my.showToast({ content: '保存成功', type: 'success' });
        // 清空表单继续记账
        this.setData({
          amount: '',
          note: '',
          date: util.getToday()
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
      content: '确定要删除这条账单吗？',
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
