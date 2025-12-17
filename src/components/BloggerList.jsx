// v1.4.0 - Added categoryId prop for category-aware blogger imports
import { useState } from 'react';
import { Table, Tag, Space, Button, Select, Input, Popconfirm, message, DatePicker, Modal, Form, InputNumber } from 'antd';
import { DeleteOutlined, EditOutlined, UserAddOutlined, FileTextOutlined, SyncOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { bloggerDB } from '../utils/db';
import { getDateOnlyTimestamp, formatDateOnly } from '../utils/dateHelper';
import UpdateInteractions from './UpdateInteractions';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

const STATUS_COLORS = {
  '待审核': { color: '#8c8c8c', bg: '#f5f5f5' },
  '改稿中': { color: '#1890ff', bg: '#e6f7ff' },
  '已定稿': { color: '#faad14', bg: '#fff7e6' },
  '已发布': { color: '#52c41a', bg: '#f6ffed' },
};

const STATUS_OPTIONS = ['待审核', '改稿中', '已定稿', '已发布'];

// 格式化数字（超过1000显示为 1.2k，超过10000显示为 1.2万）
const formatNumber = (num) => {
  if (!num || num === 0) return null;
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

export default function BloggerList({ projectId, categoryId, bloggers, onUpdate, onShareProject }) {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [editingPublishTime, setEditingPublishTime] = useState(null); // 正在编辑的博主
  const [tempPublishTime, setTempPublishTime] = useState(null); // 临时日期值
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // 手动添加博主弹窗
  const [addForm] = Form.useForm(); // 表单实例
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false); // 备注编辑弹窗
  const [currentBlogger, setCurrentBlogger] = useState(null); // 当前编辑备注的博主
  const [notesValue, setNotesValue] = useState(''); // 备注内容
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false); // 清空确认弹窗
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // 待处理的状态变更
  const [updateInteractionsVisible, setUpdateInteractionsVisible] = useState(false); // 更新互动数据弹窗

  // 筛选数据
  const filteredData = bloggers.filter(blogger => {
    // 状态筛选
    if (statusFilter !== 'all' && blogger.status !== statusFilter) {
      return false;
    }

    // 关键词搜索
    if (searchText) {
      const text = searchText.toLowerCase();
      return (
        blogger.nickname.toLowerCase().includes(text) ||
        blogger.profileUrl.toLowerCase().includes(text) ||
        blogger.xhsLink.toLowerCase().includes(text) ||
        blogger.dianpingLink.toLowerCase().includes(text) ||
        blogger.douyinLink.toLowerCase().includes(text)
      );
    }

    return true;
  });

  // 表格列定义
  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
      fixed: 'left',
    },
    {
      title: '粉丝数',
      dataIndex: 'followers',
      key: 'followers',
      width: 100,
      render: (followers) => followers?.toLocaleString() || '-',
    },
    {
      title: '主页链接',
      dataIndex: 'profileUrl',
      key: 'profileUrl',
      width: 200,
      ellipsis: true,
      render: (url) => url && url.trim() ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
          {url}
        </a>
      ) : <span style={{ color: '#ccc' }}>未填写</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => {
        const statusColor = STATUS_COLORS[status] || STATUS_COLORS['待审核'];
        return (
          <div style={{
            backgroundColor: statusColor.bg,
            borderRadius: '4px',
            padding: '2px',
            display: 'inline-block'
          }}>
            <Select
              value={status}
              className="status-select"
              style={{
                width: 96,
                color: statusColor.color
              }}
              size="small"
              onChange={(newStatus) => handleStatusChange(record.id, newStatus)}
            >
              {STATUS_OPTIONS.map(s => (
                <Option key={s} value={s}>
                  <span style={{ color: STATUS_COLORS[s].color, fontWeight: 500 }}>{s}</span>
                </Option>
              ))}
            </Select>
          </div>
        );
      },
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      key: 'publishTime',
      width: 160,
      render: (time, record) => (
        <Space>
          <span>{time ? formatDateOnly(time) : '-'}</span>
          {record.status === '已发布' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditPublishTime(record)}
            />
          )}
        </Space>
      ),
    },
    {
      title: '小红书',
      key: 'xiaohongshu',
      className: 'platform-xiaohongshu',
      onHeaderCell: () => ({
        style: {
          background: '#fff0f0',
          borderLeft: '2px solid #ff2442',
          fontWeight: 600,
        }
      }),
      children: [
        {
          title: '链接',
          dataIndex: 'xhsLink',
          key: 'xhsLink',
          width: 100,
          className: 'platform-xiaohongshu-col',
          align: 'center',
          onHeaderCell: () => ({
            style: { background: '#fffafa', textAlign: 'center' }
          }),
          render: (link) => link ? (
            <a href={link} target="_blank" rel="noopener noreferrer">
              查看笔记
            </a>
          ) : '-',
        },
        {
          title: '点赞',
          dataIndex: 'xhsLikes',
          key: 'xhsLikes',
          width: 80,
          className: 'platform-xiaohongshu-col',
          align: 'center',
          sorter: (a, b) => (a.xhsLikes || 0) - (b.xhsLikes || 0),
          onHeaderCell: () => ({
            style: { background: '#fffafa', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '收藏',
          dataIndex: 'xhsFavorites',
          key: 'xhsFavorites',
          width: 80,
          className: 'platform-xiaohongshu-col',
          align: 'center',
          sorter: (a, b) => (a.xhsFavorites || 0) - (b.xhsFavorites || 0),
          onHeaderCell: () => ({
            style: { background: '#fffafa', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '评论',
          dataIndex: 'xhsComments',
          key: 'xhsComments',
          width: 80,
          className: 'platform-xiaohongshu-col',
          align: 'center',
          sorter: (a, b) => (a.xhsComments || 0) - (b.xhsComments || 0),
          onHeaderCell: () => ({
            style: { background: '#fffafa', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '转发',
          dataIndex: 'xhsShares',
          key: 'xhsShares',
          width: 80,
          className: 'platform-xiaohongshu-col',
          align: 'center',
          sorter: (a, b) => (a.xhsShares || 0) - (b.xhsShares || 0),
          onHeaderCell: () => ({
            style: { background: '#fffafa', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
      ],
    },
    {
      title: '大众点评',
      key: 'dianping',
      className: 'platform-dianping',
      onHeaderCell: () => ({
        style: {
          background: '#fff7e6',
          borderLeft: '2px solid #fa8c16',
          fontWeight: 600,
        }
      }),
      children: [
        {
          title: '链接',
          dataIndex: 'dianpingLink',
          key: 'dianpingLink',
          width: 100,
          className: 'platform-dianping-col',
          align: 'center',
          onHeaderCell: () => ({
            style: { background: '#fffbf0', textAlign: 'center' }
          }),
          render: (link) => link ? (
            <a href={link} target="_blank" rel="noopener noreferrer">
              查看点评
            </a>
          ) : '-',
        },
        {
          title: '点赞',
          dataIndex: 'dianpingLikes',
          key: 'dianpingLikes',
          width: 80,
          className: 'platform-dianping-col',
          align: 'center',
          sorter: (a, b) => (a.dianpingLikes || 0) - (b.dianpingLikes || 0),
          onHeaderCell: () => ({
            style: { background: '#fffbf0', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '收藏',
          dataIndex: 'dianpingFavorites',
          key: 'dianpingFavorites',
          width: 80,
          className: 'platform-dianping-col',
          align: 'center',
          sorter: (a, b) => (a.dianpingFavorites || 0) - (b.dianpingFavorites || 0),
          onHeaderCell: () => ({
            style: { background: '#fffbf0', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '评论',
          dataIndex: 'dianpingComments',
          key: 'dianpingComments',
          width: 80,
          className: 'platform-dianping-col',
          align: 'center',
          sorter: (a, b) => (a.dianpingComments || 0) - (b.dianpingComments || 0),
          onHeaderCell: () => ({
            style: { background: '#fffbf0', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '转发',
          dataIndex: 'dianpingShares',
          key: 'dianpingShares',
          width: 80,
          className: 'platform-dianping-col',
          align: 'center',
          sorter: (a, b) => (a.dianpingShares || 0) - (b.dianpingShares || 0),
          onHeaderCell: () => ({
            style: { background: '#fffbf0', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
      ],
    },
    {
      title: '抖音',
      key: 'douyin',
      className: 'platform-douyin',
      onHeaderCell: () => ({
        style: {
          background: '#f0f5ff',
          borderLeft: '2px solid #1890ff',
          fontWeight: 600,
        }
      }),
      children: [
        {
          title: '链接',
          dataIndex: 'douyinLink',
          key: 'douyinLink',
          width: 100,
          className: 'platform-douyin-col',
          align: 'center',
          onHeaderCell: () => ({
            style: { background: '#f5f8ff', textAlign: 'center' }
          }),
          render: (link) => link ? (
            <a href={link} target="_blank" rel="noopener noreferrer">
              查看视频
            </a>
          ) : '-',
        },
        {
          title: '点赞',
          dataIndex: 'douyinLikes',
          key: 'douyinLikes',
          width: 80,
          className: 'platform-douyin-col',
          align: 'center',
          sorter: (a, b) => (a.douyinLikes || 0) - (b.douyinLikes || 0),
          onHeaderCell: () => ({
            style: { background: '#f5f8ff', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '收藏',
          dataIndex: 'douyinFavorites',
          key: 'douyinFavorites',
          width: 80,
          className: 'platform-douyin-col',
          align: 'center',
          sorter: (a, b) => (a.douyinFavorites || 0) - (b.douyinFavorites || 0),
          onHeaderCell: () => ({
            style: { background: '#f5f8ff', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '评论',
          dataIndex: 'douyinComments',
          key: 'douyinComments',
          width: 80,
          className: 'platform-douyin-col',
          align: 'center',
          sorter: (a, b) => (a.douyinComments || 0) - (b.douyinComments || 0),
          onHeaderCell: () => ({
            style: { background: '#f5f8ff', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
        {
          title: '转发',
          dataIndex: 'douyinShares',
          key: 'douyinShares',
          width: 80,
          className: 'platform-douyin-col',
          align: 'center',
          sorter: (a, b) => (a.douyinShares || 0) - (b.douyinShares || 0),
          onHeaderCell: () => ({
            style: { background: '#f5f8ff', textAlign: 'center' }
          }),
          render: (value) => value ? formatNumber(value) : '-',
        },
      ],
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 60,
      fixed: 'right',
      render: (notes, record) => (
        <Button
          type="text"
          size="small"
          icon={<FileTextOutlined />}
          style={{
            color: notes ? '#1890ff' : '#d9d9d9',
            fontSize: '16px'
          }}
          onClick={() => handleOpenNotes(record)}
          title={notes ? `备注: ${notes}` : '添加备注'}
        >
          {notes && notes.length > 0 ? (
            <span style={{ fontSize: '10px', marginLeft: '-2px' }}>
              {notes.length}
            </span>
          ) : null}
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="确认删除该博主？"
          onConfirm={() => handleDelete(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // 修改单个博主状态
  const handleStatusChange = async (bloggerId, newStatus) => {
    const blogger = bloggers.find(b => b.id === bloggerId);
    const oldStatus = blogger?.status;

    // 如果从"已发布"改为其他状态，询问是否清空发布信息
    if (oldStatus === '已发布' && newStatus !== '已发布') {
      setPendingStatusChange({ bloggerId, newStatus });
      setClearConfirmVisible(true);
      return;
    }

    // 正常状态修改
    const updates = { status: newStatus };
    if (newStatus === '已发布') {
      updates.publishTime = getDateOnlyTimestamp(); // 只保存年月日
    }
    await bloggerDB.update(bloggerId, updates);
    message.success('状态已更新');
    onUpdate();
  };

  // 确认清空发布信息
  const handleConfirmClear = async () => {
    if (!pendingStatusChange) return;

    const { bloggerId, newStatus } = pendingStatusChange;
    const updates = {
      status: newStatus,
      publishTime: null,
      xhsLink: '',
      dianpingLink: '',
      douyinLink: '',
    };
    await bloggerDB.update(bloggerId, updates);
    message.success('状态已更新，发布信息已清空');
    setClearConfirmVisible(false);
    setPendingStatusChange(null);
    onUpdate();
  };

  // 不清空，只修改状态
  const handleKeepData = async () => {
    if (!pendingStatusChange) return;

    const { bloggerId, newStatus } = pendingStatusChange;
    await bloggerDB.update(bloggerId, { status: newStatus });
    message.success('状态已更新');
    setClearConfirmVisible(false);
    setPendingStatusChange(null);
    onUpdate();
  };

  // 打开编辑发布时间弹窗
  const handleEditPublishTime = (record) => {
    setEditingPublishTime(record);
    setTempPublishTime(record.publishTime ? dayjs(record.publishTime) : dayjs());
  };

  // 确认修改发布时间
  const handleConfirmPublishTime = async () => {
    if (!tempPublishTime) {
      message.warning('请选择日期');
      return;
    }

    const newTimestamp = getDateOnlyTimestamp(tempPublishTime.toDate());
    await bloggerDB.update(editingPublishTime.id, { publishTime: newTimestamp });
    message.success('发布时间已更新');
    setEditingPublishTime(null);
    setTempPublishTime(null);
    onUpdate();
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingPublishTime(null);
    setTempPublishTime(null);
  };

  // 批量修改状态
  const handleBatchStatusChange = async (newStatus) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择博主');
      return;
    }

    await bloggerDB.updateStatus(selectedRowKeys, newStatus);
    message.success(`已批量更新 ${selectedRowKeys.length} 个博主的状态`);
    setSelectedRowKeys([]);
    onUpdate();
  };

  // 删除博主
  const handleDelete = async (bloggerId) => {
    await bloggerDB.delete(bloggerId);
    message.success('博主已删除');
    onUpdate();
  };

  // 手动添加博主
  const handleAddBlogger = async () => {
    try {
      const values = await addForm.validateFields();

      // 调用importBatch方法添加单个博主，传入categoryId
      await bloggerDB.importBatch(projectId, [{
        nickname: values.nickname,
        followers: values.followers,
        profileUrl: values.profileUrl,
      }], categoryId);

      message.success('博主添加成功！');
      addForm.resetFields();
      setIsAddModalOpen(false);
      onUpdate();
    } catch (error) {
      console.error('表单验证失败：', error);
    }
  };

  // 打开备注编辑弹窗
  const handleOpenNotes = (blogger) => {
    setCurrentBlogger(blogger);
    setNotesValue(blogger.notes || '');
    setIsNotesModalOpen(true);
  };

  // 保存备注
  const handleSaveNotes = async () => {
    if (notesValue.length > 50) {
      message.warning('备注最多50个字');
      return;
    }

    await bloggerDB.update(currentBlogger.id, { notes: notesValue });
    message.success('备注已保存');
    setIsNotesModalOpen(false);
    setCurrentBlogger(null);
    setNotesValue('');
    onUpdate();
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      {/* 清空发布信息确认弹窗 */}
      <Modal
        title="⚠️ 状态变更确认"
        open={clearConfirmVisible}
        onOk={handleConfirmClear}
        onCancel={handleKeepData}
        okText="清空发布信息"
        cancelText="保留发布信息"
        okButtonProps={{ danger: true }}
        centered
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            即将从 <strong>"已发布"</strong> 改为 <strong>"{pendingStatusChange?.newStatus}"</strong>
          </p>
          <p style={{ marginBottom: 12, color: '#666' }}>是否需要清空以下内容？</p>
          <ul style={{ paddingLeft: 20, color: '#666' }}>
            <li>发布时间</li>
            <li>小红书链接</li>
            <li>大众点评链接</li>
            <li>抖音链接</li>
          </ul>
          <p style={{ fontSize: 12, color: '#ff4d4f', marginTop: 16, marginBottom: 0 }}>
            💡 提示：点击"清空发布信息"将删除以上所有内容，点击"保留发布信息"则只修改状态
          </p>
        </div>
      </Modal>

      {/* 编辑发布时间弹窗 */}
      <Modal
        title="修改发布时间"
        open={!!editingPublishTime}
        onOk={handleConfirmPublishTime}
        onCancel={handleCancelEdit}
        okText="确认修改"
        cancelText="取消"
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            博主：<strong>{editingPublishTime?.nickname}</strong>
          </p>
          <DatePicker
            value={tempPublishTime}
            onChange={setTempPublishTime}
            format="YYYY-MM-DD"
            style={{ width: '100%' }}
            placeholder="选择发布日期"
          />
          <p style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            💡 提示：只记录年月日，不包含具体时间
          </p>
        </div>
      </Modal>

      {/* 手动添加博主弹窗 */}
      <Modal
        title="手动添加博主"
        open={isAddModalOpen}
        onOk={handleAddBlogger}
        onCancel={() => {
          setIsAddModalOpen(false);
          addForm.resetFields();
        }}
        okText="添加"
        cancelText="取消"
        width={500}
      >
        <Form
          form={addForm}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="昵称"
            name="nickname"
            rules={[{ required: true, message: '请输入博主昵称' }]}
          >
            <Input placeholder="请输入博主昵称" />
          </Form.Item>

          <Form.Item
            label="粉丝数"
            name="followers"
            rules={[{ required: true, message: '请输入粉丝数' }]}
          >
            <InputNumber
              placeholder="请输入粉丝数"
              style={{ width: '100%' }}
              min={0}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/,/g, '')}
            />
          </Form.Item>

          <Form.Item
            label="主页链接"
            name="profileUrl"
            rules={[
              { required: true, message: '请输入主页链接' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <p style={{ color: '#999', fontSize: 12, marginTop: -8 }}>
            💡 提示：博主状态默认为"待审核"，后续可在列表中修改
          </p>
        </Form>
      </Modal>

      {/* 备注编辑弹窗 */}
      <Modal
        title="编辑备注"
        open={isNotesModalOpen}
        onOk={handleSaveNotes}
        onCancel={() => {
          setIsNotesModalOpen(false);
          setCurrentBlogger(null);
          setNotesValue('');
        }}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            博主：<strong>{currentBlogger?.nickname}</strong>
          </p>
          <Input.TextArea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="请输入备注内容（最多50字）"
            maxLength={50}
            showCount
            rows={4}
            autoFocus
          />
          <p style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            💡 提示：备注仅供个人使用，不会在HTML分享中显示
          </p>
        </div>
      </Modal>

      {/* 工具栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setIsAddModalOpen(true)}
        >
          手动添加博主
        </Button>

        <Button
          type="primary"
          icon={<SyncOutlined />}
          onClick={() => setUpdateInteractionsVisible(true)}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          更新互动数据
        </Button>

        <Button
          icon={<CloudUploadOutlined />}
          onClick={onShareProject}
          disabled={bloggers.length === 0}
        >
          分享到云端
        </Button>

        <Search
          placeholder="搜索昵称或链接"
          onSearch={setSearchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />

        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 120 }}
        >
          <Option value="all">全部状态</Option>
          {STATUS_OPTIONS.map(status => (
            <Option key={status} value={status}>{status}</Option>
          ))}
        </Select>

        {selectedRowKeys.length > 0 && (
          <>
            <span>已选择 {selectedRowKeys.length} 项</span>
            <Select
              placeholder="批量修改状态"
              style={{ width: 150 }}
              onChange={handleBatchStatusChange}
            >
              {STATUS_OPTIONS.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </>
        )}
      </Space>

      {/* 表格 */}
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        pagination={{
          ...pagination,
          total: filteredData.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        scroll={{ x: 1200 }}
        size="small"
      />

      {/* 更新互动数据弹窗 */}
      <UpdateInteractions
        visible={updateInteractionsVisible}
        onClose={() => {
          setUpdateInteractionsVisible(false);
        }}
        bloggers={bloggers}
        onComplete={onUpdate}
      />
    </div>
  );
}
