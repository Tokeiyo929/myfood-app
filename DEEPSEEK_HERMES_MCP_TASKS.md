# 本地 DeepSeek + Hermes + Windows MCP 交接任务清单

> 交给服务器维护人员执行。目标：Hermes 聊天继续使用本地 DeepSeek，并能真正调用 Windows 本地文件 MCP；不能只把工具调用文本显示出来。

## 一、当前环境

- [ ] Hermes Dashboard：`http://192.168.1.148:9124/chat`
- [ ] Hermes 账号：`cancer`
- [ ] Hermes 配置文件：`/home/chaowei/hermes-accounts/cancer/config.yaml`
- [ ] 本地模型 API：`http://192.168.1.148:8000/v1`
- [ ] 模型：`deepseek-v4-flash-vision-exp`
- [ ] 推理服务：vLLM（`/version` 返回 `0.1.dev1+g3264654b8`）
- [ ] Windows MCP：`http://127.0.0.1:18897/mcp`
- [ ] MCP 服务名：`windows-local-files`

## 二、已经完成，不要重复做

- [x] Windows 本地 MCP 已安装并连通。
- [x] MCP 已有读、写、删、复制、移动、建目录、执行命令等管理员权限工具。
- [x] 已验证 Windows MCP 可以写入、读取 `C:\Users\tuqingyu\mcp_admin_test.txt`。
- [x] Hermes 已识别 Windows MCP，显示 11 个工具。
- [x] Hermes 主模型已配置为本地 DeepSeek。
- [x] Hermes 配置中的 `model.streaming` 已改为 `false` 并重启过网关。

## 三、已确认的故障

Hermes 调用 MCP 时，目前把 MCP 工具包装成内部元工具 `tool_call`。DeepSeek 返回类似下面的内容：

```text
<｜DSML｜tool_call name="tool_call" arguments="{...}">
```

这段内容被 Hermes 当成普通文本显示，没有执行 MCP，所以聊天会重复搜索工具、看起来像卡死。

重要对比：直接向 vLLM 发送一个普通函数工具时，vLLM 能正确返回 OpenAI 原生格式：

```json
{
  "finish_reason": "tool_calls",
  "message": {
    "tool_calls": [
      {"type": "function", "function": {"name": "list_drives", "arguments": "{}"}}
    ]
  }
}
```

结论：模型和 vLLM 并非完全不支持工具调用；主要问题是 Hermes 的 MCP 动态工具/内部 `tool_call` 适配链路。

## 四、处理任务

### A. 先备份并收集日志

- [ ] 备份 Hermes 配置：

```bash
cp -a /home/chaowei/hermes-accounts/cancer/config.yaml \
  /home/chaowei/hermes-accounts/cancer/config.yaml.before-deepseek-mcp
```

- [ ] 记录 Hermes 版本、vLLM 启动命令、模型服务日志。
- [ ] 日志中不要输出或提交 `OPENAI_API_KEY`、SSH 私钥、MCP token。

### B. 确认 Hermes 工具调用策略

- [ ] 查 Hermes v0.21.0 的配置 schema/source，确认 `agent.tool_use_enforcement` 的合法值。
- [ ] 当前值是 `auto`；不要猜值，确认后再尝试能让 OpenAI-compatible provider 使用原生 function tools 的模式。
- [ ] 优先尝试“原生工具调用/静态工具暴露”方案，避免让 DeepSeek 处理 Hermes 内部 `tool_call` 元工具。
- [ ] 检查是否能关闭 MCP 的动态工具发现（`tool_search` / `tool_describe`），让 `windows-local-files` 的工具直接出现在请求的 `tools` 数组中。

### C. 检查 vLLM 启动参数

- [ ] 确认服务启动时包含自动工具选择和 DeepSeek parser；常见 vLLM 形式如下，具体 parser 名称以当前 vLLM 版本支持列表为准：

```bash
--enable-auto-tool-choice
--tool-call-parser deepseek_v3
```

