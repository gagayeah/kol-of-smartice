// v1.4.0 - Added performance logging for debugging slow startup
// Data structure: Brand -> Restaurant -> Category -> Blogger

import { useState, useEffect } from 'react';

// 性能日志工具
const perfLog = {
  timers: {},
  start(label) {
    this.timers[label] = performance.now();
    console.log(`⏱️ [PERF] START: ${label}`);
  },
  end(label) {
    if (this.timers[label]) {
      const duration = performance.now() - this.timers[label];
      console.log(`⏱️ [PERF] END: ${label} - ${duration.toFixed(2)}ms`);
      delete this.timers[label];
      return duration;
    }
    return 0;
  },
  log(message) {
    console.log(`📊 [PERF] ${message}`);
  }
};
import { Layout, Button, Space, Empty, message, Tabs } from 'antd';
import { UploadOutlined, ThunderboltOutlined, DownloadOutlined, ShareAltOutlined, SyncOutlined, DatabaseOutlined, ProjectOutlined, CloudUploadOutlined } from '@ant-design/icons';
import ProjectGroupSelector from './components/ProjectGroupSelector';
import ProjectManagerPlanA from './components/ProjectManagerPlanA';
import CategorySelector from './components/CategorySelector';
import BloggerList from './components/BloggerList';
import ImportBlogger from './components/ImportBlogger';
import ReceiptParser from './components/ReceiptParser';
import UpdateInteractions from './components/UpdateInteractions';
import ShareProjectModal from './components/ShareProjectModal';
import { projectGroupDB, projectDB, categoryDB, bloggerDB } from './utils/db';
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
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [bloggers, setBloggers] = useState([]);
  const [importVisible, setImportVisible] = useState(false);
  const [parserVisible, setParserVisible] = useState(false);
  const [updateInteractionsVisible, setUpdateInteractionsVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareMode, setShareMode] = useState('project'); // 'project' or 'group'
  const [shareData, setShareData] = useState(null);

  // 加载数据 - 优化版：并行加载 + 减少重复查询
  const loadData = async () => {
    perfLog.start('loadData-total');

    // 第一步：加载品牌（只需一次网络请求）
    perfLog.start('loadData-brands');
    const allGroups = await projectGroupDB.getAll();
    perfLog.end('loadData-brands');

    // 从缓存中获取当前品牌（不再发网络请求）
    const currentBrandId = localStorage.getItem('current_brand_id');
    const currentGrp = allGroups.find(b => b.id === currentBrandId) || allGroups[0] || null;

    setProjectGroups(allGroups);
    setCurrentGroup(currentGrp);
    perfLog.log(`品牌数量: ${allGroups.length}, 当前品牌: ${currentGrp?.name || 'null'}`);

    if (!currentGrp) {
      setProjects([]);
      setCurrentProject(null);
      setCategories([]);
      setCurrentCategory(null);
      setBloggers([]);
      perfLog.end('loadData-total');
      return;
    }

    // 第二步：加载门店（一次网络请求）
    perfLog.start('loadData-restaurants');
    const groupProjects = await projectDB.getByGroup(currentGrp.id);
    perfLog.end('loadData-restaurants');

    // 从本地获取当前门店（不发网络请求）
    const currentRestaurantId = localStorage.getItem('current_restaurant_id');
    let validCurrentProject = groupProjects.find(p => p.id === currentRestaurantId) || groupProjects[0] || null;

    setProjects(groupProjects);
    setCurrentProject(validCurrentProject);
    perfLog.log(`门店数量: ${groupProjects.length}`);

    if (!validCurrentProject) {
      setCategories([]);
      setCurrentCategory(null);
      setBloggers([]);
      perfLog.end('loadData-total');
      return;
    }

    // 第三步：并行加载分类和博主（两个网络请求同时发出）
    perfLog.start('loadData-categories+bloggers-parallel');

    const [restaurantCategories, allProjectBloggers] = await Promise.all([
      categoryDB.getByRestaurant(validCurrentProject.id),
      bloggerDB.getByProject(validCurrentProject.id) // 先加载所有博主作为备用
    ]);

    perfLog.end('loadData-categories+bloggers-parallel');
    perfLog.log(`分类数量: ${restaurantCategories.length}, 门店博主总数: ${allProjectBloggers.length}`);

    setCategories(restaurantCategories);

    // 从本地获取当前分类
    const currentCategoryId = localStorage.getItem('current_category_id');
    let validCurrentCategory = restaurantCategories.find(c => c.id === currentCategoryId) || restaurantCategories[0] || null;

    setCurrentCategory(validCurrentCategory);

    // 根据分类筛选博主（如果有分类）或使用所有博主
    let projectBloggers;
    if (validCurrentCategory) {
      // 从已加载的博主中筛选当前分类的博主（无需再发请求）
      projectBloggers = allProjectBloggers.filter(b => b.categoryId === validCurrentCategory.id);
      perfLog.log(`当前分类博主数量: ${projectBloggers.length}`);
    } else {
      projectBloggers = allProjectBloggers;
    }
    setBloggers(projectBloggers);

    // 自动同步到云端（异步，不阻塞）
    autoSyncProjectIfShared(validCurrentProject.id);

    perfLog.end('loadData-total');
  };

  // 初始化 - 简化版：品牌和门店是只读的，无需检查创建
  useEffect(() => {
    const init = async () => {
      perfLog.start('init-total');
      perfLog.log('==================== 应用初始化开始 ====================');

      try {
        // 直接加载数据，不再重复检查
        await loadData();
      } catch (error) {
        console.error('初始化过程出错:', error);
        perfLog.log(`初始化出错: ${error.message}`);
      }

      perfLog.end('init-total');
      perfLog.log('==================== 应用初始化完成 ====================');
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

            {/* 项目管理器（二级） - 门店选择 */}
            {currentGroup && (
              <ProjectManagerPlanA
                projects={projects}
                currentProject={currentProject}
                currentGroup={currentGroup}
                onProjectChange={loadData}
              />
            )}

            {/* 项目分类选择器（三级） */}
            {currentProject && (
              <CategorySelector
                categories={categories}
                currentCategory={currentCategory}
                currentRestaurant={currentProject}
                onCategoryChange={loadData}
              />
            )}

            {currentProject ? (
              currentCategory ? (
                bloggers.length > 0 ? (
                  <BloggerList
                    projectId={currentProject.id}
                    categoryId={currentCategory.id}
                    bloggers={bloggers}
                    onUpdate={loadData}
                    onShareProject={handleShareProject}
                  />
                ) : (
                  <Empty
                    description="当前分类暂无博主数据，请导入Excel"
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
              ) : categories.length === 0 ? (
                <Empty
                  description="请先创建项目分类"
                  style={{ marginTop: 60 }}
                />
              ) : (
                <Empty
                  description="请选择一个项目分类"
                  style={{ marginTop: 60 }}
                />
              )
            ) : (
              <Empty description="请先选择门店" style={{ marginTop: 60 }} />
            )}

            {/* 导入弹窗 - 使用新的ImportBlogger组件 */}
            {currentProject && currentCategory && (
              <ImportBlogger
                projectId={currentProject.id}
                categoryId={currentCategory.id}
                visible={importVisible}
                onClose={() => setImportVisible(false)}
                onSuccess={loadData}
              />
            )}

            {/* 解析弹窗 */}
            {currentProject && currentCategory && (
              <ReceiptParser
                projectId={currentProject.id}
                categoryId={currentCategory.id}
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
          多项目博主管理系统 v1.3.0 · Made with ❤️ by gaga
        </div>
      </Footer>
    </Layout>
  );
}

export default App;
