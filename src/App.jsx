import { useState, useEffect } from 'react';
import { Layout, Button, Space, Empty, message, Tabs } from 'antd';
import { UploadOutlined, ThunderboltOutlined, DownloadOutlined, ShareAltOutlined, SyncOutlined, DatabaseOutlined, ProjectOutlined, CloudUploadOutlined } from '@ant-design/icons';
import ProjectGroupSelector from './components/ProjectGroupSelector';
import ProjectManagerPlanA from './components/ProjectManagerPlanA';
import BloggerList from './components/BloggerList';
import ImportBlogger from './components/ImportBlogger';
import ReceiptParser from './components/ReceiptParser';
import UpdateInteractions from './components/UpdateInteractions';
import ShareProjectModal from './components/ShareProjectModal';
import { projectGroupDB, projectDB, bloggerDB } from './utils/db';
import { exportToExcel } from './utils/excel';
import { autoSyncProjectIfShared } from './utils/supabase';
import logoImg from '../public/logo.png';
import './App.css';

const { Header, Content, Footer } = Layout;

function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [projectGroups, setProjectGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [bloggers, setBloggers] = useState([]);
  const [importVisible, setImportVisible] = useState(false);
  const [parserVisible, setParserVisible] = useState(false);
  const [updateInteractionsVisible, setUpdateInteractionsVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareMode, setShareMode] = useState('project'); // 'project' or 'group'
  const [shareData, setShareData] = useState(null);

  // 调试: 检查window.electron
  useEffect(() => {
    console.log('=== Electron环境检测 ===');
    console.log('window.electron:', window.electron);
    console.log('window.electron存在:', !!window.electron);
    if (!window.electron) {
      console.error('❌ window.electron 未定义! Preload脚本可能没有正确加载');
      alert('警告: Electron环境未正确初始化!\nwindow.electron = ' + window.electron);
    } else {
      console.log('✅ window.electron 已正确加载');
      console.log('可用的API:', Object.keys(window.electron));
    }
  }, []);

  // 加载数据
  const loadData = async () => {
    // 加载项目集
    const allGroups = await projectGroupDB.getAll();
    const currentGrp = await projectGroupDB.getCurrent();

    setProjectGroups(allGroups);
    setCurrentGroup(currentGrp);

    // 加载当前项目集的项目
    if (currentGrp) {
      const groupProjects = await projectDB.getByGroup(currentGrp.id);
      const current = await projectDB.getCurrent(currentGrp.id);

      setProjects(groupProjects);

      // 检查当前项目是否属于当前项目集
      let validCurrentProject = null;
      if (current && groupProjects.find(p => p.id === current.id)) {
        // 当前项目属于当前项目集
        validCurrentProject = current;
      } else if (groupProjects.length > 0) {
        // 当前项目不属于当前项目集，切换到第一个项目
        validCurrentProject = groupProjects[0];
        await projectDB.switch(validCurrentProject.id);
      }

      setCurrentProject(validCurrentProject);

      // 加载当前项目的博主
      if (validCurrentProject) {
        const projectBloggers = await bloggerDB.getByProject(validCurrentProject.id);
        setBloggers(projectBloggers);

        // 自动同步到云端（如果项目已分享）
        autoSyncProjectIfShared(validCurrentProject.id);
      } else {
        setBloggers([]);
      }
    } else {
      setProjects([]);
      setCurrentProject(null);
      setBloggers([]);
    }
  };

  // 初始化
  useEffect(() => {
    console.log('=== App useEffect 开始执行 ===');

    const init = async () => {
      try {
        console.log('1. 开始初始化...');

        // 检查并创建默认数据（如果需要）
        const allGroups = await projectGroupDB.getAll();
        console.log('2. 获取到的项目集数量:', allGroups.length);

        let currentGrp = null;

        if (allGroups.length === 0) {
          // 没有项目集，创建默认项目集和项目
          console.log('3. 没有项目集，开始创建默认项目集和项目');
          const defaultGroup = await projectGroupDB.create('默认项目集');
          console.log('4. 默认项目集已创建:', defaultGroup);

          const defaultProject = await projectDB.create('我的第一个项目', defaultGroup.id);
          console.log('5. 默认项目已创建:', defaultProject);

          currentGrp = defaultGroup;
        } else {
          console.log('3. 已有项目集，检查是否需要创建项目');
          // 有项目集，检查当前项目集下是否有项目
          currentGrp = await projectGroupDB.getCurrent();
          console.log('4. 当前项目集:', currentGrp);

          if (currentGrp) {
            const groupProjects = await projectDB.getByGroup(currentGrp.id);
            console.log('5. 当前项目集下的项目数:', groupProjects.length);

            if (groupProjects.length === 0) {
              // 当前项目集下没有项目，创建默认项目
              console.log('6. 当前项目集下无项目，创建默认项目');
              const defaultProject = await projectDB.create('我的第一个项目', currentGrp.id);
              console.log('7. 默认项目已创建:', defaultProject);
            }
          }
        }

        // 加载所有数据
        console.log('最后: 开始加载所有数据...');
        await loadData();
        console.log('=== 初始化完成 ===');
      } catch (error) {
        console.error('初始化过程出错:', error);
      }
    };

    init();
  }, []);

  // 导出Excel
  const handleExport = () => {
    if (bloggers.length === 0) {
      message.warning('当前项目没有数据可导出');
      return;
    }

    const filename = `${currentProject.name}_${new Date().toLocaleDateString()}.xlsx`;
    exportToExcel(bloggers, filename);
  };

  // 打开分享项目集弹窗
  const handleShareGroup = async () => {
    if (!currentGroup) return;

    // 获取项目集下的所有项目和博主
    const groupProjects = await projectDB.getByGroup(currentGroup.id);
    let allBloggers = [];
    let projectsWithBloggers = [];

    for (const project of groupProjects) {
      const projectBloggers = await bloggerDB.getByProject(project.id);
      // 给每个博主添加项目名称
      const bloggersWithProject = projectBloggers.map(blogger => ({
        ...blogger,
        projectName: project.name
      }));
      allBloggers = allBloggers.concat(bloggersWithProject);

      // 保存项目及其博主信息
      projectsWithBloggers.push({
        id: project.id,
        name: project.name,
        bloggers: projectBloggers
      });
    }

    if (allBloggers.length === 0) {
      message.warning('当前项目集下没有数据可分享');
      return;
    }

    setShareMode('group');
    setShareData({
      groupId: currentGroup.id,
      groupName: currentGroup.name,
      projectCount: groupProjects.length,
      totalBloggers: allBloggers.length,
      bloggers: allBloggers,
      projects: projectsWithBloggers
    });
    setShareModalVisible(true);
  };

  // 打开分享单个项目弹窗
  const handleShareProject = () => {
    if (bloggers.length === 0) {
      message.warning('当前项目没有数据可分享');
      return;
    }

    setShareMode('project');
    setShareData({
      projectId: currentProject.id,
      projectName: currentProject.name,
      projectGroupName: currentGroup.name,
      bloggers: bloggers
    });
    setShareModalVisible(true);
  };


  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header style={{
        background: 'linear-gradient(135deg, #ffa5c1 0%, #ffb7d5 100%)',
        padding: '0 24px 0 90px',
        boxShadow: '0 2px 8px rgba(255, 165, 193, 0.15)',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={logoImg} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <h1 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 600 }}>多项目博主管理系统</h1>
          </div>
          {activeTab === 'projects' && currentProject && (
            <Space>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportVisible(true)}
              >
                导入博主信息
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                type="primary"
                onClick={() => setParserVisible(true)}
              >
                智能解析
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={() => setUpdateInteractionsVisible(true)}
                disabled={bloggers.length === 0}
                type="primary"
              >
                更新互动数据
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={bloggers.length === 0}
              >
                导出Excel
              </Button>
            </Space>
          )}
        </div>
      </Header>

      <Content style={{ padding: '24px' }}>
        {/* Tab导航 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'projects',
              label: (
                <span>
                  <ProjectOutlined />
                  项目管理
                </span>
              ),
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        {/* 项目管理页面 */}
        {activeTab === 'projects' && (
          <>
            {/* 项目集选择器（一级） */}
            <ProjectGroupSelector
              groups={projectGroups}
              currentGroup={currentGroup}
              onGroupChange={loadData}
              onShareGroup={handleShareGroup}
            />

            {/* 项目管理器（二级） - 使用方案A：多层标签页 */}
            {currentGroup && (
              <ProjectManagerPlanA
                projects={projects}
                currentProject={currentProject}
                currentGroup={currentGroup}
                onProjectChange={loadData}
              />
            )}

            {currentProject ? (
              bloggers.length > 0 ? (
                <BloggerList
                  projectId={currentProject.id}
                  bloggers={bloggers}
                  onUpdate={loadData}
                  onShareProject={handleShareProject}
                />
              ) : (
                <Empty
                  description="暂无博主数据，请导入Excel"
                  style={{ marginTop: 60 }}
                >
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => setImportVisible(true)}
                  >
                    导入博主信息
                  </Button>
                </Empty>
              )
            ) : (
              <Empty description="请先创建项目" style={{ marginTop: 60 }} />
            )}

            {/* 导入弹窗 - 使用新的ImportBlogger组件 */}
            {currentProject && (
              <ImportBlogger
                projectId={currentProject.id}
                visible={importVisible}
                onClose={() => setImportVisible(false)}
                onSuccess={loadData}
              />
            )}

            {/* 解析弹窗 */}
            {currentProject && (
              <ReceiptParser
                projectId={currentProject.id}
                visible={parserVisible}
                onClose={() => setParserVisible(false)}
                onSuccess={loadData}
              />
            )}

            {/* 更新互动数据弹窗 */}
            <UpdateInteractions
              visible={updateInteractionsVisible}
              bloggers={bloggers}
              onClose={() => setUpdateInteractionsVisible(false)}
              onComplete={loadData}
            />

            {/* 分享到云端弹窗 */}
            {shareModalVisible && shareData && (
              <ShareProjectModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                projectData={shareData}
                shareMode={shareMode}
              />
            )}
          </>
        )}
      </Content>

      <Footer style={{ textAlign: 'center', padding: '20px', background: 'transparent', borderTop: 'none' }}>
        <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
          多项目博主管理系统 v1.2.0 · Made with ❤️ by gaga
        </div>
      </Footer>
    </Layout>
  );
}

export default App;