- [ ] 不要盲目重启生产模型服务；先记录现有启动命令、端口、容器/进程管理方式。
- [ ] 修改后验证 `/v1/chat/completions` 返回 `message.tool_calls`，而不是把 DSML 放进 `message.content`。

### D. 用最小请求验证 vLLM

- [ ] 使用服务器已有 API key 环境变量测试；不要把真实 key 写入脚本或聊天记录。
- [ ] 工具定义只放一个简单函数 `list_drives`，确认返回：

```text
finish_reason = tool_calls
message.tool_calls[0].function.name = list_drives
```

- [ ] 再测试 `tool_search`；如果简单函数成功、Hermes 元工具失败，继续处理 Hermes 适配，而不是继续改模型 parser。

### E. 修复 Hermes MCP 链路

按优先级执行：

1. [ ] 让 Hermes 直接把 MCP 工具作为原生 OpenAI function tools 发送给 DeepSeek。
2. [ ] 如果 Hermes 必须使用 `tool_call` 元工具，给 OpenAI-compatible provider 增加 DSML 解析兼容层：
   - 解析普通 `<｜DSML｜tool_call>...</｜DSML｜tool_call>`；
   - 解析带 `name="tool_call" arguments="..."` 的形式；
   - 先解码 `&quot;`、`&amp;` 等 HTML 实体；
   - 解析内部 JSON；
   - 将 `mcp__windows_local_files__list_drives` 映射到对应 MCP 工具；
   - 解析失败时返回明确错误，不要无限重试。
3. [ ] 给修复增加一个回归测试：模型输出 DSML 时，Hermes 必须实际执行一次 MCP，不得把 DSML 原文交给用户。

### F. 重启并验证

- [ ] 保存配置后重启 Hermes Gateway。
- [ ] 新建聊天，不要复用之前已经卡住的会话。
- [ ] 依次测试：

```text
请调用 windows-local-files 的 list_drives，只返回工具结果。
```

```text
请读取 C:\Users\tuqingyu\mcp_admin_test.txt，只返回文件内容。
```

```text
请写入 C:\Users\tuqingyu\mcp_admin_test_2.txt，内容为 mcp-ok，然后读回验证。
```

- [ ] 聊天中不能出现 `<｜DSML｜...>` 原始标签。
- [ ] MCP 服务端日志显示真实工具调用，而不是只有 `tool_search` 重复调用。
- [ ] 写入、读取测试完成后删除测试文件；删除前确认路径只指向测试文件。

## 五、验收标准

- [ ] Hermes 当前模型仍是 `deepseek-v4-flash-vision-exp`。
- [ ] 没有切换到外部 GPT、Claude 或其他云模型。
- [ ] 可以调用 `list_drives`。
- [ ] 可以读取 Windows 本地文件。
- [ ] 可以在明确要求时写入 Windows 本地文件。
- [ ] 工具调用一次成功，不重复搜索、不假装执行、不显示 DSML 原文。
- [ ] API key、SSH key、管理员凭据没有出现在 Markdown、日志或聊天回复中。

## 六、回滚方案

- [ ] 停止 Hermes Gateway。
- [ ] 恢复备份配置：

```bash
cp -a /home/chaowei/hermes-accounts/cancer/config.yaml.before-deepseek-mcp \
  /home/chaowei/hermes-accounts/cancer/config.yaml
```

- [ ] 重启 Hermes Gateway。
- [ ] 若只需恢复原流式设置，把 `model.streaming` 改回 `true`；但这不能解决 Hermes 元工具 DSML 解析问题，只用于回退实验配置。

## 七、交接时请回报

- [ ] Hermes 版本：
- [ ] vLLM 版本和启动参数：
- [ ] 实际采用的修复方式：
- [ ] `list_drives` 是否成功：
- [ ] `read_file` 是否成功：
- [ ] `write_file` 是否成功：
- [ ] 是否仍出现 DSML 原文：
- [ ] 相关日志路径：
