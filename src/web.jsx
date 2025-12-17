// v1.4.0 - Added CategorySelector for project categories (活动期管理)
import { useState, useEffect } from 'react';
import { Layout, Button, Space, Empty, message, Tabs, Alert } from 'antd';
import { UploadOutlined, ThunderboltOutlined, DownloadOutlined, ShareAltOutlined, SyncOutlined, DatabaseOutlined, ProjectOutlined, CloudUploadOutlined } from '@ant-design/icons';
import ProjectGroupSelector from './components/ProjectGroupSelector';
import ProjectManagerPlanA from './components/ProjectManagerPlanA';
import CategorySelector from './components/CategorySelector';
import BloggerList from './components/BloggerList';
import ImportBlogger from './components/ImportBlogger';
import ReceiptParser from './components/ReceiptParser';
import UpdateInteractions from './components/UpdateInteractions';
import ShareProjectModal from './components/ShareProjectModal';
import { projectGroupDB, projectDB, bloggerDB, categoryDB } from './utils/db';
import { exportToExcel } from './utils/excel';
import { autoSyncProjectIfShared } from './utils/supabase';
import logoImg from '../public/logo.png';
import './App.css';

const { Header, Content, Footer } = Layout;

function WebApp() {
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

  // 加载数据
  const loadData = async () => {
    try {
      // 加载项目集
      const allGroups = await projectGroupDB.getAll();
      const currentGrp = await projectGroupDB.getCurrent();

      setProjectGroups(allGroups);
      setCurrentGroup(currentGrp);

      // 加载当前项目集的项目
      if (currentGrp) {
        const groupProjects = await projectDB.getByGroup(currentGrp.id);
        const current = await projectDB.getCurrent();

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

        // 加载当前门店的分类和博主
        if (validCurrentProject) {
          // 加载分类
          const restaurantCategories = await categoryDB.getByRestaurant(validCurrentProject.id);
          setCategories(restaurantCategories);

          // 获取当前分类
          const currentCat = await categoryDB.getCurrent();
          // 验证当前分类是否属于当前门店
          const validCurrentCategory = restaurantCategories.find(c => c.id === currentCat?.id)
            ? currentCat
            : (restaurantCategories.length > 0 ? restaurantCategories[0] : null);

          if (validCurrentCategory && validCurrentCategory.id !== currentCat?.id) {
            await categoryDB.switch(validCurrentCategory.id);
          }
          setCurrentCategory(validCurrentCategory);

          // 根据分类加载博主
          if (validCurrentCategory) {
            const categoryBloggers = await bloggerDB.getByCategory(validCurrentCategory.id);
            setBloggers(categoryBloggers);
          } else {
            // 没有分类时加载门店全部博主
            const projectBloggers = await bloggerDB.getByProject(validCurrentProject.id);
            setBloggers(projectBloggers);
          }
        } else {
          setCategories([]);
          setCurrentCategory(null);
          setBloggers([]);
        }
      } else {
        setProjects([]);
        setCurrentProject(null);
        setCategories([]);
        setCurrentCategory(null);
        setBloggers([]);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败，请刷新页面重试');
    }
  };

  // 初始化 - v1.3.0 简化：数据来自 Supabase，无需创建默认数据
  useEffect(() => {
    const init = async () => {
      try {
        // 直接加载数据（品牌和门店来自 Supabase master 表）
        await loadData();
      } catch (error) {
        console.error('初始化过程出错:', error);
        message.error('加载数据失败，请检查网络连接后刷新页面');
      }
    };

    init();
  }, []);

  // Web 环境下的文件处理适配
  const handleWebFileSelect = (accept) => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              success: true,
              data: e.target.result.split(',')[1], // base64
              filename: file.name
            });
          };
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsDataURL(file);
        } else {
          resolve({ success: false });
        }
      };
      input.click();
    });
  };

  // Web 环境下的文件保存适配
  const handleWebFileSave = (base64Data, filename) => {
    return new Promise((resolve, reject) => {
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        resolve({ success: true, path: filename });
      } catch (error) {
        reject(error);
      }
    });
  };

  // 导出Excel
  const handleExport = () => {
    if (bloggers.length === 0) {
      message.warning('当前项目没有数据可导出');
      return;
    }

    const filename = `${currentProject.name}_${new Date().toLocaleDateString()}.xlsx`;

    if (window.electron) {
      // Electron 环境
      exportToExcel(bloggers, filename);
    } else {
      // Web 环境
      exportToExcel(bloggers, filename)
        .then(() => {
          message.success('Excel 文件已开始下载');
        })
        .catch(error => {
          console.error('导出失败:', error);
          message.error('导出失败');
        });
    }
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
            <h1 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 600 }}>
              KOL 博主管理系统 (Web版)
            </h1>
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
        {/* v1.3.0: Web 和 Electron 现在都使用 Supabase 云端数据库，无需区分 */}

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

            {/* 项目分类选择器（三级）- 活动期管理 */}
            {currentProject && (
              <CategorySelector
                categories={categories}
                currentCategory={currentCategory}
                currentRestaurant={currentProject}
                onCategoryChange={loadData}
              />
            )}

            {currentProject ? (
              bloggers.length > 0 ? (
                <BloggerList
                  projectId={currentProject.id}
                  categoryId={currentCategory?.id}
                  bloggers={bloggers}
                  onUpdate={loadData}
                  onShareProject={handleShareProject}
                />
              ) : (
                <Empty
                  description={currentCategory ? `当前分类「${currentCategory.name}」暂无博主数据` : "暂无博主数据，请导入Excel"}
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
              <Empty description="请先选择门店" style={{ marginTop: 60 }} />
            )}

            {/* 导入弹窗 - 使用新的ImportBlogger组件 */}
            {currentProject && (
              <ImportBlogger
                projectId={currentProject.id}
                categoryId={currentCategory?.id}
                visible={importVisible}
                onClose={() => setImportVisible(false)}
                onSuccess={loadData}
              />
            )}

            {/* 解析弹窗 */}
            {currentProject && (
              <ReceiptParser
                projectId={currentProject.id}
                categoryId={currentCategory?.id}
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
          KOL 博主管理系统 v1.4.0 (Web版) · Made with ❤️ by gaga
        </div>
      </Footer>
    </Layout>
  );
}

export default WebApp;