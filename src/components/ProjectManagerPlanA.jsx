// v1.3.0 - Simplified to read-only restaurant selector (data from Supabase master_restaurant)
// Removed: create, rename, delete, hierarchical structure (restaurants are flat list)
// Changed: "项目" → "门店" to match business terminology

import { useState, useEffect } from 'react';
import { Tabs, Tag } from 'antd';
import { ShopOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { projectDB } from '../utils/db';

export default function ProjectManagerPlanA({ projects, currentProject, currentGroup, onProjectChange }) {
  // 切换门店
  const handleProjectSelect = async (projectId) => {
    await projectDB.switch(projectId);
    onProjectChange();
  };

  // 构建门店标签页
  const tabItems = projects.map(project => ({
    key: project.id,
    label: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <ShopOutlined style={{ color: '#ffa5c1' }} />
        <span>{project.name}</span>
        {project.city && (
          <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>
            {project.city}
          </Tag>
        )}
      </div>
    ),
  }));

  if (projects.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#94a3b8',
        background: '#fafafa',
        borderRadius: 8
      }}>
        <ShopOutlined style={{ fontSize: 32, marginBottom: 12, color: '#d9d9d9' }} />
        <div>当前品牌下暂无门店</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>请联系管理员添加门店数据</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#333' }}>
          <ShopOutlined style={{ marginRight: 8, color: '#ffa5c1' }} />
          门店列表
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8, fontWeight: 'normal' }}>
            (共 {projects.length} 家门店)
          </span>
        </h3>
      </div>

      <Tabs
        activeKey={currentProject?.id}
        onChange={handleProjectSelect}
        items={tabItems}
        type="card"
        size="small"
        tabBarGutter={4}
        style={{ marginBottom: 16 }}
      />

      {/* 当前门店详情 */}
      {currentProject && (
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #fff5f7 0%, #fef5e7 100%)',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 13
        }}>
          <div>
            <span style={{ color: '#94a3b8' }}>当前门店：</span>
            <span style={{ fontWeight: 600, color: '#333' }}>{currentProject.name}</span>
          </div>
          {currentProject.city && (
            <div>
              <EnvironmentOutlined style={{ color: '#ffa5c1', marginRight: 4 }} />
              <span style={{ color: '#666' }}>{currentProject.city}</span>
            </div>
          )}
          {currentProject.address && (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              {currentProject.address}
            </div>
          )}
        </div>
      )}
    </>
  );
}
