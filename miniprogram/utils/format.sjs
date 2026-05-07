/**
 * SJS 工具函数 - 用于模板中调用
 */

function formatAmount(fen) {
  var num = parseFloat(fen) / 100;
  return num.toFixed(2);
}

function formatAmountWithSign(fen, type) {
  var num = parseFloat(fen) / 100;
  var str = num.toFixed(2);
  if (type === 'expense') {
    return '-' + str;
  }
  return '+' + str;
}

export default {
  formatAmount: formatAmount,
  formatAmountWithSign: formatAmountWithSign
};
