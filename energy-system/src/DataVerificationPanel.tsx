import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Play,
  Download,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Battery,
  Sun,
  Wind,
  Leaf,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  Upload,
  Users,
  ArrowRight,
  Minimize2,
  Square,
} from 'lucide-react';
import { City, CityType, getCurrentStudentId, getStudentRegionMultiplier } from './DataSetting';
import {
  Solution,
  BiomassRoute,
  StudentConfig,
  findOptimalSolutions,
  saveSolutions,
  loadRegionSolutions,
  exportSolutionsToJSON,
  importSolutionsFromJSON,
  evaluateStudentSolution,
  recommendBiomassRoutes,
  estimateSearchRanges,
  OptimizationProgress,
  HourlyData,
  CancelSignal,
  // 小组联合求解相关
  GroupType,
  GroupSolution,
  GROUP_DEFINITIONS,
  findGroupOptimalSolutions,
  saveGroupSolution,
  loadGroupSolution,
  getGroupRegions,
} from './OptimizationEngine';
import {
  SOLAR_PANELS,
  WIND_TURBINES,
  DIRECT_COMBUSTION_BOILERS,
  GASIFIERS,
  ANAEROBIC_DIGESTERS,
  GAS_ENGINES,
  STEAM_TURBINES,
  BATTERIES,
  INVERTERS,
} from './EquipmentData';

// ============================================
// 基础参数配置（按区域类型）
// 实际显示时会根据学号产生5-10%的波动
// ============================================
const BASE_REGION_STATS: Record<CityType, { dailyLoad: number; peakLoad: number; dailyBiomass: number }> = {
  '工业区': { dailyLoad: 1320, peakLoad: 65, dailyBiomass: 60 },
  '居民区': { dailyLoad: 660, peakLoad: 35, dailyBiomass: 80 },
  '山地区': { dailyLoad: 120, peakLoad: 8, dailyBiomass: 30 },
  '农业区': { dailyLoad: 240, peakLoad: 12, dailyBiomass: 163 },  // (100*9 + 350*3)/12 ≈ 163
  '林业区': { dailyLoad: 72, peakLoad: 4, dailyBiomass: 150 },
  '测试区': { dailyLoad: 480, peakLoad: 20, dailyBiomass: 100 },
};

// 根据区域动态计算统计数据（应用学号波动系数）
// 可以传入指定学号，用于管理员查看特定学生的数据
function getRegionStatsWithStudent(region: City, studentId: string) {
  const base = BASE_REGION_STATS[region.type] || { dailyLoad: 240, peakLoad: 12, dailyBiomass: 100 };
  const multiplier = getStudentRegionMultiplier(studentId, region.id);
  
  return {
    dailyLoad: Math.round(base.dailyLoad * multiplier),
    peakLoad: Math.round(base.peakLoad * multiplier * 10) / 10,
    dailyBiomass: Math.round(base.dailyBiomass * multiplier)
  };
}

// 兼容函数：使用当前登录学号（用于小组联合等不需要指定学号的场景）
function getRegionStats(region: City) {
  return getRegionStatsWithStudent(region, getCurrentStudentId());
}

interface DataVerificationPanelProps {
  onClose: () => void;
  cities: City[];
  theme?: 'dark' | 'light';
}

type TabType = 'optimize' | 'evaluate' | 'results' | 'charts' | 'group';

