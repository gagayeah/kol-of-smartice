// v1.3.0 - Simplified to read-only brand selector (data from Supabase master_brand)
// Removed: create, rename, delete functionality (master data is managed externally)
// Changed: "项目集" → "品牌" to match business terminology

import { Select } from 'antd';
import { FolderOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { projectGroupDB } from '../utils/db';
import { Button } from 'antd';

export default function ProjectGroupSelector({ groups, currentGroup, onGroupChange, onShareGroup }) {
  // 切换品牌
  const handleGroupChange = async (groupId) => {
    await projectGroupDB.switch(groupId);
    onGroupChange();
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
      <span style={{ fontWeight: 600, color: '#475569', fontSize: 15 }}>品牌：</span>

      <Select
        value={currentGroup?.id}
        onChange={handleGroupChange}
        style={{ minWidth: 200, flex: 1, maxWidth: 300 }}
        options={groups.map(g => ({
          label: g.nameEn ? `${g.name} (${g.nameEn})` : g.name,
          value: g.id
        }))}
        placeholder="请选择品牌"
      />

      {currentGroup && onShareGroup && (
        <Button
          icon={<CloudUploadOutlined />}
          onClick={() => onShareGroup()}
          size="small"
          type="primary"
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          分享品牌数据
        </Button>
      )}

      {currentGroup && currentGroup.description && (
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
          {currentGroup.description}
        </span>
      )}
    </div>
  );
}
