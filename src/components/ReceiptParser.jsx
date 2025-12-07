import { useState } from 'react';
import { Modal, Input, Button, Space, message, Alert, List } from 'antd';
import { parseReceipt } from '../utils/parser';
import { bloggerDB } from '../utils/db';
import { getDateOnlyTimestamp } from '../utils/dateHelper';

const { TextArea } = Input;

export default function ReceiptParser({ projectId, visible, onClose, onSuccess }) {
  const [receiptText, setReceiptText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  // 解析回执
  const handleParse = async () => {
    if (!receiptText.trim()) {
      message.warning('请输入回执内容');
      return;
    }

    setProcessing(true);

    try {
      const parsed = parseReceipt(receiptText);

      if (parsed.length === 0) {
        message.warning('未识别到有效的博主信息');
        setProcessing(false);
        return;
      }

      // 匹配博主并更新
      const results = [];
      for (const item of parsed) {
        const blogger = await bloggerDB.findByNickname(projectId, item.nickname);

        if (!blogger) {
          results.push({
            ...item,
            status: 'not_found',
            message: '未找到该博主，请确认昵称或先导入数据',
          });
          continue;
        }

        // 更新博主信息
        const updates = {
          status: '已发布',
          publishTime: getDateOnlyTimestamp(), // 只保存年月日
        };

        if (item.xhsLink) updates.xhsLink = item.xhsLink;
        if (item.dianpingLink) updates.dianpingLink = item.dianpingLink;
        if (item.douyinLink) updates.douyinLink = item.douyinLink;

        await bloggerDB.update(blogger.id, updates);

        results.push({
          ...item,
          status: 'success',
          message: '更新成功',
        });
      }

      setParseResult(results);

      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        message.success(`成功更新 ${successCount} 个博主${failCount > 0 ? `，${failCount} 个未找到` : ''}`);
        onSuccess();
      }

      setProcessing(false);
    } catch (error) {
      message.error('解析失败：' + error.message);
      setProcessing(false);
    }
  };

  // 重置
  const handleReset = () => {
    setReceiptText('');
    setParseResult(null);
  };

  // 关闭
  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title="智能回执解析"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="reset" onClick={handleReset}>
          清空
        </Button>,
        <Button key="parse" type="primary" onClick={handleParse} loading={processing}>
          解析并更新
        </Button>,
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>,
      ]}
      width={800}
    >
      <Alert
        message="回执格式说明"
        description={
          <div>
            <p style={{ marginBottom: 8 }}>粘贴单个博主的回执内容：</p>
            <pre style={{
              background: '#f5f5f5',
              padding: '8px 12px',
              borderRadius: 4,
              fontSize: 12,
              marginBottom: 0,
            }}>
{`快乐肥仔gaga
宁桂杏江油店打卡！... http://xhslink.com/abc

终于开到江油来了！！！好期待！！！
http://dpurl.cn/xyz

https://v.douyin.com/123/`}
            </pre>
            <p style={{ marginTop: 8, fontSize: 12, color: '#666', marginBottom: 0 }}>
              💡 <strong>第一行</strong>是博主昵称，后面所有内容（不管有多少空行）都会自动扫描链接
            </p>
          </div>
        }
        type="info"
        style={{ marginBottom: 16 }}
      />

      <TextArea
        value={receiptText}
        onChange={(e) => setReceiptText(e.target.value)}
        placeholder="粘贴博主回执内容..."
        rows={10}
        style={{ marginBottom: 16 }}
      />

      {parseResult && (
        <>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>解析结果：</div>
          <List
            size="small"
            bordered
            dataSource={parseResult}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>{item.nickname}</strong>
                    <span style={{
                      marginLeft: 8,
                      color: item.status === 'success' ? '#52c41a' : '#ff4d4f'
                    }}>
                      {item.message}
                    </span>
                  </div>
                  {item.status === 'success' && (
                    <Space size="small">
                      {item.xhsLink && <span>📱 小红书</span>}
                      {item.dianpingLink && <span>⭐ 大众点评</span>}
                      {item.douyinLink && <span>🎵 抖音</span>}
                    </Space>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );
}
