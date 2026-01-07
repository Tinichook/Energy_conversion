// Web Worker 用于后台优化计算
import { findOptimalSolutions } from './OptimizationEngine';

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  if (type === 'START_OPTIMIZATION') {
    const { region, config } = data;
    
    try {
      // 进度回调
      const onProgress = (progress: any) => {
        self.postMessage({
          type: 'PROGRESS_UPDATE',
          data: { progress }
        });
      };
      
      // 开始优化计算
      const solutions = await findOptimalSolutions(region, onProgress);
      
      // 发送完成结果
      self.postMessage({
        type: 'OPTIMIZATION_COMPLETE',
        data: { solutions }
      });
      
    } catch (error) {
      self.postMessage({
        type: 'OPTIMIZATION_ERROR',
        data: { error: error.message }
      });
    }
  }
};