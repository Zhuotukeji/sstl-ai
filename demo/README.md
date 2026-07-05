# SSTL H5 Demo

这是根据 SSTL 系列 PRD 生成的静态 H5 原型，用于演示搜索套利投放操作系统和自我复盘迭代型 AI 中台的核心页面、信息架构和关键交互。

## 打开方式

投放中台 Demo：

```text
demo/index.html
```

AI 中台 Demo：

```text
demo/ai-platform.html
```

也可以用任意静态服务器打开，不需要后端、不需要构建、不需要安装依赖。

## 投放中台覆盖页面

- 控制台
- Offer 管理
- 内部 Campaign
- 重定向日志
- 业务总览
- 自动化计划
- 自动化执行日志
- TikTok 跨账号复制
- 任务中心
- 素材 AI 分析
- TONIC 合规
- TikTok 授权、广告账户、操作审计占位页

## 投放中台覆盖交互

- 左侧导航切换
- 筛选、重置、保存视图 toast 反馈
- Offer 新增/编辑抽屉
- 内部 Campaign 三步创建抽屉
- Campaign 权重配置弹窗
- 重定向日志详情抽屉
- 自动化 dry-run 预览弹窗
- 跨账号复制任务预览
- 任务详情抽屉
- 素材 AI 详情抽屉
- TONIC declined 联动确认弹窗

## AI 中台覆盖页面

- AI 控制台
- AI 对话助手
- AI 数据分析
- 投手经营分析
- 智能投放助手
- 素材制作助手
- Skill Registry
- Skill 草稿
- Skill 审核
- Skill 测试
- 知识库
- 知识审核
- 案例库 / SOP 库
- AI 复盘中心
- AI 任务中心
- 模型与成本
- AI 审计日志

## AI 中台覆盖交互

- 知识上传/编辑抽屉
- 知识审核弹窗
- 知识引用详情抽屉
- Skill 详情抽屉
- Skill 草稿生成弹窗
- Skill 审核通过/驳回弹窗
- Skill 测试运行弹窗
- AI Router 路由过程弹窗
- Context Builder 详情抽屉
- AI 数据分析结果抽屉
- 智能投放 Dry-run 弹窗
- 素材 Brief/脚本生成弹窗
- AI 复盘改进建议弹窗
- AI 审计日志详情抽屉

## 设计说明

- 采用后台工作台风格，表格和筛选优先。
- 状态颜色统一：绿色正常、红色异常、橙色风险、紫色自动化/增强展示。
- 桌面端为侧边栏布局，移动端侧边栏可折叠，表格支持横向滚动。
- 所有数据都是 mock 数据，不会持久化。
- AI 中台 Demo 用 mock 数据演示“知识喂养 -> Skill 注册 -> Router 选 Skill -> Context 拼装 -> AI 分析 -> Dry-run -> 用户反馈 -> 自我复盘改进”的闭环。

## 后续接真实系统

真实接入时建议按以下顺序替换：

1. 将 mock arrays 替换为 API 请求。
2. 对接 `docs/v1-openapi.yaml` 中的 Offer、Internal Campaign、Redirect Log 接口。
3. 将抽屉表单保存动作接入真实后端。
4. 将自动化 dry-run 和任务中心接入真实任务服务。
5. AI 中台接入时，将 mock 数据替换为 MCP/只读 API、知识库/RAG、Skill Registry、Dry-run 和审计服务。
