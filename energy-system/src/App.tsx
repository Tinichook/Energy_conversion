import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Leaf, Zap, Map as MapIcon, 
  Activity, Truck, 
  Info, ChevronRight, User, 
  Download, X,
  Factory, Trees, Wheat, Home, Mountain,
  UserCheck, Shield, Package, BarChart3, FileText,
  Sun, Moon, DollarSign, Wind
} from 'lucide-react';
import { validateStudent } from './students';
import AdminPanel, { loadConfigFromStorage } from './AdminPanel';
import EquipmentPanel from './EquipmentPanel';
import DataVerificationPanel from './DataVerificationPanel';
import DesignSchemePanel from './DesignSchemePanel';
import { 
  generateCities as generateCitiesFromConfig, 
  getResourceData as getResourceDataFromConfig,
  setCurrentStudentId,
  City as ConfigCity
} from './DataSetting';

// --- 类型定义 ---

type CityType = '工业区' | '林业区' | '农业区' | '居民区' | '山地区' | '测试区';
type TimeUnit = '年' | '月' | '日';
type ThemeMode = 'dark' | 'light';

// 管理员账号
const ADMIN_ACCOUNT = { id: '11', password: '11' };



interface BiomassComposition {
  // 元素分析 (Elemental Analysis) - Sum = 100%
  C: number; H: number; O: number; N: number; S: number;
  // 工业分析 (Proximate Analysis) - Sum = 100%
  Moisture: number; Volatiles: number; FixedCarbon: number; Ash: number;
}

interface City {
  id: number;
  name: string;
  type: CityType;
  x: number;
  y: number;
  biomassComp: BiomassComposition;
  baseCostMultiplier: number;
  biomassConnections: number[]; 
  powerConnections: number[];
}

interface EquipmentConfig {
  windTurbineCount: number;
  windTurbinePower: number; 
  solarPanelCount: number;
  solarPanelPower: number; 
  biomassGeneratorPower: number; 
  batteryCapacity: number; 
  inverterPower: number; 
}

// --- 辅助函数 ---

const getDaysInMonth = (month: number) => {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};


// --- 组件 ---

