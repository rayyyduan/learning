# 学习工作区：本地预览、构建、部署（Node + Vite，首次运行会自动 pnpm install）
#   make serve                                   开发服务器（实时渲染 + 自动刷新）
#   make build                                   生成纯静态的 site/（含搜索索引）
#   make deploy DEPLOY_TARGET=user@host:/path    构建并用 rsync 上传

PORT ?= 8080
DEPLOY_TARGET ?=

.PHONY: serve build deploy

node_modules: package.json pnpm-lock.yaml
	pnpm install --frozen-lockfile
	@touch node_modules

serve: node_modules
	PORT=$(PORT) pnpm dev

build: node_modules
	pnpm build

deploy: build
	@test -n "$(DEPLOY_TARGET)" || { echo "请先指定部署目标，例如：make deploy DEPLOY_TARGET=user@host:/var/www/learning" >&2; exit 1; }
	rsync -avz --delete site/ "$(DEPLOY_TARGET)"
