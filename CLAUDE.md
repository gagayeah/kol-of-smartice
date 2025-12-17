# KOL 博主管理系统 - 项目文档
# v2.1.0 - 添加项目分类功能，恢复三层可编辑结构

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
| code | varchar | 品牌代码 |
| name | varchar | 品牌中文名 |
| name_en | varchar | 品牌英文名 |
| description | text | 品牌描述 |
| is_active | boolean | 是否启用 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `master_restaurant` - 门店表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| brand_id | integer | 品牌ID，外键 → master_brand.id |
| restaurant_name | varchar | 门店名称 |
| city | varchar | 城市 |
| address | varchar | 地址 |
| phone | varchar | 电话 |
| meituan_org_code | varchar | 美团组织代码 |
| is_active | boolean | 是否启用 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 业务数据表 (KOL Data) - 可读写

#### `kol_project_categories` - 项目分类表 (NEW)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| restaurant_id | uuid | 门店ID，外键 → master_restaurant.id |
| name | text | 分类名称 (如 s5, s8, s9) |
| description | text | 描述 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| status | text | 状态 (active/completed/archived) |
| sort_order | integer | 排序 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `kol_bloggers` - 博主表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| project_id | uuid | 门店ID，外键 → master_restaurant.id |
| category_id | text | 项目分类ID，外键 → kol_project_categories.id (NEW) |
| nickname | text | 博主昵称 |
| followers | integer | 粉丝数 |
| profile_url | text | 主页链接 |
| status | text | 状态 (pending/contacted/completed/rejected) |
| **小红书字段** | | |
| xhs_link | text | 小红书链接 |
| xhs_likes | integer | 小红书点赞数 |
| xhs_favorites | integer | 小红书收藏数 |
| xhs_comments | integer | 小红书评论数 |
| xhs_shares | integer | 小红书分享数 |
| **点评字段** | | |
| dianping_link | text | 大众点评链接 |
| dianping_likes | integer | 点评点赞数 |
| dianping_favorites | integer | 点评收藏数 |
| dianping_comments | integer | 点评评论数 |
| dianping_shares | integer | 点评分享数 |
| **抖音字段** | | |
| douyin_link | text | 抖音链接 |
| douyin_likes | integer | 抖音点赞数 |
| douyin_favorites | integer | 抖音收藏数 |
| douyin_comments | integer | 抖音评论数 |
| douyin_shares | integer | 抖音分享数 |
| **微博字段** | | |
| weibo_link | text | 微博链接 |
| weibo_likes | integer | 微博点赞数 |
| weibo_favorites | integer | 微博收藏数 |
| weibo_comments | integer | 微博评论数 |
| weibo_shares | integer | 微博分享数 |
| **其他字段** | | |
| contact_info | jsonb | 联系方式 JSON |
| cooperation_fee | numeric | 合作费用 |
| publish_time | timestamptz | 发布时间 |
| notes | text | 备注 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `shared_projects` - 分享记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| share_id | text | 分享ID，主键 |
| project_name | text | 项目/门店名称 |
| project_group_name | text | 品牌名称 |
| bloggers | jsonb | 博主数据 JSON |
| projects | jsonb | 项目数据 JSON (项目集模式) |
| password | text | 访问密码 |
| expires_at | timestamptz | 过期时间 |
| view_count | integer | 查看次数 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `kol_shares` - 分享关联表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| project_id | uuid | 项目/门店ID |
| share_id | text | 分享ID，外键 → shared_projects.share_id |
| created_at | bigint | 创建时间戳 |
| expires_at | bigint | 过期时间戳 |

### 遗留表 (Legacy - 当前未使用)

以下表存在于数据库中但当前未被应用使用：

#### `kol_project_groups` - 项目集表 (已清空)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| name | text | 项目集名称 |
| brand_id | integer | 品牌ID |
| description | text | 描述 |
| is_active | boolean | 是否启用 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `kol_projects` - 项目表 (已清空)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| group_id | text | 项目集ID |
| parent_id | text | 父项目ID (支持多层嵌套) |
| restaurant_id | uuid | 门店ID |
| name | text | 项目名称 |
| project_type | text | 项目类型 |
| status | text | 状态 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| budget | numeric | 预算 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### `kol_campaigns` - 活动表
用于管理 KOL 营销活动，包含预算、日期、目标指标等。

#### `kol_blogger_campaigns` - 博主活动关联表
关联博主与活动，记录邀请状态、费用、交付物等。

#### `kol_analytics` - 数据分析表
记录历史互动数据，用于趋势分析。

## 当前数据关系 (v2.1.0)

```
master_brand (品牌) - 只读
    │
    └── master_restaurant (门店) - 只读
            │
            └── kol_project_categories (项目分类) - 可读写 ← NEW
                    │
                    └── kol_bloggers (博主) - 可读写
```

## 架构演进历史

### v1.x - 原始设计 (已废弃)
支持用户自定义的多层项目结构，使用本地 SQLite：
```
项目集 (kol_project_groups) - 可创建/删除
    └── 项目 (kol_projects, parent_id=null) - 可创建/删除
          └── 子项目 (kol_projects, parent_id=上级) - 可创建/删除
```

### v2.0.0 - 简化设计 (过渡版本)
迁移到 Supabase，简化为只读的品牌-门店结构：
```
品牌 (master_brand) - 只读
    └── 门店 (master_restaurant) - 只读
          └── 博主 (kol_bloggers)
```
**问题**: 移除了项目分类功能，无法在门店下组织博主

### v2.1.0 - 当前设计
恢复项目分类功能，保持品牌/门店只读：
```
品牌 (master_brand) - 只读
    └── 门店 (master_restaurant) - 只读
          └── 项目分类 (kol_project_categories) - 可读写 ← 恢复
                └── 博主 (kol_bloggers) - 可读写
```
**特性**: 用户可在每个门店下自由创建项目分类 (如 s5, s8, s9 等活动期)

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

// 项目分类操作 (可读写) - NEW
categoryDB.getByRestaurant(restaurantId)  // 获取门店的所有分类
categoryDB.getCurrent()                   // 获取当前选中的分类
categoryDB.switch(id)                     // 切换分类 (仅更新 localStorage)
categoryDB.create(name, restaurantId)     // 创建分类
categoryDB.update(id, data)               // 更新分类
categoryDB.delete(id)                     // 删除分类

// 博主操作 (可读写)
bloggerDB.getByCategory(categoryId)       // 获取分类下的所有博主 - NEW
bloggerDB.getByProject(restaurantId)      // 获取门店的所有博主 (兼容)
bloggerDB.add(blogger)                    // 添加博主
bloggerDB.update(id, data)                // 更新博主
bloggerDB.delete(id)                      // 删除博主
bloggerDB.batchAdd(bloggers)              // 批量添加博主
```

### 本地状态存储 (localStorage)

- `currentProjectGroup` - 当前选中的品牌ID
- `currentProject` - 当前选中的门店ID
- `currentCategory` - 当前选中的项目分类ID (NEW)

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
5. **kol_bloggers 表有平台特定字段** - 小红书/点评/抖音/微博各有独立的互动数据字段
