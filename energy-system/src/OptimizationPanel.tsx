import React, { useState, useEffect } from 'react';
import { X, Play, Square, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface OptimizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: any;
  theme: 'dark' | 'light';
}

interface OptimizationState {
  isRunning: boolean;
  progress: number;
  phase: string;
  feasibleCount: number;
  bestCost: number;
  results: any[] | null;
  error: string | null;
  startTime: number | null;
}

const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  isOpen,
  onClose,
  selectedCity,
  theme
}) => {
  const [state, setState] = useState<OptimizationState>({
    isRunning: false,
    progress: 0,
    phase: '准备中...',
    feasibleCount: 0,
    bestCost: 0,
    results: null,
    error: null,
    startTime: null
  });

  const [showBackgroundWarning, setShowBackgroundWarning] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      if (!visible && state.isRunning) {
        setShowBackgroundWarning(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isRunning]);

  const startOptimization = () => {
    if (!selectedCity) {
      setState(prev => ({ ...prev, error: '请先选择一个区域' }));
      return;
    }

    setState(prev => ({
      ...prev,
      isRunning: true,
      progress: 0,
      phase: '初始化优化引擎...',
      feasibleCount: 0,
      bestCost: 0,
      results: null,
      error: null,
      startTime: Date.now()
    }));

    // 模拟优化过程（实际应该调用 Web Worker）
    // 这里先用简单的模拟，后续可以集成真正的优化引擎
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setState(prev => ({
          ...prev,
          isRunning: false,
          progress: 100,
          phase: '优化完成',
          results: [
            { score: { total: 85.5 }, totalCost: 12500, simulation: { reliability: 98.5 } },
            { score: { total: 82.3 }, totalCost: 11800, simulation: { reliability: 97.2 } },
            { score: { total: 80.1 }, totalCost: 10500, simulation: { reliability: 96.8 } },
          ]
        }));
      } else {
        setState(prev => ({
          ...prev,
          progress,
          phase: progress < 30 ? '搜索可行解...' : progress < 70 ? '优化求解中...' : '评估方案...',
          feasibleCount: Math.floor(progress / 10),
          bestCost: 15000 - progress * 30
        }));
      }
    }, 200);

    // 保存 interval ID 以便停止
    (window as any).__optimizationInterval = interval;
  };

  const stopOptimization = () => {
    if ((window as any).__optimizationInterval) {
      clearInterval((window as any).__optimizationInterval);
    }
    setState(prev => ({
      ...prev,
      isRunning: false,
      phase: '已停止'
    }));
  };

  const formatDuration = (startTime: number) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 页面状态（用于调试）
  console.debug('页面状态:', isPageVisible ? '活跃' : '后台');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        {/* 标题栏 */}
        <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border-b px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                优化求解引擎
              </h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {selectedCity ? `${selectedCity.name} (${selectedCity.type})` : '未选择区域'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-80px)] overflow-y-auto">
          
          {/* 后台运行警告 */}
          {showBackgroundWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-600 dark:text-yellow-400">页面已切换到后台</h3>
                <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                  计算可能会暂停或变慢，建议保持此页面活跃状态。
                </p>
                <button
                  onClick={() => setShowBackgroundWarning(false)}
                  className="text-sm text-yellow-600 dark:text-yellow-400 underline mt-2"
                >
                  我知道了
                </button>
              </div>
            </div>
          )}

          {/* 控制面板 */}
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                优化控制
              </h3>
              <div className="flex items-center gap-2">
                {state.startTime && state.isRunning && (
                  <div className={`flex items-center gap-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(state.startTime)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startOptimization}
                disabled={state.isRunning || !selectedCity}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                开始优化
              </button>
              
              <button
                onClick={stopOptimization}
                disabled={!state.isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                停止计算
              </button>
            </div>
          </div>

          {/* 进度显示 */}
          {(state.isRunning || state.results || state.error) && (
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-4`}>
              <h3 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                计算状态
              </h3>
              
              {state.isRunning && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                      {state.phase}
                    </span>
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                      {state.progress.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className={`w-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>可行方案：</span>
                      <span className={`ml-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {state.feasibleCount}
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>最优成本：</span>
                      <span className={`ml-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {state.bestCost.toFixed(0)} 万元
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {state.error && (
                <div className="flex items-start gap-3 text-red-500">
                  <AlertTriangle className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">计算出错</p>
                    <p className="text-sm mt-1">{state.error}</p>
                  </div>
                </div>
              )}

              {state.results && !state.isRunning && (
                <div className="flex items-start gap-3 text-green-500">
                  <CheckCircle className="w-5 h-5 mt-0.5" />
                  <div>
                    <p className="font-medium">优化完成</p>
                    <p className="text-sm mt-1">找到 {state.results.length} 个可行方案</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 结果展示 */}
          {state.results && !state.isRunning && (
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-4`}>
              <h3 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                优化结果（前5个方案）
              </h3>
              
              <div className="space-y-2">
                {state.results.slice(0, 5).map((solution, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        方案 {idx + 1}
                      </span>
                      <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        评分: {solution.score?.total?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      总投资: {solution.totalCost?.toFixed(0) || 'N/A'} 万元 | 
                      可靠率: {solution.simulation?.reliability?.toFixed(2) || 'N/A'}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizationPanel;