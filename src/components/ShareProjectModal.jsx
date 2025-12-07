import { useState } from 'react';
import { Modal, Button, Input, Switch, InputNumber, message, Space, Typography } from 'antd';
import { ShareAltOutlined, CopyOutlined, LockOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { shareProject } from '../utils/supabase';

const { Text, Paragraph } = Typography;

export default function ShareProjectModal({ visible, onClose, projectData, shareMode = 'project' }) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);

  const isGroupMode = shareMode === 'group';

  // 生成分享
  const handleShare = async () => {
    if (enablePassword && !password) {
      message.warning('请设置访问密码');
      return;
    }

    setLoading(true);

    const options = {};
    if (enablePassword) {
      options.password = password;
    }
    if (enableExpiry) {
      options.expiresIn = expiryDays;
    }

    const result = await shareProject(projectData, options);

    setLoading(false);

    if (result.success) {
      // 生成分享URL
      const url = `https://bzgl.pages.dev/?id=${result.shareId}`;
      setShareUrl(url);
      message.success('✅ 分享链接已生成！');
    } else {
      message.error('生成失败：' + result.error);
    }
  };

  // 复制链接
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    message.success('✅ 分享链接已复制到剪贴板');
  };

  // 在浏览器中打开
  const handleOpenInBrowser = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  // 重置
  const handleReset = () => {
    setShareUrl('');
    setPassword('');
    setEnablePassword(false);
    setEnableExpiry(false);
    setExpiryDays(7);
  };

  // 关闭
  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title={
        <>
          <ShareAltOutlined />
          {isGroupMode ? ' 分享项目集到云端' : ' 分享项目到云端'}
        </>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
    >
      {!shareUrl ? (
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20, padding: 16, background: '#f7f9fc', borderRadius: 8 }}>
            <Text strong>{isGroupMode ? '项目集信息' : '项目信息'}</Text>
            {isGroupMode ? (
              <>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">项目集：</Text>
                  <Text>{projectData.groupName || '默认项目集'}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">包含项目：</Text>
                  <Text>{projectData.projectCount} 个</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">总博主数：</Text>
                  <Text>{projectData.totalBloggers} 个</Text>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">项目集：</Text>
                  <Text>{projectData.projectGroupName || '默认项目集'}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">项目名：</Text>
                  <Text>{projectData.projectName}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">博主数：</Text>
                  <Text>{projectData.bloggers?.length || 0} 个</Text>
                </div>
              </>
            )}
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 密码保护 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Space>
                  <LockOutlined />
                  <Text strong>密码保护</Text>
                </Space>
                <Switch checked={enablePassword} onChange={setEnablePassword} />
              </div>
              {enablePassword && (
                <Input.Password
                  placeholder="设置访问密码（4-20位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={20}
                />
              )}
            </div>

            {/* 有效期 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Space>
                  <ClockCircleOutlined />
                  <Text strong>设置有效期</Text>
                </Space>
                <Switch checked={enableExpiry} onChange={setEnableExpiry} />
              </div>
              {enableExpiry && (
                <Space>
                  <InputNumber
                    min={1}
                    max={365}
                    value={expiryDays}
                    onChange={setExpiryDays}
                  />
                  <Text type="secondary">天后过期</Text>
                </Space>
              )}
            </div>
          </Space>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>取消</Button>
              <Button type="primary" onClick={handleShare} loading={loading}>
                生成分享链接
              </Button>
            </Space>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <Text type="success" strong style={{ fontSize: 16 }}>✅ 分享链接已生成</Text>
          </div>

          <div style={{ marginBottom: 20, padding: 16, background: '#f7f9fc', borderRadius: 8 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>分享链接：</Text>
            <Paragraph
              copyable={{
                text: shareUrl,
                tooltips: ['点击复制', '已复制'],
              }}
              style={{
                background: 'white',
                padding: 12,
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                marginBottom: 0,
                wordBreak: 'break-all',
              }}
            >
              {shareUrl}
            </Paragraph>
          </div>

          {enablePassword && (
            <div style={{ marginBottom: 20, padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
              <Text type="warning">🔒 此分享需要密码访问</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">密码：</Text>
                <Text strong>{password}</Text>
              </div>
            </div>
          )}

          {enableExpiry && (
            <div style={{ marginBottom: 20, padding: 12, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
              <Text type="info">⏰ 此分享将在 {expiryDays} 天后过期</Text>
            </div>
          )}

          <div style={{ marginBottom: 20, padding: 12, background: '#f0f5ff', borderRadius: 8 }}>
            <Text type="secondary">💡 使用说明：</Text>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li>复制链接分享给其他人，对方点击即可查看</li>
              <li>数据实时从云端加载，修改后刷新页面即可看到最新内容</li>
              <li>可以通过微信、邮件、短信等方式分享此链接</li>
              <li>手机和电脑都可以直接打开，无需安装任何软件</li>
            </ul>
          </div>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCopy} icon={<CopyOutlined />}>
                复制链接
              </Button>
              <Button onClick={handleOpenInBrowser}>
                在浏览器中打开
              </Button>
              <Button type="primary" onClick={handleClose}>
                完成
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
