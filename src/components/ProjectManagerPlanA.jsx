import { useState, useEffect } from 'react';
import { Tabs, Button, Modal, Input, message, Space, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, HomeOutlined } from '@ant-design/icons';
import { projectDB } from '../utils/db';

export default function ProjectManagerPlanA({ projects, currentProject, currentGroup, onProjectChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [projectToRename, setProjectToRename] = useState(null);
  const [newParentId, setNewParentId] = useState(null);
  const [parentProjectForNew, setParentProjectForNew] = useState(null);
  const [currentLevelProjects, setCurrentLevelProjects] = useState([]);
  const [childProjects, setChildProjects] = useState([]);
  const [grandChildProjects, setGrandChildProjects] = useState([]);
  const [selectedLevel1, setSelectedLevel1] = useState(null);
  const [selectedLevel2, setSelectedLevel2] = useState(null);

  useEffect(() => {
    loadProjects();
  }, [projects, currentProject]);

  const loadProjects = async () => {
    if (!projects || projects.length === 0) return;

    // 第一层：顶级项目
    const topLevel = projects.filter(p => !p.parentId);
    setCurrentLevelProjects(topLevel);

    // 如果有当前项目，找到它的层级关系
    if (currentProject) {
      const findParentChain = (proj) => {
        if (!proj.parentId) {
          return [proj];
        }
        const parent = projects.find(p => p.id === proj.parentId);
        if (!parent) return [proj];
        return [...findParentChain(parent), proj];
      };

      const chain = findParentChain(currentProject);

      if (chain.length >= 1) {
        setSelectedLevel1(chain[0]);
        const level1Children = await projectDB.getChildren(chain[0].id);
        setChildProjects(level1Children);
      }

      if (chain.length >= 2) {
        setSelectedLevel2(chain[1]);
        const level2Children = await projectDB.getChildren(chain[1].id);
        setGrandChildProjects(level2Children);
      } else {
        setSelectedLevel2(null);
        setGrandChildProjects([]);
      }

      // 如果当前项目是第三层项目，确保第三层数据已加载
      if (chain.length >= 3) {
        const level2Parent = chain[1];
        const level2Children = await projectDB.getChildren(level2Parent.id);
        setGrandChildProjects(level2Children);
      }
    }
  };

  const handleLevel1Select = async (projectId) => {
    // 处理新建项目按钮
    if (projectId === 'add-level1') {
      openCreateModal();
      return;
    }

    const project = currentLevelProjects.find(p => p.id === projectId);
    setSelectedLevel1(project);
    setSelectedLevel2(null);
    setGrandChildProjects([]);

    await projectDB.switch(projectId);
    const children = await projectDB.getChildren(projectId);
    setChildProjects(children);
    onProjectChange();
  };

  const handleLevel2Select = async (projectId) => {
    // 处理添加子项目按钮
    if (projectId === 'add-level2') {
      openCreateModal(selectedLevel1);
      return;
    }

    const project = childProjects.find(p => p.id === projectId);
    setSelectedLevel2(project);

    await projectDB.switch(projectId);
    const grandChildren = await projectDB.getChildren(projectId);
    setGrandChildProjects(grandChildren);
    onProjectChange();
  };

  const handleLevel3Select = async (projectId) => {
    // 处理添加子项目按钮
    if (projectId === 'add-level3') {
      openCreateModal(selectedLevel2);
      return;
    }

    await projectDB.switch(projectId);
    onProjectChange();
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入项目名称');
      return;
    }

    if (!currentGroup) {
      message.error('请先选择项目集');
      return;
    }

    if (parentProjectForNew) {
      await projectDB.create(newProjectName, currentGroup.id, parentProjectForNew.id);
      message.success(`子项目"${newProjectName}"创建成功！`);
    } else {
      await projectDB.create(newProjectName, currentGroup.id);
      message.success(`项目"${newProjectName}"创建成功！`);
    }

    setNewProjectName('');
    setIsModalOpen(false);
    setParentProjectForNew(null);
    onProjectChange();
  };

  const openCreateModal = (parent = null) => {
    setParentProjectForNew(parent);
    setIsModalOpen(true);
  };

  const openRenameModal = (project) => {
    setProjectToRename(project);
    setRenameValue(project.name);
    setNewParentId(project.parentId || null);
    setIsRenameModalOpen(true);
  };

  const handleRename = async () => {
    if (!renameValue.trim()) {
      message.warning('请输入项目名称');
      return;
    }

    // 检查是否会造成循环引用
    if (newParentId) {
      const isDescendant = await checkIsDescendant(newParentId, projectToRename.id);
      if (isDescendant) {
        message.error('不能将项目移动到自己的子项目下！');
        return;
      }
    }

    // 更新名称
    await projectDB.rename(projectToRename.id, renameValue.trim());

    // 如果父级改变了，更新父级（博主数据会自动跟着项目走，因为博主的project_id不变）
    if (newParentId !== (projectToRename.parentId || null)) {
      await projectDB.updateParent(projectToRename.id, newParentId);
      if (newParentId === null) {
        message.success('项目已提升为顶级项目！项目内的博主数据保持不变。');
      } else {
        message.success('项目层级已调整！项目内的博主数据保持不变。');
      }
    } else {
      message.success('项目重命名成功！');
    }

    setIsRenameModalOpen(false);
    setProjectToRename(null);
    onProjectChange();
  };

  // 检查是否是子孙项目（防止循环引用）
  const checkIsDescendant = async (potentialParentId, projectId) => {
    if (potentialParentId === projectId) return true;

    const children = await projectDB.getChildren(projectId);
    for (const child of children) {
      if (child.id === potentialParentId) return true;
      const isDescendant = await checkIsDescendant(potentialParentId, child.id);
      if (isDescendant) return true;
    }
    return false;
  };

  const startDelete = (project) => {
    setProjectToDelete(project);
    setDeleteStep(1);
  };

  const handleStep1Continue = () => {
    setDeleteStep(2);
    setConfirmText('');
  };

  const handleStep2Continue = () => {
    if (confirmText !== '确认删除') {
      message.error('请输入"确认删除"四个字');
      return;
    }
    setDeleteStep(3);
  };

  const handleFinalDelete = async () => {
    if (projectToDelete) {
      await projectDB.delete(projectToDelete.id);
      message.success(`项目"${projectToDelete.name}"及其所有子项目已删除`);
      cancelDelete();
      onProjectChange();
    }
  };

  const cancelDelete = () => {
    setDeleteStep(0);
    setProjectToDelete(null);
    setConfirmText('');
  };

  // 构建第一层标签页
  const level1Items = currentLevelProjects.map(project => ({
    key: project.id,
    label: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span>{project.name}</span>
        <EditOutlined
          style={{ color: '#ffa5c1', fontSize: '12px', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); openRenameModal(project); }}
        />
        {currentLevelProjects.length > 1 && (
          <DeleteOutlined
            style={{ color: '#ff4d4f', fontSize: '12px', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); startDelete(project); }}
          />
        )}
      </div>
    ),
  }));

  level1Items.push({
    key: 'add-level1',
    label: <Button type="dashed" icon={<PlusOutlined />} size="small">新建项目</Button>,
    disabled: false,
  });

  // 构建第二层标签页
  const level2Items = childProjects.map(project => ({
    key: project.id,
    label: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span>{project.name}</span>
        <EditOutlined
          style={{ color: '#ffa5c1', fontSize: '12px', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); openRenameModal(project); }}
        />
        <DeleteOutlined
          style={{ color: '#ff4d4f', fontSize: '12px', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); startDelete(project); }}
        />
      </div>
    ),
  }));

  if (selectedLevel1 && childProjects.length >= 0) {
    level2Items.push({
      key: 'add-level2',
      label: <Button type="dashed" icon={<PlusOutlined />} size="small">添加子项目</Button>,
      disabled: false,
    });
  }

  // 构建第三层标签页
  const level3Items = grandChildProjects.map(project => ({
    key: project.id,
    label: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span>{project.name}</span>
        <EditOutlined
          style={{ color: '#ffa5c1', fontSize: '12px', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); openRenameModal(project); }}
        />
        <DeleteOutlined
          style={{ color: '#ff4d4f', fontSize: '12px', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); startDelete(project); }}
        />
      </div>
    ),
  }));

  if (selectedLevel2 && grandChildProjects.length >= 0) {
    level3Items.push({
      key: 'add-level3',
      label: <Button type="dashed" icon={<PlusOutlined />} size="small">添加子项目</Button>,
      disabled: false,
    });
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#333' }}>📋 项目管理</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCreateModal()}
          size="small"
          style={{ background: '#ff69b4', borderColor: '#ff69b4' }}
        >
          新建项目
        </Button>
      </div>

      {/* 第一层 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: 4 }}>第一层（顶级项目）</div>
        <Tabs
          activeKey={selectedLevel1?.id}
          onChange={handleLevel1Select}
          items={level1Items}
          type="card"
          size="small"
          tabBarGutter={4}
          tabBarExtraContent={{
            right: <Button type="text" icon={<PlusOutlined />} size="small" onClick={() => openCreateModal()}>新建</Button>
          }}
        />
      </div>

      {/* 第二层 */}
      {selectedLevel1 && level2Items.length > 0 && (
        <div style={{ marginBottom: 8, marginLeft: 20 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: 4 }}>第二层（{selectedLevel1.name} 的子项目）</div>
          <Tabs
            activeKey={selectedLevel2?.id}
            onChange={handleLevel2Select}
            items={level2Items}
            type="card"
            size="small"
            tabBarGutter={4}
            tabBarExtraContent={{
              right: <Button type="text" icon={<PlusOutlined />} size="small" onClick={() => openCreateModal(selectedLevel1)}>添加</Button>
            }}
          />
        </div>
      )}

      {/* 第三层 */}
      {selectedLevel2 && (
        <div style={{ marginBottom: 8, marginLeft: 40 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: 4 }}>第三层（{selectedLevel2.name} 的子项目）</div>
          <Tabs
            activeKey={currentProject?.id}
            onChange={handleLevel3Select}
            items={level3Items}
            type="card"
            size="small"
            tabBarGutter={4}
            tabBarExtraContent={{
              right: <Button type="text" icon={<PlusOutlined />} size="small" onClick={() => openCreateModal(selectedLevel2)}>添加</Button>
            }}
          />
        </div>
      )}

      {/* 新建项目对话框 */}
      <Modal
        title={parentProjectForNew ? `在"${parentProjectForNew.name}"下新建子项目` : '新建项目'}
        open={isModalOpen}
        onOk={handleCreateProject}
        onCancel={() => {
          setIsModalOpen(false);
          setNewProjectName('');
          setParentProjectForNew(null);
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder={parentProjectForNew ? '请输入子项目名称' : '请输入项目名称'}
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={handleCreateProject}
          autoFocus
        />
      </Modal>

      {/* 重命名对话框 */}
      <Modal
        title="重命名项目"
        open={isRenameModalOpen}
        onOk={handleRename}
        onCancel={() => {
          setIsRenameModalOpen(false);
          setProjectToRename(null);
        }}
        okText="确认"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新的项目名称"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          autoFocus
        />
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        title="⚠️ 第一次确认：删除项目"
        open={deleteStep === 1}
        onOk={handleStep1Continue}
        onCancel={cancelDelete}
        okText="继续删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>即将删除项目：<strong>{projectToDelete?.name}</strong></p>
        <p style={{ color: '#ff4d4f' }}>⚠️ 该项目及其所有子项目、博主数据将被清除！</p>
      </Modal>

      <Modal
        title="⚠️⚠️ 第二次确认：请输入确认文字"
        open={deleteStep === 2}
        onOk={handleStep2Continue}
        onCancel={cancelDelete}
        okText="下一步"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>为防止误操作，请输入以下文字：</p>
        <p style={{ background: '#fff1f0', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#ff4d4f' }}>
          确认删除
        </p>
        <Input
          placeholder="请准确输入上面的文字"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
        />
      </Modal>

      <Modal
        title="🚨 第三次确认：最后警告"
        open={deleteStep === 3}
        onOk={handleFinalDelete}
        onCancel={cancelDelete}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p style={{ fontWeight: 'bold', color: '#ff4d4f' }}>🚨 这是最后一次确认！</p>
        <p>项目 <strong>"{projectToDelete?.name}"</strong> 及其下所有子项目和博主数据将被永久删除</p>
        <p style={{ color: '#ff4d4f' }}>❌ 此操作无法撤销</p>
      </Modal>
    </>
  );
}
