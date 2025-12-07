import { useState, useEffect } from 'react';
import { Modal, Button, Table, Tag } from 'antd';
import { BugOutlined } from '@ant-design/icons';

function DataDebug({ bloggers = [] }) {
  const [visible, setVisible] = useState(false);

  // 筛选已发布的博主
  const publishedBloggers = bloggers.filter(b => b.status === '已发布');

  // 筛选已发布且有小红书链接的博主
  const publishedWithLink = bloggers.filter(
    b => b.status === '已发布' && b.xhsLink && b.xhsLink.trim() !== ''
  );

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          '待审核': 'default',
          '改稿中': 'processing',
          '已定稿': 'warning',
          '已发布': 'success',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: '小红书链接',
      dataIndex: 'xhsLink',
      key: 'xhsLink',
      render: (link) => {
        if (!link || link.trim() === '') {
          return <Tag color="red">❌ 无链接</Tag>;
        }
        return <Tag color="green">✅ 有链接</Tag>;
      },
    },
    {
      title: '链接内容',
      dataIndex: 'xhsLink',
      key: 'xhsLinkContent',
      ellipsis: true,
      render: (link) => link || '-',
    },
  ];

  return (
    <>
      <Button
        type="dashed"
        icon={<BugOutlined />}
        onClick={() => setVisible(true)}
        style={{ marginLeft: 8 }}
      >
        数据调试
      </Button>

      <Modal
        title="数据调试信息"
        open={visible}
        onCancel={() => setVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <h3>统计信息:</h3>
          <p>📊 总博主数: <strong>{bloggers.length}</strong></p>
          <p>✅ 已发布博主数: <strong>{publishedBloggers.length}</strong></p>
          <p>🔗 已发布且有小红书链接: <strong style={{ color: publishedWithLink.length > 0 ? 'green' : 'red' }}>{publishedWithLink.length}</strong></p>

          {publishedWithLink.length === 0 && (
            <div style={{
              background: '#fff7e6',
              border: '1px solid #ffd591',
              padding: 12,
              borderRadius: 4,
              marginTop: 12
            }}>
              <p style={{ color: '#d46b08', fontWeight: 'bold' }}>⚠️ 无法更新的原因:</p>
              {publishedBloggers.length === 0 && (
                <p>• 没有状态为"已发布"的博主</p>
              )}
              {publishedBloggers.length > 0 && (
                <p>• 已发布的博主没有填写小红书笔记链接</p>
              )}
              <p style={{ marginTop: 8, color: '#1890ff' }}>
                💡 解决方法: 使用"智能回执解析"功能添加笔记链接
              </p>
            </div>
          )}
        </div>

        <h3>所有博主详情:</h3>
        <Table
          columns={columns}
          dataSource={bloggers}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </>
  );
}

export default DataDebug;
