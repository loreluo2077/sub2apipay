# 业务应用接入与数据库真源化实施方案

## 一、目标

把当前项目从“单应用支付站点 + 环境变量优先配置”，逐步演进成“支持多个业务应用接入的统一支付服务”。

核心目标只有四个：

- 运行时业务配置以数据库为真源
- 支付实例与业务应用绑定
- 每一笔订单明确归属于某个业务应用
- 环境变量只保留系统启动必需项

这份文档是当前项目后续改造的实际实施方案，作为后续数据模型、配置模型和代码改造的统一基线。

## 二、当前现状

当前仓库已经有一些不错的基础：

- `SystemConfig` 可以存放全局业务配置
- `PaymentProviderInstance` 已经支持把支付实例配置存进数据库
- `Order` 已经有 `srcHost` 和 `srcUrl`
- `ensureDBProviders()` 已经能从数据库补注册支付实例

但整体仍然偏 env-first：

- `getEnv()` 仍然承载了大量支付运行配置
- 支付服务注册仍然先从 env 出发
- `SystemConfig` 仍然会回退到 `process.env`
- 当前没有明确的 `App` 模型
- 订单还没有一等公民级别的应用归属字段
- `Channel` 和 `SubscriptionPlan` 还没有应用归属

## 三、设计原则

### 1. 数据库是运行时真源

数据库负责承载：

- 业务应用接入配置
- 支付服务商实例配置
- 支付方式启用情况
- 订单策略与限额
- 前台展示和商品可见性

### 2. 环境变量只做启动底座

环境变量只保留：

- `DATABASE_URL`
- 系统级主密钥
- 系统管理员引导项
- 少量部署开关

不再承载支付凭证、应用级品牌配置、应用级运行策略。

### 3. App 是一等公民

以后核心业务对象要么归属于某个 `App`，要么明确标记为全局共享。

### 4. 字段要克制

第一阶段不追求把未来所有可能性一次性塞进表里。  
先补“归属关系”所必需的最小字段，避免把模型做得过重。

## 四、配置分层

建议只保留两层，而不是做复杂分层。

### 1. 启动层配置

只存在于环境变量里。

保留：

- `DATABASE_URL`
- `APP_MASTER_KEY`
- `BOOTSTRAP_ADMIN_TOKEN`

### 2. 运行时配置

存储在数据库里。

包括：

- 全局默认配置
- 业务应用级配置
- 支付实例配置

第一阶段继续保留 `SystemConfig`，但运行方向明确为 DB-first，不再继续扩大 env fallback 的使用范围。

## 五、数据模型

### 1. 新增 `App` 模型

第一阶段字段固定为：

- `id`
- `code`，唯一
- `name`
- `status`
- `createdAt`
- `updatedAt`

- `App` 表示一个接入本支付系统的业务应用
- 第一阶段不加入品牌、模式、认证方式等扩展字段

### 2. 扩展 `Order`

订单需要先建立应用归属。

第一阶段只新增：

- `appId`
- `bizOrderId`
- `bizUserId`

- `appId` 用来明确订单来自哪个业务应用
- `bizOrderId` 用来映射上游业务应用自己的订单号
- `bizUserId` 用来映射上游业务应用自己的用户标识

### 3. 扩展 `PaymentProviderInstance`

支付实例必须归属于某个业务应用。

第一阶段只新增：

- `appId`

这样就已经足够支持：

- A 应用走自己的 EasyPay
- B 应用走自己的 Stripe

第一阶段不增加更多模式字段。

### 4. 扩展 `Channel`

`Channel` 当前更像前台展示配置，而不是支付网关实例。

第一阶段只新增：

- `appId`

目的不是一次把它抽象完，而是先明确“这个展示渠道属于哪个应用”。

### 5. 扩展 `SubscriptionPlan`

第一阶段只新增：

- `appId`

这样就能支持：

- 某个应用售卖自己的套餐
- 不同应用展示不同套餐

### 6. 配置表先不急着新建

引入 `AppConfig` 应用配置表。

当前阶段做法：

