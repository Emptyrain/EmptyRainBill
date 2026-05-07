const storage = require('../../utils/storage');
const util = require('../../utils/util');

Page({
  data: {
    // 时间筛选
    dateType: 'month', // day | month | year | custom
    currentDate: '',
    startDate: '',
    endDate: '',
    dateRangeText: '',

    // 分类筛选
    categories: [],
    selectedCategoryId: '',
    selectedCategoryName: '全部分类',
    showCategoryFilter: false,

    // 账单数据
    billGroups: [],
    stats: {
      totalExpense: 0,
      totalIncome: 0,
      balance: 0
    },

    // 空状态
    isEmpty: false,

    // 加载状态
    loading: true
  },

  async onLoad() {
    await this.initData();
  },

  async onShow() {
    // 每次显示时刷新数据
    await this.loadData();
  },

  async onPullDownRefresh() {
    await this.loadData();
    my.stopPullDownRefresh();
  },

  async initData() {
    const categories = await storage.getCategories();
    const today = util.getToday();
    const monthStart = util.getMonthStart();

    this.setData({
      categories: [{ id: '', name: '全部分类', icon: '📋' }, ...categories],
      currentDate: today,
      startDate: monthStart,
      endDate: today,
      dateRangeText: util.getMonthName(today)
    });

    await this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

    const { startDate, endDate, selectedCategoryId } = this.data;
    const options = {
      startDate,
      endDate
    };

    if (selectedCategoryId) {
      options.categoryId = selectedCategoryId;
    }

    const [billGroups, stats] = await Promise.all([
      storage.getBillsGroupedByDate(options),
      storage.calculateStats(options)
    ]);

    // 获取分类信息用于显示
    const categories = await storage.getCategories();
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[c.id] = c;
    });

    // 为每条账单添加分类信息
    billGroups.forEach(group => {
      group.bills.forEach(bill => {
        const cat = categoryMap[bill.categoryId];
        bill.categoryName = cat ? cat.name : '未知';
        bill.categoryIcon = cat ? cat.icon : '❓';
        bill.amountText = util.formatAmountWithSign(bill.amount, bill.type);
      });
      // 计算每日收支
      group.dayExpense = group.bills
        .filter(b => b.type === 'expense')
        .reduce((sum, b) => sum + b.amount, 0);
      group.dayIncome = group.bills
        .filter(b => b.type === 'income')
        .reduce((sum, b) => sum + b.amount, 0);
      group.weekDay = util.getWeekDay(group.date);
      group.displayDate = this.formatDisplayDate(group.date);
    });

    this.setData({
      billGroups,
      stats,
      isEmpty: billGroups.length === 0,
      loading: false
    });
  },

  formatDisplayDate(dateStr) {
    const today = util.getToday();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = util.formatDate(yesterday);

    if (dateStr === today) {
      return '今天';
    } else if (dateStr === yesterdayStr) {
      return '昨天';
    }
    return dateStr.substring(5); // MM-DD
  },

  // 时间类型切换
  onDateTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ dateType: type });

    const range = util.getDateRange(type);
    this.setData({
      startDate: range.start,
      endDate: range.end
    });

    this.updateDateRangeText(type);
    this.loadData();
  },

  updateDateRangeText(type) {
    let text = '';
    switch (type) {
      case 'day':
        text = this.data.currentDate;
        break;
      case 'month':
        text = util.getMonthName(this.data.currentDate);
        break;
      case 'year':
        text = new Date(this.data.currentDate).getFullYear() + '年';
        break;
    }
    this.setData({ dateRangeText: text });
  },

  // 时间导航
  onDateNavigate(e) {
    const direction = e.currentTarget.dataset.direction;
    const { dateType, currentDate, startDate, endDate } = this.data;

    if (dateType === 'custom') {
      // 自定义范围不支持导航
      return;
    }

    const newDate = util.navigateDate(dateType, currentDate, direction);
    const range = util.getDateRange(dateType, { start: newDate, end: newDate });

    // 根据类型计算新的范围
    let newStart, newEnd;
    const d = new Date(newDate);

    switch (dateType) {
      case 'day':
        newStart = newEnd = newDate;
        break;
      case 'month':
        d.setDate(1);
        newStart = util.formatDate(d);
        newEnd = util.formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        break;
      case 'year':
        d.setMonth(0, 1);
        newStart = util.formatDate(d);
        newEnd = util.formatDate(new Date(d.getFullYear(), 11, 31));
        break;
    }

    this.setData({
      currentDate: newDate,
      startDate: newStart,
      endDate: newEnd
    });

    this.updateDateRangeText(dateType);
    this.loadData();
  },

  // 分类筛选
  onCategoryFilterTap() {
    this.setData({ showCategoryFilter: true });
  },

  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.categories.find(c => c.id === id);
    this.setData({
      selectedCategoryId: id,
      selectedCategoryName: category ? category.name : '全部分类',
      showCategoryFilter: false
    });
    this.loadData();
  },

  onCategoryFilterClose() {
    this.setData({ showCategoryFilter: false });
  },

  // 账单操作
  onBillTap(e) {
    const bill = e.currentTarget.dataset.bill;
    my.showActionSheet({
      items: ['编辑', '删除'],
      success: async (res) => {
        if (res.index === 0) {
          // 编辑
          my.navigateTo({
            url: `/pages/bill-add/bill-add?id=${bill.id}`
          });
        } else if (res.index === 1) {
          // 删除
          my.confirm({
            title: '确认删除',
            content: '确定要删除这条账单吗？',
            success: async (confirmRes) => {
              if (confirmRes.confirm) {
                await storage.deleteBill(bill.id);
                my.showToast({ content: '删除成功', type: 'success' });
                this.loadData();
              }
            }
          });
        }
      }
    });
  },

  // 跳转记账页
  onAddBill() {
    my.switchTab({
      url: '/pages/bill-add/bill-add'
    });
  }
});