const Chart = ({ data, color, label, timeScale, month, theme }: { data: number[], color: string, label: string, timeScale: TimeUnit, month: number, theme: ThemeMode }) => {
  const width = 300;
  const height = 120;
  const paddingLeft = 35;
  const paddingBottom = 20;
  const paddingTop = 5;
  const chartW = width - paddingLeft;
  const chartH = height - paddingBottom - paddingTop;

  // 主题颜色
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-800/50' : 'bg-gray-100';
  const borderColor = isDark ? 'border-gray-700/50' : 'border-gray-300';
  const textColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const labelColor = isDark ? 'text-gray-300' : 'text-gray-700';
  const gridColor = isDark ? '#333' : '#ddd';
  const tickColor = isDark ? '#666' : '#999';

  // 过滤无效数据并确保数据有效
  const validData = data.map(v => (isNaN(v) || v === undefined || v === null) ? 0 : v);
  
  // 如果数据为空，返回空图表
  if (validData.length === 0) {
    return (
      <div className={`mb-4 ${bgColor} p-2 rounded-lg border ${borderColor}`}>
        <div className={`flex justify-between text-xs ${textColor} mb-2 px-1`}>
          <span className={`font-medium ${labelColor}`}>{label}</span>
          <span>无数据</span>
        </div>
      </div>
    );
  }

  // 动态计算Y轴范围：从0开始，最大值上浮20%
  const dataMax = Math.max(...validData, 0.1); // 确保最大值至少为0.1
  const yMax = dataMax * 1.2;
  
  // 生成美观的Y轴刻度 - 智能计算合理的刻度间隔
  const getYTicks = (max: number) => {
    if (max <= 0) return [0];
    
    // 计算合适的刻度数量（3-6个刻度最佳）
    const targetTickCount = 5;
    
    // 计算原始步长
    const rawStep = max / targetTickCount;
    
    // 将步长规范化为1, 2, 5的倍数（更美观的刻度）
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    
    let niceStep: number;
    if (normalized <= 1) niceStep = 1 * magnitude;
    else if (normalized <= 2) niceStep = 2 * magnitude;
    else if (normalized <= 5) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    
    // 生成刻度数组
    const ticks: number[] = [];
    const niceMax = Math.ceil(max / niceStep) * niceStep;
    
    for (let i = 0; i <= niceMax && ticks.length <= 8; i += niceStep) {
      ticks.push(i);
    }
    
    return ticks.length > 0 ? ticks : [0];
  };
  const yTicks = getYTicks(yMax);
  const actualYMax = yTicks[yTicks.length - 1] || yMax;

  // 生成X轴标签（带位置信息）
  const getXLabelsWithPos = () => {
    const labels: {text: string, idx: number}[] = [];
    if (timeScale === '日') {
      // 24个数据点，索引0-23对应0:00-23:00
      labels.push({text: '0:00', idx: 0});
      labels.push({text: '6:00', idx: 6});
      labels.push({text: '12:00', idx: 12});
      labels.push({text: '18:00', idx: 18});
      labels.push({text: '23:00', idx: 23});
    } else if (timeScale === '月') {
      // N个数据点，索引0到N-1对应1日到N日
      const days = getDaysInMonth(month);
      labels.push({text: '1日', idx: 0});
      labels.push({text: `${Math.floor(days/2)}日`, idx: Math.floor(days/2) - 1});
      labels.push({text: `${days}日`, idx: days - 1});
    } else {
      // 12个数据点，索引0-11对应1月-12月
      labels.push({text: '1月', idx: 0});
      labels.push({text: '6月', idx: 5});
      labels.push({text: '12月', idx: 11});
    }
    return labels;
  };
  const xLabelsWithPos = getXLabelsWithPos();

  const points = validData.map((val, idx) => {
    const x = paddingLeft + (idx / Math.max(validData.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - (val / actualYMax) * chartH;
    return `${x},${y}`;
  }).join(' ');

  // 根据时间尺度生成峰值说明
  const peakNote = timeScale === '日' ? '(小时峰值)' : timeScale === '月' ? '(日均峰值)' : '(月均峰值)';

  return (
    <div className={`mb-4 ${bgColor} p-2 rounded-lg border ${borderColor}`}>
      <div className={`flex justify-between text-xs ${textColor} mb-2 px-1`}>
        <span className={`font-medium ${labelColor}`}>{label}</span>
        <span title={timeScale === '日' ? '当天各小时的最大值' : timeScale === '月' ? '当月各天日均值的最大值' : '全年各月月均值的最大值'}>
          Peak: {dataMax.toFixed(1)} <span className="text-gray-500">{peakNote}</span>
        </span>
      </div>
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Y轴网格线和标签 */}
          {yTicks.map(tick => {
            const y = paddingTop + chartH - (tick / actualYMax) * chartH;
            // 格式化刻度标签：大数值使用k/M后缀
            const formatTick = (val: number) => {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 10000) return (val / 1000).toFixed(0) + 'k';
              if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
              if (val % 1 === 0) return val.toString();
              return val.toFixed(1);
            };
            return (
              <g key={tick}>
                <line x1={paddingLeft} y1={y} x2={width} y2={y} stroke={gridColor} strokeDasharray="3"/>
                <text x={paddingLeft - 5} y={y + 3} fontSize="9" fill={tickColor} textAnchor="end">
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}
          {/* 数据线 */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* X轴标签 - 使用SVG精确定位 */}
        <svg width="100%" height="15" viewBox={`0 0 ${width} 15`} className="overflow-visible">
          {xLabelsWithPos.map((item, i) => {
            const x = paddingLeft + (item.idx / Math.max(validData.length - 1, 1)) * chartW;
            return (
              <text key={i} x={x} y="10" fontSize="9" fill={tickColor} textAnchor="middle">
                {item.text}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const RouteModal = ({ link, onClose }: { link: { from: City, to: City, type: 'power' | 'biomass' }, onClose: () => void }) => {
  const dist = Math.hypot(link.from.x - link.to.x, link.from.y - link.to.y);
  const realDist = (dist * 0.5).toFixed(1); 
  const loss = (parseFloat(realDist) * 0.05).toFixed(2);
  const cost = (parseFloat(realDist) * 2.5).toFixed(0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gray-700/50 p-4 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            {link.type === 'power' ? <Zap className="w-5 h-5 text-yellow-400" /> : <Truck className="w-5 h-5 text-green-400" />}
            {link.type === 'power' ? '电力输送路线' : '生物质运输路线'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">起点:</span>
            <span className="text-white font-bold">{link.from.name}</span>
          </div>
          <div className="flex items-center justify-center my-2 text-gray-600">
            <div className="h-px bg-gray-600 w-full mx-2"></div>
            <span className="text-xs whitespace-nowrap">连接详情</span>
            <div className="h-px bg-gray-600 w-full mx-2"></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">终点:</span>
            <span className="text-white font-bold">{link.to.name}</span>
          </div>
          
          <div className="bg-gray-900/50 p-4 rounded-lg space-y-3 mt-4">
            <div className="flex justify-between">
              <span className="text-gray-400">距离:</span>
              <span className="text-blue-400 font-mono text-lg">{realDist} km</span>
            </div>
            {link.type === 'power' ? (
              <div className="flex justify-between">
                <span className="text-gray-400">电力损耗:</span>
                <span className="text-red-400">{loss}%</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-400">运输成本:</span>
                <span className="text-yellow-400">{cost} 元/吨</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


export default function EnergyCourseDesignApp() {
  const [cities, setCities] = useState<City[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [assignedCityId, setAssignedCityId] = useState<number | null>(null); // 分配的区域（固定）
  const [viewingCityId, setViewingCityId] = useState<number | null>(null);   // 当前查看的区域
  
  const [viewMode, setViewMode] = useState<'resource' | 'transport_power' | 'transport_bio'>('resource');
  const [timeScale, setTimeScale] = useState<TimeUnit>('日');
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);  // 标记是否真正发生了拖拽
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [selectedLink, setSelectedLink] = useState<{from: City, to: City, type: 'power' | 'biomass'} | null>(null);
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
  const [showDataVerification, setShowDataVerification] = useState(false);
  const [showDesignScheme, setShowDesignScheme] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [designParams, setDesignParams] = useState<EquipmentConfig>({
    windTurbineCount: 10, windTurbinePower: 100, solarPanelCount: 500, 
    solarPanelPower: 300, biomassGeneratorPower: 50, batteryCapacity: 2000, inverterPower: 500
  });

  // 初始化：加载配置并生成城市
  const loadCities = () => {
    loadConfigFromStorage(); // 从localStorage加载配置
    const generatedCities = generateCitiesFromConfig(true);
    // 转换类型以兼容现有代码
    setCities(generatedCities.map(c => ({
      ...c,
      type: c.type as CityType
    })));
  };

  useEffect(() => {
    loadCities();
  }, []);

  // 配置更新后重新生成城市
  const handleConfigUpdate = () => {
    loadCities();
  };

  const daysInCurrentMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);
  
  useEffect(() => {
    if (selectedDay > daysInCurrentMonth) setSelectedDay(daysInCurrentMonth);
  }, [daysInCurrentMonth, selectedDay]);

  const handleLogin = () => {
    if (!studentId || !studentName) {
      setLoginError('请输入学号和姓名');
      return;
    }
    
    // 检查是否是管理员账号
    if (studentId === ADMIN_ACCOUNT.id && studentName === ADMIN_ACCOUNT.password) {
      setLoginError('');
      setIsAdmin(true);
      setIsLoggedIn(true);
      setAssignedCityId(1);
      setViewingCityId(1);
      const city = cities[0];
      if (city) {
        setTransform({ x: 400 - city.x * 0.5, y: 300 - city.y * 0.5, scale: 0.5 });
      }
      return;
    }
    
    // 验证学号和姓名是否匹配
    if (!validateStudent(studentId, studentName)) {
      setLoginError('学号或姓名错误，请检查后重试');
      return;
    }
    
    setLoginError('');
    setIsAdmin(false);
    // 设置当前学号，用于生成个性化的区域数据（5-10%波动）
    setCurrentStudentId(studentId);
    const num = parseInt(studentId.replace(/\D/g, '').slice(-4) || '1');
    const targetCityId = (num % 52) + 1;
    setAssignedCityId(targetCityId);
    setViewingCityId(targetCityId);
    setIsLoggedIn(true);
    const city = cities[targetCityId - 1];
    if (city) {
        setTransform({ x: 400 - city.x * 0.5, y: 300 - city.y * 0.5, scale: 0.5 });
    }
  };

  // 分配的区域（固定不变）
  const assignedCity = useMemo(() => cities.find(c => c.id === assignedCityId), [cities, assignedCityId]);
  // 当前查看的区域
  const viewingCity = useMemo(() => cities.find(c => c.id === viewingCityId), [cities, viewingCityId]);
  
  const chartData = useMemo(() => {
    if (!viewingCity) return null;
    // 使用DataSetting中的配置生成资源数据
    return getResourceDataFromConfig(viewingCity as ConfigCity, timeScale, selectedMonth, selectedDay);
  }, [viewingCity, timeScale, selectedMonth, selectedDay]);

  // 计算生物质产量（吨）
  // 数据说明：
  // - 日视图：24个点，每个点的值代表当天的日产量（吨/天），所以取平均值即为日产量
  // - 月视图：N个点（N=天数），每个点代表该天的日产量
  // - 年视图：12个点，每个点代表该月的平均日产量
  const biomassYield = useMemo(() => {
    if (!viewingCity) return { daily: 0, monthly: 0, yearly: 0, monthDailyAvg: 0, yearDailyAvg: 0, yearMonthlyAvg: 0, current: 0, label: '' };
    
    // 当天产量：日视图数据的平均值就是当天产量
    const dailyData = getResourceDataFromConfig(viewingCity as ConfigCity, '日', selectedMonth, selectedDay);
    const dailyYield = dailyData.biomass.reduce((a, b) => a + b, 0) / dailyData.biomass.length;
    
    // 当月产量：月视图每个点是每天的产量，求和即为月产量
    const monthData = getResourceDataFromConfig(viewingCity as ConfigCity, '月', selectedMonth, 1);
    const monthlyYield = monthData.biomass.reduce((a, b) => a + b, 0);
    
    // 全年产量：年视图每个点是每月的平均日产量，需要乘以各月天数
    const yearData = getResourceDataFromConfig(viewingCity as ConfigCity, '年', 1, 1);
    let yearlyYield = 0;
    for (let m = 0; m < 12; m++) {
      yearlyYield += yearData.biomass[m] * getDaysInMonth(m + 1);
    }
    
    // 本月日平均
    const monthDailyAvg = monthlyYield / getDaysInMonth(selectedMonth);
    // 全年日平均
    const yearDailyAvg = yearlyYield / 365;
    // 全年月平均
    const yearMonthlyAvg = yearlyYield / 12;
    
    // 根据时间尺度返回当前显示的产量
    let current = dailyYield;
    let label = `${selectedMonth}月${selectedDay}日产量`;
    if (timeScale === '月') {
      current = monthlyYield;
      label = `${selectedMonth}月产量`;
    } else if (timeScale === '年') {
      current = yearlyYield;
      label = '全年产量';
    }
    
    return { 
      daily: dailyYield, 
      monthly: monthlyYield, 
      yearly: yearlyYield, 
      monthDailyAvg,
      yearDailyAvg,
      yearMonthlyAvg,
      current, 
      label 
    };
  }, [viewingCity, timeScale, selectedMonth, selectedDay]);

  const downloadExcel = () => {
    if (!viewingCity) return;
    const rows = [['Date', 'Time', 'Wind(m/s)', 'Solar(kW/m2)', 'Temperature(°C)', 'Load(kW)', 'Biomass(Ton)', 
                   'Moisture(%)', 'Volatiles(%)', 'FixedC(%)', 'Ash(%)', 
                   'C(%)', 'H(%)', 'O(%)', 'N(%)', 'S(%)']];
    
    const comp = viewingCity.biomassComp;
    const commonCols = [
      comp.Moisture, comp.Volatiles, comp.FixedCarbon, comp.Ash,
      comp.C, comp.H, comp.O, comp.N, comp.S
    ].join(',');

    for (let m = 1; m <= 12; m++) {
      const days = getDaysInMonth(m);
      for (let d = 1; d <= days; d++) {
        const dailyData = getResourceDataFromConfig(viewingCity as ConfigCity, '日', m, d);
        for (let h = 0; h < 24; h++) {
          const timeStr = `${h.toString().padStart(2, '0')}:00`;
          const row = [
            `2024-${m}-${d}`, timeStr,
            String(dailyData.wind[h]), String(dailyData.solar[h]), String(dailyData.temperature[h]), String(dailyData.load[h]), (dailyData.biomass[h]/24).toFixed(3),
            commonCols
          ];
          rows.push(row);
        }
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${viewingCity.name}_FullYear_Data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scaleAdjustment = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.3, transform.scale + scaleAdjustment), 2);
    setTransform(prev => ({
      ...prev,
      scale: newScale
    }));
  };

  // 限制拖动范围的函数
  const clampTransform = (x: number, y: number, scale: number) => {
    // 地图实际大小 2000x1500，视口大小约 800x600
    const mapWidth = 2000 * scale;
    const mapHeight = 1500 * scale;
    const viewWidth = 800;
    const viewHeight = 600;
    
    // 限制范围：地图不能完全移出视口
    const minX = viewWidth - mapWidth - 100;
    const maxX = 100;
    const minY = viewHeight - mapHeight - 100;
    const maxY = 100;
    
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY)
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return;
    setIsDragging(true);
    setHasDragged(false);  // 重置拖拽标记
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    // 检查鼠标左键是否仍然按下
    if (e.buttons !== 1) {
      setIsDragging(false);
      return;
    }
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const clamped = clampTransform(newX, newY, transform.scale);
    setTransform(prev => ({ ...prev, x: clamped.x, y: clamped.y }));
    setHasDragged(true);  // 标记发生了拖拽
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // 延迟重置hasDragged，让点击事件有机会检查
    setTimeout(() => setHasDragged(false), 100);
  };
  
  // 全局监听mouseup，防止鼠标在窗口外松开时状态不更新
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => setHasDragged(false), 100);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const CityIcon = ({ type, isLarge }: { type: CityType, isLarge: boolean }) => {
    // 保持原本颜色，不填充
    const color = 
      type === '工业区' ? '#F87171' :
      type === '林业区' ? '#34D399' :
      type === '农业区' ? '#FBBF24' :
      type === '居民区' ? '#60A5FA' : '#A78BFA';
    const size = isLarge ? 40 : 24;
    
    switch (type) {
      case '工业区': return <Factory size={size} color={color} />;
      case '林业区': return <Trees size={size} color={color} />;
      case '农业区': return <Wheat size={size} color={color} />;
      case '居民区': return <Home size={size} color={color} />;
      case '山地区': return <Mountain size={size} color={color} />;
      default: return <MapIcon size={size} color={color} />;
    }
  };


  const renderMapContent = () => {
    // 主题相关颜色 - 白色主题使用更高对比度的配色
    const nodeFill = theme === 'dark' ? '#1F2937' : '#FFFFFF';
    const nodeStroke = theme === 'dark' ? '#374151' : '#94A3B8';
    const labelBg = theme === 'dark' ? '#111827' : '#334155';
    const labelText = theme === 'dark' ? '#9CA3AF' : '#FFFFFF';
    // 白色主题下添加阴影效果
    const nodeShadow = theme === 'light';
    
    return (
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
        {/* 白色主题下的阴影定义 */}
        {nodeShadow && (
          <defs>
            <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#64748b" floodOpacity="0.3"/>
            </filter>
          </defs>
        )}
        
        {cities.map(city => {
          const targets = viewMode === 'transport_power' ? city.powerConnections : 
                          viewMode === 'transport_bio' ? city.biomassConnections : [];
          
          return targets.map(targetId => {
            if (targetId < city.id) return null;
            const target = cities.find(c => c.id === targetId);
            if (!target) return null;
            
            const isPower = viewMode === 'transport_power';
            return (
              <line 
                key={`${city.id}-${targetId}`}
                x1={city.x} y1={city.y} x2={target.x} y2={target.y}
                stroke={isPower ? '#F59E0B' : '#10B981'}
                strokeWidth={isPower ? 3 : 6}
                strokeOpacity={theme === 'dark' ? 0.6 : 0.8}
                strokeDasharray={isPower ? '0' : '8,4'}
                className="cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLink({ from: city, to: target, type: isPower ? 'power' : 'biomass' });
                }}
              />
            );
          });
        })}

        {cities.map(city => {
          const isAssigned = assignedCityId === city.id;
          const isViewing = viewingCityId === city.id;
          return (
            <g key={city.id} 
               onClick={(e) => {
                 e.stopPropagation();
                 // 防止拖拽时触发点击
                 if (!hasDragged) {
                   setViewingCityId(city.id);
                 }
               }}
               className="cursor-pointer transition-all duration-300 hover:opacity-100 opacity-90"
               transform={`translate(${city.x}, ${city.y})`}
            >
              {/* 分配区域绿色边框，选中其他区域蓝色边框 */}
              <circle 
                r={isViewing || isAssigned ? 35 : 25} 
                fill={nodeFill} 
                stroke={isAssigned ? '#10B981' : isViewing ? '#3B82F6' : nodeStroke} 
                strokeWidth={isAssigned || isViewing ? 4 : theme === 'dark' ? 2 : 2.5} 
                filter={nodeShadow ? 'url(#nodeShadow)' : undefined}
              />
              <g transform="translate(-12, -12) scale(1)">
                 <g transform={isViewing || isAssigned ? "translate(-8, -8)" : ""}>
                    <CityIcon type={city.type} isLarge={isViewing || isAssigned} />
                 </g>
              </g>
              
              <rect x="-45" y="38" width="90" height="24" rx="4" fill={isAssigned ? '#10B981' : isViewing ? '#3B82F6' : labelBg} fillOpacity="0.95" />
              <text x="0" y="55" textAnchor="middle" fill={isAssigned || isViewing ? '#FFF' : labelText} fontSize="14" fontWeight="bold">
                {city.name}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-xl shadow-lg shadow-blue-500/20">
              <Activity className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white text-center mb-2 tracking-tight">能源转化原理</h1>
          <p className="text-gray-400 text-center mb-8">风光生物质互补发电系统课程设计</p>
          <div className="space-y-5">
            <div>
              <label className="block text-gray-400 mb-2 text-sm font-medium">学号</label>
              <div className="relative group">
                <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={studentId}
                  onChange={(e) => { setStudentId(e.target.value); setLoginError(''); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="请输入您的学号"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 mb-2 text-sm font-medium">姓名</label>
              <div className="relative group">
                <UserCheck className="absolute left-3 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={studentName}
                  onChange={(e) => { setStudentName(e.target.value); setLoginError(''); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="请输入您的姓名"
                />
              </div>
            </div>
            {loginError && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-2 rounded-lg text-sm text-center">
                {loginError}
              </div>
            )}
            <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2">
              进入系统 <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-screen bg-[#0f172a] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* 左侧：地图区域 */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        {/* 顶部状态栏 */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
          <div className={`${theme === 'dark' ? 'bg-gray-900/90 border-gray-700/50' : 'bg-white/90 border-gray-300'} backdrop-blur-md border p-4 rounded-xl shadow-xl pointer-events-auto flex items-center gap-6`}>
            <div>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-0.5`}>姓名</div>
              <div className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-wide`}>{isAdmin ? '管理员' : studentName}</div>
            </div>
            <div className={`w-px h-8 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <div>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-0.5`}>学号</div>
              <div className={`text-lg font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} tracking-wide`}>{studentId}</div>
            </div>
            <div className={`w-px h-8 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <div>
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-0.5`}>分配区域</div>
              <div className="text-xl font-bold text-green-500">{assignedCity?.name || '-'}</div>
            </div>
            {viewingCityId !== assignedCityId && viewingCity && (
              <>
                <div className={`w-px h-8 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                <div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-0.5`}>当前查看</div>
                  <div className="text-xl font-bold text-blue-500">{viewingCity.name}</div>
                </div>
              </>
            )}
            {isAdmin && (
              <>
                <div className={`w-px h-8 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                  <Shield className="w-4 h-4" /> 管理面板
                </button>
                <button 
                  onClick={() => setShowDataVerification(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                  <BarChart3 className="w-4 h-4" /> 数据核对
                </button>
              </>
            )}
          </div>

          <div className={`${theme === 'dark' ? 'bg-gray-900/90 border-gray-700/50' : 'bg-white/90 border-gray-300'} backdrop-blur-md border p-1.5 rounded-xl shadow-xl pointer-events-auto flex gap-1`}>
            <button 
              onClick={() => setShowEquipmentPanel(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all bg-purple-600 text-white shadow-lg hover:bg-purple-500"
            >
              <Package className="w-4 h-4" /> 设备库
            </button>
            {[
              { id: 'resource', icon: Activity, label: '资源概览', color: 'bg-blue-600' },
              { id: 'transport_bio', icon: Truck, label: '生物质路网', color: 'bg-green-600' },
              { id: 'transport_power', icon: Zap, label: '电力网络', color: 'bg-yellow-600' },
            ].map(mode => (
              <button 
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${viewMode === mode.id ? `${mode.color} text-white shadow-lg` : theme === 'dark' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <mode.icon className="w-4 h-4" /> {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* 地图背景 */}
        <div 
          className={`flex-1 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50'} cursor-move relative overflow-hidden`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className={`absolute inset-0 ${theme === 'dark' ? 'opacity-10' : 'opacity-30'} pointer-events-none`} 
               style={{backgroundImage: `radial-gradient(${theme === 'dark' ? '#64748b' : '#94a3b8'} 1px, transparent 1px)`, backgroundSize: '30px 30px'}}>
          </div>
          <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
            {renderMapContent()}
          </svg>

          {/* 左下角设计方案按钮 - 仅管理员可见 */}
          {isAdmin && (
            <div className="absolute bottom-4 left-4 z-10">
              <button
                onClick={() => setShowDesignScheme(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/30"
              >
                <FileText className="w-4 h-4" /> 设计方案
              </button>
            </div>
          )}

          {/* 主题切换按钮 - 左下角 */}
          <div className={`absolute bottom-4 ${isAdmin ? 'left-36' : 'left-4'} z-10`}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-3 rounded-full shadow-lg transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-700' 
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
              }`}
              title={theme === 'dark' ? '切换到白色主题' : '切换到深色主题'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：数据面板 */}
      <div className={`w-[450px] ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-l flex flex-col overflow-y-auto scrollbar-thin ${theme === 'dark' ? 'scrollbar-thumb-gray-700' : 'scrollbar-thumb-gray-300'}`}>
        {viewingCity ? (
          <>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-800 bg-gray-800/20' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-1 flex items-center gap-2`}>
                    {viewingCity.name}
                    <CityIcon type={viewingCity.type} isLarge={false} />
                    {viewingCityId === assignedCityId && (
                      <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">我的区域</span>
                    )}
                  </h2>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{viewingCity.type}</span>
                </div>
              </div>

              {/* 日期选择器 */}
              <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-3 space-y-3`}>
                <div className={`flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} rounded p-1`}>
                  {(['年', '月', '日'] as TimeUnit[]).map(t => (
                    <button key={t} onClick={() => setTimeScale(t)} className={`flex-1 py-1 text-xs rounded font-medium transition-all ${timeScale === t ? 'bg-blue-600 text-white' : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>{t === '年' ? '年视图' : t === '月' ? '月视图' : '日视图'}</button>
                  ))}
                </div>
                {timeScale !== '年' && (
                  <div className="flex gap-2 text-sm">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className={`${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-700'} border rounded px-2 py-1 flex-1 outline-none`}>
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
                    </select>
                    {timeScale === '日' && (
                      <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className={`${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-700'} border rounded px-2 py-1 flex-1 outline-none`}>
                        {Array.from({length: daysInCurrentMonth}, (_, i) => <option key={i+1} value={i+1}>{i+1}日</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {chartData && (
                <>
                  <Chart label="风力资源 (m/s)" data={chartData.wind} color="#60A5FA" timeScale={timeScale} month={selectedMonth} theme={theme} />
                  <Chart label="光照资源 (kW/m²)" data={chartData.solar} color="#FBBF24" timeScale={timeScale} month={selectedMonth} theme={theme} />
                  <Chart label="环境温度 (°C)" data={chartData.temperature} color="#10B981" timeScale={timeScale} month={selectedMonth} theme={theme} />
                  <Chart label="负荷特性 (kW)" data={chartData.load} color="#F87171" timeScale={timeScale} month={selectedMonth} theme={theme} />

                  <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-xl p-4 border`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} flex items-center gap-2`}><Leaf className="w-4 h-4 text-green-400" /> 生物质原料分析</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* 产量显示 */}
                      <div className={`${theme === 'dark' ? 'bg-green-900/30 border-green-700/50' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
                        <div className="text-[10px] text-green-400 mb-2 uppercase tracking-wider">{biomassYield.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-mono font-bold text-green-400">{biomassYield.current.toFixed(1)}</span>
                          <span className="text-sm text-green-500">吨</span>
                        </div>
                        <div className={`flex gap-4 mt-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          {timeScale === '日' && (
                            <>
                              <span>本日: {biomassYield.daily.toFixed(1)}t</span>
                              <span>本月: {biomassYield.monthly.toFixed(0)}t</span>
                              <span>全年: {biomassYield.yearly.toFixed(0)}t</span>
                            </>
                          )}
                          {timeScale === '月' && (
                            <>
                              <span>本月日均: {biomassYield.monthDailyAvg.toFixed(1)}t</span>
                              <span>本月: {biomassYield.monthly.toFixed(0)}t</span>
                              <span>全年: {biomassYield.yearly.toFixed(0)}t</span>
                            </>
                          )}
                          {timeScale === '年' && (
                            <>
                              <span>全年日均: {biomassYield.yearDailyAvg.toFixed(1)}t</span>
                              <span>全年月均: {biomassYield.yearMonthlyAvg.toFixed(0)}t</span>
                              <span>全年: {biomassYield.yearly.toFixed(0)}t</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 成分分析 */}
                      <div> 
                        <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mb-1 uppercase tracking-wider`}>工业分析 (wt.%)</div>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(viewingCity.biomassComp).slice(0, 4).map(([key, val]) => (
                            <div key={key} className={`${theme === 'dark' ? 'bg-gray-900/80 border-gray-700' : 'bg-white border-gray-200'} p-2 rounded text-center border`}>
                              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{key}</div>
                              <div className={`text-sm font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'} font-bold`}>{val}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mb-1 uppercase tracking-wider`}>元素分析 (wt.%)</div>
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(viewingCity.biomassComp).slice(4).map(([key, val]) => (
                            <div key={key} className={`${theme === 'dark' ? 'bg-gray-900/80 border-gray-700' : 'bg-white border-gray-200'} p-2 rounded text-center border`}>
                              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{key}</div>
                              <div className="text-sm font-mono text-yellow-500 font-bold">{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button onClick={downloadExcel} className={`w-full ${theme === 'dark' ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/30' : 'bg-blue-50 hover:bg-blue-100 border-blue-200'} text-blue-500 hover:text-blue-600 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-sm`}>
                <Download className="w-4 h-4" /> 导出该地区全年资源数据 (.csv)
              </button>

              {/* 建设成本系数 */}
              <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-xl p-4 border`}>
                <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-3 flex items-center gap-2`}>
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                  建设成本系数
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'} p-3 rounded-lg flex flex-col items-center`}>
                    <Wind className={`w-5 h-5 mb-1.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs mb-1`}>风电</span>
                    <span className={`font-mono font-bold text-base ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      {viewingCity.type === '工业区' ? '3.0' : 
                       viewingCity.type === '居民区' ? '2.5' : 
                       viewingCity.type === '山地区' ? '1.2' : 
                       viewingCity.type === '农业区' ? '1.0→2.0' : '2.0'}
                    </span>
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'} p-3 rounded-lg flex flex-col items-center`}>
                    <Sun className={`w-5 h-5 mb-1.5 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs mb-1`}>光伏</span>
                    <span className={`font-mono font-bold text-base ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {viewingCity.type === '工业区' ? '3.0' : 
                       viewingCity.type === '居民区' ? '2.5' : 
                       viewingCity.type === '山地区' ? '1.0' : 
                       viewingCity.type === '农业区' ? '1.0→2.0' : '2.0'}
                    </span>
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'} p-3 rounded-lg flex flex-col items-center`}>
                    <Leaf className={`w-5 h-5 mb-1.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs mb-1`}>生物质</span>
                    <span className={`font-mono font-bold text-base ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                      {viewingCity.type === '工业区' ? '2.5' : 
                       viewingCity.type === '居民区' ? '2.0' : '0'}
                    </span>
                  </div>
                </div>
                <div className={`mt-3 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} italic leading-relaxed`}>
                  {viewingCity.type === '工业区' ? '💡 工业园区土地成本高，施工难度大' :
                   viewingCity.type === '居民区' ? '💡 城区土地紧张，需考虑居民影响' :
                   viewingCity.type === '山地区' ? '💡 地形复杂，风机安装成本略高' :
                   viewingCity.type === '农业区' ? '💡 阶梯成本：风机>5台或光伏>200块后成本翻倍（保护耕地政策）' :
                   '💡 需从零开始建设基础设施'}
                </div>
              </div>

              {/* 区域连接路线 */}
              <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-xl p-4 border`}>
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-4 flex items-center gap-2`}>
                  <Activity className="w-4 h-4 text-blue-400" /> 区域连接路线
                </h3>
                
                {/* 电力连接 */}
                <div className="mb-4">
                  <div className="text-[10px] text-yellow-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3" /> 电力输送路线 ({viewingCity.powerConnections.length}条)
                  </div>
                  <div className={`space-y-1 max-h-32 overflow-y-auto scrollbar-thin ${theme === 'dark' ? 'scrollbar-thumb-gray-700' : 'scrollbar-thumb-gray-300'}`}>
                    {viewingCity.powerConnections.length > 0 ? (
                      viewingCity.powerConnections.map(targetId => {
                        const target = cities.find(c => c.id === targetId);
                        if (!target) return null;
                        const dist = (Math.hypot(viewingCity.x - target.x, viewingCity.y - target.y) * 0.5).toFixed(1);
                        return (
                          <div key={targetId} className={`flex justify-between items-center ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'} px-2 py-1.5 rounded text-xs`}>
                            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{viewingCity.name} → {target.name}</span>
                            <span className="text-yellow-500 font-mono">{dist} km</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-center py-2`}>无电力连接</div>
                    )}
                  </div>
                </div>

                {/* 生物质连接 */}
                <div className="mb-4">
                  <div className="text-[10px] text-green-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3 h-3" /> 生物质运输路线 ({viewingCity.biomassConnections.length}条)
                  </div>
                  <div className={`space-y-1 max-h-32 overflow-y-auto scrollbar-thin ${theme === 'dark' ? 'scrollbar-thumb-gray-700' : 'scrollbar-thumb-gray-300'}`}>
                    {viewingCity.biomassConnections.length > 0 ? (
                      viewingCity.biomassConnections.map(targetId => {
                        const target = cities.find(c => c.id === targetId);
                        if (!target) return null;
                        const dist = (Math.hypot(viewingCity.x - target.x, viewingCity.y - target.y) * 0.5).toFixed(1);
                        return (
                          <div key={targetId} className={`flex justify-between items-center ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'} px-2 py-1.5 rounded text-xs`}>
                            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{viewingCity.name} → {target.name}</span>
                            <span className="text-green-500 font-mono">{dist} km</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} text-center py-2`}>无生物质连接</div>
                    )}
                  </div>
                </div>

                {/* 导出所有路线按钮 */}
                <button 
                  onClick={() => {
                    // 收集所有路线（去重）
                    const allRoutes: {from: string, to: string, type: string, distance: string}[] = [];
                    const routeSet = new Set<string>();
                    
                    cities.forEach(city => {
                      // 电力路线
                      city.powerConnections.forEach(targetId => {
                        const target = cities.find(c => c.id === targetId);
                        if (!target) return;
                        const routeKey = [city.id, targetId].sort().join('-') + '-power';
                        if (!routeSet.has(routeKey)) {
                          routeSet.add(routeKey);
                          const dist = (Math.hypot(city.x - target.x, city.y - target.y) * 0.5).toFixed(1);
                          allRoutes.push({
                            from: city.name,
                            to: target.name,
                            type: '电力',
                            distance: dist
                          });
                        }
                      });
                      
                      // 生物质路线
                      city.biomassConnections.forEach(targetId => {
                        const target = cities.find(c => c.id === targetId);
                        if (!target) return;
                        const routeKey = [city.id, targetId].sort().join('-') + '-biomass';
                        if (!routeSet.has(routeKey)) {
                          routeSet.add(routeKey);
                          const dist = (Math.hypot(city.x - target.x, city.y - target.y) * 0.5).toFixed(1);
                          allRoutes.push({
                            from: city.name,
                            to: target.name,
                            type: '生物质',
                            distance: dist
                          });
                        }
                      });
                    });
                    
                    // 生成CSV
                    const csvRows = [['输送路线', '输送类型', '距离(km)']];
                    allRoutes.forEach(route => {
                      csvRows.push([`${route.from}-${route.to}`, route.type, route.distance]);
                    });
                    
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "所有输送路线.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className={`w-full ${theme === 'dark' ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/30' : 'bg-blue-50 hover:bg-blue-100 border-blue-200'} text-blue-500 hover:text-blue-600 py-2.5 rounded-lg border flex items-center justify-center gap-2 transition-all text-sm`}
                >
                  <Download className="w-4 h-4" /> 导出所有输送路线 (.csv)
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <div className={`w-16 h-16 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'} rounded-full flex items-center justify-center mb-4`}><Info className={`w-8 h-8 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} /></div>
            <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>未选择区域</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>请在左侧地图中点击一个节点，或输入学号自动定位。</p>
          </div>
        )}
        
      </div>

      {selectedLink && (
        <RouteModal link={selectedLink} onClose={() => setSelectedLink(null)} />
      )}

      {showAdminPanel && (
        <AdminPanel 
          onClose={() => setShowAdminPanel(false)} 
          onConfigUpdate={handleConfigUpdate}
          cities={cities}
          initialRegionId={viewingCityId || assignedCityId || 1}
          theme={theme}
        />
      )}

      {showEquipmentPanel && (
        <EquipmentPanel onClose={() => setShowEquipmentPanel(false)} theme={theme} />
      )}

      {showDataVerification && (
        <DataVerificationPanel 
          onClose={() => setShowDataVerification(false)}
          cities={cities}
          theme={theme}
        />
      )}

      {showDesignScheme && (
        <DesignSchemePanel onClose={() => setShowDesignScheme(false)} theme={theme} />
      )}
    </div>
  );
}