- `SystemConfig` 继续承载全局默认配置
- `AppConfig` 可以覆盖默认配置

## 六、Prisma 第一阶段最小改动

第一阶段 Prisma 结构改动固定为：

- 新增 `App`
- `Order.appId`
- `Order.bizOrderId`
- `Order.bizUserId`
- `PaymentProviderInstance.appId`
- `Channel.appId`
- `SubscriptionPlan.appId`

这一组改动足以建立应用归属主线。

## 七、运行时解析思路

目标不是让业务代码继续到处直接读 `getEnv()`，而是逐步变成：

1. 先识别请求属于哪个 `App`
2. 根据 `App` 读取对应运行配置
3. 再按 `App` 选择支付实例

这一阶段新增下列能力：

- `resolveRequestApp(request)`
- `getAppRuntimeConfig(appId)`
- `selectInstance(appId, providerKey, strategy, paymentType, amount)`

## 八、请求如何识别 App

以后不要只靠 `srcHost` 和 `srcUrl` 判断来源。

第一阶段统一支持传入：

- `app_code`

或者由后端在前置入口把它解析出来。

第一阶段不引入更重的签名接入方案。

## 九、支付实例选择的改造方向

当前：

- `selectInstance(providerKey, strategy, paymentType, amount)`

第一阶段直接改成：

- `selectInstance(appId, providerKey, strategy, paymentType, amount)`

这是整个多应用能力里最关键的一步之一。

因为只要实例选择还是全局的，后面应用归属再完整也容易串用支付实例。

## 十、迁移顺序

### Phase 0：冻结 env 业务配置扩张

本阶段执行项：

- 新增业务配置默认走数据库
- 不再往 env 里继续堆支付运行项

### Phase 1：引入 `App`

1. 新增 `App` 表
2. 创建一个默认应用，例如 `default`
3. 给现有数据回填默认应用：
   - `Order`
   - `PaymentProviderInstance`
   - `Channel`
   - `SubscriptionPlan`

本阶段不改变前台行为。

### Phase 2：让订单和支付路由按 App 工作

1. 创建订单时解析 `appId`
2. `Order` 写入 `appId`
3. 实例选择按 `appId` 过滤
4. 前台商品和渠道按 `appId` 读取

### Phase 3：把运行配置从 env 挪出

1. 收缩 `getEnv()`
2. 支付 provider 不再依赖 env 中的业务凭证
3. `SystemConfig` 逐步取消 env fallback

## 十一、代码改造顺序

实施顺序固定为：

1. 新增 `App` 模型
2. 给 `Order`、`PaymentProviderInstance`、`Channel`、`SubscriptionPlan` 增加 `appId`
3. 给 `Order` 增加 `bizOrderId`、`bizUserId`
4. 把 `selectInstance()` 改成必须传 `appId`
5. 增加 `resolveRequestApp()`
6. 再逐步收缩 `getEnv()`

## 十二、当前明确不做的事

第一阶段不做下面这些事情：

- 不急着引入大量 App 扩展字段
- 单独拆出 `AppConfig`
- 不急着设计很重的安全接入模型
- 不急着拆成多个服务

先完成应用归属和数据库真源这两条主线，后续再按需要扩展。

## 十三、第一批实施项

第一批实施项固定为：

1. 新增 `App`
2. 给 `Order`、`PaymentProviderInstance`、`Channel`、`SubscriptionPlan` 增加 `appId`
3. 把 `selectInstance()` 改成按 `appId` 路由

这是一组收益最高、同时改动范围可控的改造。

## 十四、总结

本方案的落地目标不是一次把系统做重，而是先把最关键的边界立起来：

- 业务应用是接入主体，用 `App` 表达
- 订单、商品、支付实例都有明确的应用归属
- 运行时配置逐步从环境变量迁移到数据库
- 字段设计保持克制，只补第一阶段真正需要的字段

这样改完之后，这个项目会更适合继续往“多业务应用统一支付服务”演进，而且不会因为前期字段加得太重，反而把后续调整空间锁死。
