# Bug修复记录：项目集数据隔离问题

## 发生时间
2024年12月9日

## 问题描述
用户创建新项目集B时，原项目集A的三个顶层级项目"消失"了；删除项目集B的项目时，项目集A的数据也被删除。

## 根本原因分析

### 1. 直接原因
- **SQLite外键约束未启用**：虽然定义了外键，但SQLite默认不启用
- **查询逻辑错误**：`projectDB.getCurrent()`查询所有项目，而非当前项目集的项目
- **状态清理不完整**：删除操作后未正确清理localStorage状态

### 2. 深层原因
- 数据边界控制不严，导致跨项目集数据混乱
- 缺少数据完整性检查机制
- UI状态与实际数据不同步

## 修复方案（双保险机制）

### 第一重保险：数据库层面
1. **启用外键约束**
   ```javascript
   // electron/database.js:73
   db.pragma('foreign_keys = ON');
   ```

2. **添加数据完整性检查**
   - 启动时自动检查孤立记录
   - 将孤立项目移到默认项目集
   - 清理无效的博主记录

### 第二重保险：业务逻辑层面
1. **修复getCurrent()方法**
   - 只返回当前项目集的项目
   - 避免跨项目集获取数据

2. **完善删除逻辑**
   - 删除项目后选择同项目集的新项目
   - 删除项目集后清空currentProjectId

3. **参数传递优化**
   - App.jsx调用getCurrent时传入currentGroupId

## 修复的文件

### 1. electron/database.js
```javascript
// 新增
db.pragma('foreign_keys = ON');  // 启用外键约束

// 新增数据完整性检查
const orphanedProjects = db.prepare(`
  SELECT p.id, p.name, p.group_id
  FROM projects p
  LEFT JOIN project_groups g ON p.group_id = g.id
  WHERE g.id IS NULL
`).all();
```

### 2. src/utils/db.js
```javascript
// 修复getCurrent方法
async getCurrent(currentGroupId = null) {
  // 只在当前项目集中查找
  const groupProjects = await this.getByGroup(currentGroupId);
  return groupProjects.find(p => p.id === currentId) || groupProjects[0] || null;
}

// 修复删除项目后的处理
const currentGroupId = localStorage.getItem('currentGroupId');
if (currentGroupId) {
  const groupProjects = await this.getByGroup(currentGroupId);
  localStorage.setItem('currentProjectId', groupProjects[0]?.id || '');
}

// 修复删除项目集后的处理
localStorage.setItem('currentProjectId', '');  // 清空状态
```

### 3. src/App.jsx
```javascript
// 传入currentGroupId参数
const current = await projectDB.getCurrent(currentGrp.id);
```

### 4. test-project-isolation.js
新增测试文件，用于验证修复效果。

## 验证方法

1. **创建项目集测试**
   - 创建新项目集B
   - 确认原项目集A的项目还在

2. **切换项目集测试**
   - 切换到空项目集B
   - 确认显示空列表

3. **删除操作测试**
   - 删除项目集B的项目
   - 确认项目集A不受影响

4. **级联删除测试**
   - 删除整个项目集
   - 确认相关项目和博主都被正确删除

## 预防措施

1. **代码审查**
   - 所有跨表查询必须检查边界条件
   - 删除操作必须清理相关状态

2. **测试覆盖**
   - 项目集隔离测试
   - 数据完整性测试
   - 边界条件测试

3. **监控机制**
   - 启动时数据完整性检查
   - 关键操作的日志记录

## 后续优化建议

1. 添加更多的数据验证
2. 实现数据备份和恢复机制
3. 添加操作历史记录
4. 考虑引入状态管理库（如Zustand）

## 提交信息
- Commit ID: 91faee3
- 提交时间: 2024-12-09
- 修改文件: 4个
- 新增行数: 124行
- 删除行数: 9行