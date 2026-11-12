# 舒尔特方格

一个纯 HTML / CSS / JavaScript 实现的舒尔特方格训练页面，无需构建、无外部依赖，可直接部署到任意静态 Web 服务器。

## 功能

- 默认 5 × 5，可切换 6 × 6、7 × 7、8 × 8
- 按 1 → N² 的顺序点击数字，自动计时并统计错误
- 暂停时遮挡数字；切换到其他标签页会自动暂停
- 完成后显示用时、错误数，并保存该尺寸的最佳成绩
- 成绩保存在浏览器 `localStorage`，刷新页面后仍然保留
- 响应式布局，支持键盘操作、系统深色模式和减弱动效设置

## 文件

```text
.
├── index.html   # 页面结构
├── styles.css   # 样式
├── app.js       # 交互逻辑
└── README.md
```

## 本地预览

任选一种静态服务器即可，例如使用 Python 启动一个临时服务器：

```bash
python3 -m http.server 1314
```

然后访问 <http://localhost:1314>。

## 部署到 nginx

把三个静态文件复制到服务器目录：

```bash
sudo mkdir -p /var/www/schulte
sudo cp index.html styles.css app.js /var/www/schulte/
```

添加站点配置（路径按实际情况调整）：

```nginx
server {
    listen 80;
    server_name schulte.example.com;

    root /var/www/schulte;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(?:css|js)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

启用配置并重载 nginx：

```bash
sudo ln -s /etc/nginx/sites-available/schulte /etc/nginx/sites-enabled/schulte
sudo nginx -t
sudo systemctl reload nginx
```

页面内所有资源均使用相对路径。

## 数据说明

最佳成绩存储在浏览器本地，键名为 `schulte-table.best.v1`；所选尺寸存储在 `schulte-table.size.v1`。清理浏览器站点数据会同时清除记录，不会向服务器发送任何数据。
