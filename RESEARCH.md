# Enigma Lab · 技术选型与参考核查

初次核查日期：2026-10-01；Enigma I 外壳与灯板补充核查：2026-10-02。本文基于公开仓库的 README、依赖文件、实际源码、测试及许可证，以及密码机历史资料。这里的「已核实」表示确实读取了对应资料；开发建议与项目当前实现程度分开陈述。

## 结论

这个项目适合做成纯前端的三维交互网页。推荐 **React + TypeScript + Vite + Three.js / React Three Fiber / Drei**；加密内核使用可独立测试的 TypeScript，**Vitest** 做密码学与状态测试，浏览器交互检查验证整条操作流程。第一版明确实现 **Enigma I：三转子，I–V 中选三枚，宽反射器 B / C，插线板、环设置和双步进**。M4、可接线反射器 D 等属于不同机型，后续单独扩展。

这一组合能够自动生成部件、驱动剖视与拆解动画、追踪每次按键，并部署到静态网站。它也保留以后替换高精度 Blender / glTF 外观模型的空间。网站运行无需 Python 服务、账户、数据库或云端加密接口。

## 用户提供的参考项目

### RhineLabUI

- [仓库](https://github.com/LBEILC/RhineLabUI)；[在线版本](https://rhine.lubeiluchen.cc/)；[依赖文件](https://github.com/LBEILC/RhineLabUI/blob/main/package.json)。实际采用 **TypeScript + Three.js + Vite**，并非 React；核查时 Three.js 依赖为 `^0.183.0`。
- README 说明模型通过 Blender MCP 制作；仓库实际包含 `.blend` 源工程、Python 建模脚本，以及 `archive-cassette.glb`、`archive-assembly.glb`。`src/model-viewer.ts` 使用 OrbitControls、相机运动、部件分组与拆解位移。适合学习「模型 + 档案 + 部件检视」的整体组织。
- [MIT 许可证已核实](https://github.com/LBEILC/RhineLabUI/blob/main/LICENSE)。README 明确授权作者有权授权的代码、建模脚本、原创 Blender / GLB 模型及原创声音等，复用时保留版权和许可证。
- README 同时明确排除《明日方舟》名称、标志、设定、原 PV、原作视觉设计、PV 音频采样及第三方字体等权利。整个仓库采用 MIT 并不意味着第三方素材也获得 MIT 授权。本项目采用原创密码学研究终端主题，借鉴留白、技术标注、档案式交互，不依赖这些品牌素材。

### Steam 创意工坊展示

[提供的 Steam 页面](https://steamcommunity.com/sharedfiles/filedetails/?id=3799142774)是 **Rhine Lab · 莱茵生命交互桌面 | Interactive Desktop**，属于 Wallpaper Engine 交互壁纸。页面描述包括三维档案阵列、360° 查看、旋转缩放、模型拆解、主题与画质设置。

RhineLabUI 的 README 说明壁纸版现已拆到 [RhineLabWallpaper](https://github.com/LBEILC/RhineLabWallpaper)。浏览器项目不需要引入 Wallpaper Engine；如果以后需要桌面壁纸，再增加宿主适配层即可。本次未将独立壁纸仓库作为可复用代码来源，也未单独核查其许可证。

### cassette / OHM TAPE

- [仓库](https://github.com/zcy83821448/cassette)；[已验证可访问的网页地址](https://zcy83821448.github.io/cassette/)；[依赖文件](https://github.com/zcy83821448/cassette/blob/main/package.json)。实际采用 **原生 JavaScript + Three.js + esbuild**，Three.js 为 `^0.180.0`。
- 读取了 `src/cassette.js`、`src/textures.js`、`src/anim.js`、`src/controls.js`：模型与纹理由代码生成，使用挤压、回转、倒角、程序纹理与部件分组；有分层拆解、半透明幽灵材质、部件专属机位。并不是仅播放预渲染动画，也不依赖下载一个成品模型。
- 对 Enigma 最有用的思想是：**选中部件后，模型、镜头、技术说明同步；机械运动与界面显示共用一套状态**。其磁带速度和带盘半径来自同一运动模型；Enigma 的灯、转子、走线也应来自同一次真实加密结果。
- **授权记录**：初次核查时 GitHub 返回 `license: null`，仓库未附 LICENSE。用户随后明确说明作者已在 bilibili 公开授权并开源，本轮按用户提供的授权背景继续参考其整体视觉与交互，不把缺少 MIT 文件作为开发阻碍。当前 Enigma 的界面、几何和电流实现仍为独立编写。
- README 说明商业音乐已不在公开仓库中分发；Enigma 网页不需要这项资产。

## 可以实际使用的开源项目

1. **[Three.js](https://github.com/mrdoob/three.js)**：实时三维渲染、物理材质、几何、灯光、相机、glTF。适合主体建模与金属、木材、胶木等材质。[MIT 已核实](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。
2. **[React Three Fiber](https://github.com/pmndrs/react-three-fiber)**：在 React 中组织 Three.js 场景；部件可以独立复用，状态变更与普通界面统一。[MIT 已核实](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE)。
3. **[Drei](https://github.com/pmndrs/drei)**：补充 OrbitControls、曲线、文字、包围盒及加载工具，减少相机和检视交互的重复劳动。[MIT 已核实](https://github.com/pmndrs/drei/blob/master/LICENSE)。
4. **[Py-Enigma](https://github.com/gremmie/enigma)**：Python 的历史 Enigma 模拟库，当前 README 版本 1.0.2；支持三/四转子，包含转子、环设置、插线板、双步进和历史报文测试。建议用作**独立测试参照**，为浏览器内核生成确定性核验数据，不放到网页运行路径中。[MIT 已核实](https://github.com/gremmie/enigma/blob/master/LICENSE.txt)。
5. **[Cryptii](https://github.com/cryptii/cryptii)**：浏览器编码与加密工具。已读取 [Enigma 实现](https://github.com/cryptii/cryptii/blob/main/src/Encoder/Enigma.js)与[测试](https://github.com/cryptii/cryptii/blob/main/test/Encoder/Enigma.js)，确实涵盖 Enigma I / M3 / M4 等机型。适合交叉查看历史参数、交互与另一个实现；其模块依赖自身框架，直接嵌入不如独立小内核清晰。[MIT 已核实](https://github.com/cryptii/cryptii/blob/main/LICENSE.txt)。
6. **[Blender](https://www.blender.org/)**：后续精细外壳、倒角、螺钉、插孔、触点、木箱与机械机构。可用 Python 批量建模、命名与导出 glTF，便于自动化迭代。[官方许可证说明已核实](https://www.blender.org/about/license/)：软件遵循 GNU GPL，生成的艺术作品与数据文件由创作者自行使用；脚本/插件的分发许可需按具体用途处理。
7. **[glTF Transform](https://gltf-transform.dev/)**：后续模型清理、去重、压缩、优化的自动化工具，可进入构建流程。[MIT 已核实](https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md)。

没有必要先集齐所有工具。第一版用程序化几何即可做出真实可操作的结构；Blender 和 glTF 优化适合在部件层级和交互稳定后逐步接入。本次没有核实出一个能够直接替代全部工作的现成模型包，尤其是同时具有完整内部机构、明确许可和可驱动部件层级的整机模型。

## 加密正确性必须如何保证

**数学与显示分离，但只有一个事实来源。** 每次按键先生成一份不可变记录：输入字母、按下前位置、哪些转子步进、步进后位置、各元件入口/出口字母、环偏移和最终灯号。三维动画、线路图、文字记录与导出都消费这份记录。重复播放动画不能再次推进密码状态；暂停动画也不能丢失按键。

路径为：键盘 → 插线板 → 输入轮 ETW → 右/中/左转子正向 → 反射器 → 左/中/右转子反向 → ETW → 插线板 → 灯板。通常的 Enigma I 输入轮按字母表接线。

必须单独覆盖的边界：

- **先步进，再通电**；缺口条件用步进前状态判断。
- 中间转子会产生双步进，不能按普通里程表进位实现。
- 环设置改变内部走线相对字母环的偏移；对这里的 Enigma I 转子，缺口随字母环，因此以窗口字母表示的进位点不因环设置改变。I–V 的进位触发字母为 Q、E、V、J、Z。
- 反向通过转子要使用逆置换；反射器必须成对互连、没有自连；插线板每个字母最多接入一对，限制最多十对。
- 位置 A–Z 与环设置 01–26 的展示，需和内核 0–25 索引明确转换。转子列表始终标明「从左至右」，实际正向电流则从右向左经过。

独立证据与建议测试：

1. Py-Enigma 的[测试文件](https://github.com/gremmie/enigma/blob/master/enigma/tests/test_enigma.py)有已知例子：I–II–III，B，环 AAA，初始 AAA，无插线，`AAAAA → BDZGO`。
2. 同文件的双步进例子：从左至右 III–II–I，`KDO → KDP → KDQ → KER → LFS → LFT → LFU`。
3. 非零环和十对插线的历史配置：II–IV–V / B / 环 B–U–L / `AV BS CG DL FU HZ IN KM OW RX`；初始 WXC 加密 KCH 得 BLA，再从 BLA 处理对应报文。Py-Enigma README 提供短例和源码中的完整历史报文。
4. 大量确定性配置与 Py-Enigma 对拍，覆盖不同转子顺序、环设置、窗口位置、反射器、插线与跨缺口长报文；再验证复位后同设置可还原输入、字母不会映射为自身。仅有「加密再解密相同」不足以证明历史规则正确。
5. 检查动画与结果一致：最终高亮灯号等于密文；回放不会改变窗口位置；切换部件不改变密码状态；批量输入与逐次按键结果相同。

历史原理来源：[Dirk Rijmenants 的 Enigma 技术说明](https://www.ciphermachinesandcryptology.com/en/enigmatech.htm)与 [Crypto Museum 接线资料](https://www.cryptomuseum.com/crypto/enigma/wiring.htm)，本次均已读取。它们适合核实史实和数据，不等于取得网站图片的再分发许可。

### 本次已实际执行的独立对拍

已从 PyPI 安装固定版本 **py-enigma 1.0.2** 到工作目录，仅调用其 `EnigmaMachine.key_press` 与 `get_display` 生成参考数据，没有使用本项目内核生成预期值。确定性种子为 923731，数据保存在 `src/core/reference-vectors.json`，版本、来源、PyPI 分发包 SHA-256 与实际参考源码 SHA-256 同时写入数据。

本次实际比较 **120 种配置**，覆盖 I–V 的全部 **60 种不重复三转子排列 × B/C 两种反射器**，变化的环设置与窗口位置，以及 **0–10 对**互不冲突的插线。每条输入 **728–1025 个字母**，累计 **105,240 个字母**；除完整密文与最终窗口外，还检查了 **4,851 个中间窗口状态**。这些独立轨迹包含 **190 次中间转子连续两次步进**。

已运行 `cross-reference.test.ts`，**121 项测试全部通过**（1 项数据覆盖检查、120 项配置对拍）。这为当前加密内核提供独立证据，三维外观与动画仍需浏览器验收。

## Enigma I 外壳与灯板资料核查

本轮实际读取了 [Crypto Museum 的 Enigma I 专页](https://www.cryptomuseum.com/crypto/enigma/i/index.htm)中部件说明、Interior、操作步骤与 Storage cases 等文字，以及相应图片说明。核实的结构事实包括：

- 机架为压铸轻合金；常见运输箱为橡木，机体固定在箱底。木箱前翻板用于接近插线板，与机体顶盖是不同部件。
- 开启机体顶盖才能接近转子组与灯板；合盖后通过窗口读取转子位置。页面还列出转子拨轮上方的铰链盖与弹簧保持夹。
- Enigma I 刻度环使用数字而非字母，步进缺口装在刻度环上；环设置调节刻度环与线芯的相对位置。
- 灯板是三行 26 个灯泡，与键盘顺序相同；字母薄片（letter-film）装在顶盖内。灯泡使用扁平玻璃外形及 E10 灯头，普通圆灯泡可能碰坏字母薄片。

据此，本轮模型分离木箱与空心金属机架，为转子井、灯板和键盘建立实际开孔；合罩保留三个读数窗与拨轮槽。整机数字刻度环随转子旋转，界面 A–Z 对应 01–26。灯板字母片接近平齐，灯泡和灯座置于其下；内部接线、跟随电流回放和转子／反射器检视时自动剖开罩壳。后者是帮助看清电路的教学交互，不是历史机器的自动机构。

供外观对照的原站图片链接如下，地址及说明已在专页核对。本次资料核查以正文和图片说明为依据，未进行实物尺寸测量，也未把图片下载到项目中：

- [Enigma I 顶视图](https://www.cryptomuseum.com/crypto/enigma/i/img/300002/073/full.jpg)
- [键盘与灯板](https://www.cryptomuseum.com/crypto/enigma/i/img/300002/075/full.jpg)
- [抬起转子盖](https://www.cryptomuseum.com/crypto/enigma/i/img/300002/028/full.jpg)
- [设置转子起始位置](https://www.cryptomuseum.com/crypto/enigma/i/img/300002/029/full.jpg)
- [箱盖与前翻板开启](https://www.cryptomuseum.com/crypto/enigma/i/img/300002/022/full.jpg)

这些资料支持部件层次与工作关系；没有提供本项目所需的完整制造尺寸。模型比例、窗口与孔槽尺寸、五金位置及内部净空是参考照片与文字的教学建模选择，**不是原厂测绘或制造级复刻**。自动剖切、空间展开与导线曲线也属于教学表达；电气正确性仍由独立密码学测试验证，不能由外观相似程度推断。

## 建模与后续验收边界

程序化模型的优势是所有触点、字母环、缺口、插线对都能够直接与密码数据绑定。线路的位置与颜色必须由该次轨迹推导，不能用固定装饰线冒充电路。可以同时提供整机、拆解、转子切面、26 触点接线图和单步回放。

不过，**正确的电气置换与博物馆级机械复原是两个需要分别验收的目标**。示意走线可以准确表达端点连接，但不意味着复制了某台历史实物内部导线的具体三维形状。棘爪、棘轮、按键连杆、弹簧和真实插头接点若尚未制作，应在界面说明中清楚区分，而不是将教学动画称为完整工程仿真。

首轮验收建议关注：默认视图是否有参考项目的精密器物感；插线板、转子和反射器是否容易进入检视；按一个字母是否能看清「步进—正向—反射—返回—点灯」；环设置和双步进是否有可重复例子；轨迹与输出能否通过独立数据验证。之后再按用户偏好增加材质磨损、木箱附件、机械联动、声音与更细的制造结构。

此文说明技术依据与核查结果；具体已完成功能、实际测试数量和运行方式，以同目录 README 和测试结果为准。
