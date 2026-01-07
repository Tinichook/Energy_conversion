import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：提供API保存配置到JSON文件
    {
      name: 'save-config-api',
      configureServer(server) {
        server.middlewares.use('/api/save-config', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const configPath = path.resolve(__dirname, 'src/regionConfigs.json');
                // 验证JSON格式
                JSON.parse(body);
                fs.writeFileSync(configPath, body, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '配置已保存到文件' }));
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '保存失败: ' + e }));
              }
            });
          } else {
            res.writeHead(405);
            res.end('Method Not Allowed');
          }
        });
      }
    }
  ],
  // 支持 Web Workers
  worker: {
    format: 'es'
  },
  // 优化构建
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'optimization-worker': ['./src/optimizationWorker.ts']
        }
      }
    }
  }
})
