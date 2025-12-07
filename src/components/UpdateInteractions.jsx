import { useState, useEffect } from 'react';
import { Modal, Button, Progress, message, Alert, Space, Table, Tag, Statistic, Row, Col } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { isElectron } from '../utils/db';

function UpdateInteractions({ visible, onClose, bloggers = [], onComplete }) {
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [currentBlogger, setCurrentBlogger] = useState('');

  // 筛选出已发布且有小红书链接的博主
  const publishedBloggers = bloggers.filter(
    b => b.status === '已发布' && b.xhsLink && b.xhsLink.trim() !== ''
  );

  useEffect(() => {
    if (!visible || !isElectron()) return;

    // 监听爬虫进度
    window.electron.crawler.onProgress((progressData) => {
      console.log('[更新进度]', progressData);

      if (progressData.status === 'processing') {
        setProgress({
          current: progressData.current,
          total: progressData.total,
        });
        setCurrentBlogger(progressData.blogger);
      } else if (progressData.status === 'completed') {
        setProgress({
          current: progressData.total,
          total: progressData.total,
        });
        const results = progressData.results || [];
        setResults(results);
        setUpdating(false);

        // 计算成功和失败数量
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        message.success('互动数据更新完成!');

        // 显示桌面通知
        if (window.electron && window.electron.notification) {
          window.electron.notification.show({
            title: '互动数据更新完成',
            body: `成功: ${successCount}个 | 失败: ${failCount}个`,
          });
        }

        // 通知父组件刷新数据
        if (onComplete) {
          onComplete();
        }
      } else if (progressData.status === 'error') {
        message.error(`更新 ${progressData.blogger} 时出错: ${progressData.error}`);
      }
    });

    return () => {
      window.electron.crawler.removeProgressListener();
    };
  }, [visible, onComplete]);

  const handleStartUpdate = async () => {
    const electronCheck = !!isElectron(); // 转换为布尔值
    alert('调试信息:\n' +
          '博主数量: ' + publishedBloggers.length + '\n' +
          'isElectron: ' + electronCheck + '\n' +
          'window.electron存在: ' + (typeof window !== 'undefined' && !!window.electron) + '\n' +
          '博主详情: ' + JSON.stringify(publishedBloggers.map(b => b.nickname)));

    console.log('[调试] handleStartUpdate 被调用');
    console.log('[调试] isElectron:', electronCheck);
    console.log('[调试] window.electron:', window.electron);
    console.log('[调试] publishedBloggers.length:', publishedBloggers.length);
    console.log('[调试] publishedBloggers:', publishedBloggers);

    if (!electronCheck) {
      alert('检测失败: 不在Electron环境\nwindow.electron = ' + window.electron);
      message.error('互动数据更新功能仅在桌面应用中可用');
      return;
    }

    if (publishedBloggers.length === 0) {
      alert('检测失败: 没有可更新的博主');
      message.warning('没有可更新的博主(需要状态为"已发布"且有小红书链接)');
      return;
    }

    alert('检测通过,准备开始更新');

    setUpdating(true);
    setProgress({ current: 0, total: publishedBloggers.length });
    setResults([]);
    setCurrentBlogger('');

    try {
      console.log('[前端] 开始更新互动数据，博主数量:', publishedBloggers.length);
      console.log('[前端] 博主详情:', publishedBloggers.map(b => ({
        id: b.id,
        nickname: b.nickname,
        xhsLink: b.xhsLink
      })));

      alert('准备调用爬虫API');
      const response = await window.electron.crawler.crawlBloggers(publishedBloggers);
      alert('爬虫API返回了: ' + JSON.stringify(response));
      console.log('[前端] 爬虫响应:', response);

      if (!response.success) {
        throw new Error(response.error || '更新失败');
      }
      alert('爬虫执行成功');
    } catch (error) {
      console.error('[前端] 更新失败:', error);
      alert('捕获到错误: ' + error.message);
      message.error(`更新失败: ${error.message}`);
      setUpdating(false);
    }
  };

  // 计算预计耗时(每个博主平均3.5秒)
  const estimatedTime = Math.ceil((publishedBloggers.length * 3.5) / 60);

  const columns = [
    {
      title: '博主昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 100,
      render: (success) =>
        success ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            失败
          </Tag>
        ),
    },
    {
      title: '点赞',
      key: 'likes',
      width: 100,
      render: (_, record) => {
        if (!record.success) return '-';
        const num = record.data?.likes || 0;
        return num > 0 ? <span style={{ color: '#ff4d4f' }}>❤️ {num}</span> : '-';
      },
    },
    {
      title: '收藏',
      key: 'favorites',
      width: 100,
      render: (_, record) => {
        if (!record.success) return '-';
        const num = record.data?.favorites || 0;
        return num > 0 ? <span style={{ color: '#faad14' }}>⭐ {num}</span> : '-';
      },
    },
    {
      title: '评论',
      key: 'comments',
      width: 100,
      render: (_, record) => {
        if (!record.success) return '-';
        const num = record.data?.comments || 0;
        return num > 0 ? <span style={{ color: '#1890ff' }}>💬 {num}</span> : '-';
      },
    },
    {
      title: '转发',
      key: 'shares',
      width: 100,
      render: (_, record) => {
        if (!record.success) return '-';
        const num = record.data?.shares || 0;
        return num > 0 ? <span style={{ color: '#52c41a' }}>🔄 {num}</span> : '-';
      },
    },
    {
      title: '备注',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error) => (error ? <span style={{ color: 'red' }}>{error}</span> : ''),
    },
  ];

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // 统计数据
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Modal
      title="更新互动数据"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" onClick={onClose} disabled={updating}>
          {results.length > 0 ? '完成' : '取消'}
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<SyncOutlined spin={updating} />}
          onClick={handleStartUpdate}
          loading={updating}
          disabled={publishedBloggers.length === 0}
        >
          {updating ? '更新中...' : '开始更新'}
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 调试信息 */}
        <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>
          <p><strong>🔍 调试信息:</strong></p>
          <p>• 传入博主总数: {bloggers.length}</p>
          <p>• 已发布博主数: {bloggers.filter(b => b.status === '已发布').length}</p>
          <p>• 可更新博主数: {publishedBloggers.length}</p>
          <p>• 按钮状态: {publishedBloggers.length === 0 ? '❌ 禁用' : '✅ 可用'}</p>
          <Button
            size="small"
            onClick={() => {
              console.log('测试按钮被点击');
              alert(`可更新博主数: ${publishedBloggers.length}`);
            }}
          >
            测试点击
          </Button>
        </div>

        {/* 统计信息 */}
        {!updating && results.length === 0 && (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="可更新博主"
                value={publishedBloggers.length}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="预计耗时"
                value={estimatedTime}
                suffix="分钟"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="更新频率"
                value="2-5"
                suffix="秒/个"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>
        )}

        {/* 结果统计 */}
        {results.length > 0 && (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="成功"
                value={successCount}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="失败"
                value={failCount}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="总计"
                value={results.length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        )}

        {/* 提示信息 */}
        {!updating && results.length === 0 && (
          <Alert
            message="更新说明"
            description={
              <div>
                <p>• 只会更新状态为"已发布"且有小红书链接的博主</p>
                <p>• 每个博主之间会有2-5秒的随机延迟,避免被识别为机器人</p>
                <p>• 更新过程中会打开浏览器窗口,请不要关闭</p>
                <p>• 更新的数据会保存到数据库,并记录历史</p>
                <p style={{ color: '#faad14', fontWeight: 'bold' }}>
                  • 建议在网络状况良好时进行更新
                </p>
              </div>
            }
            type="info"
            showIcon
          />
        )}

        {/* 进度条 */}
        {updating && (
          <div>
            <div style={{ marginBottom: 8 }}>
              正在更新: <strong>{currentBlogger}</strong> ({progress.current}/{progress.total})
            </div>
            <Progress
              percent={percent}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
              预计剩余时间: {Math.ceil((progress.total - progress.current) * 3.5 / 60)} 分钟
            </div>
          </div>
        )}

        {/* 博主列表 */}
        {!updating && results.length === 0 && publishedBloggers.length > 0 && (
          <div>
            <h4>将要更新的博主 ({publishedBloggers.length}个):</h4>
            <div style={{
              maxHeight: 200,
              overflow: 'auto',
              padding: '12px',
              background: '#fafafa',
              borderRadius: 4,
              border: '1px solid #d9d9d9'
            }}>
              {publishedBloggers.map((b, index) => (
                <div key={b.id} style={{
                  marginBottom: 8,
                  padding: '8px',
                  background: 'white',
                  borderRadius: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>
                    {index + 1}. {b.nickname}
                  </span>
                  <Tag color="green">已发布</Tag>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 结果表格 */}
        {results.length > 0 && (
          <div>
            <h4>更新结果:</h4>
            <Table
              columns={columns}
              dataSource={results}
              rowKey={(record, index) => `${record.bloggerId}-${index}`}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </div>
        )}

        {/* 无可更新博主提示 */}
        {publishedBloggers.length === 0 && (
          <Alert
            message="没有可更新的博主"
            description={
              <div>
                <p>需要满足以下条件才能更新:</p>
                <p>1. 博主状态为"已发布"</p>
                <p>2. 已填写小红书笔记链接</p>
                <p style={{ marginTop: 12, color: '#1890ff' }}>
                  💡 提示: 请先使用"智能回执解析"功能添加笔记链接
                </p>
              </div>
            }
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
}

export default UpdateInteractions;
