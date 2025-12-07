import { useState, useEffect } from 'react';
import { Modal, Button, Table, Progress, message, Alert, Space, Tag } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { isElectron } from '../utils/db';

function CrawlerTest({ visible, onClose, bloggers = [] }) {
  const [crawling, setCrawling] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [currentBlogger, setCurrentBlogger] = useState('');

  useEffect(() => {
    if (!visible || !isElectron()) return;

    // 监听爬虫进度
    window.electron.crawler.onProgress((progressData) => {
      console.log('[爬虫进度]', progressData);

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
        setResults(progressData.results || []);
        setCrawling(false);
        message.success('爬虫任务完成!');
      } else if (progressData.status === 'error') {
        message.error(`处理博主 ${progressData.blogger} 时出错: ${progressData.error}`);
      }
    });

    return () => {
      // 清理监听器
      window.electron.crawler.removeProgressListener();
    };
  }, [visible]);

  const handleStartCrawl = async () => {
    if (!isElectron()) {
      message.error('爬虫功能仅在Electron桌面应用中可用');
      return;
    }

    if (bloggers.length === 0) {
      message.warning('没有可爬取的博主');
      return;
    }

    setCrawling(true);
    setProgress({ current: 0, total: bloggers.length });
    setResults([]);
    setCurrentBlogger('');

    try {
      console.log('[前端] 开始爬虫，博主数量:', bloggers.length);
      const response = await window.electron.crawler.crawlBloggers(bloggers);

      if (!response.success) {
        throw new Error(response.error || '爬虫执行失败');
      }
    } catch (error) {
      console.error('[前端] 爬虫失败:', error);
      message.error(`爬虫失败: ${error.message}`);
      setCrawling(false);
    }
  };

  const columns = [
    {
      title: '博主昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => {
        const platformMap = {
          xiaohongshu: '小红书',
          douyin: '抖音',
          dianping: '大众点评',
        };
        return platformMap[platform] || platform;
      },
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
      title: '点赞数',
      key: 'likes',
      width: 100,
      render: (_, record) => (record.success ? record.data?.likes || '-' : '-'),
    },
    {
      title: '收藏数',
      key: 'favorites',
      width: 100,
      render: (_, record) => (record.success ? record.data?.favorites || '-' : '-'),
    },
    {
      title: '评论数',
      key: 'comments',
      width: 100,
      render: (_, record) => (record.success ? record.data?.comments || '-' : '-'),
    },
    {
      title: '转发数',
      key: 'shares',
      width: 100,
      render: (_, record) => (record.success ? record.data?.shares || '-' : '-'),
    },
    {
      title: '备注',
      dataIndex: 'error',
      key: 'error',
      render: (error) => (error ? <span style={{ color: 'red' }}>{error}</span> : '-'),
    },
  ];

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Modal
      title="爬虫测试 - 小红书互动数据"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" onClick={onClose} disabled={crawling}>
          关闭
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<SyncOutlined />}
          onClick={handleStartCrawl}
          loading={crawling}
          disabled={bloggers.length === 0}
        >
          {crawling ? '爬取中...' : '开始爬取'}
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 提示信息 */}
        <Alert
          message="重要提示"
          description={
            <div>
              <p>1. 爬虫会打开浏览器窗口,请不要关闭</p>
              <p>2. 爬取过程中每个博主之间会有2-5秒的随机延迟</p>
              <p>3. 当前只支持爬取小红书数据,抖音和大众点评后续支持</p>
              <p>4. 测试阶段建议只选择5-10个博主</p>
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                5. 请确保博主已有小红书笔记链接,否则会跳过
              </p>
            </div>
          }
          type="info"
          showIcon
        />

        {/* 进度条 */}
        {crawling && (
          <div>
            <div style={{ marginBottom: 8 }}>
              正在处理: <strong>{currentBlogger}</strong> ({progress.current}/{progress.total})
            </div>
            <Progress percent={percent} status="active" />
          </div>
        )}

        {/* 博主列表 */}
        <div>
          <h4>
            将要爬取的博主列表 ({bloggers.length}个):
            {bloggers.filter((b) => b.xhsLink && b.xhsLink.trim() !== '').length > 0 && (
              <span style={{ marginLeft: 10, color: 'green' }}>
                其中 {bloggers.filter((b) => b.xhsLink && b.xhsLink.trim() !== '').length} 个有小红书链接
              </span>
            )}
          </h4>
          <div style={{ maxHeight: 150, overflow: 'auto', padding: '8px', background: '#f5f5f5', borderRadius: 4 }}>
            {bloggers.map((b, index) => (
              <div key={index} style={{ marginBottom: 4 }}>
                {index + 1}. {b.nickname}
                {b.xhsLink && b.xhsLink.trim() !== '' ? (
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    有链接
                  </Tag>
                ) : (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    无链接
                  </Tag>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 结果表格 */}
        {results.length > 0 && (
          <div>
            <h4>爬取结果:</h4>
            <Table
              columns={columns}
              dataSource={results}
              rowKey={(record, index) => `${record.bloggerId}-${index}`}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
            <div style={{ marginTop: 16 }}>
              <Alert
                message={`成功: ${results.filter((r) => r.success).length} 个 | 失败: ${
                  results.filter((r) => !r.success).length
                } 个`}
                type={results.every((r) => r.success) ? 'success' : 'warning'}
              />
            </div>
          </div>
        )}
      </Space>
    </Modal>
  );
}

export default CrawlerTest;
