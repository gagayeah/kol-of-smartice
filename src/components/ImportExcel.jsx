import { useState } from 'react';
import { Modal, Upload, message, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { parseExcelFile } from '../utils/excel';
import { bloggerDB } from '../utils/db';

const { Dragger } = Upload;

export default function ImportExcel({ projectId, visible, onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false);

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      console.log('=== 开始导入Excel ===');
      console.log('文件名：', file.name);
      console.log('文件大小：', file.size);
      console.log('文件类型：', file.type);

      message.loading({ content: '正在解析文件...', key: 'upload', duration: 0 });
      setUploading(true);

      try {
        console.log('步骤1：开始解析Excel文件...');
        const bloggers = await parseExcelFile(file);
        console.log('步骤1完成：解析到的博主数据：', bloggers);

        if (!bloggers || bloggers.length === 0) {
          console.warn('解析结果为空');
          message.destroy('upload');
          message.warning('Excel文件中没有有效数据，请检查文件内容');
          setUploading(false);
          return false;
        }

        console.log('步骤2：验证必填字段...');
        const validBloggers = bloggers.filter(b => b.nickname && b.nickname.trim());
        console.log('步骤2完成：有效博主数量：', validBloggers.length);

        if (validBloggers.length === 0) {
          console.error('没有找到有效的昵称字段');
          message.destroy('upload');
          message.error({
            content: '未找到有效数据！请确保Excel中包含"昵称"列',
            duration: 5
          });
          setUploading(false);
          return false;
        }

        const skippedCount = bloggers.length - validBloggers.length;

        console.log('步骤3：开始批量导入...');
        console.log('项目ID：', projectId);
        console.log('准备导入的博主：', validBloggers);

        const imported = await bloggerDB.importBatch(projectId, validBloggers);
        console.log('步骤3完成：导入成功的博主：', imported);

        const duplicateCount = validBloggers.length - imported.length;

        message.destroy('upload');

        let msg = `✅ 成功导入 ${imported.length} 个博主`;
        if (duplicateCount > 0) {
          msg += `，跳过 ${duplicateCount} 个重复数据`;
        }
        if (skippedCount > 0) {
          msg += `，忽略 ${skippedCount} 条无效数据`;
        }

        console.log('导入结果消息：', msg);
        message.success({
          content: msg,
          duration: 5
        });

        setUploading(false);

        console.log('步骤4：关闭弹窗并刷新数据...');
        onClose();
        setTimeout(() => {
          onSuccess();
          console.log('=== 导入流程完成 ===');
        }, 100);
      } catch (error) {
        console.error('!!! 导入错误 !!!', error);
        console.error('错误堆栈：', error.stack);
        message.destroy('upload');
        message.error({
          content: '❌ 导入失败：' + (error.message || '未知错误'),
          duration: 5
        });
        setUploading(false);
      }

      return false; // 阻止自动上传
    },
  };

  return (
    <Modal
      title="导入博主数据"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Alert
        message="Excel格式要求"
        description={
          <div>
            <p style={{ marginBottom: 8 }}><strong>必填列：</strong></p>
            <ul style={{ marginTop: 0, paddingLeft: 20 }}>
              <li>昵称（或：nickname、名称、博主昵称）</li>
            </ul>
            <p style={{ marginBottom: 8 }}><strong>可选列：</strong></p>
            <ul style={{ marginTop: 0, paddingLeft: 20 }}>
              <li>粉丝数（或：followers、粉丝）</li>
              <li>主页链接（或：链接、主页、小红书链接、url）</li>
            </ul>
            <p style={{ marginBottom: 0, color: '#666', fontSize: 12 }}>
              💡 支持 .xlsx、.xls、.csv 格式 | 自动去重 | 上传后打开浏览器控制台可查看详细日志
            </p>
          </div>
        }
        type="info"
        style={{ marginBottom: 16 }}
      />

      <Dragger {...uploadProps} disabled={uploading}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持单次上传一个Excel文件
        </p>
      </Dragger>
    </Modal>
  );
}
