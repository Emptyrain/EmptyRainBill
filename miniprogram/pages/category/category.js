const storage = require('../../utils/storage');

Page({
  data: {
    type: 'expense', // expense | income
    categories: [],
    showAddModal: false,
    showEditModal: false,
    editingCategory: null,
    // 表单数据
    formData: {
      name: '',
      icon: '💰'
    },
    // 常用emoji
    emojiList: ['🍚', '🚗', '🛒', '🎮', '🏠', '📱', '💊', '📚', '💰', '💵', '🎁', '📈', '💼', '🍽️', '✈️', '👕', '💄', '🏃', '🎵', '🎬'],
    // 删除确认
    showDeleteConfirm: false,
    deletingCategoryId: null
  },

  async onLoad() {
    await this.loadCategories();
  },

  async onShow() {
    await this.loadCategories();
  },

  async loadCategories() {
    const categories = await storage.getCategoriesByType(this.data.type);
    this.setData({ categories });
  },

  // 切换类型
  async onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.type) return;

    this.setData({ type });
    await this.loadCategories();
  },

  // 显示添加弹窗
  onShowAddModal() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        icon: '💰'
      }
    });
  },

  // 关闭添加弹窗
  onCloseAddModal() {
    this.setData({ showAddModal: false });
  },

  // 输入名称
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 选择emoji
  onEmojiSelect(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({
      'formData.icon': emoji
    });
  },

  // 保存新分类
  async onSaveCategory() {
    const { name, icon } = this.data.formData;

    if (!name.trim()) {
      my.showToast({ content: '请输入分类名称', type: 'fail' });
      return;
    }

    my.showLoading({ content: '保存中...' });

    try {
      const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await storage.addCategory({
        id,
        name: name.trim(),
        icon,
        type: this.data.type
      });

      my.hideLoading();
      my.showToast({ content: '添加成功', type: 'success' });

      this.setData({
        showAddModal: false,
        formData: { name: '', icon: '💰' }
      });

      await this.loadCategories();
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '添加失败', type: 'fail' });
    }
  },

  // 显示编辑弹窗
  onShowEditModal(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      showEditModal: true,
      editingCategory: category,
      formData: {
        name: category.name,
        icon: category.icon
      }
    });
  },

  // 关闭编辑弹窗
  onCloseEditModal() {
    this.setData({
      showEditModal: false,
      editingCategory: null
    });
  },

  // 保存编辑
  async onSaveEdit() {
    const { editingCategory, formData } = this.data;

    if (!formData.name.trim()) {
      my.showToast({ content: '请输入分类名称', type: 'fail' });
      return;
    }

    my.showLoading({ content: '保存中...' });

    try {
      await storage.updateCategory(editingCategory.id, {
        name: formData.name.trim(),
        icon: formData.icon
      });

      my.hideLoading();
      my.showToast({ content: '修改成功', type: 'success' });

      this.setData({
        showEditModal: false,
        editingCategory: null
      });

      await this.loadCategories();
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '修改失败', type: 'fail' });
    }
  },

  // 显示删除确认
  onShowDeleteConfirm(e) {
    const category = e.currentTarget.dataset.category;

    if (category.isDefault) {
      my.showToast({ content: '默认分类不可删除', type: 'fail' });
      return;
    }

    this.setData({
      showDeleteConfirm: true,
      deletingCategoryId: category.id
    });
  },

  // 关闭删除确认
  onCloseDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
      deletingCategoryId: null
    });
  },

  // 确认删除
  async onConfirmDelete() {
    my.showLoading({ content: '删除中...' });

    try {
      await storage.deleteCategory(this.data.deletingCategoryId);

      my.hideLoading();
      my.showToast({ content: '删除成功', type: 'success' });

      this.setData({
        showDeleteConfirm: false,
        deletingCategoryId: null
      });

      await this.loadCategories();
    } catch (err) {
      my.hideLoading();
      my.showToast({ content: '删除失败', type: 'fail' });
    }
  },

  // 跳转设置页
  goToSettings() {
    my.navigateTo({
      url: '/pages/settings/settings'
    });
  }
});