export default function DataVerificationPanel({ onClose, cities, theme = 'dark' }: DataVerificationPanelProps) {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('optimize');
  const [selectedRegionId, setSelectedRegionId] = useState<number>(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);  // 最小化状态
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  
  // 取消信号引用 - 用于暂停优化
  const cancelSignalRef = useRef<CancelSignal>({ cancelled: false });
  
  // 管理员查看的学号（用于模拟学生数据）
  const [viewStudentId, setViewStudentId] = useState<string>('20234700');
  
  // 学生配置输入
  const [studentConfig, setStudentConfig] = useState<StudentConfig>({
    regionId: 1,
    wind: [],
    solar: [],
    biomassRoute: '直燃',
    biomassPrimary: { model: '', count: 0 },
    biomassSecondary: { model: '', count: 0 },
    battery: [],
    inverter: []
  });
  const [evaluationResult, setEvaluationResult] = useState<Solution | null>(null);

  const selectedRegion = useMemo(() => 
    cities.find(c => c.id === selectedRegionId), 
    [cities, selectedRegionId]
  );
  
  // 根据选择的学号计算区域统计数据
  const regionStats = useMemo(() => {
    if (!selectedRegion) return null;
    return getRegionStatsWithStudent(selectedRegion, viewStudentId);
  }, [selectedRegion, viewStudentId]);

  // 加载已存储的解决方案
  useEffect(() => {
    if (selectedRegionId) {
      const stored = loadRegionSolutions(selectedRegionId);
      setSolutions(stored);
      if (stored.length > 0) {
        setSelectedSolution(stored[0]);
      }
    }
  }, [selectedRegionId]);

  // 运行优化
  const handleOptimize = async () => {
    if (!selectedRegion) return;
    
    setIsOptimizing(true);
    setProgress(null);
    setSolutions([]);  // 清空之前的方案
    // 重置取消信号
    cancelSignalRef.current = { cancelled: false };
    
    try {
      const results = await findOptimalSolutions(selectedRegion, (p) => {
        setProgress(p);
        // 实时更新当前已找到的方案（用于暂停时获取）
        if (p.currentSolutions && p.currentSolutions.length > 0) {
          setSolutions(p.currentSolutions);
        }
      }, cancelSignalRef.current);
      
      setSolutions(results);
      saveSolutions(selectedRegionId, results);
      
      if (results.length > 0) {
        setSelectedSolution(results[0]);
      }
    } catch (e) {
      console.error('优化失败:', e);
    } finally {
      setIsOptimizing(false);
    }
  };
  
  // 暂停优化并使用当前结果
  const handleStopOptimize = () => {
    cancelSignalRef.current.cancelled = true;
    // 保存当前已找到的方案
    if (solutions.length > 0) {
      saveSolutions(selectedRegionId, solutions);
      if (!selectedSolution && solutions.length > 0) {
        setSelectedSolution(solutions[0]);
      }
    }
  };

  // 评估学生方案
  const handleEvaluate = () => {
    if (!selectedRegion) return;
    
    const config = { ...studentConfig, regionId: selectedRegionId };
    const result = evaluateStudentSolution(config, selectedRegion);
    setEvaluationResult(result);
  };

  // 导出数据
  const handleExportCSV = (data: HourlyData[]) => {
    const headers = ['小时', '风电(MW)', '光伏(MW)', '生物质(MW)', '总发电(MW)', '负荷(MW)', '平衡(MW)', 'SOC(%)', '充放电(MW)', '弃电(MW)', '缺电(MW)'];
    const rows = data.map((d, i) => [
      i, d.windPower.toFixed(2), d.solarPower.toFixed(2), d.biomassPower.toFixed(2),
      d.totalGeneration.toFixed(2), d.load.toFixed(2), d.balance.toFixed(2),
      d.batterySOC.toFixed(1), d.batteryCharge.toFixed(2), d.curtailment.toFixed(2), d.shortage.toFixed(2)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `仿真数据_区域${selectedRegionId}.csv`;
    link.click();
  };

  // 导出所有解决方案
  const handleExportAllSolutions = () => {
    const json = exportSolutionsToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '所有区域最优解.json';
    link.click();
  };

  // 导入解决方案
  const handleImportSolutions = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          if (importSolutionsFromJSON(json)) {
            const stored = loadRegionSolutions(selectedRegionId);
            setSolutions(stored);
            alert('导入成功！');
          } else {
            alert('导入失败，请检查文件格式');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const tabs = [
    { id: 'optimize', name: '优化求解', icon: Play },
    { id: 'evaluate', name: '方案评估', icon: CheckCircle },
    { id: 'results', name: '结果列表', icon: BarChart3 },
    { id: 'charts', name: '可视化', icon: TrendingUp },
    { id: 'group', name: '小组联合', icon: Users },
  ];

  return (
    <>
      {/* 最小化时显示的浮动进度条 */}
      {isMinimized && (
        <div 
          className={`fixed bottom-4 right-4 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'} border rounded-xl shadow-2xl p-4 z-50 ${isDark ? 'hover:border-purple-500' : 'hover:border-purple-400'} transition-all`}
        >
          <div 
            className="flex items-center gap-3 mb-2 cursor-pointer"
            onClick={() => setIsMinimized(false)}
          >
            <BarChart3 className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>数据核对系统</span>
            {isOptimizing && <Loader2 className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'} animate-spin`} />}
          </div>
          {isOptimizing && progress && (
            <div className="w-64">
              <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2 mb-2`}>
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()}</span>
                <span>可靠率{progress.bestReliability?.toFixed(1) || 0}%</span>
              </div>
              {/* 暂停按钮 */}
              {progress.feasibleCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStopOptimize();
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-500 text-white transition-all"
                >
                  <Square className="w-3 h-3" />
                  暂停 (已找到{progress.feasibleCount}个方案)
                </button>
              )}
            </div>
          )}
          {!isOptimizing && (
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>点击展开</div>
          )}
        </div>
      )}

      {/* 主面板 */}
      {!isMinimized && (
        <div className={`fixed inset-0 ${isDark ? 'bg-black/80' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center z-50 p-4`}>
          <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'} border rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden`}>
            {/* 标题栏 */}
            <div className={`${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-100 border-gray-200'} px-6 py-4 flex justify-between items-center border-b`}>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-3`}>
                <BarChart3 className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                数据核对系统
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} font-normal ml-2`}>仅管理员可见</span>
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportAllSolutions}
                  className={`px-3 py-1.5 ${isDark ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} rounded-lg text-sm flex items-center gap-1`}
                >
              <Download className="w-4 h-4" /> 导出全部
            </button>
            <button
              onClick={handleImportSolutions}
              className={`px-3 py-1.5 ${isDark ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-lg text-sm flex items-center gap-1`}
            >
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button 
              onClick={() => setIsMinimized(true)} 
              className={`${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'} p-2 rounded-lg`}
              title="最小化"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'} p-2 rounded-lg`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：区域选择和Tab */}
          <div className={`w-56 ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-200'} border-r p-4 flex flex-col`}>
            {/* 区域选择 */}
            <div className="mb-4">
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1 block`}>选择区域</label>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(Number(e.target.value))}
                className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 text-sm`}
              >
                {cities.map(city => (
                  <option key={city.id} value={city.id}>
                    {city.name} ({city.type})
                  </option>
                ))}
              </select>
            </div>
            
            {/* 学号输入（用于查看特定学生的数据） */}
            <div className="mb-4">
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1 block`}>查看学号</label>
              <input
                type="text"
                value={viewStudentId}
                onChange={(e) => setViewStudentId(e.target.value)}
                placeholder="输入学号查看数据"
                className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 text-sm`}
              />
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                波动系数: {(getStudentRegionMultiplier(viewStudentId, selectedRegionId) * 100 - 100).toFixed(1)}%
              </div>
            </div>

            {/* 区域信息 */}
            {selectedRegion && regionStats && (
                <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3 mb-4 text-xs space-y-1`}>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>日用电:</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>{regionStats.dailyLoad.toFixed(0)} MWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>峰值负荷:</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>{regionStats.peakLoad.toFixed(1)} MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>生物质:</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>{regionStats.dailyBiomass.toFixed(0)} t/d</span>
                  </div>
                </div>
            )}

            {/* Tab导航 */}
            <div className="flex-1 flex flex-col gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : isDark 
                        ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm">{tab.name}</span>
                </button>
              ))}
            </div>

            {/* 已存储方案数 */}
            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'} text-xs`}>
              已存储 {solutions.length} 个可行方案
            </div>
          </div>

          {/* 右侧：内容区 */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'optimize' && (
              <OptimizeTab
                region={selectedRegion}
                isOptimizing={isOptimizing}
                progress={progress}
                solutions={solutions}
                onOptimize={handleOptimize}
                onStopOptimize={handleStopOptimize}
                viewStudentId={viewStudentId}
                theme={theme}
              />
            )}
            {activeTab === 'evaluate' && (
              <EvaluateTab
                region={selectedRegion}
                studentConfig={studentConfig}
                setStudentConfig={setStudentConfig}
                evaluationResult={evaluationResult}
                onEvaluate={handleEvaluate}
                theme={theme}
              />
            )}
            {activeTab === 'results' && (
              <ResultsTab
                solutions={solutions}
                selectedSolution={selectedSolution}
                onSelectSolution={setSelectedSolution}
                theme={theme}
              />
            )}
            {activeTab === 'charts' && (
              <ChartsTab
                solution={selectedSolution}
                onExportCSV={handleExportCSV}
                theme={theme}
              />
            )}
            {activeTab === 'group' && (
              <GroupTab cities={cities} theme={theme} />
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
}


// ============================================
// 优化求解Tab
// ============================================

function OptimizeTab({ 
  region, 
  isOptimizing, 
  progress, 
  solutions,
  onOptimize,
  onStopOptimize,
  viewStudentId,
  theme = 'dark'
}: {
  region: City | undefined;
  isOptimizing: boolean;
  progress: OptimizationProgress | null;
  solutions: Solution[];
  onOptimize: () => void;
  onStopOptimize: () => void;
  viewStudentId: string;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';
  if (!region) return <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>请选择区域</div>;

  const biomassRoutes = recommendBiomassRoutes(region);
  const ranges = estimateSearchRanges(region);
  const stats = getRegionStatsWithStudent(region, viewStudentId);

  return (
    <div className="space-y-6">
      {/* 区域分析 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
          <Zap className="w-5 h-5 text-yellow-400" />
          区域资源分析
        </h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className={`${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-blue-400">{stats.dailyLoad.toFixed(0)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>日用电量 MWh</div>
          </div>
          <div className={`${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-yellow-400">{stats.peakLoad.toFixed(1)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>峰值负荷 MW</div>
          </div>
          <div className={`${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-green-400">{stats.dailyBiomass.toFixed(0)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>生物质 t/d</div>
          </div>
        </div>

        {/* 生物质路线推荐 */}
        <div className="mb-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>推荐生物质路线</div>
          <div className="flex gap-2">
            {biomassRoutes.map((route, i) => (
              <div 
                key={route.route}
                className={`flex-1 p-2 rounded-lg border ${
                  i === 0 
                    ? isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                    : isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${i === 0 ? 'text-green-400' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {route.route}
                  </span>
                  <span className={`text-sm ${i === 0 ? 'text-green-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {route.score}分
                  </span>
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{route.reason}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 搜索范围 */}
        <div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>搜索范围估算</div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded p-2`}>
              <div className="text-blue-400 font-medium">风电</div>
              <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{ranges.wind.min}-{ranges.wind.max.toFixed(1)} MW</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>步长 {ranges.wind.step}</div>
            </div>
            <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded p-2`}>
              <div className="text-yellow-400 font-medium">光伏</div>
              <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{ranges.solar.min}-{ranges.solar.max.toFixed(1)} MW</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>步长 {ranges.solar.step}</div>
            </div>
            <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded p-2`}>
              <div className="text-green-400 font-medium">生物质</div>
              <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{ranges.biomass.min}-{ranges.biomass.max.toFixed(1)} MW</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>步长 {ranges.biomass.step}</div>
            </div>
            <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded p-2`}>
              <div className="text-purple-400 font-medium">储能</div>
              <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{ranges.battery.min.toFixed(0)}-{ranges.battery.max.toFixed(0)} MWh</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>步长 {ranges.battery.step.toFixed(0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 优化控制 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>开始优化</h3>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-4`}>
          基于全年8760小时仿真，遍历所有设备组合，找出满足供电可靠性的最优方案
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              isOptimizing
                ? isDark ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                优化中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始遍历求解（8760小时仿真）
              </>
            )}
          </button>
          
          {/* 暂停按钮 - 仅在优化中显示 */}
          {isOptimizing && (
            <button
              onClick={onStopOptimize}
              className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-orange-600 hover:bg-orange-500 text-white"
              title="暂停优化并使用当前已找到的方案"
            >
              <Square className="w-5 h-5" />
              暂停
            </button>
          )}
        </div>

        {/* 进度显示 */}
        {progress && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{progress.phase}</span>
              <span className={isDark ? 'text-white' : 'text-gray-900'}>
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
              </span>
            </div>
            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <span>可行方案: {progress.feasibleCount}</span>
              <span>最优: 可靠率{progress.bestReliability?.toFixed(1) || 0}% | 成本¥{progress.bestCost.toFixed(0)}万</span>
            </div>
            
            {/* 暂停提示 */}
            {isOptimizing && progress.feasibleCount > 0 && (
              <div className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'} mt-2`}>
                💡 已找到 {progress.feasibleCount} 个可行方案，可点击"暂停"使用当前结果
              </div>
            )}
          </div>
        )}

        {/* 结果摘要 */}
        {solutions.length > 0 && !isOptimizing && (
          <div className={`mt-4 p-3 ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg`}>
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">优化完成</span>
            </div>
            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              找到 {solutions.length} 个可行方案，最优成本 ¥{solutions[0]?.totalCost.toFixed(0)}万
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 方案评估Tab
// ============================================

function EvaluateTab({
  region,
  studentConfig,
  setStudentConfig,
  evaluationResult,
  onEvaluate,
  theme = 'dark'
}: {
  region: City | undefined;
  studentConfig: StudentConfig;
  setStudentConfig: (config: StudentConfig) => void;
  evaluationResult: Solution | null;
  onEvaluate: () => void;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';
  if (!region) return <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>请选择区域</div>;

  const [expandedSection, setExpandedSection] = useState<string>('wind');

  const updateConfig = (key: keyof StudentConfig, value: any) => {
    setStudentConfig({ ...studentConfig, [key]: value });
  };

  const addEquipment = (key: 'wind' | 'solar' | 'battery' | 'inverter', model: string) => {
    const current = studentConfig[key];
    const existing = current.find(e => e.model === model);
    if (existing) {
      updateConfig(key, current.map(e => 
        e.model === model ? { ...e, count: e.count + 1 } : e
      ));
    } else {
      updateConfig(key, [...current, { model, count: 1 }]);
    }
  };

  const removeEquipment = (key: 'wind' | 'solar' | 'battery' | 'inverter', model: string) => {
    const current = studentConfig[key];
    const existing = current.find(e => e.model === model);
    if (existing && existing.count > 1) {
      updateConfig(key, current.map(e => 
        e.model === model ? { ...e, count: e.count - 1 } : e
      ));
    } else {
      updateConfig(key, current.filter(e => e.model !== model));
    }
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
      className={`w-full flex items-center justify-between p-3 ${isDark ? 'bg-gray-700/30 hover:bg-gray-700/50' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</span>
      </div>
      {expandedSection === id ? <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /> : <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />}
    </button>
  );

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>输入学生设计方案</h3>

      {/* 风机选型 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
        <SectionHeader id="wind" title="风机选型" icon={Wind} />
        {expandedSection === 'wind' && (
          <div className="p-4 space-y-2">
            {WIND_TURBINES.map(turbine => (
              <div key={turbine.id} className={`flex items-center justify-between p-2 ${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded`}>
                <div>
                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{turbine.model}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{turbine.manufacturer} · {turbine.ratedPower}kW</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeEquipment('wind', turbine.model)}
                    className="w-6 h-6 bg-red-500/20 text-red-400 rounded flex items-center justify-center"
                  >-</button>
                  <input
                    type="number"
                    value={studentConfig.wind.find(w => w.model === turbine.model)?.count || 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      const current = studentConfig.wind.filter(w => w.model !== turbine.model);
                      if (count > 0) {
                        updateConfig('wind', [...current, { model: turbine.model, count }]);
                      } else {
                        updateConfig('wind', current);
                      }
                    }}
                    className={`w-16 text-center ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1 text-sm`}
                  />
                  <button
                    onClick={() => addEquipment('wind', turbine.model)}
                    className="w-6 h-6 bg-green-500/20 text-green-400 rounded flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 光伏选型 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
        <SectionHeader id="solar" title="光伏选型" icon={Sun} />
        {expandedSection === 'solar' && (
          <div className="p-4 space-y-2">
            {SOLAR_PANELS.map(panel => (
              <div key={panel.id} className={`flex items-center justify-between p-2 ${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded`}>
                <div>
                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{panel.model}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{panel.manufacturer} · {panel.power}Wp</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeEquipment('solar', panel.model)}
                    className="w-6 h-6 bg-red-500/20 text-red-400 rounded flex items-center justify-center"
                  >-</button>
                  <input
                    type="number"
                    value={studentConfig.solar.find(s => s.model === panel.model)?.count || 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      const current = studentConfig.solar.filter(s => s.model !== panel.model);
                      if (count > 0) {
                        updateConfig('solar', [...current, { model: panel.model, count }]);
                      } else {
                        updateConfig('solar', current);
                      }
                    }}
                    className={`w-16 text-center ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1 text-sm`}
                  />
                  <button
                    onClick={() => addEquipment('solar', panel.model)}
                    className="w-6 h-6 bg-green-500/20 text-green-400 rounded flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 生物质路线 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
        <SectionHeader id="biomass" title="生物质设备" icon={Leaf} />
        {expandedSection === 'biomass' && (
          <div className="p-4 space-y-4">
            {/* 路线选择 */}
            <div>
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1 block`}>技术路线</label>
              <div className="flex gap-2">
                {(['直燃', '气化', '沼气'] as BiomassRoute[]).map(route => (
                  <button
                    key={route}
                    onClick={() => updateConfig('biomassRoute', route)}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      studentConfig.biomassRoute === route
                        ? 'bg-green-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {route}
                  </button>
                ))}
              </div>
            </div>

            {/* 主设备选择 */}
            <div>
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1 block`}>
                {studentConfig.biomassRoute === '直燃' ? '锅炉' : 
                 studentConfig.biomassRoute === '气化' ? '气化炉' : '发酵罐'}
              </label>
              <select
                value={studentConfig.biomassPrimary.model}
                onChange={(e) => updateConfig('biomassPrimary', { model: e.target.value, count: 1 })}
                className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 text-sm`}
              >
                <option value="">请选择</option>
                {studentConfig.biomassRoute === '直燃' && DIRECT_COMBUSTION_BOILERS.map(b => (
                  <option key={b.id} value={b.model}>{b.model} - {b.manufacturer}</option>
                ))}
                {studentConfig.biomassRoute === '气化' && GASIFIERS.map(g => (
                  <option key={g.id} value={g.model}>{g.model} - {g.manufacturer}</option>
                ))}
                {studentConfig.biomassRoute === '沼气' && ANAEROBIC_DIGESTERS.map(d => (
                  <option key={d.id} value={d.model}>{d.model} - {d.manufacturer}</option>
                ))}
              </select>
            </div>

            {/* 发电设备选择 */}
            <div>
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1 block`}>
                {studentConfig.biomassRoute === '直燃' ? '汽轮机' : '发电机'}
              </label>
              <select
                value={studentConfig.biomassSecondary.model}
                onChange={(e) => updateConfig('biomassSecondary', { model: e.target.value, count: 1 })}
                className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg px-3 py-2 text-sm`}
              >
                <option value="">请选择</option>
                {studentConfig.biomassRoute === '直燃' && STEAM_TURBINES.map(t => (
                  <option key={t.id} value={t.model}>{t.model} - {t.ratedPower}MW</option>
                ))}
                {studentConfig.biomassRoute === '气化' && GAS_ENGINES.filter(e => e.fuelType === '燃气').map(e => (
                  <option key={e.id} value={e.model}>{e.model} - {e.ratedPower}kW</option>
                ))}
                {studentConfig.biomassRoute === '沼气' && GAS_ENGINES.filter(e => e.fuelType === '沼气').map(e => (
                  <option key={e.id} value={e.model}>{e.model} - {e.ratedPower}kW</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 储能选型 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
        <SectionHeader id="battery" title="储能电池" icon={Battery} />
        {expandedSection === 'battery' && (
          <div className="p-4 space-y-2">
            {BATTERIES.map(battery => (
              <div key={battery.id} className={`flex items-center justify-between p-2 ${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded`}>
                <div>
                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{battery.model}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{battery.manufacturer} · {battery.energyCapacity}kWh</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeEquipment('battery', battery.model)}
                    className="w-6 h-6 bg-red-500/20 text-red-400 rounded flex items-center justify-center"
                  >-</button>
                  <input
                    type="number"
                    value={studentConfig.battery.find(b => b.model === battery.model)?.count || 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      const current = studentConfig.battery.filter(b => b.model !== battery.model);
                      if (count > 0) {
                        updateConfig('battery', [...current, { model: battery.model, count }]);
                      } else {
                        updateConfig('battery', current);
                      }
                    }}
                    className={`w-16 text-center ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1 text-sm`}
                  />
                  <button
                    onClick={() => addEquipment('battery', battery.model)}
                    className="w-6 h-6 bg-green-500/20 text-green-400 rounded flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 逆变器选型 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl overflow-hidden`}>
        <SectionHeader id="inverter" title="逆变器" icon={Zap} />
        {expandedSection === 'inverter' && (
          <div className="p-4 space-y-2">
            {INVERTERS.map(inverter => (
              <div key={inverter.id} className={`flex items-center justify-between p-2 ${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded`}>
                <div>
                  <div className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{inverter.model}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{inverter.manufacturer} · {inverter.ratedPower}kW</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeEquipment('inverter', inverter.model)}
                    className="w-6 h-6 bg-red-500/20 text-red-400 rounded flex items-center justify-center"
                  >-</button>
                  <input
                    type="number"
                    value={studentConfig.inverter.find(i => i.model === inverter.model)?.count || 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      const current = studentConfig.inverter.filter(i => i.model !== inverter.model);
                      if (count > 0) {
                        updateConfig('inverter', [...current, { model: inverter.model, count }]);
                      } else {
                        updateConfig('inverter', current);
                      }
                    }}
                    className={`w-16 text-center ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1 text-sm`}
                  />
                  <button
                    onClick={() => addEquipment('inverter', inverter.model)}
                    className="w-6 h-6 bg-green-500/20 text-green-400 rounded flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 评估按钮 */}
      <button
        onClick={onEvaluate}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
      >
        <CheckCircle className="w-5 h-5" />
        评估方案
      </button>

      {/* 评估结果 */}
      {evaluationResult && (
        <ScoreCard solution={evaluationResult} theme={theme} />
      )}
    </div>
  );
}


// ============================================
// 结果列表Tab
// ============================================

function ResultsTab({
  solutions,
  selectedSolution,
  onSelectSolution,
  theme = 'dark'
}: {
  solutions: Solution[];
  selectedSolution: Solution | null;
  onSelectSolution: (solution: Solution) => void;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';
  if (solutions.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>暂无优化结果</p>
        <p className="text-sm mt-2">请先运行优化求解</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>可行方案列表</h3>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>共 {solutions.length} 个方案</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {solutions.slice(0, 50).map((solution, index) => (
          <div
            key={solution.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSolution(solution);
            }}
            className={`p-3 rounded-lg cursor-pointer transition-all ${
              selectedSolution?.id === solution.id
                ? 'bg-purple-500/20 border-2 border-purple-400'
                : isDark 
                  ? 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                  : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </span>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>方案 #{index + 1}</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-yellow-400">¥{solution.totalCost.toFixed(0)}万</div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>总投资</div>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className={`${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} rounded p-1.5 text-center`}>
                <div className="text-blue-400 font-medium">
                  {solution.config?.wind?.reduce((s, w) => s + w.totalCapacity, 0).toFixed(0) || 0}kW
                </div>
                <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>风电</div>
              </div>
              <div className={`${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} rounded p-1.5 text-center`}>
                <div className="text-yellow-400 font-medium">
                  {((solution.config?.solar?.reduce((s, p) => s + p.totalCapacity, 0) || 0) / 1000).toFixed(1)}MW
                </div>
                <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>光伏</div>
              </div>
              <div className={`${isDark ? 'bg-green-500/10' : 'bg-green-50'} rounded p-1.5 text-center`}>
                <div className="text-green-400 font-medium">
                  {((solution.config?.biomass?.secondary?.totalCapacity || 0) / 1000).toFixed(1)}MW
                </div>
                <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>生物质</div>
              </div>
              <div className={`${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} rounded p-1.5 text-center`}>
                <div className="text-purple-400 font-medium">
                  {((solution.config?.battery?.reduce((s, b) => s + b.totalCapacity, 0) || 0) / 1000).toFixed(1)}MWh
                </div>
                <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>储能</div>
              </div>
            </div>

            <div className="flex justify-between mt-2 text-xs">
              <span className={`${(solution.simulation?.reliability || 0) >= 99 ? 'text-green-400' : 'text-yellow-400'}`}>
                可靠率 {(solution.simulation?.reliability || 0).toFixed(1)}%
              </span>
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                弃电率 {(solution.simulation?.curtailmentRate || 0).toFixed(1)}%
              </span>
              <span className={`font-medium ${
                (solution.score?.total || 0) >= 80 ? 'text-green-400' :
                (solution.score?.total || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                评分 {solution.score?.total || 0}分
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 选中方案详情 */}
      {selectedSolution && (
        <div className="mt-6">
          <ScoreCard solution={selectedSolution} theme={theme} />
        </div>
      )}
    </div>
  );
}

// ============================================
// 评分卡片组件
// ============================================

function ScoreCard({ solution, theme = 'dark' }: { solution: Solution; theme?: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  const score = solution.score || { total: 0, reliability: 0, matching: 0, economics: 0, stability: 0, groupBonus: 0, issues: [] };
  const simulation = solution.simulation || { reliability: 0, totalGeneration: 0, curtailmentRate: 0, energyRatio: null };
  const config = solution.config || { wind: [], solar: [], biomass: { route: '', secondary: { model: '' } }, battery: [], inverter: [], pcs: [] };
  const totalCost = solution.totalCost || 0;

  // 如果数据不完整，显示提示
  if (!solution.simulation) {
    return (
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <div className="flex items-center gap-2 text-yellow-400 mb-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">数据不完整</span>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          该方案缺少仿真数据，可能是从旧版本导入的数据。请重新运行优化。
        </p>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4 space-y-4`}>
      <div className="flex justify-between items-center">
        <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>评分详情</h4>
        <div className={`text-3xl font-bold ${
          score.total >= 80 ? 'text-green-400' :
          score.total >= 60 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {score.total}/100
        </div>
      </div>

      {/* 分项评分 */}
      <div className="space-y-2">
        <ScoreBar label="工况满足" score={score.reliability || 0} max={30} color="blue" theme={theme} />
        <ScoreBar label="设备匹配" score={score.matching || 0} max={20} color="green" theme={theme} />
        <ScoreBar label="经济性" score={score.economics || 0} max={30} color="yellow" theme={theme} />
        <ScoreBar label="稳定性" score={score.stability || 0} max={10} color="purple" theme={theme} />
        <ScoreBar label="小组加分" score={score.groupBonus || 0} max={10} color="pink" theme={theme} />
      </div>

      {/* 问题诊断 */}
      {score.issues && score.issues.length > 0 && (
        <div className={`${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3`}>
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">问题诊断</span>
          </div>
          <ul className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} space-y-1`}>
            {score.issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>总投资</div>
          <div className="text-xl font-bold text-yellow-400">¥{totalCost.toFixed(0)}万</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>供电可靠率</div>
          <div className="text-xl font-bold text-blue-400">{simulation.reliability.toFixed(2)}%</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>年发电量</div>
          <div className="text-xl font-bold text-green-400">{(simulation.totalGeneration / 1000).toFixed(0)} GWh</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>弃电率</div>
          <div className="text-xl font-bold text-orange-400">{simulation.curtailmentRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* 能源占比 */}
      {simulation.energyRatio && (
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-white'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>能源占比</div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="text-blue-400 font-medium">{(simulation.energyRatio.wind * 100).toFixed(1)}%</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>风电</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 font-medium">{(simulation.energyRatio.solar * 100).toFixed(1)}%</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>光伏</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-medium">{(simulation.energyRatio.bio * 100).toFixed(1)}%</div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>生物质</div>
            </div>
            <div className="text-center">
              <div className={`font-medium ${simulation.energyRatio.total >= 1.0 ? 'text-green-400' : 'text-red-400'}`}>
                {(simulation.energyRatio.total * 100).toFixed(1)}%
              </div>
              <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>总占比</div>
            </div>
          </div>
        </div>
      )}

      {/* 设备配置摘要 */}
      <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <div className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>设备配置</div>
        <div className="grid grid-cols-2 gap-2">
          {config.wind?.map((w, i) => (
            <div key={i}>风机: {w.model} × {w.count}</div>
          ))}
          {config.solar?.map((s, i) => (
            <div key={i}>光伏: {s.model} × {s.count}</div>
          ))}
          {config.biomass && (
            <div>生物质: {config.biomass.route} - {config.biomass.secondary?.model || '无'}</div>
          )}
          {config.battery?.map((b, i) => (
            <div key={i}>储能: {b.model} × {b.count}</div>
          ))}
          {/* 逆变器 - 合并相同型号 */}
          {config.inverter && config.inverter.length > 0 && (() => {
            const merged = config.inverter.reduce((acc: Record<string, number>, inv) => {
              acc[inv.model] = (acc[inv.model] || 0) + inv.count;
              return acc;
            }, {});
            return Object.entries(merged).map(([model, count], i) => (
              <div key={i}>逆变器: {model} × {count}</div>
            ));
          })()}
          {/* 储能变流器PCS */}
          {config.pcs && config.pcs.length > 0 && config.pcs.map((p, i) => (
            <div key={i}>变流器: {p.model} × {p.count}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, max, color, theme = 'dark' }: { label: string; score: number; max: number; color: string; theme?: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  const percentage = (score / max) * 100;
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-20 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
      <div className={`flex-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
        <div 
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className={`w-12 text-xs text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{score}/{max}</div>
    </div>
  );
}

// ============================================
// 可视化Tab
// ============================================

function ChartsTab({
  solution,
  onExportCSV,
  theme = 'dark'
}: {
  solution: Solution | null;
  onExportCSV: (data: HourlyData[]) => void;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';
  const [chartType, setChartType] = useState<'generation' | 'soc' | 'balance'>('generation');
  const [viewRange, setViewRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [selectedDay, setSelectedDay] = useState(1);

  if (!solution) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>请先选择一个方案</p>
      </div>
    );
  }

  // 检查 simulation 数据是否存在
  if (!solution.simulation || !solution.simulation.hourlyData) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50 text-yellow-500" />
        <p>方案数据不完整</p>
        <p className="text-sm mt-2">缺少仿真数据，请重新运行优化</p>
      </div>
    );
  }

  const { hourlyData } = solution.simulation;

  // 聚合数据类型（包含最大、最小、平均值）
  interface AggregatedData {
    min: HourlyData;
    max: HourlyData;
    avg: HourlyData;
  }

  // 根据视图范围获取数据
  const getDisplayData = (): { data: HourlyData[]; aggregated?: AggregatedData[] } => {
    if (viewRange === 'day') {
      // 日视图：24小时数据
      const startHour = (selectedDay - 1) * 24;
      return { data: hourlyData.slice(startHour, startHour + 24) };
    } else if (viewRange === 'week') {
      // 周视图：168小时数据
      const startHour = (selectedDay - 1) * 24;
      return { data: hourlyData.slice(startHour, startHour + 168) };
    } else if (viewRange === 'month') {
      // 月视图：每天的最大、最小、平均值
      const aggregated: AggregatedData[] = [];
      const avgData: HourlyData[] = [];
      const startDay = selectedDay - 1;
      
      for (let d = 0; d < 30; d++) {
        const dayStart = (startDay + d) * 24;
        const dayEnd = Math.min(dayStart + 24, hourlyData.length);
        const dayHours = hourlyData.slice(dayStart, dayEnd);
        
        if (dayHours.length > 0) {
          const minSOC = Math.min(...dayHours.map(h => h.batterySOC));
          const maxSOC = Math.max(...dayHours.map(h => h.batterySOC));
          const avgSOC = dayHours.reduce((s, h) => s + h.batterySOC, 0) / dayHours.length;
          
          const avg: HourlyData = {
            windPower: dayHours.reduce((s, h) => s + h.windPower, 0) / dayHours.length,
            solarPower: dayHours.reduce((s, h) => s + h.solarPower, 0) / dayHours.length,
            biomassPower: dayHours.reduce((s, h) => s + h.biomassPower, 0) / dayHours.length,
            totalGeneration: dayHours.reduce((s, h) => s + h.totalGeneration, 0) / dayHours.length,
            load: dayHours.reduce((s, h) => s + h.load, 0) / dayHours.length,
            balance: dayHours.reduce((s, h) => s + h.balance, 0) / dayHours.length,
            batterySOC: avgSOC,
            batteryCharge: dayHours.reduce((s, h) => s + h.batteryCharge, 0) / dayHours.length,
            curtailment: dayHours.reduce((s, h) => s + h.curtailment, 0) / dayHours.length,
            shortage: dayHours.reduce((s, h) => s + h.shortage, 0) / dayHours.length,
          };
          
          avgData.push(avg);
          aggregated.push({
            min: { ...avg, batterySOC: minSOC },
            max: { ...avg, batterySOC: maxSOC },
            avg,
          });
        }
      }
      return { data: avgData, aggregated };
    } else {
      // 年视图：每月的最大、最小、平均值
      const aggregated: AggregatedData[] = [];
      const avgData: HourlyData[] = [];
      const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let hourOffset = 0;
      
      for (let m = 0; m < 12; m++) {
        const monthHours = monthDays[m] * 24;
        const monthEnd = Math.min(hourOffset + monthHours, hourlyData.length);
        const monthData = hourlyData.slice(hourOffset, monthEnd);
        
        if (monthData.length > 0) {
          const minSOC = Math.min(...monthData.map(h => h.batterySOC));
          const maxSOC = Math.max(...monthData.map(h => h.batterySOC));
          const avgSOC = monthData.reduce((s, h) => s + h.batterySOC, 0) / monthData.length;
          
          const avg: HourlyData = {
            windPower: monthData.reduce((s, h) => s + h.windPower, 0) / monthData.length,
            solarPower: monthData.reduce((s, h) => s + h.solarPower, 0) / monthData.length,
            biomassPower: monthData.reduce((s, h) => s + h.biomassPower, 0) / monthData.length,
            totalGeneration: monthData.reduce((s, h) => s + h.totalGeneration, 0) / monthData.length,
            load: monthData.reduce((s, h) => s + h.load, 0) / monthData.length,
            balance: monthData.reduce((s, h) => s + h.balance, 0) / monthData.length,
            batterySOC: avgSOC,
            batteryCharge: monthData.reduce((s, h) => s + h.batteryCharge, 0) / monthData.length,
            curtailment: monthData.reduce((s, h) => s + h.curtailment, 0) / monthData.length,
            shortage: monthData.reduce((s, h) => s + h.shortage, 0) / monthData.length,
          };
          
          avgData.push(avg);
          aggregated.push({
            min: { ...avg, batterySOC: minSOC },
            max: { ...avg, batterySOC: maxSOC },
            avg,
          });
        }
        hourOffset += monthHours;
      }
      return { data: avgData, aggregated };
    }
  };

  const { data: displayData, aggregated: aggregatedData } = getDisplayData();

  // 获取X轴标签
  const getXAxisLabels = () => {
    if (viewRange === 'day') {
      // 日视图：每4小时一个标签
      return displayData.map((_, i) => i % 4 === 0 ? `${i}:00` : null);
    } else if (viewRange === 'week') {
      // 周视图：每天一个标签
      return displayData.map((_, i) => i % 24 === 0 ? `第${Math.floor(i / 24) + 1}天` : null);
    } else if (viewRange === 'month') {
      // 月视图：每5天一个标签
      return displayData.map((_, i) => i % 5 === 0 ? `${i + 1}日` : null);
    } else {
      // 年视图：每月一个标签
      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      return displayData.map((_, i) => months[i] || null);
    }
  };

  const xAxisLabels = getXAxisLabels();

  // 简单的SVG图表
  const renderChart = () => {
    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    let maxY = 0;
    let minY: number;

    if (chartType === 'generation') {
      maxY = Math.max(...displayData.map(d => Math.max(d.totalGeneration, d.load))) * 1.1;
      minY = 0;
    } else if (chartType === 'soc') {
      maxY = 100;
      minY = 0;
    } else {
      maxY = Math.max(...displayData.map(d => Math.abs(d.balance))) * 1.2;
      minY = -maxY;
    }

    // 使用 minY 避免未使用警告
    void minY;

    const xScale = (i: number) => padding.left + (i / (displayData.length - 1)) * chartWidth;
    const yScale = (v: number) => {
      if (chartType === 'balance') {
        return padding.top + chartHeight / 2 - (v / maxY) * (chartHeight / 2);
      }
      return padding.top + chartHeight - (v / maxY) * chartHeight;
    };

    const createPath = (data: number[]) => {
      return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    };

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className={`${isDark ? 'bg-gray-800/30' : 'bg-gray-100'} rounded-lg`}>
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding.top + chartHeight * (1 - ratio);
          const value = chartType === 'balance' 
            ? (ratio - 0.5) * 2 * maxY 
            : ratio * maxY;
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={isDark ? '#374151' : '#D1D5DB'} strokeDasharray="3" />
              <text x={padding.left - 5} y={y + 4} fontSize="10" fill={isDark ? '#9CA3AF' : '#6B7280'} textAnchor="end">
                {value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 数据线 */}
        {chartType === 'generation' && (
          <>
            <path d={createPath(displayData.map(d => d.windPower))} fill="none" stroke="#3B82F6" strokeWidth="2" />
            <path d={createPath(displayData.map(d => d.solarPower))} fill="none" stroke="#EAB308" strokeWidth="2" />
            <path d={createPath(displayData.map(d => d.biomassPower))} fill="none" stroke="#22C55E" strokeWidth="2" />
            <path d={createPath(displayData.map(d => d.load))} fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="5" />
          </>
        )}
        {chartType === 'soc' && (
          <>
            {/* 月/年视图显示最大最小值区域 */}
            {aggregatedData && aggregatedData.length > 0 && (
              <path 
                d={
                  aggregatedData.map((item, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(item.max.batterySOC)}`).join(' ') +
                  ' ' +
                  aggregatedData.map((_, i) => `L ${xScale(aggregatedData.length - 1 - i)} ${yScale(aggregatedData[aggregatedData.length - 1 - i].min.batterySOC)}`).join(' ') +
                  ' Z'
                }
                fill="#A855F7" 
                fillOpacity="0.2" 
                stroke="none"
              />
            )}
            {/* 平均值线 */}
            <path d={createPath(displayData.map(d => d.batterySOC))} fill="none" stroke="#A855F7" strokeWidth="2" />
            {/* 月/年视图显示最大最小值线 */}
            {aggregatedData && aggregatedData.length > 0 && (
              <>
                <path d={createPath(aggregatedData.map(d => d.max.batterySOC))} fill="none" stroke="#A855F7" strokeWidth="1" strokeDasharray="3" strokeOpacity="0.6" />
                <path d={createPath(aggregatedData.map(d => d.min.batterySOC))} fill="none" stroke="#A855F7" strokeWidth="1" strokeDasharray="3" strokeOpacity="0.6" />
              </>
            )}
          </>
        )}
        {chartType === 'balance' && (
          <>
            <line x1={padding.left} y1={yScale(0)} x2={width - padding.right} y2={yScale(0)} stroke="#6B7280" strokeWidth="1" />
            <path d={createPath(displayData.map(d => d.balance))} fill="none" stroke="#06B6D4" strokeWidth="2" />
          </>
        )}

        {/* X轴标签 */}
        {xAxisLabels.map((label, i) => {
          if (label) {
            return (
              <text key={i} x={xScale(i)} y={height - 10} fontSize="10" fill={isDark ? '#9CA3AF' : '#6B7280'} textAnchor="middle">
                {label}
              </text>
            );
          }
          return null;
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {[
            { id: 'generation', name: '发电曲线' },
            { id: 'soc', name: 'SOC曲线' },
            { id: 'balance', name: '供需平衡' },
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id as any)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                chartType === type.id
                  ? 'bg-purple-600 text-white'
                  : isDark ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            { id: 'day', name: '日' },
            { id: 'week', name: '周' },
            { id: 'month', name: '月' },
            { id: 'year', name: '年' },
          ].map(range => (
            <button
              key={range.id}
              onClick={() => setViewRange(range.id as any)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                viewRange === range.id
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.name}
            </button>
          ))}
        </div>
      </div>

      {/* 日期选择 - 日视图显示第几天，周视图显示第几周，月视图显示第几月，年视图不显示 */}
      {viewRange === 'day' && (
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>选择日期:</span>
          <input
            type="range"
            min={1}
            max={365}
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="flex-1"
          />
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} w-20`}>第 {selectedDay} 天</span>
        </div>
      )}
      {viewRange === 'week' && (
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>选择周:</span>
          <input
            type="range"
            min={1}
            max={52}
            value={Math.ceil(selectedDay / 7)}
            onChange={(e) => setSelectedDay((Number(e.target.value) - 1) * 7 + 1)}
            className="flex-1"
          />
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} w-20`}>第 {Math.ceil(selectedDay / 7)} 周</span>
        </div>
      )}
      {viewRange === 'month' && (
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>选择月:</span>
          <input
            type="range"
            min={1}
            max={12}
            value={Math.ceil(selectedDay / 30.4)}
            onChange={(e) => {
              const monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
              setSelectedDay(monthDays[Number(e.target.value) - 1] + 1);
            }}
            className="flex-1"
          />
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'} w-20`}>第 {Math.min(12, Math.ceil(selectedDay / 30.4))} 月</span>
        </div>
      )}

      {/* 图表 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        {renderChart()}
        
        {/* 图例 */}
        {chartType === 'generation' && (
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>风电</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded" />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>光伏</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>生物质</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-red-500" style={{ borderStyle: 'dashed' }} />
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>负荷</span>
            </div>
          </div>
        )}
      </div>

      {/* 导出按钮 */}
      <button
        onClick={() => onExportCSV(hourlyData)}
        className={`w-full py-2.5 ${isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-600/30' : 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-blue-200'} rounded-xl flex items-center justify-center gap-2 border`}
      >
        <Download className="w-4 h-4" />
        导出全年8760小时数据 (.csv)
      </button>

      {/* 统计摘要 */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3 text-center`}>
          <div className="text-lg font-bold text-blue-400">
            {((solution.simulation?.totalGeneration || 0) / 1000).toFixed(0)}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>年发电量 GWh</div>
        </div>
        <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3 text-center`}>
          <div className="text-lg font-bold text-red-400">
            {((solution.simulation?.totalLoad || 0) / 1000).toFixed(0)}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>年用电量 GWh</div>
        </div>
        <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3 text-center`}>
          <div className="text-lg font-bold text-purple-400">
            {(solution.simulation?.avgSOC || 0).toFixed(1)}%
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>平均SOC</div>
        </div>
        <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-3 text-center`}>
          <div className="text-lg font-bold text-orange-400">
            {solution.simulation?.shortageHours || 0}
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>缺电小时数</div>
        </div>
      </div>
    </div>
  );
}


// ============================================
// 小组联合求解Tab
// ============================================

function GroupTab({ cities, theme = 'dark' }: { cities: City[]; theme?: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  const [selectedGroup, setSelectedGroup] = useState<GroupType>('区域-10小组');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [groupSolution, setGroupSolution] = useState<GroupSolution | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'visualization' | 'details'>('overview');
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);

  // 加载已存储的小组方案
  useEffect(() => {
    const stored = loadGroupSolution(selectedGroup);
    setGroupSolution(stored);
  }, [selectedGroup]);

  // 获取小组内的区域
  const groupRegions = useMemo(() => 
    getGroupRegions(selectedGroup, cities),
    [selectedGroup, cities]
  );

  // 获取小组定义
  const groupDef = useMemo(() => 
    GROUP_DEFINITIONS.find(g => g.name === selectedGroup),
    [selectedGroup]
  );

  // 小组统计信息（根据每个区域的实际类型计算，应用学号波动系数）
  const groupStats = useMemo(() => {
    let totalDailyLoad = 0;
    let totalPeakLoad = 0;
    let totalBiomass = 0;
    
    groupRegions.forEach(region => {
      const stats = getRegionStats(region);
      totalDailyLoad += stats.dailyLoad;
      totalPeakLoad += stats.peakLoad;
      totalBiomass += stats.dailyBiomass;
    });
    
    return {
      regionCount: groupRegions.length,
      totalDailyLoad,
      totalPeakLoad,
      totalBiomass,
      centerType: groupDef?.centerType || '工业区',
    };
  }, [groupRegions, groupDef]);

  // 运行小组联合优化
  const handleGroupOptimize = async () => {
    setIsOptimizing(true);
    setProgress(null);
    
    try {
      const result = await findGroupOptimalSolutions(selectedGroup, cities, (p) => {
        setProgress(p);
      });
      
      if (result) {
        setGroupSolution(result);
        saveGroupSolution(selectedGroup, result);
      }
    } catch (e) {
      console.error('小组优化失败:', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  // 导出小组方案
  const handleExportGroupSolution = () => {
    if (!groupSolution) return;
    
    // 构建导出数据
    const exportData = {
      groupName: groupSolution.groupName,
      exportTime: new Date().toISOString(),
      summary: {
        totalCost: groupSolution.totalGroupCost,
        totalGeneration: groupSolution.totalGroupGeneration,
        totalLoad: groupSolution.totalGroupLoad,
        reliability: groupSolution.groupReliability,
        curtailmentRate: groupSolution.groupCurtailmentRate,
        score: groupSolution.groupScore.total
      },
      equipmentSummary: groupSolution.groupEquipmentSummary,
      biomassFlow: groupSolution.biomassFlowSummary,
      transfers: groupSolution.transfers,
      regionDetails: groupSolution.regionDetails || groupSolution.regionSolutions.map(sol => ({
        regionId: sol.regionId,
        regionName: sol.regionName,
        regionType: sol.regionType,
        equipment: {
          wind: sol.config.wind,
          solar: sol.config.solar,
          biomass: sol.config.biomass,
          battery: sol.config.battery,
          inverter: sol.config.inverter,
          pcs: sol.config.pcs
        },
        simulation: {
          reliability: sol.simulation.reliability,
          curtailmentRate: sol.simulation.curtailmentRate,
          shortageHours: sol.simulation.shortageHours,
          totalGeneration: sol.simulation.totalGeneration,
          totalLoad: sol.simulation.totalLoad
        },
        cost: sol.totalCost,
        score: sol.score.total
      }))
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${groupSolution.groupName}_联合优化方案.json`;
    link.click();
  };

  // 导出CSV格式
  const handleExportCSV = () => {
    if (!groupSolution) return;
    
    const headers = ['区域ID', '区域名称', '区域类型', '风电(MW)', '光伏(MW)', '生物质(MW)', '储能(MWh)', '总成本(万元)', '可靠率(%)', '弃电率(%)', '评分'];
    const rows = (groupSolution.regionDetails || groupSolution.regionSolutions).map((item: any) => {
      const sol = 'config' in item ? item : null;
      const detail = 'equipment' in item ? item : null;
      return [
        sol?.regionId || detail?.regionId,
        sol?.regionName || detail?.regionName,
        sol?.regionType || detail?.regionType,
        detail?.equipment?.wind?.totalCapacity?.toFixed(2) || (sol?.config?.wind?.reduce((s: number, w: any) => s + w.totalCapacity, 0) / 1000)?.toFixed(2) || 0,
        detail?.equipment?.solar?.totalCapacity?.toFixed(2) || (sol?.config?.solar?.reduce((s: number, p: any) => s + p.totalCapacity, 0) / 1000000)?.toFixed(2) || 0,
        detail?.equipment?.biomass?.totalCapacity?.toFixed(2) || (sol?.config?.biomass?.secondary?.totalCapacity / 1000)?.toFixed(2) || 0,
        detail?.equipment?.battery?.totalCapacity?.toFixed(0) || (sol?.config?.battery?.reduce((s: number, b: any) => s + b.totalCapacity, 0) / 1000)?.toFixed(0) || 0,
        sol?.totalCost?.toFixed(0) || detail?.costs?.totalCost?.toFixed(0) || 0,
        sol?.simulation?.reliability?.toFixed(1) || detail?.simulation?.reliability?.toFixed(1) || 0,
        sol?.simulation?.curtailmentRate?.toFixed(1) || detail?.simulation?.curtailmentRate?.toFixed(1) || 0,
        sol?.score?.total || detail?.score?.total || 0
      ];
    });
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${groupSolution.groupName}_设备选型.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 小组选择 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
          <Users className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          小组联合求解
        </h3>
        
        <div className="grid grid-cols-5 gap-2 mb-4">
          {GROUP_DEFINITIONS.map(group => (
            <button
              key={group.name}
              onClick={() => setSelectedGroup(group.name)}
              className={`p-3 rounded-lg text-sm transition-all ${
                selectedGroup === group.name
                  ? 'bg-purple-600 text-white'
                  : isDark 
                    ? 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-900'
              }`}
            >
              <div className="font-medium">{group.name.replace('小组', '')}</div>
              <div className="text-xs opacity-70">{group.regionIds.length}个区域</div>
              <div className="text-xs opacity-50">{group.centerType}</div>
            </button>
          ))}
        </div>

        {/* 小组统计 */}
        <div className="grid grid-cols-4 gap-3">
          <div className={`${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-blue-400">{groupStats.regionCount}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>区域数量</div>
          </div>
          <div className={`${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-yellow-400">{groupStats.totalDailyLoad.toFixed(0)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>总日用电 MWh</div>
          </div>
          <div className={`${isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-orange-400">{groupStats.totalPeakLoad.toFixed(0)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>总峰值负荷 MW</div>
          </div>
          <div className={`${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
            <div className="text-2xl font-bold text-green-400">{groupStats.totalBiomass.toFixed(0)}</div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>总生物质 t/d</div>
          </div>
        </div>
      </div>

      {/* 区域列表 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>小组内区域</h4>
        <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto">
          {groupRegions.map(region => {
            const isCenter = region.id === groupDef?.centerRegionId;
            return (
              <div 
                key={region.id} 
                className={`rounded px-2 py-1 text-xs ${
                  isCenter 
                    ? isDark 
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                      : 'bg-purple-100 text-purple-700 border border-purple-300'
                    : isDark 
                      ? 'bg-gray-700/30 text-gray-400'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {region.name}
                {isCenter && <span className={`ml-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>★</span>}
              </div>
            );
          })}
        </div>
        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-2`}>★ 中心区域（接收生物质）</div>
      </div>

      {/* 优化控制 */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4`}>
        <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>联合优化</h4>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-4`}>
          对小组内所有区域进行联合优化，考虑区域间的生物质输送和电力传输，实现整体最优
        </p>
        
        <button
          onClick={handleGroupOptimize}
          disabled={isOptimizing}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            isOptimizing
              ? isDark ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              优化中...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              开始小组联合优化
            </>
          )}
        </button>

        {/* 进度显示 */}
        {progress && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{progress.phase}</span>
              <span className={isDark ? 'text-white' : 'text-gray-900'}>{progress.current} / {progress.total}</span>
            </div>
            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 小组方案结果 */}
      {groupSolution && (
        <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-xl p-4 space-y-4`}>
          {/* 标题和导出按钮 */}
          <div className="flex justify-between items-center">
            <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>小组联合方案</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className={`px-3 py-1.5 ${isDark ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-lg text-xs flex items-center gap-1`}
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleExportGroupSolution}
                className={`px-3 py-1.5 ${isDark ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} rounded-lg text-xs flex items-center gap-1`}
              >
                <Download className="w-3 h-3" /> JSON
              </button>
              <div className={`text-3xl font-bold ${
                groupSolution.groupScore.total >= 80 ? 'text-green-400' :
                groupSolution.groupScore.total >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {groupSolution.groupScore.total}/100
              </div>
            </div>
          </div>

          {/* 视图切换 */}
          <div className="flex gap-2">
            {[
              { id: 'overview', name: '概览' },
              { id: 'visualization', name: '资源流向可视化' },
              { id: 'details', name: '详细方案' },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  viewMode === mode.id
                    ? 'bg-purple-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.name}
              </button>
            ))}
          </div>

          {/* 概览视图 */}
          {viewMode === 'overview' && (
            <GroupOverviewView groupSolution={groupSolution} isDark={isDark} />
          )}

          {/* 可视化视图 */}
          {viewMode === 'visualization' && (
            <GroupVisualizationView 
              groupSolution={groupSolution} 
              groupRegions={groupRegions}
              groupDef={groupDef}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
              isDark={isDark}
            />
          )}

          {/* 详细方案视图 */}
          {viewMode === 'details' && (
            <GroupDetailsView groupSolution={groupSolution} isDark={isDark} />
          )}
        </div>
      )}
    </div>
  );
}

// 概览视图组件
function GroupOverviewView({ groupSolution, isDark }: { groupSolution: GroupSolution; isDark: boolean }) {
  return (
    <div className="space-y-4">
      {/* 整体指标 */}
      <div className="grid grid-cols-4 gap-3">
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>联合优化总成本</div>
          <div className="text-xl font-bold text-yellow-400">¥{groupSolution.totalGroupCost.toFixed(0)}万</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>整体可靠率</div>
          <div className="text-xl font-bold text-blue-400">{groupSolution.groupReliability.toFixed(1)}%</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>年发电量</div>
          <div className="text-xl font-bold text-green-400">{(groupSolution.totalGroupGeneration / 1000).toFixed(0)} GWh</div>
        </div>
        <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded-lg p-3`}>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>弃电率</div>
          <div className="text-xl font-bold text-orange-400">{groupSolution.groupCurtailmentRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* 成本对比：联合优化 vs 独立优化 */}
      {groupSolution.costComparison && (
        <div className={`bg-gradient-to-r ${isDark ? 'from-green-500/10 to-blue-500/10' : 'from-green-100 to-blue-100'} border border-green-500/30 rounded-xl p-4`}>
          <div className="flex items-center gap-2 text-green-400 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">联合优化效益分析</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>独立优化总成本</div>
              <div className={`text-lg font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>¥{groupSolution.costComparison.independentTotalCost.toFixed(0)}万</div>
            </div>
            <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>联合优化总成本</div>
              <div className="text-lg font-bold text-yellow-400">¥{groupSolution.costComparison.jointTotalCost.toFixed(0)}万</div>
            </div>
            <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>节省金额</div>
              <div className={`text-lg font-bold ${groupSolution.costComparison.savingsAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {groupSolution.costComparison.savingsAmount >= 0 ? '↓' : '↑'}¥{Math.abs(groupSolution.costComparison.savingsAmount).toFixed(0)}万
              </div>
            </div>
            <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded-lg p-2 text-center`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>节省比例</div>
              <div className={`text-lg font-bold ${groupSolution.costComparison.savingsRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {groupSolution.costComparison.savingsRate >= 0 ? '-' : '+'}{Math.abs(groupSolution.costComparison.savingsRate).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {groupSolution.costComparison.savingsRate >= 0 
              ? `通过联合优化，小组整体节省了 ${groupSolution.costComparison.savingsAmount.toFixed(0)} 万元，体现了区域资源协调的经济效益。`
              : `联合优化成本略高于独立优化，但可获得更好的系统稳定性和资源利用率。`}
          </div>
        </div>
      )}

      {/* 评分详情 */}
      <div className="space-y-2">
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>评分详情</div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`flex items-center justify-between ${isDark ? 'bg-gray-700/20' : 'bg-gray-200/50'} rounded p-2`}>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>区域平均分</span>
            <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{groupSolution.groupScore.avgRegionScore.toFixed(1)}</span>
          </div>
          <div className={`flex items-center justify-between ${isDark ? 'bg-gray-700/20' : 'bg-gray-200/50'} rounded p-2`}>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>资源共享加分</span>
            <span className="text-sm text-green-400">+{groupSolution.groupScore.resourceSharing.toFixed(1)}</span>
          </div>
          <div className={`flex items-center justify-between ${isDark ? 'bg-gray-700/20' : 'bg-gray-200/50'} rounded p-2`}>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>负荷平衡加分</span>
            <span className="text-sm text-blue-400">+{groupSolution.groupScore.loadBalancing.toFixed(1)}</span>
          </div>
          <div className={`flex items-center justify-between ${isDark ? 'bg-gray-700/20' : 'bg-gray-200/50'} rounded p-2`}>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>经济优化加分</span>
            <span className="text-sm text-yellow-400">+{groupSolution.groupScore.economicOptimization.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* 小组设备汇总 */}
      {groupSolution.groupEquipmentSummary && (
        <div className="space-y-2">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>小组设备汇总</div>
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-blue-400">
                {groupSolution.groupEquipmentSummary.totalWindCapacity.toFixed(1)}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>风电 MW</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">
                {groupSolution.groupEquipmentSummary.totalSolarCapacity.toFixed(1)}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>光伏 MW</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-green-400">
                {groupSolution.groupEquipmentSummary.totalBiomassCapacity.toFixed(1)}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>生物质 MW</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-purple-400">
                {groupSolution.groupEquipmentSummary.totalBatteryCapacity.toFixed(0)}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>储能 MWh</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2 text-center">
              <div className="text-lg font-bold text-orange-400">
                {(groupSolution.groupEquipmentSummary.totalInverterCapacity / 1000).toFixed(0)}
              </div>
              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>逆变器 MW</div>
            </div>
          </div>
        </div>
      )}

      {/* 问题诊断 */}
      {groupSolution.groupScore.issues.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium text-sm">问题诊断</span>
          </div>
          <ul className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
            {groupSolution.groupScore.issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 可视化视图组件 - 展示资源流向
interface GroupVisualizationViewProps {
  groupSolution: GroupSolution;
  groupRegions: City[];
  groupDef: typeof GROUP_DEFINITIONS[0] | undefined;
  selectedRegionId: number | null;
  onSelectRegion: (id: number | null) => void;
  isDark: boolean;
}

function GroupVisualizationView({ 
  groupSolution, 
  groupRegions, 
  groupDef,
  selectedRegionId,
  onSelectRegion,
  isDark
}: GroupVisualizationViewProps) {
  const centerRegionId = groupDef?.centerRegionId || groupSolution.centerRegionId;
  const centerRegion = groupRegions.find(r => r.id === centerRegionId);
  const peripheralRegions = groupRegions.filter(r => r.id !== centerRegionId);
  
  // 计算区域位置（圆形布局）
  const getRegionPosition = (index: number, total: number, radius: number) => {
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    return {
      x: 250 + radius * Math.cos(angle),
      y: 200 + radius * Math.sin(angle)
    };
  };

  // 获取区域的生物质传输量
  const getBiomassTransfer = (fromId: number) => {
    const transfer = groupSolution.transfers.find(
      t => t.fromRegionId === fromId && t.toRegionId === centerRegionId
    );
    return transfer?.biomassTransfer || 0;
  };

  // 获取电力传输
  const getPowerTransfers = () => {
    return groupSolution.transfers.filter(t => t.powerTransfer > 0);
  };

  const selectedDetail = selectedRegionId 
    ? (groupSolution.regionDetails || groupSolution.regionSolutions).find(
        (item: any) => (item.regionId || item.regionId) === selectedRegionId
      )
    : null;

  return (
    <div className="space-y-4">
      {/* SVG 可视化 */}
      <div className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-200/50'} rounded-xl p-4`}>
        <svg viewBox="0 0 500 400" className="w-full h-80">
          {/* 背景网格 */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={isDark ? '#374151' : '#d1d5db'} strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="500" height="400" fill="url(#grid)" />
          
          {/* 生物质流向箭头 */}
          {peripheralRegions.map((region, i) => {
            const pos = getRegionPosition(i, peripheralRegions.length, 140);
            const biomass = getBiomassTransfer(region.id);
            if (biomass <= 0) return null;
            
            const lineWidth = Math.max(1, Math.min(6, biomass / 20));
            return (
              <g key={`biomass-${region.id}`}>
                <line
                  x1={pos.x}
                  y1={pos.y}
                  x2={250}
                  y2={200}
                  stroke="#22c55e"
                  strokeWidth={lineWidth}
                  strokeDasharray="5,3"
                  opacity={0.6}
                />
                <text
                  x={(pos.x + 250) / 2}
                  y={(pos.y + 200) / 2 - 8}
                  fill="#22c55e"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {biomass.toFixed(0)}t/d
                </text>
              </g>
            );
          })}
          
          {/* 电力传输线 */}
          {getPowerTransfers().map((transfer, i) => {
            const fromRegion = groupRegions.find(r => r.id === transfer.fromRegionId);
            const toRegion = groupRegions.find(r => r.id === transfer.toRegionId);
            if (!fromRegion || !toRegion) return null;
            
            const fromIndex = peripheralRegions.findIndex(r => r.id === fromRegion.id);
            const toIndex = peripheralRegions.findIndex(r => r.id === toRegion.id);
            
            const fromPos = fromRegion.id === centerRegionId 
              ? { x: 250, y: 200 }
              : getRegionPosition(fromIndex, peripheralRegions.length, 140);
            const toPos = toRegion.id === centerRegionId
              ? { x: 250, y: 200 }
              : getRegionPosition(toIndex, peripheralRegions.length, 140);
            
            return (
              <g key={`power-${i}`}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke="#eab308"
                  strokeWidth={2}
                  opacity={0.5}
                />
                <text
                  x={(fromPos.x + toPos.x) / 2}
                  y={(fromPos.y + toPos.y) / 2 + 12}
                  fill="#eab308"
                  fontSize="9"
                  textAnchor="middle"
                >
                  ⚡{transfer.powerTransfer.toFixed(1)}MW
                </text>
              </g>
            );
          })}
          
          {/* 中心区域 */}
          {centerRegion && (
            <g 
              onClick={() => onSelectRegion(centerRegion.id)}
              className="cursor-pointer"
            >
              <circle
                cx={250}
                cy={200}
                r={35}
                fill={selectedRegionId === centerRegion.id ? '#7c3aed' : '#6366f1'}
                stroke="#a78bfa"
                strokeWidth={3}
              />
              <text x={250} y={195} fill="white" fontSize="11" textAnchor="middle" fontWeight="bold">
                {centerRegion.name}
              </text>
              <text x={250} y={210} fill="#c4b5fd" fontSize="9" textAnchor="middle">
                ★ 中心
              </text>
            </g>
          )}
          
          {/* 周边区域 */}
          {peripheralRegions.map((region, i) => {
            const pos = getRegionPosition(i, peripheralRegions.length, 140);
            const isSelected = selectedRegionId === region.id;
            const biomass = getBiomassTransfer(region.id);
            
            return (
              <g 
                key={region.id}
                onClick={() => onSelectRegion(region.id)}
                className="cursor-pointer"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={28}
                  fill={isSelected ? '#059669' : (isDark ? '#1f2937' : '#e5e7eb')}
                  stroke={biomass > 0 ? '#22c55e' : (isDark ? '#4b5563' : '#9ca3af')}
                  strokeWidth={2}
                />
                <text x={pos.x} y={pos.y - 5} fill={isDark ? 'white' : '#1f2937'} fontSize="10" textAnchor="middle">
                  {region.name}
                </text>
                <text x={pos.x} y={pos.y + 8} fill="#9ca3af" fontSize="8" textAnchor="middle">
                  {region.type}
                </text>
              </g>
            );
          })}
          
          {/* 图例 */}
          <g transform="translate(10, 350)">
            <line x1="0" y1="0" x2="20" y2="0" stroke="#22c55e" strokeWidth="2" strokeDasharray="5,3"/>
            <text x="25" y="4" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize="9">生物质传输</text>
            <line x1="100" y1="0" x2="120" y2="0" stroke="#eab308" strokeWidth="2"/>
            <text x="125" y="4" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize="9">电力传输</text>
          </g>
        </svg>
      </div>
      
      {/* 选中区域详情 */}
      {selectedDetail && (
        <SelectedRegionDetail detail={selectedDetail} isCenter={selectedRegionId === centerRegionId} isDark={isDark} />
      )}
      
      {/* 传输统计 */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`${isDark ? 'bg-green-500/10' : 'bg-green-50'} border border-green-500/20 rounded-lg p-3`}>
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Leaf className="w-4 h-4" />
            <span className="text-sm font-medium">生物质流向</span>
          </div>
          <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
            {groupSolution.transfers.filter(t => t.biomassTransfer > 0).map((t, i) => (
              <div key={i} className={`flex items-center justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="flex items-center gap-1">
                  区域-{t.fromRegionId} <ArrowRight className="w-3 h-3" /> 区域-{t.toRegionId}
                </span>
                <span className="text-green-400">{t.biomassTransfer.toFixed(1)} t/d</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className={`${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} border border-yellow-500/20 rounded-lg p-3`}>
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">电力传输可能性</span>
          </div>
          <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
            {groupSolution.transfers.filter(t => t.powerTransfer > 0).length > 0 ? (
              groupSolution.transfers.filter(t => t.powerTransfer > 0).map((t, i) => (
                <div key={i} className={`flex items-center justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="flex items-center gap-1">
                    区域-{t.fromRegionId} <ArrowRight className="w-3 h-3" /> 区域-{t.toRegionId}
                  </span>
                  <span className="text-yellow-400">{t.powerTransfer.toFixed(2)} MW</span>
                </div>
              ))
            ) : (
              <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无电力传输建议</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 选中区域详情组件
function SelectedRegionDetail({ detail, isCenter, isDark }: { detail: any; isCenter: boolean; isDark: boolean }) {
  const sol = 'config' in detail ? detail : null;
  const regionDetail = 'equipment' in detail ? detail : null;
  
  return (
    <div className={`rounded-lg p-4 ${isCenter ? 'bg-purple-500/10 border border-purple-500/30' : (isDark ? 'bg-gray-700/30' : 'bg-gray-200/50')}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{sol?.regionName || regionDetail?.regionName}</span>
        {isCenter && <span className="text-purple-400 text-xs px-2 py-0.5 bg-purple-500/20 rounded">中心区域</span>}
      </div>
      
      {regionDetail?.equipment && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded p-2 text-center`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>风电</div>
            <div className="text-sm text-blue-400 font-medium">{regionDetail.equipment.wind.totalCapacity.toFixed(1)} MW</div>
          </div>
          <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded p-2 text-center`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>光伏</div>
            <div className="text-sm text-yellow-400 font-medium">{regionDetail.equipment.solar.totalCapacity.toFixed(1)} MW</div>
          </div>
          <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded p-2 text-center`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>生物质</div>
            <div className="text-sm text-green-400 font-medium">{regionDetail.equipment.biomass.totalCapacity.toFixed(1)} MW</div>
          </div>
          <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded p-2 text-center`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>储能</div>
            <div className="text-sm text-purple-400 font-medium">{regionDetail.equipment.battery.totalCapacity.toFixed(0)} MWh</div>
          </div>
          <div className={`${isDark ? 'bg-gray-800/50' : 'bg-white/70'} rounded p-2 text-center`}>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>成本</div>
            <div className="text-sm text-orange-400 font-medium">¥{(regionDetail.costs?.totalCost || 0).toFixed(0)}万</div>
          </div>
        </div>
      )}
      
      <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <span>可靠率: <span className={isDark ? 'text-white' : 'text-gray-900'}>{(sol?.simulation?.reliability || regionDetail?.simulation?.reliability || 0).toFixed(1)}%</span></span>
        <span>弃电率: <span className={isDark ? 'text-white' : 'text-gray-900'}>{(sol?.simulation?.curtailmentRate || regionDetail?.simulation?.curtailmentRate || 0).toFixed(1)}%</span></span>
        <span>评分: <span className="text-green-400 font-medium">{(sol?.score?.total || regionDetail?.score?.total || 0)}分</span></span>
      </div>
    </div>
  );
}

// 详细方案视图组件
function GroupDetailsView({ groupSolution, isDark }: { groupSolution: GroupSolution; isDark: boolean }) {
  // 获取区域的独立优化成本
  const getIndependentCost = (regionId: number) => {
    if (!groupSolution.costComparison) return null;
    return groupSolution.costComparison.regionIndependentCosts.find(r => r.regionId === regionId);
  };

  return (
    <div className="space-y-4">
      {/* 成本对比表格 */}
      {groupSolution.costComparison && (
        <div className={`${isDark ? 'bg-gray-800/30' : 'bg-gray-100'} rounded-xl p-4`}>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-3`}>各区域成本对比（独立优化 vs 联合优化）</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={`${isDark ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-300'} border-b`}>
                  <th className="text-left py-2 px-2">区域</th>
                  <th className="text-right py-2 px-2">独立优化成本</th>
                  <th className="text-right py-2 px-2">联合优化成本</th>
                  <th className="text-right py-2 px-2">差额</th>
                </tr>
              </thead>
              <tbody>
                {groupSolution.costComparison.regionIndependentCosts.map((item, i) => {
                  const diff = item.independentCost - item.jointCost;
                  return (
                    <tr key={i} className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                      <td className={`py-2 px-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.regionName}</td>
                      <td className={`py-2 px-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>¥{item.independentCost.toFixed(0)}万</td>
                      <td className="py-2 px-2 text-right text-yellow-400">¥{item.jointCost.toFixed(0)}万</td>
                      <td className={`py-2 px-2 text-right ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff >= 0 ? '↓' : '↑'}{Math.abs(diff).toFixed(0)}万
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-medium">
                  <td className={`py-2 px-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>合计</td>
                  <td className={`py-2 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>¥{groupSolution.costComparison.independentTotalCost.toFixed(0)}万</td>
                  <td className="py-2 px-2 text-right text-yellow-400">¥{groupSolution.costComparison.jointTotalCost.toFixed(0)}万</td>
                  <td className={`py-2 px-2 text-right ${groupSolution.costComparison.savingsAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {groupSolution.costComparison.savingsAmount >= 0 ? '↓' : '↑'}{Math.abs(groupSolution.costComparison.savingsAmount).toFixed(0)}万
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 各区域详细方案 */}
      <div className="space-y-3">
        {(groupSolution.regionDetails || groupSolution.regionSolutions).map((item: any) => {
          const sol = 'config' in item ? item : null;
          const detail = 'equipment' in item ? item : null;
          const regionId = sol?.regionId || detail?.regionId;
          const regionName = sol?.regionName || detail?.regionName;
          const regionType = sol?.regionType || detail?.regionType;
          const isCenter = regionId === groupSolution.centerRegionId;
          const score = sol?.score || detail?.score;
          const simulation = sol?.simulation || detail?.simulation;
          const totalCost = sol?.totalCost || detail?.costs?.totalCost || 0;
          const costInfo = getIndependentCost(regionId);
          
          return (
            <div key={regionId} className={`rounded-xl p-4 ${
              isCenter ? 'bg-purple-500/10 border border-purple-500/30' : (isDark ? 'bg-gray-800/30' : 'bg-gray-100')
            }`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{regionName}</span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} px-2 py-0.5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-200'} rounded`}>{regionType}</span>
                  {isCenter && <span className="text-xs text-purple-400 px-2 py-0.5 bg-purple-500/20 rounded">★ 中心区域</span>}
                </div>
                <div className="flex items-center gap-3">
                  {costInfo && (
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      独立: ¥{costInfo.independentCost.toFixed(0)}万
                      {costInfo.independentCost > totalCost && (
                        <span className="text-green-400 ml-1">↓{(costInfo.independentCost - totalCost).toFixed(0)}</span>
                      )}
                    </div>
                  )}
                  <div className={`text-2xl font-bold ${
                    score?.total >= 80 ? 'text-green-400' :
                    score?.total >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{score?.total || 0}分</div>
                </div>
              </div>
              
              {/* 设备配置详情 - 带型号名称 */}
              {detail?.equipment && (
                <div className="space-y-2 mb-3">
                  {/* 风电设备 */}
                  <div className={`${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} border border-blue-500/20 rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Wind className="w-4 h-4" />
                        <span className="font-medium">风电设备</span>
                      </div>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{detail.equipment.wind.totalCapacity.toFixed(1)} MW</span>
                    </div>
                    {detail.equipment.wind.models?.map((m: any, i: number) => (
                      <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} flex justify-between`}>
                        <span>{m.model} ({m.manufacturer})</span>
                        <span>{m.count}台 × {(m.unitPower/1000).toFixed(1)}MW</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 光伏设备 */}
                  <div className={`${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} border border-yellow-500/20 rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Sun className="w-4 h-4" />
                        <span className="font-medium">光伏设备</span>
                      </div>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{detail.equipment.solar.totalCapacity.toFixed(1)} MW</span>
                    </div>
                    {detail.equipment.solar.models?.map((m: any, i: number) => (
                      <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} flex justify-between`}>
                        <span>{m.model} ({m.manufacturer})</span>
                        <span>{m.count}组 × {m.unitPower?.toFixed(0) || 0}W</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 生物质设备 */}
                  <div className={`${isDark ? 'bg-green-500/10' : 'bg-green-50'} border border-green-500/20 rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-green-400">
                        <Leaf className="w-4 h-4" />
                        <span className="font-medium">生物质设备 ({detail.equipment.biomass.route})</span>
                      </div>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{detail.equipment.biomass.totalCapacity.toFixed(1)} MW</span>
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} space-y-1`}>
                      <div className="flex justify-between">
                        <span>一次设备: {detail.equipment.biomass.primary?.model} ({detail.equipment.biomass.primary?.manufacturer})</span>
                        <span>{detail.equipment.biomass.primary?.count}台</span>
                      </div>
                      <div className="flex justify-between">
                        <span>二次设备: {detail.equipment.biomass.secondary?.model} ({detail.equipment.biomass.secondary?.manufacturer})</span>
                        <span>{detail.equipment.biomass.secondary?.count}台</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 储能设备 */}
                  <div className={`${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} border border-purple-500/20 rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-purple-400">
                        <Battery className="w-4 h-4" />
                        <span className="font-medium">储能设备</span>
                      </div>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>{detail.equipment.battery.totalCapacity.toFixed(0)} MWh</span>
                    </div>
                    {detail.equipment.battery.models?.map((m: any, i: number) => (
                      <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} flex justify-between`}>
                        <span>{m.model} ({m.manufacturer})</span>
                        <span>{m.count}组 × {m.unitCapacity}kWh</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 逆变器设备（光伏用） */}
                  {detail.equipment.inverter && detail.equipment.inverter.length > 0 && (
                    <div className={`${isDark ? 'bg-orange-500/10' : 'bg-orange-50'} border border-orange-500/20 rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-orange-400">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">光伏逆变器</span>
                        </div>
                        <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>
                          {(detail.equipment.inverter.reduce((sum: number, inv: any) => sum + (inv.count * (inv.ratedPower || inv.unitPower || 0)), 0) / 1000).toFixed(1)} MW
                        </span>
                      </div>
                      {/* 合并相同型号的逆变器 */}
                      {(() => {
                        const merged = detail.equipment.inverter.reduce((acc: Record<string, any>, inv: any) => {
                          if (!acc[inv.model]) {
                            acc[inv.model] = { ...inv, count: 0 };
                          }
                          acc[inv.model].count += inv.count;
                          return acc;
                        }, {});
                        return Object.values(merged).map((inv: any, i: number) => (
                          <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} flex justify-between`}>
                            <span>{inv.model} ({inv.manufacturer || ''})</span>
                            <span>{inv.count}台 × {inv.ratedPower || inv.unitPower || 0}kW</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                  
                  {/* 储能变流器PCS */}
                  {detail.equipment.pcs && detail.equipment.pcs.length > 0 && (
                    <div className={`${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'} border border-cyan-500/20 rounded-lg p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-cyan-400">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">储能变流器(PCS)</span>
                        </div>
                        <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold`}>
                          {(detail.equipment.pcs.reduce((sum: number, p: any) => sum + (p.count * (p.ratedPower || p.unitPower || 0)), 0) / 1000).toFixed(1)} MW
                        </span>
                      </div>
                      {detail.equipment.pcs.map((p: any, i: number) => (
                        <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} flex justify-between`}>
                          <span>{p.model} ({p.manufacturer || ''})</span>
                          <span>{p.count}台 × {p.ratedPower || p.unitPower || 0}kW</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 成本汇总 */}
                  <div className={`${isDark ? 'bg-orange-500/10' : 'bg-orange-50'} border border-orange-500/20 rounded-lg p-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-400 font-medium">总投资成本</span>
                      <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-lg`}>¥{totalCost.toFixed(0)}万</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 仿真结果 */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded p-2`}>
                  <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>可靠率</div>
                  <div className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{simulation?.reliability?.toFixed(1) || 0}%</div>
                </div>
                <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded p-2`}>
                  <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>弃电率</div>
                  <div className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{simulation?.curtailmentRate?.toFixed(1) || 0}%</div>
                </div>
                <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded p-2`}>
                  <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>缺电小时</div>
                  <div className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{simulation?.shortageHours || 0}h</div>
                </div>
                <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-200/50'} rounded p-2`}>
                  <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>年发电量</div>
                  <div className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{((simulation?.totalGeneration || 0) / 1000).toFixed(0)} GWh</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}