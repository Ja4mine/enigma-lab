# 发布到 GitHub Pages

这个项目是纯前端静态网站。GitHub 保存源码，GitHub Actions 安装依赖、运行测试并生成 `dist/`，GitHub Pages 提供可公开访问的网页。无需购买服务器或运行后端。个人免费账号可用公开仓库发布；私有仓库的 Pages 支持取决于账号套餐，网页访问权限也应单独确认。

## 一、准备仓库

1. 登录 GitHub，选择右上角 **+ → New repository**。
2. 仓库名建议用 `enigma-lab`，选择 **Public**。
3. 如果准备按下面的终端方式上传，保持新仓库为空：暂不勾选 README、`.gitignore` 和 License。
4. 点击 **Create repository**，记下仓库地址，例如 `https://github.com/YOUR_USERNAME/enigma-lab.git`。

**仓库根目录应直接包含 `package.json`、`package-lock.json`、`index.html`、`src/`、`vite.config.ts` 和 `.github/workflows/deploy.yml`。** 如果使用源码压缩包，解压后进入 `enigma-lab` 文件夹，把里面的内容作为仓库根。不要把 ZIP 文件本身当成源码上传，也不要再包一层 `enigma-lab/` 或 `outputs/enigma-lab/`，否则默认工作流找不到构建文件。

## 二、上传源码

推荐使用 GitHub Desktop，或者使用终端。任选一种即可。

### GitHub Desktop

- 在 GitHub Desktop 中选择 **File → Add Local Repository**，指定本地 `enigma-lab` 项目文件夹。
- 如果提示它不是 Git 仓库，使用提示中的 **create a repository here**，确认最终目录仍是现有项目目录，并避免创建重复的内层 `enigma-lab/enigma-lab`。
- 提交项目文件，默认分支使用 `main`。
- 选择 **Publish repository**，仓库名使用 `enigma-lab`。使用免费公开 Pages 时取消勾选 **Keep this code private**。
- 使用这种方式时，可以让 Desktop 直接创建远端仓库，无需事先完成第一节的网页建仓步骤；若远端已创建，请配置为该远端后推送，避免创建重名仓库。

### 终端

在本地项目目录中运行下面的命令。把 `YOUR_USERNAME` 换成你的 GitHub 用户名，仓库名按实际情况替换。

```sh
git init -b main
git add .
git commit -m "Initial Enigma Lab website"
git remote add origin https://github.com/YOUR_USERNAME/enigma-lab.git
git push -u origin main
```

本次交付的项目目录是：

```text
/Users/chenyu/Documents/Codex/2026-10-01/https-github-com-lbeilc-rhinelabui-https/outputs/enigma-lab
```

这组命令适用于尚未初始化 Git、远端为空的情况；已有仓库时不用重复初始化或重新添加 `origin`。如果提示身份信息未设置，按 Git 提示设置提交者姓名和邮箱。GitHub 不接受账号密码作为 HTTPS 推送密码；可使用 GitHub Desktop 的登录流程或已经配置的 Git 凭证。

项目已有 `.gitignore`：`node_modules/`、`dist/` 和临时构建文件不会进入源码仓库。`.github/` 是隐藏文件夹，必须提交；macOS Finder 可用 `Command + Shift + .` 显示隐藏文件。

## 三、启用 Pages

1. 打开 GitHub 仓库，进入 **Settings → Pages**。
2. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 打开仓库 **Actions** 页，找到 **Deploy Enigma Lab to GitHub Pages**。
4. 首次推送可能早于 Pages 设置，因此可点 **Run workflow → main → Run workflow** 手动运行一次。若已有运行因 Pages 未启用而失败，启用后重新运行即可。
5. 等待 `build` 和 `deploy` 都变绿。首次通常需要几分钟，具体取决于 GitHub 队列。
6. 在部署记录或 **Settings → Pages** 点击网站地址。

仓库名为 `enigma-lab` 时，地址通常是：

```text
https://YOUR_USERNAME.github.io/enigma-lab/
```

如果创建的是特殊仓库 `YOUR_USERNAME.github.io`，地址通常是 `https://YOUR_USERNAME.github.io/`。本项目 Vite 的 `base: "./"` 可兼容这两种形式，无需硬编码用户名或仓库名。

## 四、以后更新

修改源码并提交、推送到 `main` 后，工作流会自动重新运行测试、构建和部署。测试或构建失败时不会执行后续部署，原有网页继续提供上一版。

GitHub Desktop 中使用 **Commit to main → Push origin**。终端中可使用：

```sh
git add .
git commit -m "Update Enigma Lab"
git push
```

## 常见问题

- **首次显示 404**：确认 Pages Source 为 GitHub Actions、工作流已成功，网址包含仓库名；发布后再稍等片刻。
- **Actions 找不到 package.json**：仓库多套了一层目录；按第一节把应用内容放在仓库根。
- **网页空白或资源 404**：确认部署的是 `dist/`，不是源码目录；保留 `vite.config.ts` 的相对资源路径配置。
- **Actions 找不到工作流**：确认 `.github/workflows/deploy.yml` 已上传到仓库根，且分支名为 `main`。文件夹名开头的点不能省略。
- **网页有旧版本**：检查最近一次部署是否成功，再刷新页面。Actions 失败详情可在失败步骤中查看。
- **手机三维性能较低**：这是 WebGL 模型渲染开销；静态托管不改变设备的图形性能，电路剖面仍可使用。

## 参考

- [GitHub Pages 官方入门](https://docs.github.com/en/pages/quickstart)
- [使用自定义 GitHub Actions 工作流发布 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Vite 静态部署说明](https://vite.dev/guide/static-deploy.html#github-pages)
