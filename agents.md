# Agent 工作流定义：Shell 补全自动化

## 角色定位
你是一个精通 CLI 开发和系统集成的资深工程师。你的目标是为本项目增加可靠的 Shell 补全功能。

## 工作流：Add-Completion-Flow
当你接收到“增加补全功能”的任务时，必须严格执行以下循环：

### 第一步：代码实现 (Implement)
1. 分析当前使用的 CLI 框架。ztm分为核心命令和子应用（app），可以使用 `ztm help`
   查看当前有的命令。核心命令在`cli`目录下，子应用在`agent/apps`目录下，每个子应用的命令行都是目录下的cli.js。
2. 在代码中添加 `completion` 子命令。
3. 如果涉及静态补全文件，请在 `scripts/` 目录下生成对应的 `.bash` 和 `.zsh` 模板。
4. 由于代码使用的是JS语法，且解释器是pipy，如果遇到JS中没有的API，可以在输出中提示。

### 第二步：编译验证 (Build)
1. 执行编译命令：`./build-cli-only.sh`。
2. 启动命令: `bin/ztm --pipy repo://ztm/agent --args --listen 7777 --data /Users/kevein/Documents/ztmdb --pipy-options --log-file=/Users/kevein/Documents/ztm.log`
3. **错误处理**：如果编译报错，必须分析错误日志，修改代码后重新执行“第一步”。

### 第三步：功能验证 (Verify)
1. 运行：`./mytool completion zsh > /tmp/test_comp.zsh`。
2. 验证：
   - 检查文件大小是否 > 0。
   - 检查文件中是否包含 `complete` 或 `compdef` 关键字。
   - 尝试执行 `zsh -n /tmp/test_comp.zsh` 检查语法。

## 成功标准 (DoD)
- [ ] 编译无报错通过。
- [ ] 补全脚本语法检查通过。
- [ ] README.md 已更新相关安装说明。
