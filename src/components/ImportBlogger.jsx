import { useState } from 'react';
import { Modal, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { parseExcelFile } from '../utils/excel';
import { bloggerDB } from '../utils/db';

const { Dragger } = Upload;

export default function ImportBlogger({ projectId, visible, onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false);

  // Excel导入
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      message.loading({ content: '正在解析文件...', key: 'upload', duration: 0 });
      setUploading(true);

      try {
        const bloggers = await parseExcelFile(file);

        if (!bloggers || bloggers.length === 0) {
          message.destroy('upload');
          message.warning('Excel文件中没有有效数据');
          setUploading(false);
          return false;
        }

        const validBloggers = bloggers.filter(b => {
          // 过滤掉表头行和无效数据
          const isHeader =
            b.nickname === '昵称' ||
            b.nickname === '红薯名' ||
            b.nickname === 'nickname' ||
            b.nickname === 'Nickname' ||
            b.nickname === '博主名' ||
            b.nickname === '博主昵称';

          const hasValidNickname = b.nickname && b.nickname.trim();

          return !isHeader && hasValidNickname;
        });

        if (validBloggers.length === 0) {
          message.destroy('upload');
          message.error('未找到有效数据！请确保Excel中包含"昵称"列');
          setUploading(false);
          return false;
        }

        message.destroy('upload');
        message.loading({ content: `正在导入 ${validBloggers.length} 个博主...`, key: 'import', duration: 0 });

        // 导入博主到项目
        const imported = await bloggerDB.importBatch(projectId, validBloggers);

        message.destroy('import');
        message.success(`成功导入 ${imported.length} 个博主`);
        setUploading(false);
        onSuccess();
        onClose();
      } catch (error) {
        message.destroy('upload');
        message.destroy('import');
        message.error('导入失败: ' + error.message);
        setUploading(false);
      }

      return false;
    },
  };

  return (
    <Modal
      title="导入博主到项目"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <div style={{ padding: '16px 0' }}>
        <Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽Excel文件到此区域</p>
          <p className="ant-upload-hint">
            支持 .xlsx、.xls、.csv 格式
          </p>
        </Dragger>
      </div>
    </Modal>
  );
}
