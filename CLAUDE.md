# KOL 博主管理系统 - 项目文档

## 技术架构

- **前端**: React + Vite + Ant Design
- **桌面端**: Electron
- **数据库**: Supabase (PostgreSQL)
- **部署**: Web 版 + Electron 桌面版

## 数据库架构 (Supabase)

### 主数据表 (Master Data) - 只读

这些表由管理员在 Supabase 后台维护，前端应用只能读取，不能修改。

#### `master_brand` - 品牌表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键，自增 |
| code | text | 品牌代码 |
| name | text | 品牌中文名 |
| name_en | text | 品牌英文名 |
| description | text | 品牌描述 |
| is_active | boolean | 是否启用 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

#### `master_restaurant` - 门店表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| brand_id | integer | 品牌ID，外键 → master_brand.id |
| restaurant_name | text | 门店名称 |
| city | text | 城市 |
| address | text | 地址 |
| is_active | boolean | 是否启用 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 业务数据表 (KOL Data) - 可读写

#### `kol_bloggers` - 博主表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| project_id | uuid | 门店ID，外键 → master_restaurant.id |
| nickname | text | 博主昵称 |
| avatar | text | 头像URL |
| followers | integer | 粉丝数 |
| status | text | 状态 (pending/contacted/completed/rejected) |
| contact_date | text | 联系日期 |
| notes | text | 备注 |
| xiaohongshu_url | text | 小红书链接 |
| douyin_url | text | 抖音链接 |
| weibo_url | text | 微博链接 |
| likes | integer | 点赞数 |
| comments | integer | 评论数 |
| shares | integer | 分享数 |
| last_interaction_update | text | 最后更新互动数据时间 |
| created_at | bigint | 创建时间戳 |
| updated_at | bigint | 更新时间戳 |

#### `shared_projects` - 分享记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| share_id | text | 分享ID，主键 |
| project_name | text | 项目/门店名称 |
| project_group_name | text | 品牌名称 |
| bloggers | jsonb | 博主数据 JSON |
| projects | jsonb | 项目数据 JSON (项目集模式) |
| password | text | 访问密码 |
| expires_at | timestamp | 过期时间 |
| view_count | integer | 查看次数 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

## 数据关系

```
master_brand (品牌)
    │
    └── master_restaurant (门店)
            │
            └── kol_bloggers (博主)
```

## 前端数据层 (src/utils/db.js)

### API 接口

```javascript
// 品牌操作 (只读)
projectGroupDB.getAll()      // 获取所有品牌
projectGroupDB.getCurrent()  // 获取当前选中的品牌
projectGroupDB.switch(id)    // 切换品牌 (仅更新 localStorage)

// 门店操作 (只读)
projectDB.getByGroup(brandId)  // 获取品牌下的所有门店
projectDB.getCurrent()         // 获取当前选中的门店
projectDB.switch(id)           // 切换门店 (仅更新 localStorage)

// 博主操作 (可读写)
bloggerDB.getByProject(restaurantId)  // 获取门店的所有博主
bloggerDB.add(blogger)                // 添加博主
bloggerDB.update(id, data)            // 更新博主
bloggerDB.delete(id)                  // 删除博主
bloggerDB.batchAdd(bloggers)          // 批量添加博主
```

### 本地状态存储 (localStorage)

- `currentProjectGroup` - 当前选中的品牌ID
- `currentProject` - 当前选中的门店ID

## 项目文件结构

```
kol-of-smartice/
├── electron/           # Electron 主进程
│   ├── main.js        # 应用入口
│   ├── database.js    # 本地数据库 (已废弃，使用 Supabase)
│   ├── crawler.js     # 爬虫模块
│   └── preload.cjs    # 预加载脚本
├── src/               # React 前端
│   ├── components/    # UI 组件
│   ├── utils/         # 工具函数
│   │   ├── db.js              # 数据层 API (Supabase)
│   │   ├── supabase.js        # 分享功能
│   │   └── supabase-client.js # Supabase 客户端配置
│   ├── App.jsx        # Electron 版入口
│   └── web.jsx        # Web 版入口
├── public/            # 静态资源
├── share-page/        # 分享页面
└── dist-electron/     # 构建输出
```

## 开发注意事项

1. **品牌和门店数据是只读的** - 由管理员在 Supabase 后台管理
2. **博主数据通过 project_id 关联到门店** - project_id 是 master_restaurant.id
3. **使用 localStorage 保存当前选中状态** - 不存储到数据库
4. **Web 版和 Electron 版共用同一套数据层代码**
