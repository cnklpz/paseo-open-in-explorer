# Open in Explorer — Paseo 插件

在 [Paseo](https://paseo.sh) 的 agent 聊天中右键文件路径，直接在 Windows 资源管理器中打开。

[English](#english)

## 功能

- 右键 agent 回复里的路径，弹出“在资源管理器中打开”菜单
- 文件：打开所在文件夹并选中该文件；文件夹：直接打开
- 路径不存在时，打开最近的存在的上级文件夹
- 资源管理器窗口会被切到前台，不会只在任务栏闪烁
- 右键非路径文字时，保留原来的右键菜单
- 手机端：长按消息

支持识别的路径：

| 类型 | 示例 |
| --- | --- |
| 盘符绝对路径 | `C:\Users\me\file.txt`、`D:/xm/project` |
| 网络路径 (UNC) | `\\nas\share\doc.pdf` |
| 相对路径（按 agent 工作目录解析） | `./docs`、`src/app/main.ts` |
| 带行列号 | `src/index.ts:12:3`（行列号会被忽略） |

## 安装

需要 Paseo 0.17.3 或更高版本，并在 **设置 → 插件** 中启用插件。

```bash
paseo plugin install github:cnklpz/paseo-open-in-explorer
```

更新与卸载：

```bash
paseo plugin update open-in-explorer
paseo plugin remove open-in-explorer
```

## 工作原理

Paseo 没有提供聊天右键菜单的扩展 API，所以插件：

1. 用时间线转换器（timeline transformer）接管**已完成**且包含路径的 assistant 消息，并用 Paseo 自带的 Markdown 组件重新渲染，外观不变。正在流式输出的消息和不含路径的消息不受影响。
2. 在桌面端监听该消息的 `contextmenu` 事件：选中的文字或光标下的文字中有路径时，显示插件菜单。
3. 点击菜单项后，通过插件 RPC 让 daemon 执行 `explorer.exe /select,"<路径>"`。
4. daemon 是后台进程，受 Windows 前台锁限制，新窗口默认无法置顶。插件随后运行一段隐藏的 PowerShell，找到对应的资源管理器窗口并切到前台。

macOS 和 Linux 上分别使用 `open -R` 和 `xdg-open`（未充分测试）。

## 注意事项

- 资源管理器在 **daemon 所在的机器**上打开。应用连接远程 daemon 时，窗口会出现在远程机器上。
- 路径识别基于正则，可能有少量误判或漏判。含空格的路径只会识别到空格之前。
- 窗口切到前台约需 1 秒。

## 开发

```bash
git clone https://github.com/cnklpz/paseo-open-in-explorer.git
cd paseo-open-in-explorer
npm install
npm run typecheck
paseo plugin install "$(pwd)"
# 修改后
paseo plugin reload open-in-explorer
paseo plugin logs open-in-explorer
```

| 文件 | 作用 |
| --- | --- |
| `shared/paths.ts` | 路径识别与 RPC 契约 |
| `client/message.tsx` | 消息渲染与右键菜单 |
| `client/web.ts` | 桌面端 DOM 事件辅助 |
| `server/open.ts` | 解析路径并启动资源管理器 |
| `server/focus.ts` | 将资源管理器窗口切到前台 |

## English

A Paseo plugin: right-click a file path in an agent's reply to reveal it in Windows Explorer. Files open with the file selected, folders open directly, and missing paths fall back to the nearest existing parent. The Explorer window is brought to the foreground. Requires Paseo 0.17.3+ with plugins enabled.

```bash
paseo plugin install github:cnklpz/paseo-open-in-explorer
```

## License

[MIT](LICENSE)
