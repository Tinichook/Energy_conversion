// Web Worker 管理器
export class WorkerManager {
  private worker: Worker | null = null;
  private onProgress?: (progress: number) => void;
  private onComplete?: (results: any) => void;
  private onError?: (error: string) => void;

  constructor() {
    // 检查浏览器是否支持 Web Workers
    if (typeof Worker !== 'undefined') {
      try {
        // 创建 Web Worker
        this.worker = new Worker(
          new URL('./optimizationWorker.ts', import.meta.url),
          { type: 'module' }
        );
        
        // 监听 Worker 消息
        this.worker.onmessage = (e) => {
          const { type, data } = e.data;
          
          switch (type) {
            case 'PROGRESS_UPDATE':
              this.onProgress?.(data.progress);
              break;
            case 'OPTIMIZATION_COMPLETE':
              this.onComplete?.(data.results);
              break;
            case 'OPTIMIZATION_ERROR':
              this.onError?.(data.error);
              break;
          }
        };
        
        this.worker.onerror = (error) => {
          this.onError?.(`Worker 错误: ${error.message}`);
        };
        
      } catch (error) {
        console.warn('Web Worker 创建失败，将使用主线程计算:', error);
        this.worker = null;
      }
    }
  }

  // 开始优化计算
  startOptimization(
    cities: any[], 
    config: any,
    onProgress: (progress: number) => void,
    onComplete: (results: any) => void,
    onError: (error: string) => void
  ) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    if (this.worker) {
      // 使用 Web Worker
      this.worker.postMessage({
        type: 'START_OPTIMIZATION',
        data: { cities, config }
      });
    } else {
      // 降级到主线程（会被页面切换影响）
      this.onError('Web Worker 不可用，请保持页面活跃状态');
    }
  }

  // 停止计算
  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // 检查是否支持后台计算
  isBackgroundSupported(): boolean {
    return this.worker !== null;
  }
}

// 单例实例
export const workerManager = new WorkerManager();