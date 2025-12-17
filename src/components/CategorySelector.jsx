// v1.0.0 - Category selector component for project categories (kol_project_categories)
// Allows users to view, create, rename, and delete categories under a restaurant

import { useState } from 'react';
import { Tabs, Button, Modal, Input, message, Dropdown, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined, FolderOutlined } from '@ant-design/icons';
import { categoryDB } from '../utils/db';

export default function CategorySelector({
  categories,
  currentCategory,
  currentRestaurant,
  onCategoryChange
}) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [loading, setLoading] = useState(false);

  // Switch category
  const handleCategorySelect = async (categoryId) => {
    await categoryDB.switch(categoryId);
    onCategoryChange();
  };

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入分类名称');
      return;
    }

    setLoading(true);
    try {
      await categoryDB.create(newCategoryName.trim(), currentRestaurant.id);
      message.success('创建成功');
      setCreateModalVisible(false);
      setNewCategoryName('');
      onCategoryChange();
    } catch (error) {
      message.error(error.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  // Rename category
  const handleRenameCategory = async () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入分类名称');
      return;
    }

    setLoading(true);
    try {
      await categoryDB.rename(renamingCategory.id, newCategoryName.trim());
      message.success('重命名成功');
      setRenameModalVisible(false);
      setNewCategoryName('');
      setRenamingCategory(null);
      onCategoryChange();
    } catch (error) {
      message.error(error.message || '重命名失败');
    } finally {
      setLoading(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (category) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分类 "${category.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await categoryDB.delete(category.id);
          message.success('删除成功');
          onCategoryChange();
        } catch (error) {
          message.error(error.message || '删除失败');
        }
      }
    });
  };

  // Open rename modal
  const openRenameModal = (category) => {
    setRenamingCategory(category);
    setNewCategoryName(category.name);
    setRenameModalVisible(true);
  };

  // Category tab menu items
  const getCategoryMenuItems = (category) => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => openRenameModal(category)
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => handleDeleteCategory(category)
    }
  ];

  // Build category tab items
  const tabItems = categories.map(category => ({
    key: category.id,
    label: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <FolderOutlined style={{ color: '#ffa5c1' }} />
        <span>{category.name}</span>
        <Dropdown
          menu={{ items: getCategoryMenuItems(category) }}
          trigger={['click']}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreOutlined
            style={{ marginLeft: 4, color: '#94a3b8', cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </div>
    ),
  }));

  if (!currentRestaurant) {
    return null;
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#333' }}>
          <FolderOutlined style={{ marginRight: 8, color: '#ffa5c1' }} />
          项目分类
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8, fontWeight: 'normal' }}>
            (共 {categories.length} 个分类)
          </span>
        </h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setCreateModalVisible(true)}
        >
          新建分类
        </Button>
      </div>

      {categories.length > 0 ? (
        <>
          <Tabs
            activeKey={currentCategory?.id}
            onChange={handleCategorySelect}
            items={tabItems}
            type="card"
            size="small"
            tabBarGutter={4}
            style={{ marginBottom: 16 }}
          />

          {/* Current category info */}
          {currentCategory && (
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #fff5f7 100%)',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 13
            }}>
              <div>
                <span style={{ color: '#94a3b8' }}>当前分类：</span>
                <span style={{ fontWeight: 600, color: '#333' }}>{currentCategory.name}</span>
              </div>
              {currentCategory.description && (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  {currentCategory.description}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无项目分类"
          style={{
            padding: '24px',
            background: '#fafafa',
            borderRadius: 8,
            marginBottom: 16
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建第一个分类
          </Button>
        </Empty>
      )}

      {/* Create category modal */}
      <Modal
        title="新建项目分类"
        open={createModalVisible}
        onOk={handleCreateCategory}
        onCancel={() => {
          setCreateModalVisible(false);
          setNewCategoryName('');
        }}
        confirmLoading={loading}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入分类名称（如 S5、S8、2024春季活动）"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onPressEnter={handleCreateCategory}
          autoFocus
        />
      </Modal>

      {/* Rename category modal */}
      <Modal
        title="重命名分类"
        open={renameModalVisible}
        onOk={handleRenameCategory}
        onCancel={() => {
          setRenameModalVisible(false);
          setNewCategoryName('');
          setRenamingCategory(null);
        }}
        confirmLoading={loading}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新的分类名称"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onPressEnter={handleRenameCategory}
          autoFocus
        />
      </Modal>
    </>
  );
}
