import { useState } from 'react';
import { Select, Button, Modal, Input, message } from 'antd';
import { PlusOutlined, FolderOutlined, DeleteOutlined, EditOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { projectGroupDB } from '../utils/db';

export default function ProjectGroupSelector({ groups, currentGroup, onGroupChange, onShareGroup }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteStep, setDeleteStep] = useState(0); // 0=未开始, 1=第一次, 2=第二次, 3=第三次
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // 创建新项目集
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      message.warning('请输入项目集名称');
      return;
    }

    await projectGroupDB.create(newGroupName);
    message.success('项目集创建成功！');
    setNewGroupName('');
    setIsModalOpen(false);
    onGroupChange();
  };

  // 切换项目集
  const handleGroupChange = async (groupId) => {
    await projectGroupDB.switch(groupId);
    onGroupChange();
  };

  // 打开重命名对话框
  const openRenameModal = () => {
    if (!currentGroup) {
      console.error('当前项目集不存在');
      return;
    }
    console.log('打开项目集重命名弹窗，当前项目集:', currentGroup);
    setRenameValue(currentGroup.name);
    setIsRenameModalOpen(true);
  };

  // 重命名项目集
  const handleRename = async () => {
    if (!renameValue.trim()) {
      message.warning('请输入项目集名称');
      return;
    }

    console.log('重命名项目集:', currentGroup.id, '新名称:', renameValue.trim());
    await projectGroupDB.rename(currentGroup.id, renameValue.trim());
    message.success('项目集重命名成功！');
    setIsRenameModalOpen(false);
    onGroupChange();
  };

  // 开始删除流程（第一次确认）
  const startDelete = () => {
    if (groups.length <= 1) {
      message.warning('至少需要保留一个项目集');
      return;
    }
    setGroupToDelete(currentGroup);
    setDeleteStep(1);
  };

  // 进入第二次确认
  const handleStep1Continue = () => {
    setDeleteStep(2);
    setConfirmText('');
  };

  // 进入第三次确认
  const handleStep2Continue = () => {
    if (confirmText !== '确认删除') {
      message.error('请输入"确认删除"四个字');
      return;
    }
    setDeleteStep(3);
  };

  // 最终删除
  const handleFinalDelete = async () => {
    if (groupToDelete) {
      await projectGroupDB.delete(groupToDelete.id);
      message.success(`项目集"${groupToDelete.name}"已删除`);
      cancelDelete();
      onGroupChange();
    }
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteStep(0);
    setGroupToDelete(null);
    setConfirmText('');
  };

  return (
    <div className="project-group-card" style={{
      marginBottom: 20,
      padding: '16px 20px',
      background: '#fff',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      transition: 'all 0.3s ease'
    }}>
      <FolderOutlined style={{ fontSize: 20, color: '#ffa5c1' }} />
      <span style={{ fontWeight: 600, color: '#475569', fontSize: 15 }}>项目集：</span>

      <Select
        value={currentGroup?.id}
        onChange={handleGroupChange}
        style={{ minWidth: 200, flex: 1, maxWidth: 300 }}
        options={groups.map(g => ({ label: g.name, value: g.id }))}
      />

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => setIsModalOpen(true)}
        size="small"
      >
        新建项目集
      </Button>

      {currentGroup && (
        <>
          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => onShareGroup && onShareGroup()}
            size="small"
            type="primary"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            分享项目集
          </Button>

          <Button
            icon={<EditOutlined />}
            onClick={openRenameModal}
            size="small"
          >
            重命名
          </Button>
        </>
      )}

      {groups.length > 1 && currentGroup && (
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={startDelete}
          size="small"
        >
          删除当前项目集
        </Button>
      )}

      {/* 新建项目集对话框 */}
      <Modal
        title="新建项目集"
        open={isModalOpen}
        onOk={handleCreateGroup}
        onCancel={() => {
          setIsModalOpen(false);
          setNewGroupName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入项目集名称（如：2024年10月推广）"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onPressEnter={handleCreateGroup}
          autoFocus
        />
      </Modal>

      {/* 重命名项目集对话框 */}
      <Modal
        title="重命名项目集"
        open={isRenameModalOpen}
        onOk={handleRename}
        onCancel={() => setIsRenameModalOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新的项目集名称"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          autoFocus
        />
      </Modal>

      {/* 第一次确认 */}
      <Modal
        title="⚠️ 第一次确认：删除项目集"
        open={deleteStep === 1}
        onOk={handleStep1Continue}
        onCancel={cancelDelete}
        okText="继续删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <div>
          <p>即将删除项目集：<strong>{groupToDelete?.name}</strong></p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>
            ⚠️ 该项目集下的所有项目和博主数据将被清除！
          </p>
        </div>
      </Modal>

      {/* 第二次确认：输入确认文字 */}
      <Modal
        title="⚠️⚠️ 第二次确认：请输入确认文字"
        open={deleteStep === 2}
        onOk={handleStep2Continue}
        onCancel={cancelDelete}
        okText="下一步"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <div>
          <p>为防止误操作，请输入以下文字：</p>
          <p style={{
            background: '#fff1f0',
            padding: '8px',
            borderRadius: 4,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#ff4d4f'
          }}>
            确认删除
          </p>
          <Input
            placeholder="请准确输入上面的文字"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* 第三次确认：最后警告 */}
      <Modal
        title="🚨 第三次确认：最后警告"
        open={deleteStep === 3}
        onOk={handleFinalDelete}
        onCancel={cancelDelete}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <div>
          <p style={{ fontSize: 16, fontWeight: 'bold', color: '#ff4d4f', marginBottom: 12 }}>
            🚨 这是最后一次确认！
          </p>
          <p style={{ marginBottom: 8 }}>
            项目集 <strong>"{groupToDelete?.name}"</strong> 及其下所有数据将被永久删除
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 8 }}>
            ❌ 此操作无法撤销
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>
            ❌ 此操作无法恢复
          </p>
        </div>
      </Modal>
    </div>
  );
}
