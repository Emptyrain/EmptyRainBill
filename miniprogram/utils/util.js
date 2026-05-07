/**
 * 工具函数模块
 */

/**
 * 生成唯一ID
 * 格式: ${timestamp}_${randomString}
 */
function generateId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 12);
  return `${timestamp}_${randomStr}`;
}

/**
 * 金额转换：元 -> 分
 * @param {number|string} yuan 金额（元）
 * @returns {number} 金额（分）
 */
function yuanToFen(yuan) {
  const num = parseFloat(yuan);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * 金额转换：分 -> 元
 * @param {number} fen 金额（分）
 * @returns {string} 金额（元，两位小数）
 */
function fenToYuan(fen) {
  const num = parseInt(fen, 10);
  if (isNaN(num)) return '0.00';
  return (num / 100).toFixed(2);
}

/**
 * 格式化日期
 * @param {Date|string|number} date 日期对象/字符串/时间戳
 * @param {string} format 格式，默认 YYYY-MM-DD
 * @returns {string}
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 获取今天的日期字符串
 * @returns {string} YYYY-MM-DD
 */
function getToday() {
  return formatDate(new Date());
}

/**
 * 获取本周一的日期
 * @returns {string}
 */
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  return formatDate(d);
}

/**
 * 获取本月第一天的日期
 * @returns {string}
 */
function getMonthStart() {
  const d = new Date();
  d.setDate(1);
  return formatDate(d);
}

/**
 * 获取本年第一天的日期
 * @returns {string}
 */
function getYearStart() {
  const d = new Date();
  d.setMonth(0, 1);
  return formatDate(d);
}

/**
 * 获取星期几
 * @param {string} dateStr 日期字符串 YYYY-MM-DD
 * @returns {string}
 */
function getWeekDay(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

/**
 * 解析日期范围
 * @param {string} type day/month/year/custom
 * @param {object} customRange {start, end} 自定义范围
 * @returns {{start: string, end: string}}
 */
function getDateRange(type, customRange = null) {
  const today = new Date();
  let start, end;

  switch (type) {
    case 'day':
      start = end = getToday();
      break;
    case 'month':
      start = getMonthStart();
      end = getToday();
      break;
    case 'year':
      start = getYearStart();
      end = getToday();
      break;
    case 'custom':
      if (customRange) {
        start = customRange.start;
        end = customRange.end;
      }
      break;
    default:
      start = end = getToday();
  }

  return { start, end };
}

/**
 * 时间段导航
 * @param {string} type day/month/year
 * @param {string} currentDate 当前日期
 * @param {number} direction 1 下一个, -1 上一个
 * @returns {string}
 */
function navigateDate(type, currentDate, direction) {
  const d = new Date(currentDate);

  switch (type) {
    case 'day':
      d.setDate(d.getDate() + direction);
      break;
    case 'month':
      d.setMonth(d.getMonth() + direction);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + direction);
      break;
  }

  return formatDate(d);
}

/**
 * 获取月份名称
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
function getMonthName(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/**
 * 格式化金额显示（带符号）
 * @param {number} amount 金额（分）
 * @param {string} type 类型 expense/income
 * @returns {string}
 */
function formatAmountWithSign(amount, type) {
  const yuan = fenToYuan(amount);
  if (type === 'expense') {
    return `-${yuan}`;
  }
  return `+${yuan}`;
}

module.exports = {
  generateId,
  yuanToFen,
  fenToYuan,
  formatDate,
  getToday,
  getWeekStart,
  getMonthStart,
  getYearStart,
  getWeekDay,
  getDateRange,
  navigateDate,
  getMonthName,
  formatAmountWithSign
};
