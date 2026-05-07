const storage = require('../../utils/storage');
const util = require('../../utils/util');

Page({
  data: {
    // 当前统计类型
    statsType: 'day', // day | week | month | category
    statsMode: 'expense', // expense | income（分类统计用）

    // 图表数据
    chartData: [],

    // 汇总数据
    stats: {
      totalExpense: 0,
      totalIncome: 0,
      balance: 0
    },

    // 分类统计数据
    categoryStats: [],

    // 加载状态
    loading: true
  },

  async onLoad() {
    await this.loadData();
  },

  async onShow() {
    await this.loadData();
  },

  async onPullDownRefresh() {
    await this.loadData();
    my.stopPullDownRefresh();
  },

  async loadData() {
    this.setData({ loading: true });

    const { statsType, statsMode } = this.data;

    if (statsType === 'category') {
      await this.loadCategoryStats();
    } else {
      await this.loadTimeStats();
    }

    this.setData({ loading: false });
  },

  // 加载时间维度统计
  async loadTimeStats() {
    const { statsType } = this.data;
    const today = new Date();
    let chartData = [];
    let startDate, endDate;
    let allBills = [];

    switch (statsType) {
      case 'day':
        // 最近7天
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = util.formatDate(d);
          chartData.push({
            label: dateStr.substring(5), // MM-DD
            date: dateStr,
            expense: 0,
            income: 0
          });
        }
        startDate = chartData[0].date;
        endDate = chartData[6].date;
        break;

      case 'week':
        // 最近4周
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(today);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          chartData.push({
            label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            startDate: util.formatDate(weekStart),
            endDate: util.formatDate(weekEnd),
            expense: 0,
            income: 0
          });
        }
        break;

      case 'month':
        // 最近12个月
        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          chartData.push({
            label: `${d.getMonth() + 1}月`,
            year: d.getFullYear(),
            month: d.getMonth(),
            expense: 0,
            income: 0
          });
        }
        break;
    }

    // 获取账单数据
    if (statsType === 'day') {
      allBills = await storage.queryBills({ startDate, endDate });
    } else {
      allBills = await storage.getBills();
    }

    // 计算统计数据
    let totalExpense = 0;
    let totalIncome = 0;

    allBills.forEach(bill => {
      let matched = false;

      if (statsType === 'day') {
        const item = chartData.find(d => d.date === bill.date);
        if (item) {
          if (bill.type === 'expense') {
            item.expense += bill.amount;
          } else {
            item.income += bill.amount;
          }
          matched = true;
        }
      } else if (statsType === 'week') {
        chartData.forEach(item => {
          if (bill.date >= item.startDate && bill.date <= item.endDate) {
            if (bill.type === 'expense') {
              item.expense += bill.amount;
            } else {
              item.income += bill.amount;
            }
            matched = true;
          }
        });
      } else if (statsType === 'month') {
        const billDate = new Date(bill.date);
        const item = chartData.find(d => d.year === billDate.getFullYear() && d.month === billDate.getMonth());
        if (item) {
          if (bill.type === 'expense') {
            item.expense += bill.amount;
          } else {
            item.income += bill.amount;
          }
          matched = true;
        }
      }

      if (matched) {
        if (bill.type === 'expense') {
          totalExpense += bill.amount;
        } else {
          totalIncome += bill.amount;
        }
      }
    });

    // 计算最大值用于柱状图高度计算
    let maxExpense = 0;
    let maxIncome = 0;
    chartData.forEach(item => {
      if (item.expense > maxExpense) maxExpense = item.expense;
      if (item.income > maxIncome) maxIncome = item.income;
    });

    // 计算柱状图高度（最大200rpx）
    const maxBarHeight = 200;
    chartData.forEach(item => {
      item.expenseHeight = maxExpense > 0 ? (item.expense / maxExpense * maxBarHeight) : 0;
      item.incomeHeight = maxIncome > 0 ? (item.income / maxIncome * maxBarHeight) : 0;
    });

    this.setData({
      chartData,
      stats: {
        totalExpense,
        totalIncome,
        balance: totalIncome - totalExpense
      },
      categoryStats: []
    });
  },

  // 加载分类统计
  async loadCategoryStats() {
    const { statsMode } = this.data;
    const today = util.getToday();
    const yearStart = util.getYearStart();

    const categoryStats = await storage.getStatsByCategory(statsMode, {
      startDate: yearStart,
      endDate: today
    });

    // 计算汇总
    let totalAmount = 0;
    categoryStats.forEach(item => {
      totalAmount += item.total;
    });

    this.setData({
      categoryStats,
      chartData: [],
      stats: {
        totalExpense: statsMode === 'expense' ? totalAmount : 0,
        totalIncome: statsMode === 'income' ? totalAmount : 0,
        balance: 0
      }
    });
  },

  // 切换统计类型
  onStatsTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ statsType: type });
    this.loadData();
  },

  // 切换收支模式（分类统计用）
  onStatsModeChange(e) {
    const mode = e.currentTarget.dataset.type;
    this.setData({ statsMode: mode });
    this.loadCategoryStats();
  },

  // 点击分类跳转明细
  onCategoryTap(e) {
    const { id } = e.currentTarget.dataset;
    my.switchTab({
      url: '/pages/bill-list/bill-list'
    });
  },

  // 格式化金额
  formatAmount(amount) {
    return (amount / 100).toFixed(2);
  }
});
