import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Map,
  Users,
  Calculator,
  Sun,
  Wind,
  Leaf,
  Factory,
  Trees,
  Wheat,
  Home,
  Mountain,
  GripHorizontal,
  Battery,
  Search,
  Award,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface DesignSchemePanelProps {
  onClose: () => void;
  theme?: 'dark' | 'light';
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
}

// 侧边栏菜单项 - 树形结构
const MENU_ITEMS: MenuItem[] = [
  { id: 'regions', label: '1. 区域定义', icon: Map },
  { id: 'groups', label: '2. 小组定义', icon: Users },
  { 
    id: 'overview', 
    label: '3. 优化总览', 
    icon: Calculator,
    children: [
      { id: 'wind', label: '3.1 风力选型', icon: Wind },
      { id: 'solar', label: '3.2 光伏选型', icon: Sun },
      { id: 'biomass', label: '3.3 生物质选型', icon: Leaf },
      { id: 'battery', label: '3.4 储能选型', icon: Battery },
      { id: 'search', label: '3.5 搜索方法', icon: Search },
      { id: 'scoring', label: '3.6 评分系统', icon: Award },
    ]
  },
];

// 获取所有菜单项ID（扁平化）
const getAllMenuIds = (items: MenuItem[]): string[] => {
  const ids: string[] = [];
  items.forEach(item => {
    ids.push(item.id);
    if (item.children) {
      ids.push(...getAllMenuIds(item.children));
    }
  });
  return ids;
};

// 区域类型定义数据
const REGION_DEFINITIONS = [
  {
    type: '工业区', icon: Factory,
    features: '能源消耗大户，夜间负荷高于白天（三班倒生产），建设成本最高',
    wind: '基础风速 4.0 m/s，波动 ±1.5 m/s', solar: '光照 0.5 kW/m²，系数 1.0',
    load: '日用电 1320 MWh，峰值 80 MW', biomass: '50-80 t/d，热值 10 MJ/kg',
    costFactors: { wind: 3.0, solar: 3.0, biomass: 2.5 },
    costNote: '工业园区土地成本高，施工难度大',
    summary: '自给率约15%，需从其他区域调入能源',
  },
  {
    type: '居民区', icon: Home,
    features: '早晚高峰型负荷，夏季空调用电高峰，建设成本高',
    wind: '基础风速 3.5 m/s，城区略低', solar: '光照 0.5 kW/m²，系数 1.0',
    load: '日用电 660 MWh，峰值 50 MW', biomass: '60-100 t/d，热值 11 MJ/kg',
    costFactors: { wind: 2.5, solar: 2.5, biomass: 2.0 },
    costNote: '城区土地紧张，需考虑居民影响',
    summary: '自给率约28%，需从其他区域调入能源',
  },
  {
    type: '山地区', icon: Mountain,
    features: '风能充足(+30%)，光照充足(+20%)，旅游设施负荷低',
    wind: '基础风速 5.5 m/s，地形加成 +2.0', solar: '光照 0.6 kW/m²，系数 1.2',
    load: '日用电 120 MWh，峰值 10 MW', biomass: '20-40 t/d，热值 15 MJ/kg',
    costFactors: { wind: 1.2, solar: 1.0, biomass: 0 },
    costNote: '地形复杂，风机安装成本略高',
    summary: '自给率约220%，可向外输出电力',
  },
  {
    type: '农业区', icon: Wheat,
    features: '开阔地带风速好(+10%)，光照充足(+10%)，季节性秸秆高产',
    wind: '基础风速 4.5 m/s，加成 +0.5', solar: '光照 0.55 kW/m²，系数 1.1',
    load: '日用电 240 MWh，峰值 20 MW', biomass: '非丰收季100t/d，丰收季350t/d，热值16MJ/kg',
    costFactors: { wind: '1.0→2.0', solar: '1.0→2.0', biomass: 0 },
    costNote: '阶梯成本：风机>5台或光伏>200块后成本翻倍（保护耕地）',
    summary: '自给率约171%，丰收季可大量外送',
  },
  {
    type: '林业区', icon: Trees,
    features: '风能匮乏(-40%)，光照匮乏(-30%)，生物质最丰富且优质',
    wind: '基础风速 2.5 m/s，负加成 -1.0', solar: '光照 0.4 kW/m²，系数 0.7',
    load: '日用电 72 MWh，峰值 6 MW', biomass: '120-180 t/d，热值 18 MJ/kg，全年稳定',
    costFactors: { wind: 2.0, solar: 2.0, biomass: 0 },
    costNote: '需从零开始建设基础设施',
    summary: '自给率约351%，是小组主要生物质供应来源',
  },
];

// 小组定义数据
const GROUP_DEFINITIONS = [
  { center: '区域-10', centerType: '工业区', members: '区域-1(农), 2(林), 3(山), 9(林)', dailyLoad: 1824, biomass: 543 },
  { center: '区域-12', centerType: '居民区', members: '区域-4(林), 5(山), 11(农), 20(林)', dailyLoad: 1164, biomass: 493 },
  { center: '区域-14', centerType: '居民区', members: '区域-6(林), 7(林), 13(山), 15(林), 22(农)', dailyLoad: 1068, biomass: 693 },
  { center: '区域-23', centerType: '工业区', members: '区域-16(农), 24(山), 31(林), 32(山)', dailyLoad: 1872, biomass: 373 },
  { center: '区域-26', centerType: '工业区', members: '区域-17(林), 18(农), 19(山), 25(山)', dailyLoad: 1872, biomass: 493 },
  { center: '区域-28', centerType: '工业区', members: '区域-21(林), 27(农), 35(林), 36(山)', dailyLoad: 1824, biomass: 513 },
  { center: '区域-37', centerType: '工业区', members: '区域-29(山), 30(农), 38(林), 46(农)', dailyLoad: 1992, biomass: 456 },
  { center: '区域-39', centerType: '居民区', members: '区域-40(山), 47(农), 48(林)', dailyLoad: 1092, biomass: 393 },
  { center: '区域-42', centerType: '居民区', members: '区域-33(山), 34(农), 41(农), 49(山), 50(农)', dailyLoad: 1620, biomass: 569 },
  { center: '区域-44', centerType: '居民区', members: '区域-8(农), 43(农), 45(山), 51(林), 52(农)', dailyLoad: 1452, biomass: 826 },
];

// 公式渲染组件 - 使用更清晰的格式
const Formula: React.FC<{ children: React.ReactNode; theme?: 'dark' | 'light' }> = ({ children, theme = 'dark' }) => (
  <div className={`${theme === 'dark' ? 'bg-gray-900/80 border-gray-700 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'} border rounded-lg p-4 my-3 font-mono text-sm leading-relaxed overflow-x-auto`}>
    {children}
  </div>
);

