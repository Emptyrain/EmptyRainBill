Component({
  props: {
    // 图表数据 [{label, expense, income}]
    data: {
      type: Array,
      value: []
    },
    // 最大高度(rpx)
    maxHeight: {
      type: Number,
      value: 200
    }
  },

  data: {
    maxExpense: 0,
    maxIncome: 0
  },

  didUpdate() {
    this.calculateMax();
  },

  didMount() {
    this.calculateMax();
  },

  calculateMax() {
    const { data } = this.props;
    let maxExpense = 0;
    let maxIncome = 0;

    data.forEach(item => {
      if (item.expense > maxExpense) maxExpense = item.expense;
      if (item.income > maxIncome) maxIncome = item.income;
    });

    this.setData({
      maxExpense: maxExpense || 1,
      maxIncome: maxIncome || 1
    });
  },

  // 格式化金额
  formatAmount(amount) {
    return (amount / 100).toFixed(2);
  }
});
