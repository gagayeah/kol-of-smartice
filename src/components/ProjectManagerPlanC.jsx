import { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, message, Row, Col, Collapse, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, FolderOutlined, FileOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { projectDB } from '../utils/db';

const { Panel } = Collapse;

export default function ProjectManagerPlanC({ projects, currentProject, currentGroup, onProjectChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [projectToRename, setProjectToRename] = useState(null);
  const [parentProjectForNew, setParentProjectForNew] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState([]);
  const [projectChildren, setProjectChildren] = useState({});

  useEffect(() => {
    loadProjectStructure();
  }, [projects]);

  const loadProjectStructure = async () => {
    if (!projects || projects.length === 0) return;

    // 为每个项目加载子项目
    const childrenMap = {};
    for (const project of projects) {
      const children = await projectDB.getChildren(project.id);
      if (children.length > 0) {
        childrenMap[project.id] = children;
      }
    }
    setProjectChildren(childrenMap);

    // 默认展开所有有子项目的项目
    const projectsWithChildren = Object.keys(childrenMap);
    setExpandedProjects(projectsWithChildren);
  };

  const handleProjectClick = async (projectId) => {
    await projectDB.switch(projectId);
    onProjectChange();
  };

  const toggleExpand = (projectId) => {
    setExpandedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
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
    setIsRenameModalOpen(true);
  };

  const handleRename = async () => {
    if (!renameValue.trim()) {
      message.warning('请输入项目名称');
      return;
    }

    await projectDB.rename(projectToRename.id, renameValue.trim());
    message.success('项目重命名成功！');
    setIsRenameModalOpen(false);
    setProjectToRename(null);
    onProjectChange();
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

  // 渲染项目卡片
  const renderProjectCard = (project, level = 0) => {
    const hasChildren = projectChildren[project.id]?.length > 0;
    const isExpanded = expandedProjects.includes(project.id);
    const isActive = currentProject?.id === project.id;

    return (
      <div key={project.id} style={{ marginBottom: 12 }}>
        <Card
          size="small"
          style={{
            borderColor: isActive ? '#ff69b4' : '#f0f0f0',
            background: isActive ? '#fff5f8' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: isActive ? '0 2px 8px rgba(255, 105, 180, 0.2)' : '0 1px 4px rgba(0,0,0,0.05)'
          }}
          onClick={() => handleProjectClick(project.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasChildren ? (
                <Button
                  type="text"
                  size="small"
                  icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(project.id);
                  }}
                  style={{ padding: '0 4px' }}
                />
              ) : (
                <div style={{ width: 24 }} />
              )}
              {hasChildren ? <FolderOutlined style={{ color: '#ffa940' }} /> : <FileOutlined style={{ color: '#1890ff' }} />}
              <span style={{ fontWeight: isActive ? 'bold' : 'normal', color: isActive ? '#ff69b4' : '#333' }}>
                {project.name}
              </span>
              {hasChildren && (
                <Tag color="blue" style={{ fontSize: '11px', padding: '0 6px' }}>
                  {projectChildren[project.id].length} 个子项目
                </Tag>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openCreateModal(project)}
                style={{ color: '#52c41a' }}
              >
                添加子项目
              </Button>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openRenameModal(project)}
                style={{ color: '#ffa5c1' }}
              />
              {projects.length > 1 && (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => startDelete(project)}
                />
              )}
            </div>
          </div>
        </Card>

        {/* 子项目 */}
        {hasChildren && isExpanded && (
          <div style={{ marginLeft: 40, marginTop: 8 }}>
            <Row gutter={[12, 12]}>
              {projectChildren[project.id].map(child => (
                <Col span={8} key={child.id}>
                  {renderProjectCard(child, level + 1)}
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>
    );
  };

  // 顶级项目
  const topLevelProjects = projects.filter(p => !p.parentId);

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#ff69b4' }}>🎴 方案C：卡片式横排（可折叠）</h3>
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

      <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
        <Row gutter={[16, 16]}>
          {topLevelProjects.map(project => (
            <Col span={8} key={project.id}>
              {renderProjectCard(project)}
            </Col>
          ))}

          {/* 新建项目卡片 */}
          <Col span={8}>
            <Card
              size="small"
              style={{
                borderStyle: 'dashed',
                borderColor: '#d9d9d9',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => openCreateModal()}
            >
              <div style={{ textAlign: 'center', color: '#999' }}>
                <PlusOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                <div>新建项目</div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

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