// 公式行组件
const FormulaLine: React.FC<{ children: React.ReactNode; indent?: number }> = ({ children, indent = 0 }) => (
  <div style={{ marginLeft: indent * 16 }} className="py-0.5">{children}</div>
);

// 变量高亮
const Var: React.FC<{ children: React.ReactNode; theme?: 'dark' | 'light' }> = ({ children, theme = 'dark' }) => (
  <span className={`${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'} italic`}>{children}</span>
);

// 下标
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <sub className="text-xs">{children}</sub>
);

// 上标
const Sup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <sup className="text-xs">{children}</sup>
);

const DesignSchemePanel: React.FC<DesignSchemePanelProps> = ({ onClose, theme = 'dark' }) => {
  const [activeSection, setActiveSection] = useState('regions');
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [isScrolling, setIsScrolling] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 主题相关样式
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-gray-900' : 'bg-white';
  const bgSidebar = isDark ? 'bg-gray-800/50' : 'bg-gray-100';
  const bgCard = isDark ? 'bg-gray-800/50' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const hoverBg = isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-200';

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 0);
      setPosition({ x: Math.max(0, Math.min(newX, maxX)), y: Math.max(0, Math.min(newY, maxY)) });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // 滚动监听 - 自动更新侧边栏高亮
  const handleScroll = useCallback(() => {
    if (isScrolling || !contentRef.current) return;
    
    const container = contentRef.current;
    const containerHeight = container.clientHeight;
    
    const allIds = getAllMenuIds(MENU_ITEMS);
    let currentSection = allIds[0];
    
    for (const id of allIds) {
      const element = document.getElementById(`section-${id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        
        // 当section顶部进入视口上半部分时，认为该section是当前section
        if (relativeTop <= containerHeight * 0.3) {
          currentSection = id;
        }
      }
    }
    
    if (currentSection !== activeSection) {
      setActiveSection(currentSection);
      
      // 如果当前section是子项，自动展开父级
      const childIds = ['wind', 'solar', 'biomass', 'battery', 'search', 'scoring'];
      if (childIds.includes(currentSection)) {
        setExpandedSections(prev => new Set([...prev, 'overview']));
      }
    }
  }, [activeSection, isScrolling]);

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // 切换展开/折叠
  const toggleExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // 点击菜单滚动到对应区域
  const scrollToSection = (sectionId: string) => {
    setIsScrolling(true);
    setActiveSection(sectionId);
    
    // 如果点击的是子项，确保父级展开
    const childIds = ['wind', 'solar', 'biomass', 'battery', 'search', 'scoring'];
    if (childIds.includes(sectionId)) {
      setExpandedSections(prev => new Set([...prev, 'overview']));
    }
    
    const element = document.getElementById(`section-${sectionId}`);
    if (element && contentRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // 滚动完成后恢复滚动监听
    setTimeout(() => setIsScrolling(false), 500);
  };

  // 渲染区域定义
  const renderRegions = () => (
    <div id="section-regions" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>1. 各类区域定义</h3>
      <p className={`${textSecondary} text-sm mb-4`}>系统包含5种区域类型，各区域资源禀赋和负荷特性不同，需要差异化的能源配置方案。</p>
      <div className="space-y-3">
        {REGION_DEFINITIONS.map((region) => {
          const Icon = region.icon;
          return (
            <div key={region.type} className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                <span className={`font-bold ${textPrimary}`}>{region.type}</span>
              </div>
              <p className={`${textSecondary} text-sm mb-2`}>{region.features}</p>
              <div className={`grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <div>风能: {region.wind}</div>
                <div>光能: {region.solar}</div>
                <div>负荷: {region.load}</div>
                <div>生物质: {region.biomass}</div>
              </div>
              
              {/* 建设成本系数 */}
              <div className={`mt-3 pt-2 border-t ${borderColor}`}>
                <div className={`text-xs font-semibold ${textPrimary} mb-1.5`}>建设成本系数：</div>
                <div className={`grid grid-cols-3 gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className="flex items-center gap-1">
                    <Wind className="w-3 h-3" />
                    <span>风电: {region.costFactors.wind}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sun className="w-3 h-3" />
                    <span>光伏: {region.costFactors.solar}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Leaf className="w-3 h-3" />
                    <span>生物质: {region.costFactors.biomass}</span>
                  </div>
                </div>
                <div className={`mt-1.5 text-xs ${textMuted} italic`}>{region.costNote}</div>
              </div>
              
              <div className={`mt-2 pt-2 border-t ${borderColor} text-xs ${textSecondary}`}>{region.summary}</div>
            </div>
          );
        })}
      </div>
      
      {/* 成本系数说明 */}
      <div className={`mt-4 ${bgCard} border ${borderColor} rounded-lg p-3`}>
        <div className={`text-sm font-semibold ${textPrimary} mb-2`}>💡 成本系数说明</div>
        <div className={`text-xs ${textSecondary} space-y-1`}>
          <div>• 成本系数表示相对于基准成本的倍数，系数越高建设成本越高</div>
          <div>• 工业区/居民区：城区土地成本高，系数2.5-3.0</div>
          <div>• 山地区：地形适中，系数1.0-1.2</div>
          <div>• 农业区：阶梯成本，超过阈值后成本翻倍（保护耕地政策）</div>
          <div>• 林业区：基础设施从零开始，系数2.0</div>
        </div>
      </div>
    </div>
  );

  // 渲染小组定义
  const renderGroups = () => (
    <div id="section-groups" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>2. 小组定义（按生物质路线分组）</h3>
      <p className={`${textSecondary} text-sm mb-4`}>
        小组按照生物质路线连接关系进行分组，每个小组以一个中心区域（工业区或居民区）为核心，周边区域的生物质资源汇聚到该中心区域进行能源转化。
      </p>
      <div className={`text-sm ${textSecondary} mb-4`}>分组原则：生物质汇聚 → 集中转化 → 电力互济 → 联合优化</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${borderColor} ${textSecondary}`}>
              <th className="text-left py-2 px-2">小组中心</th>
              <th className="text-left py-2 px-2">类型</th>
              <th className="text-left py-2 px-2">成员区域</th>
              <th className="text-right py-2 px-2">日用电(MWh)</th>
              <th className="text-right py-2 px-2">生物质(t/d)</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_DEFINITIONS.map((group, idx) => (
              <tr key={idx} className={`border-b ${isDark ? 'border-gray-700/50 hover:bg-gray-800/30' : 'border-gray-200 hover:bg-gray-100'}`}>
                <td className={`py-2 px-2 ${textPrimary}`}>{group.center}</td>
                <td className={`py-2 px-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.centerType}</td>
                <td className={`py-2 px-2 ${textSecondary} text-xs`}>{group.members}</td>
                <td className={`py-2 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.dailyLoad}</td>
                <td className={`py-2 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.biomass}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 text-xs ${textMuted}`}>共10个小组，52个区域。</div>
    </div>
  );

  // 渲染优化总览
  const renderOverview = () => (
    <div id="section-overview" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3. 优化求解方法总览</h3>
      <p className={`${textSecondary} text-sm mb-4`}>系统采用8760小时精确仿真，遍历搜索最优设备配置方案。</p>
      <div className={`${bgCard} border ${borderColor} rounded-lg p-4`}>
        <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <div className="flex gap-2"><span className={textMuted}>①</span> 根据区域类型估算搜索范围（风电、光伏、生物质、储能容量）</div>
          <div className="flex gap-2"><span className={textMuted}>②</span> 在搜索范围内遍历所有可能的容量组合</div>
          <div className="flex gap-2"><span className={textMuted}>③</span> 对每个组合进行8760小时仿真，计算供电可靠率、弃电率等指标</div>
          <div className="flex gap-2"><span className={textMuted}>④</span> 根据评分函数对方案进行评分，选出最优方案</div>
          <div className="flex gap-2"><span className={textMuted}>⑤</span> 根据最优容量配置，选择具体设备型号和数量</div>
        </div>
      </div>
    </div>
  );

  // 渲染风力选型
  const renderWind = () => (
    <div id="section-wind" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.1 风力发电设备选型</h3>
      <p className={`${textSecondary} text-sm mb-4`}>根据目标装机容量和区域风速特性选择合适的风机型号。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>风机发电功率计算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>P</Var><Sub>wind</Sub> = Σ(<Var>P</Var><Sub>rated</Sub> × <Var>f</Var>(<Var>v</Var>) × <Var>η</Var><Sub>wind</Sub>)</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>wind</Sub>: 风机实际输出功率 (kW)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>rated</Sub>: 风机额定功率 (kW)，由设备型号决定</FormulaLine>
        <FormulaLine indent={1}><Var>f</Var>(<Var>v</Var>): 功率系数函数，取值范围 0~1，由当前风速决定</FormulaLine>
        <FormulaLine indent={1}><Var>v</Var>: 当前风速 (m/s)，由区域基础风速和随机波动决定</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>wind</Sub>: 风机系统效率 ≈ 0.95（含传动损耗、变流器损耗）</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>功率曲线 <Var>f</Var>(<Var>v</Var>) 分段定义:</FormulaLine>
        <FormulaLine indent={1}>当 <Var>v</Var> &lt; <Var>v</Var><Sub>cut-in</Sub>: <Var>f</Var> = 0 （风速过低，无法启动）</FormulaLine>
        <FormulaLine indent={1}>当 <Var>v</Var><Sub>cut-in</Sub> ≤ <Var>v</Var> &lt; <Var>v</Var><Sub>rated</Sub>: <Var>f</Var> = ((<Var>v</Var> - <Var>v</Var><Sub>cut-in</Sub>) / (<Var>v</Var><Sub>rated</Sub> - <Var>v</Var><Sub>cut-in</Sub>))<Sup>3</Sup></FormulaLine>
        <FormulaLine indent={1}>当 <Var>v</Var><Sub>rated</Sub> ≤ <Var>v</Var> ≤ <Var>v</Var><Sub>cut-out</Sub>: <Var>f</Var> = 1 （满功率运行）</FormulaLine>
        <FormulaLine indent={1}>当 <Var>v</Var> &gt; <Var>v</Var><Sub>cut-out</Sub>: <Var>f</Var> = 0 （风速过高，保护停机）</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>风速参数说明:</FormulaLine>
        <FormulaLine indent={1}><Var>v</Var><Sub>cut-in</Sub>: 切入风速 (m/s)，风机开始发电的最低风速</FormulaLine>
        <FormulaLine indent={1}><Var>v</Var><Sub>rated</Sub>: 额定风速 (m/s)，风机达到额定功率的风速</FormulaLine>
        <FormulaLine indent={1}><Var>v</Var><Sub>cut-out</Sub>: 切出风速 (m/s)，风机停机保护的风速，通常为25 m/s</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>年发电量估算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>E</Var><Sub>wind</Sub> = <Var>P</Var><Sub>rated</Sub> × <Var>H</Var><Sub>eq</Sub> × <Var>η</Var><Sub>wind</Sub></FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>E</Var><Sub>wind</Sub>: 年发电量 (kWh/年)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>rated</Sub>: 风机额定功率 (kW)</FormulaLine>
        <FormulaLine indent={1}><Var>H</Var><Sub>eq</Sub>: 等效满负荷利用小时数 (h/年)</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>wind</Sub>: 风机系统效率 ≈ 0.95</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>各区域等效利用小时数参考:</FormulaLine>
        <FormulaLine indent={1}>山地区: 2500h（风资源最优）</FormulaLine>
        <FormulaLine indent={1}>农业区: 2200h（开阔地带，风速较好）</FormulaLine>
        <FormulaLine indent={1}>工业区: 2000h（建筑物遮挡，风速一般）</FormulaLine>
        <FormulaLine indent={1}>居民区: 1800h（城区风速较低）</FormulaLine>
        <FormulaLine indent={1}>林业区: 1500h（树木遮挡，风速最低）</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>设备型号参考</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${borderColor} ${textSecondary}`}>
            <th className="text-left py-2 px-2">型号</th><th className="text-left py-2 px-2">额定功率</th>
            <th className="text-left py-2 px-2">切入风速</th><th className="text-left py-2 px-2">额定风速</th>
            <th className="text-left py-2 px-2">系统效率</th><th className="text-left py-2 px-2">参考价格</th><th className="text-left py-2 px-2">适用区域</th>
          </tr></thead>
          <tbody className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">WT-10</td><td>10 kW</td><td>2.5 m/s</td><td>9 m/s</td><td>93%</td><td>5-8万</td><td>林业区</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">WT-30</td><td>30 kW</td><td>3.0 m/s</td><td>10 m/s</td><td>94%</td><td>12-18万</td><td>山地/农业区</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">WT-100</td><td>100 kW</td><td>3.0 m/s</td><td>11 m/s</td><td>95%</td><td>35-50万</td><td>农业区</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">WT-500</td><td>500 kW</td><td>3.5 m/s</td><td>12 m/s</td><td>96%</td><td>180-250万</td><td>山地区(大型)</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">WT-1500</td><td>1500 kW</td><td>3.5 m/s</td><td>12 m/s</td><td>97%</td><td>600-800万</td><td>工业/居民区</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // 渲染光伏选型
  const renderSolar = () => (
    <div id="section-solar" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.2 光伏发电设备选型</h3>
      <p className={`${textSecondary} text-sm mb-4`}>根据目标装机容量选择高效率、高性价比的光伏组件。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>光伏发电功率计算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>P</Var><Sub>solar</Sub> = <Var>P</Var><Sub>installed</Sub> × <Var>I</Var><Sub>norm</Sub> × <Var>η</Var><Sub>panel</Sub> × <Var>η</Var><Sub>inverter</Sub> × <Var>η</Var><Sub>loss</Sub></FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>solar</Sub>: 光伏实际输出功率 (kW)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>installed</Sub>: 光伏装机容量 (kWp)，峰值功率</FormulaLine>
        <FormulaLine indent={1}><Var>I</Var><Sub>norm</Sub>: 归一化光照强度 (0~1)，标准条件1000W/m²时为1</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>panel</Sub>: 光伏组件效率 (20%~22%)，由组件型号决定</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>inverter</Sub>: 逆变器效率 ≈ 0.97（直流转交流损耗）</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>loss</Sub>: 线路及其他损耗系数 ≈ 0.90（含灰尘、温度、线损）</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>综合系统效率:</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>system</Sub> = <Var>η</Var><Sub>panel</Sub> × <Var>η</Var><Sub>inverter</Sub> × <Var>η</Var><Sub>loss</Sub> ≈ 0.85</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>日内光照强度曲线</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>I</Var>(<Var>h</Var>) = sin(π × (<Var>h</Var> - <Var>t</Var><Sub>rise</Sub>) / <Var>T</Var><Sub>day</Sub>) × <Var>I</Var><Sub>peak</Sub> × <Var>k</Var><Sub>region</Sub> × <Var>k</Var><Sub>weather</Sub></FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>I</Var>(<Var>h</Var>): 第h小时的光照强度 (kW/m²)</FormulaLine>
        <FormulaLine indent={1}><Var>h</Var>: 当前小时 (0~23)</FormulaLine>
        <FormulaLine indent={1}><Var>t</Var><Sub>rise</Sub>: 日出时间 (h)，约为6:00</FormulaLine>
        <FormulaLine indent={1}><Var>T</Var><Sub>day</Sub>: 日照时长 (h)，约为12小时</FormulaLine>
        <FormulaLine indent={1}><Var>I</Var><Sub>peak</Sub>: 峰值光照强度 (kW/m²)，标准条件下为1.0</FormulaLine>
        <FormulaLine indent={1}><Var>k</Var><Sub>region</Sub>: 区域系数，山地1.2/农业1.1/工业居民1.0/林业0.7</FormulaLine>
        <FormulaLine indent={1}><Var>k</Var><Sub>weather</Sub>: 天气系数 (0.3~1.0)，晴天1.0/多云0.6/阴天0.3</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>各区域等效利用小时数参考:</FormulaLine>
        <FormulaLine indent={1}>山地区: 1400h（光照充足，遮挡少）</FormulaLine>
        <FormulaLine indent={1}>农业区: 1300h（开阔地带）</FormulaLine>
        <FormulaLine indent={1}>工业/居民区: 1200h（建筑物部分遮挡）</FormulaLine>
        <FormulaLine indent={1}>林业区: 1000h（树木遮挡严重）</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>设备型号参考</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${borderColor} ${textSecondary}`}>
            <th className="text-left py-2 px-2">型号</th><th className="text-left py-2 px-2">标称功率</th>
            <th className="text-left py-2 px-2">组件效率</th><th className="text-left py-2 px-2">类型</th>
            <th className="text-left py-2 px-2">温度系数</th><th className="text-left py-2 px-2">参考价格</th>
          </tr></thead>
          <tbody className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">PV-330M</td><td>330 Wp</td><td>20.1%</td><td>单晶硅</td><td>-0.35%/°C</td><td>650-750元</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">PV-450M</td><td>450 Wp</td><td>20.7%</td><td>单晶硅</td><td>-0.34%/°C</td><td>850-950元</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">PV-550M</td><td>550 Wp</td><td>21.3%</td><td>单晶硅</td><td>-0.32%/°C</td><td>1000-1150元</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">PV-600M</td><td>600 Wp</td><td>21.8%</td><td>单晶硅</td><td>-0.30%/°C</td><td>1150-1300元</td></tr>
          </tbody>
        </table>
      </div>
      <div className={`mt-3 text-xs ${textMuted}`}>注：温度系数表示温度每升高1°C，功率下降的百分比。高温地区应选择温度系数较低的组件。</div>
    </div>
  );

  // 渲染生物质选型
  const renderBiomass = () => (
    <div id="section-biomass" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.3 生物质发电设备选型</h3>
      <p className={`${textSecondary} text-sm mb-4`}>根据生物质类型和产量选择合适的发电技术路线。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>生物质发电功率计算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>P</Var><Sub>bio</Sub> = (<Var>m</Var> × <Var>Q</Var><Sub>LHV</Sub> × <Var>η</Var><Sub>conv</Sub> × <Var>η</Var><Sub>gen</Sub>) / (3600 × <Var>t</Var>)</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>bio</Sub>: 生物质发电功率 (MW)</FormulaLine>
        <FormulaLine indent={1}><Var>m</Var>: 日生物质投料量 (kg/d)，由区域产量决定</FormulaLine>
        <FormulaLine indent={1}><Var>Q</Var><Sub>LHV</Sub>: 生物质低位热值 (MJ/kg)，由生物质类型决定</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>conv</Sub>: 热能转换效率，直燃0.85/气化0.75/沼气0.65</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>gen</Sub>: 发电效率，直燃0.33/气化0.33/沼气0.46</FormulaLine>
        <FormulaLine indent={1}><Var>t</Var>: 日运行小时数 (h)，通常为20~24小时</FormulaLine>
        <FormulaLine indent={1}>3600: 单位换算系数 (MJ → kWh)</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>综合发电效率:</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>total</Sub> = <Var>η</Var><Sub>conv</Sub> × <Var>η</Var><Sub>gen</Sub></FormulaLine>
        <FormulaLine indent={1}>直燃: 0.85 × 0.33 ≈ 28%</FormulaLine>
        <FormulaLine indent={1}>气化: 0.75 × 0.33 ≈ 25%</FormulaLine>
        <FormulaLine indent={1}>沼气: 0.65 × 0.46 ≈ 30%</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>热值计算（Boie公式）</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>HHV</Var> = (35.16×<Var>C</Var> + 116.225×<Var>H</Var> - 11.09×<Var>O</Var> + 6.28×<Var>N</Var> + 10.465×<Var>S</Var>) / 100</FormulaLine>
        <FormulaLine><Var>LHV</Var> = <Var>HHV</Var> - 2.442 × (<Var>M</Var> + 9×<Var>H</Var>) / 100</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>HHV</Var>: 高位热值 (MJ/kg)，含水蒸气潜热</FormulaLine>
        <FormulaLine indent={1}><Var>LHV</Var>: 低位热值 (MJ/kg)，实际可用热量</FormulaLine>
        <FormulaLine indent={1}><Var>C</Var>: 碳含量 (%)，典型值40~50%</FormulaLine>
        <FormulaLine indent={1}><Var>H</Var>: 氢含量 (%)，典型值5~7%</FormulaLine>
        <FormulaLine indent={1}><Var>O</Var>: 氧含量 (%)，典型值35~45%</FormulaLine>
        <FormulaLine indent={1}><Var>N</Var>: 氮含量 (%)，典型值0.5~2%</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var>: 硫含量 (%)，典型值0.1~0.5%</FormulaLine>
        <FormulaLine indent={1}><Var>M</Var>: 水分含量 (%)，典型值10~30%</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>各区域典型热值参考:</FormulaLine>
        <FormulaLine indent={1}>工业区: 10.3 MJ/kg（工业废弃物，热值较低）</FormulaLine>
        <FormulaLine indent={1}>居民区: 11.2 MJ/kg（生活垃圾，热值一般）</FormulaLine>
        <FormulaLine indent={1}>山地区: 15.1 MJ/kg（枯枝落叶，热值较高）</FormulaLine>
        <FormulaLine indent={1}>农业区: 16.0 MJ/kg（秸秆，热值高）</FormulaLine>
        <FormulaLine indent={1}>林业区: 17.7 MJ/kg（木质废料，热值最高）</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>三种技术路线对比</h4>
      <div className="space-y-3">
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-medium ${textPrimary}`}>直燃发电</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>综合效率 28%</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>大型 &gt;10MW</span>
          </div>
          <div className={`text-xs ${textSecondary}`}>适用: 工业区、农业区 | 设备: 循环流化床锅炉 + 汽轮发电机组</div>
          <div className={`text-xs ${textMuted} mt-1`}>热转换效率85%，发电效率33%，适合大规模集中处理</div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-medium ${textPrimary}`}>气化发电</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>综合效率 25%</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>中小型 100kW-10MW</span>
          </div>
          <div className={`text-xs ${textSecondary}`}>适用: 农业区、林业区、山地区 | 设备: 气化炉 + 燃气发电机组</div>
          <div className={`text-xs ${textMuted} mt-1`}>气化效率75%，发电效率33%，适合分散式处理</div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-medium ${textPrimary}`}>沼气发电</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>综合效率 30%</span>
            <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-0.5 rounded`}>中小型 几十kW-几MW</span>
          </div>
          <div className={`text-xs ${textSecondary}`}>适用: 农业区、居民区 | 设备: 厌氧发酵罐 + 沼气发电机组</div>
          <div className={`text-xs ${textMuted} mt-1`}>发酵效率65%，发电效率46%，适合有机废弃物处理</div>
        </div>
      </div>
    </div>
  );

  // 渲染储能选型
  const renderBattery = () => (
    <div id="section-battery" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.4 储能系统选型</h3>
      <p className={`${textSecondary} text-sm mb-4`}>根据峰值负荷和调峰需求配置储能容量。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>供需平衡计算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>LPS</Var><Sub>i</Sub> = <Var>L</Var><Sub>i</Sub> - (<Var>P</Var><Sub>wind,i</Sub> + <Var>P</Var><Sub>solar,i</Sub> + <Var>P</Var><Sub>bio,i</Sub>)</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>LPS</Var><Sub>i</Sub>: 第i小时的供应损失量 (MW)，正值表示缺电，负值表示余电</FormulaLine>
        <FormulaLine indent={1}><Var>L</Var><Sub>i</Sub>: 第i小时的负荷需求 (MW)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>wind,i</Sub>: 第i小时风电实际出力 (MW)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>solar,i</Sub>: 第i小时光伏实际出力 (MW)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>bio,i</Sub>: 第i小时生物质发电出力 (MW)</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>展开形式:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>wind,i</Sub> = <Var>X</Var> × <Var>f</Var>(<Var>v</Var><Sub>i</Sub>) × <Var>η</Var><Sub>wind</Sub></FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>solar,i</Sub> = <Var>Y</Var> × <Var>I</Var><Sub>i</Sub> × <Var>η</Var><Sub>solar</Sub></FormulaLine>
        <FormulaLine indent={1}>其中 <Var>X</Var>: 风机装机容量(MW)，<Var>Y</Var>: 光伏装机容量(MW)</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>充放电控制策略</h4>
      <Formula theme={theme}>
        <FormulaLine>充放电判断逻辑:</FormulaLine>
        <FormulaLine indent={1}>当 <Var>LPS</Var><Sub>i</Sub> &lt; 0 且 <Var>SOC</Var><Sub>i</Sub> &lt; <Var>SOC</Var><Sub>max</Sub>: 充电模式</FormulaLine>
        <FormulaLine indent={2}><Var>f</Var><Sub>charge</Sub> = 1, <Var>f</Var><Sub>discharge</Sub> = 0</FormulaLine>
        <FormulaLine indent={1}>当 <Var>LPS</Var><Sub>i</Sub> &gt; 0 且 <Var>SOC</Var><Sub>i</Sub> &gt; <Var>SOC</Var><Sub>min</Sub>: 放电模式</FormulaLine>
        <FormulaLine indent={2}><Var>f</Var><Sub>charge</Sub> = 0, <Var>f</Var><Sub>discharge</Sub> = 1</FormulaLine>
        <FormulaLine indent={1}>其他情况: 待机模式</FormulaLine>
        <FormulaLine indent={2}><Var>f</Var><Sub>charge</Sub> = 0, <Var>f</Var><Sub>discharge</Sub> = 0</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>SOC</Var><Sub>i</Sub>: 第i小时电池荷电状态 (MWh)</FormulaLine>
        <FormulaLine indent={1}><Var>SOC</Var><Sub>max</Sub>: 电池最大容量 (MWh)</FormulaLine>
        <FormulaLine indent={1}><Var>SOC</Var><Sub>min</Sub>: 电池最小容量 (MWh)，通常为10%×<Var>SOC</Var><Sub>max</Sub></FormulaLine>
        <FormulaLine indent={1}><Var>f</Var><Sub>charge</Sub>: 充电标志位 (0或1)</FormulaLine>
        <FormulaLine indent={1}><Var>f</Var><Sub>discharge</Sub>: 放电标志位 (0或1)</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>电池能量状态更新</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>SOC</Var><Sub>i+1</Sub> = <Var>SOC</Var><Sub>i</Sub> + <Var>P</Var><Sub>c</Sub> × <Var>f</Var><Sub>charge</Sub> × <Var>η</Var><Sub>c</Sub> - <Var>P</Var><Sub>d</Sub> × <Var>f</Var><Sub>discharge</Sub> / <Var>η</Var><Sub>d</Sub></FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>SOC</Var><Sub>i+1</Sub>: 下一小时电池荷电状态 (MWh)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>c</Sub>: 充电功率 (MW)，受充电倍率限制</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>d</Sub>: 放电功率 (MW)，受放电倍率限制</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>c</Sub>: 充电效率 ≈ 0.95（电能转化为化学能的效率）</FormulaLine>
        <FormulaLine indent={1}><Var>η</Var><Sub>d</Sub>: 放电效率 ≈ 0.95（化学能转化为电能的效率）</FormulaLine>
        <FormulaLine indent={1}>往返效率: <Var>η</Var><Sub>round</Sub> = <Var>η</Var><Sub>c</Sub> × <Var>η</Var><Sub>d</Sub> ≈ 0.90</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>功率约束:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>c</Sub> ≤ min(|<Var>LPS</Var><Sub>i</Sub>|, <Var>P</Var><Sub>c,max</Sub>, (<Var>SOC</Var><Sub>max</Sub> - <Var>SOC</Var><Sub>i</Sub>) / <Var>η</Var><Sub>c</Sub>)</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>d</Sub> ≤ min(<Var>LPS</Var><Sub>i</Sub>, <Var>P</Var><Sub>d,max</Sub>, (<Var>SOC</Var><Sub>i</Sub> - <Var>SOC</Var><Sub>min</Sub>) × <Var>η</Var><Sub>d</Sub>)</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>设备型号参考</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={`border-b ${borderColor} ${textSecondary}`}>
            <th className="text-left py-2 px-2">型号</th><th className="text-left py-2 px-2">容量</th>
            <th className="text-left py-2 px-2">循环寿命</th><th className="text-left py-2 px-2">放电深度</th>
            <th className="text-left py-2 px-2">往返效率</th><th className="text-left py-2 px-2">类型</th><th className="text-left py-2 px-2">参考价格</th>
          </tr></thead>
          <tbody className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">BAT-100L</td><td>100Ah/5.12kWh</td><td>6000次</td><td>90%</td><td>90%</td><td>磷酸铁锂</td><td>1.2-1.5万</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">BAT-200L</td><td>200Ah/10.24kWh</td><td>6000次</td><td>90%</td><td>91%</td><td>磷酸铁锂</td><td>2.2-2.8万</td></tr>
            <tr className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}><td className="py-1.5 px-2">BAT-280L</td><td>280Ah/14.34kWh</td><td>6000次</td><td>90%</td><td>92%</td><td>磷酸铁锂</td><td>3.0-3.8万</td></tr>
          </tbody>
        </table>
      </div>
      <div className={`mt-3 text-xs ${textMuted}`}>注：放电深度(DOD)表示电池可用容量占总容量的比例。循环寿命指在该DOD下的充放电次数。</div>
    </div>
  );

  // 渲染搜索方法
  const renderSearch = () => (
    <div id="section-search" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.5 遍历搜索方法</h3>
      <p className={`${textSecondary} text-sm mb-4`}>在估算的搜索范围内遍历所有可能的容量组合，找出最优方案。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>搜索范围估算</h4>
      <Formula theme={theme}>
        <FormulaLine>风电搜索范围:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>wind,max</Sub> = <Var>E</Var><Sub>annual</Sub> / <Var>H</Var><Sub>wind</Sub> × <Var>k</Var><Sub>margin</Sub></FormulaLine>
        <FormulaLine indent={1}>变量说明:</FormulaLine>
        <FormulaLine indent={2}><Var>E</Var><Sub>annual</Sub>: 年用电量 (MWh/年)</FormulaLine>
        <FormulaLine indent={2}><Var>H</Var><Sub>wind</Sub>: 风电等效利用小时数 (h/年)</FormulaLine>
        <FormulaLine indent={2}><Var>k</Var><Sub>margin</Sub>: 裕度系数 = 1.5（考虑弃电和备用）</FormulaLine>
        <FormulaLine indent={1}>搜索步长: 容量 &lt; 10MW → 1MW | 容量 &lt; 30MW → 2MW | 其他 → 5MW</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>光伏搜索范围:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>solar,max</Sub> = <Var>E</Var><Sub>annual</Sub> / <Var>H</Var><Sub>solar</Sub> × <Var>k</Var><Sub>margin</Sub></FormulaLine>
        <FormulaLine indent={1}>变量说明:</FormulaLine>
        <FormulaLine indent={2}><Var>H</Var><Sub>solar</Sub>: 光伏等效利用小时数 (h/年)</FormulaLine>
        <FormulaLine indent={1}>搜索步长: 容量 &lt; 10MW → 1MW | 容量 &lt; 30MW → 2MW | 其他 → 5MW</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>生物质搜索范围:</FormulaLine>
        <FormulaLine indent={1}><Var>P</Var><Sub>bio,max</Sub> = (<Var>m</Var> × <Var>Q</Var><Sub>LHV</Sub> × <Var>η</Var><Sub>total</Sub>) / (3600 × <Var>t</Var><Sub>op</Sub>) × <Var>k</Var><Sub>bio</Sub></FormulaLine>
        <FormulaLine indent={1}>变量说明:</FormulaLine>
        <FormulaLine indent={2}><Var>m</Var>: 日生物质产量 (kg/d)</FormulaLine>
        <FormulaLine indent={2}><Var>Q</Var><Sub>LHV</Sub>: 低位热值 (MJ/kg)</FormulaLine>
        <FormulaLine indent={2}><Var>η</Var><Sub>total</Sub>: 综合发电效率</FormulaLine>
        <FormulaLine indent={2}><Var>t</Var><Sub>op</Sub>: 日运行小时数 = 20h</FormulaLine>
        <FormulaLine indent={2}><Var>k</Var><Sub>bio</Sub>: 裕度系数 = 1.2</FormulaLine>
        <FormulaLine indent={1}>搜索步长: 功率 &lt; 3MW → 0.5MW | 功率 &lt; 10MW → 1MW | 其他 → 2MW</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>储能搜索范围:</FormulaLine>
        <FormulaLine indent={1}><Var>E</Var><Sub>bat,min</Sub> = <Var>P</Var><Sub>peak</Sub> × <Var>T</Var><Sub>min</Sub></FormulaLine>
        <FormulaLine indent={1}><Var>E</Var><Sub>bat,max</Sub> = <Var>P</Var><Sub>peak</Sub> × <Var>T</Var><Sub>max</Sub></FormulaLine>
        <FormulaLine indent={1}>变量说明:</FormulaLine>
        <FormulaLine indent={2}><Var>P</Var><Sub>peak</Sub>: 峰值负荷 (MW)</FormulaLine>
        <FormulaLine indent={2}><Var>T</Var><Sub>min</Sub>: 最小储能时长 = 2h</FormulaLine>
        <FormulaLine indent={2}><Var>T</Var><Sub>max</Sub>: 最大储能时长 = 12h</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2`}>遍历搜索伪代码</h4>
      <Formula theme={theme}>
        <FormulaLine>// 四重循环遍历所有容量组合</FormulaLine>
        <FormulaLine>for <Var>wind</Var> in range(0, <Var>windMax</Var>, <Var>windStep</Var>):</FormulaLine>
        <FormulaLine indent={1}>for <Var>solar</Var> in range(0, <Var>solarMax</Var>, <Var>solarStep</Var>):</FormulaLine>
        <FormulaLine indent={2}>for <Var>biomass</Var> in range(0, <Var>biomassMax</Var>, <Var>biomassStep</Var>):</FormulaLine>
        <FormulaLine indent={3}>for <Var>battery</Var> in range(<Var>batteryMin</Var>, <Var>batteryMax</Var>, <Var>batteryStep</Var>):</FormulaLine>
        <FormulaLine indent={4}>// 8760小时仿真</FormulaLine>
        <FormulaLine indent={4}><Var>result</Var> = simulate8760Hours(<Var>wind</Var>, <Var>solar</Var>, <Var>biomass</Var>, <Var>battery</Var>)</FormulaLine>
        <FormulaLine indent={4}>// 计算评分</FormulaLine>
        <FormulaLine indent={4}><Var>score</Var> = calculateScore(<Var>result</Var>)</FormulaLine>
        <FormulaLine indent={4}>// 更新最优解</FormulaLine>
        <FormulaLine indent={4}>if <Var>score</Var> &gt; <Var>bestScore</Var>:</FormulaLine>
        <FormulaLine indent={5}><Var>bestSolution</Var> = (<Var>wind</Var>, <Var>solar</Var>, <Var>biomass</Var>, <Var>battery</Var>)</FormulaLine>
        <FormulaLine indent={5}><Var>bestScore</Var> = <Var>score</Var></FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>8760小时仿真输出指标</h4>
      <Formula theme={theme}>
        <FormulaLine>供电可靠率:</FormulaLine>
        <FormulaLine indent={1}><Var>LPSP</Var> = Σ<Var>LPS</Var><Sub>i</Sub><Sup>+</Sup> / Σ<Var>L</Var><Sub>i</Sub> × 100%</FormulaLine>
        <FormulaLine indent={1}>可靠率 = 1 - <Var>LPSP</Var></FormulaLine>
        <FormulaLine indent={1}>其中 <Var>LPS</Var><Sub>i</Sub><Sup>+</Sup> 表示取正值（缺电量）</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>弃电率:</FormulaLine>
        <FormulaLine indent={1}><Var>CurtailRate</Var> = Σ<Var>E</Var><Sub>curtail,i</Sub> / Σ<Var>E</Var><Sub>gen,i</Sub> × 100%</FormulaLine>
        <FormulaLine indent={1}><Var>E</Var><Sub>curtail,i</Sub>: 第i小时弃电量 (MWh)</FormulaLine>
        <FormulaLine indent={1}><Var>E</Var><Sub>gen,i</Sub>: 第i小时总发电量 (MWh)</FormulaLine>
      </Formula>
    </div>
  );

  // 渲染评分系统
  const renderScoring = () => (
    <div id="section-scoring" className="mb-8">
      <h3 className={`text-lg font-bold ${textPrimary} mb-4 pb-2 border-b ${borderColor}`}>3.6 评分系统</h3>
      <p className={`${textSecondary} text-sm mb-4`}>综合考虑可靠性、经济性、稳定性等因素对方案进行评分。</p>
      
      <h4 className={`${textPrimary} font-medium mb-2`}>总分计算</h4>
      <Formula theme={theme}>
        <FormulaLine><Var>Score</Var><Sub>total</Sub> = <Var>S</Var><Sub>rel</Sub> + <Var>S</Var><Sub>match</Sub> + <Var>S</Var><Sub>econ</Sub> + <Var>S</Var><Sub>stab</Sub> + <Var>S</Var><Sub>group</Sub></FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>变量说明:</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var><Sub>rel</Sub>: 工况满足评分 (0~30分)，衡量供电可靠性</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var><Sub>match</Sub>: 设备匹配评分 (0~20分)，衡量设备选型合理性</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var><Sub>econ</Sub>: 经济性评分 (0~30分)，衡量投资成本</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var><Sub>stab</Sub>: 稳定性评分 (0~20分)，衡量系统稳定性</FormulaLine>
        <FormulaLine indent={1}><Var>S</Var><Sub>group</Sub>: 小组加分 (0~10分)，衡量小组协同效果</FormulaLine>
        <FormulaLine>&nbsp;</FormulaLine>
        <FormulaLine>满分 = 30 + 20 + 30 + 20 = 100分 (不含小组加分)</FormulaLine>
      </Formula>

      <h4 className={`${textPrimary} font-medium mb-2 mt-4`}>各项评分标准</h4>
      <div className="space-y-3">
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className={`font-medium ${textPrimary} mb-2`}>1. 工况满足评分 <Var>S</Var><Sub>rel</Sub> (30分)</div>
          <Formula theme={theme}>
            <FormulaLine><Var>S</Var><Sub>rel</Sub> = f(<Var>Reliability</Var>)</FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>评分规则:</FormulaLine>
            <FormulaLine indent={1}><Var>Reliability</Var> ≥ 99.9%: 30分（优秀）</FormulaLine>
            <FormulaLine indent={1}><Var>Reliability</Var> ≥ 99.5%: 26分（良好）</FormulaLine>
            <FormulaLine indent={1}><Var>Reliability</Var> ≥ 99.0%: 22分（合格）</FormulaLine>
            <FormulaLine indent={1}><Var>Reliability</Var> ≥ 98.0%: 18分（基本合格）</FormulaLine>
            <FormulaLine indent={1}><Var>Reliability</Var> &lt; 98.0%: 线性递减</FormulaLine>
          </Formula>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className={`font-medium ${textPrimary} mb-2`}>2. 设备匹配评分 <Var>S</Var><Sub>match</Sub> (20分)</div>
          <Formula theme={theme}>
            <FormulaLine><Var>S</Var><Sub>match</Sub> = <Var>S</Var><Sub>wind,match</Sub> + <Var>S</Var><Sub>solar,match</Sub> + <Var>S</Var><Sub>bio,match</Sub> + <Var>S</Var><Sub>bat,match</Sub></FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>各项说明:</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>wind,match</Sub>: 风机选型合理性 (0~5分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 切入风速与区域风速匹配度、单机容量与总容量比例</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>solar,match</Sub>: 光伏组件效率 (0~5分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 组件效率等级、温度系数与区域气候匹配</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>bio,match</Sub>: 生物质路线适配度 (0~5分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 技术路线与生物质类型匹配、规模与产量匹配</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>bat,match</Sub>: 储能容量匹配度 (0~5分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 储能时长与负荷特性匹配、充放电倍率合理性</FormulaLine>
          </Formula>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className={`font-medium ${textPrimary} mb-2`}>3. 经济性评分 <Var>S</Var><Sub>econ</Sub> (30分)</div>
          <Formula theme={theme}>
            <FormulaLine><Var>CostRatio</Var> = <Var>C</Var><Sub>actual</Sub> / <Var>C</Var><Sub>optimal</Sub></FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>变量说明:</FormulaLine>
            <FormulaLine indent={1}><Var>C</Var><Sub>actual</Sub>: 实际方案总投资成本 (万元)</FormulaLine>
            <FormulaLine indent={1}><Var>C</Var><Sub>optimal</Sub>: 最优方案总投资成本 (万元)</FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>评分规则:</FormulaLine>
            <FormulaLine indent={1}><Var>CostRatio</Var> ≤ 1.0: 30分（最优）</FormulaLine>
            <FormulaLine indent={1}><Var>CostRatio</Var> ≤ 1.1: 25分（优秀）</FormulaLine>
            <FormulaLine indent={1}><Var>CostRatio</Var> ≤ 1.2: 20分（良好）</FormulaLine>
            <FormulaLine indent={1}><Var>CostRatio</Var> ≤ 1.5: 15分（合格）</FormulaLine>
            <FormulaLine indent={1}><Var>CostRatio</Var> &gt; 1.5: 10分以下（需优化）</FormulaLine>
          </Formula>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className={`font-medium ${textPrimary} mb-2`}>4. 稳定性评分 <Var>S</Var><Sub>stab</Sub> (20分)</div>
          <Formula theme={theme}>
            <FormulaLine><Var>S</Var><Sub>stab</Sub> = <Var>S</Var><Sub>reserve</Sub> + <Var>S</Var><Sub>ESS</Sub> + <Var>S</Var><Sub>coverage</Sub></FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>各项说明 (公式4.16-4.21):</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>reserve</Sub>: 备用容量评分 (0~8分)</FormulaLine>
            <FormulaLine indent={2}>R<Sub>cap</Sub> = (P<Sub>installed</Sub> - P<Sub>rated,max</Sub>) / P<Sub>rated,max</Sub></FormulaLine>
            <FormulaLine indent={2}>最优范围: 0.15 ≤ R<Sub>cap</Sub> ≤ 0.25</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>ESS</Sub>: 储能调节评分 (0~7分)</FormulaLine>
            <FormulaLine indent={2}>η<Sub>esi</Sub> = E<Sub>discharge,annual</Sub> / (E<Sub>ess</Sub> × 365)</FormulaLine>
            <FormulaLine indent={2}>最优范围: 0.6 ≤ η<Sub>esi</Sub> ≤ 0.8</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>coverage</Sub>: 能源差异性评分 (0~5分)</FormulaLine>
            <FormulaLine indent={2}>σ<Sub>energy</Sub> = √(Σ(k<Sub>i</Sub> - k̄)²/3)</FormulaLine>
            <FormulaLine indent={2}>S<Sub>coverage</Sub> = 5 × (1 - σ<Sub>energy</Sub>/0.3)</FormulaLine>
          </Formula>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3`}>
          <div className={`font-medium ${textPrimary} mb-2`}>5. 小组加分 <Var>S</Var><Sub>group</Sub> (10分)</div>
          <Formula theme={theme}>
            <FormulaLine><Var>S</Var><Sub>group</Sub> = <Var>S</Var><Sub>complement</Sub> + <Var>S</Var><Sub>transport</Sub> + <Var>S</Var><Sub>dispatch</Sub></FormulaLine>
            <FormulaLine>&nbsp;</FormulaLine>
            <FormulaLine>各项说明:</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>complement</Sub>: 资源互补合理性 (0~4分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 风光互补、昼夜互补、季节互补</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>transport</Sub>: 生物质运输路线优化 (0~3分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 运输距离、路线合理性、运输成本</FormulaLine>
            <FormulaLine indent={1}><Var>S</Var><Sub>dispatch</Sub>: 电力调度协调性 (0~3分)</FormulaLine>
            <FormulaLine indent={2}>考虑: 小组内电力互济、峰谷调节能力</FormulaLine>
          </Formula>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div
        ref={panelRef}
        className={`${bgMain} border ${borderColor} rounded-xl shadow-2xl w-[1000px] max-h-[85vh] flex absolute`}
        style={{ left: position.x, top: position.y, cursor: isDragging ? 'grabbing' : 'default' }}
      >
        {/* 左侧导航栏 */}
        <div className={`w-48 ${bgSidebar} border-r ${borderColor} flex flex-col`}>
          <div
            className={`p-3 border-b ${borderColor} cursor-grab active:cursor-grabbing select-none flex items-center gap-2`}
            onMouseDown={handleMouseDown}
          >
            <GripHorizontal className={`w-4 h-4 ${textMuted}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>导航</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedSections.has(item.id);
              const isActive = activeSection === item.id;
              const hasActiveChild = item.children?.some(child => activeSection === child.id);
              
              return (
                <div key={item.id}>
                  <div className="flex items-center">
                    {/* 展开/折叠按钮 */}
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className={`p-1 ml-1 ${textMuted} ${isDark ? 'hover:text-gray-300' : 'hover:text-gray-700'} transition-colors`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 ml-1" />
                    )}
                    
                    {/* 菜单项 */}
                    <button
                      onClick={() => scrollToSection(item.id)}
                      className={`flex-1 text-left px-2 py-2 text-sm flex items-center gap-2 transition-all ${
                        isActive || hasActiveChild
                          ? 'bg-blue-600/20 text-blue-500 border-r-2 border-blue-500'
                          : `${textSecondary} ${hoverBg} ${isDark ? 'hover:text-gray-200' : 'hover:text-gray-900'}`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </div>
                  
                  {/* 子菜单 */}
                  {hasChildren && isExpanded && (
                    <div className="ml-4">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeSection === child.id;
                        
                        return (
                          <button
                            key={child.id}
                            onClick={() => scrollToSection(child.id)}
                            className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-all ${
                              isChildActive
                                ? 'bg-blue-600/20 text-blue-500 border-r-2 border-blue-500'
                                : `${textMuted} ${hoverBg} ${isDark ? 'hover:text-gray-300' : 'hover:text-gray-700'}`
                            }`}
                          >
                            <ChildIcon className="w-3.5 h-3.5" />
                            <span className="truncate text-xs">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div
            className={`p-4 border-b ${borderColor} flex justify-between items-center cursor-grab active:cursor-grabbing select-none`}
            onMouseDown={handleMouseDown}
          >
            <h2 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
              <Calculator className={`w-5 h-5 ${textSecondary}`} />
              系统设计方案说明
            </h2>
            <button onClick={onClose} className={`${textSecondary} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'} p-1`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
            {renderRegions()}
            {renderGroups()}
            {renderOverview()}
            {renderWind()}
            {renderSolar()}
            {renderBiomass()}
            {renderBattery()}
            {renderSearch()}
            {renderScoring()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignSchemePanel;
