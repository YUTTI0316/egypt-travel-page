#!/usr/bin/env bash
# 埃及旅行网页 · 本地推送脚本（macOS / Linux / Windows Git Bash 通用）
# 用法：
#   1. 先在 GitHub 网页新建一个空仓库，不要勾选 README / .gitignore / license
#   2. 把下面两行的 <你的用户名> 和仓库名改成你的
#   3. 在本目录执行：bash push-to-pages.sh

set -e

# ===== 按你的实际情况修改 =====
GITHUB_USER="<你的用户名>"
REPO_NAME="egypt-travel-page"
# ==============================

echo "→ 仓库地址：https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

# 若远端已存在则先移除，避免重复添加
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
git branch -M main
git add -A
git commit -m "埃及 13 天旅行攻略网页" || true
git push -u origin main

echo ""
echo "✅ 推送完成。接下来在 GitHub 开启 Pages："
echo "   仓库 → Settings → Pages → Source: Deploy from a branch"
echo "   Branch: main / (root) → Save"
echo "   访问地址：https://${GITHUB_USER}.github.io/${REPO_NAME}/"
