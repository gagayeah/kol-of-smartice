import { useState, useEffect } from 'react';
import { Tree, Button, Modal, Input, message, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import { projectDB } from '../utils/db';

export default function ProjectManager({ projects, currentProject, currentGroup, onProjectChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [projectToRename, setProjectToRename] = useState(null);
  const [parentProjectForNew, setParentProjectForNew] = useState(null);
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);

  // 构建树形数据结构
  useEffect(() => {
    const buildTreeData = async () => {
      if (!projects || projects.length === 0) return [];

      // 递归构建树节点
      const buildNode = async (project) => {
        const children = await projectDB.getChildren(project.id);
        const childNodes = await Promise.all(children.map(child => buildNode(child)));

        return {
          key: project.id,
          title: (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  flex: 1,
                  fontWeight: currentProject?.id === project.id ? 'bold' : 'normal',
                  color: currentProject?.id === project.id ? '#ff69b4' : 'inherit'
                }}
              >
                {project.name}
              </span>
              <Space size={4}>
                <PlusOutlined
                  style={{
                    color: '#52c41a',
                    fontSize: '12px',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateSubProjectModal(project);
                  }}
                  title={`在"${project.name}"下添加子项目`}
                />
                <EditOutlined
                  style={{
                    color: '#ffa5c1',
                    fontSize: '12px',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openRenameModal(project.id);
                  }}
                  title={`重命名"${project.name}"`}
                />
                {projects.length > 1 && (
                  <DeleteOutlined
                    style={{
                      color: '#ff4d4f',
                      fontSize: '12px',
                      padding: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startDelete(project);
                    }}
                    title={`删除"${project.name}"`}
                  />
                )}
              </Space>
            </div>
          ),
          icon: childNodes.length > 0 ? <FolderOutlined /> : <FileOutlined />,
          children: childNodes.length > 0 ? childNodes : undefined,
        };
      };

      // 只对顶级项目构建树
      const topLevelProjects = projects.filter(p => !p.parentId);
      const tree = await Promise.all(topLevelProjects.map(project => buildNode(project)));
      setTreeData(tree);

      // 默认展开所有节点
      const getAllKeys = (nodes) => {
        let keys = [];
        nodes.forEach(node => {
          keys.push(node.key);
          if (node.children) {
            keys = keys.concat(getAllKeys(node.children));
          }
        });
        return keys;
      };
      setExpandedKeys(getAllKeys(tree));
    };

    buildTreeData();
  }, [projects, currentProject]);

  // 创建新项目（顶级项目，属于当前项目集）
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入项目名称');
      return;
    }

    if (!currentGroup) {
      message.error('请先选择项目集');
      return;
    }

    // 如果有父项目，创建子项目
    if (parentProjectForNew) {
      await projectDB.create(newProjectName, currentGroup.id, parentProjectForNew.id);
      message.success(`子项目"${newProjectName}"创建成功！`);
    } else {
      // 创建顶级项目
      await projectDB.create(newProjectName, currentGroup.id);
      message.success(`项目"${newProjectName}"创建成功！`);
    }

    setNewProjectName('');
    setIsModalOpen(false);
    setParentProjectForNew(null);
    onProjectChange();
  };

  // 打开创建子项目对话框
  const openCreateSubProjectModal = (parentProject) => {
    setParentProjectForNew(parentProject);
    setIsModalOpen(true);
  };

  // 打开创建顶级项目对话框
  const openCreateTopLevelModal = () => {
    setParentProjectForNew(null);
    setIsModalOpen(true);
  };

  // 切换项目
  const handleTreeSelect = async (selectedKeys) => {
    if (selectedKeys.length > 0) {
      await projectDB.switch(selectedKeys[0]);
      onProjectChange();
    }
  };

  // 打开重命名对话框
  const openRenameModal = (projectId) => {
    const findProject = (projects, id) => {
      for (const project of projects) {
        if (project.id === id) return project;
      }
      return null;
    };

    const project = findProject(projects, projectId);
    if (!project) {
      console.error('未找到项目:', projectId);
      return;
    }
    setProjectToRename(project);
    setRenameValue(project.name);
    setIsRenameModalOpen(true);
  };

  // 重命名项目
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

  // 开始删除流程
  const startDelete = (project) => {
    setProjectToDelete(project);
    setDeleteStep(1);
  };

  // 三重确认逻辑
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

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>项目管理</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateTopLevelModal}
          size="small"
          style={{ background: '#ff69b4', borderColor: '#ff69b4' }}
        >
          新建项目
        </Button>
      </div>

      {treeData.length > 0 ? (
        <Tree
          treeData={treeData}
          selectedKeys={currentProject ? [currentProject.id] : []}
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          onSelect={handleTreeSelect}
          showIcon
          style={{
            background: '#fff',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #f0f0f0'
          }}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          暂无项目，点击右上角"新建项目"按钮创建
        </div>
      )}

      {/* 新建项目/子项目对话框 */}
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
          placeholder={parentProjectForNew ? '请输入子项目名称（如：春熙路店）' : '请输入项目名称（如：宁桂杏）'}
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={handleCreateProject}
          autoFocus
        />
      </Modal>

      {/* 重命名项目对话框 */}
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

      {/* 第一次确认 */}
      <Modal
        title="⚠️ 第一次确认：删除项目"
        open={deleteStep === 1}
        onOk={handleStep1Continue}
        onCancel={cancelDelete}
        okText="继续删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <div>
          <p>即将删除项目：<strong>{projectToDelete?.name}</strong></p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>
            ⚠️ 该项目及其所有子项目、博主数据将被清除！
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
            项目 <strong>"{projectToDelete?.name}"</strong> 及其下所有子项目和博主数据将被永久删除
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 8 }}>
            ❌ 此操作无法撤销
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>
            ❌ 此操作无法恢复
          </p>
        </div>
      </Modal>
    </>
  );
}
