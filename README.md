# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

个人账单管理支付宝小程序，使用 Javascript/ACSS 开发,可以使用支付宝云开发。核心功能包括记账、明细查看、统计分析。数据即存储在本地,也可以上传到云上。

## Development

使用 **支付宝小程序开发者工具** 打开项目目录进行预览、调试和构建。

## Project Structure

```
├── app.json              # App配置（tabBar配置）
├── app.ts                # App入口
├── app.less              # 全局样式
├── mini.project.json     # 项目配置
├── tsconfig.json         # TypeScript配置
├── utils/                # 工具函数
│   ├── types.ts          # 类型定义（Bill, Category）
│   ├── uuid.ts           # ID生成
│   ├── date.ts           # 日期处理
│   ├── storage.ts        # 数据存储封装
│   └── statistic.ts      # 统计计算
└── pages/
    ├── bill-list/        # 明细页（账单列表）
    ├── bill-add/         # 记账页（添加账单）
    ├── statistics/       # 统计页（日/周/月/分类统计）
    └── category/         # 分类管理
```

## Data Models

```typescript
interface Bill {
  id: string;
  type: 'expense' | 'income';  // 支出/收入
  amount: number;              // 金额（单位：分）
  categoryId: string;
  date: string;                // YYYY-MM-DD
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;                // emoji图标
  type: 'expense' | 'income';
  isDefault: boolean;          // 默认分类不可删除
}
```

## Key APIs

- `my.setStorage` / `my.getStorage` - 本地数据存储
- `my.navigateTo` - 页面跳转
- `my.datePicker` - 日期选择器
- `my.confirm` / `my.showToast` - 用户交互

## Amount Handling

金额以**分**为单位存储（整数），显示时转换为元（除以100）。避免浮点精度问题。
