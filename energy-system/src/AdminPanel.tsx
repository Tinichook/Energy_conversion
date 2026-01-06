import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Settings,
  Leaf,
  Sun,
  Wind,
  Zap,
  RefreshCw,
  GripHorizontal,
  Link,
  Trash2,
} from 'lucide-react';
import {
  REGION_CONFIGS,
  SingleRegionConfig,
  GLOBAL_CONFIG,
  CITY_TYPES,
  CityType,
  exportConfigToJSON,
  importConfigFromJSON,
  resetRegionConfig,
  updateRegionConfig,
  initializeFromJson,
} from './DataSetting';

// 城市数据接口
interface CityData {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  biomassComp: {
    C: number; H: number; O: number; N: number; S: number;
    Moisture: number; Volatiles: number; FixedCarbon: number; Ash: number;
  };
  baseCostMultiplier: number;
  biomassConnections: number[];
  powerConnections: number[];
}

type ThemeMode = 'dark' | 'light';

interface AdminPanelProps {
  onClose: () => void;
  onConfigUpdate: () => void;
  cities: CityData[];
  initialRegionId?: number; // 初始选中的区域ID
  theme?: ThemeMode;
}

// 本地存储键名
const CONFIG_STORAGE_KEY = 'energy_system_region_configs';

// 保存配置到localStorage
export const saveConfigToStorage = () => {
  const configJson = exportConfigToJSON();
  localStorage.setItem(CONFIG_STORAGE_KEY, configJson);
};

// 保存配置到JSON文件（通过API）
export const saveConfigToFile = async (): Promise<{ success: boolean; message: string }> => {
  const configJson = exportConfigToJSON();
  try {
    const response = await fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: configJson,
    });
    return await response.json();
  } catch (e) {
    return { success: false, message: '保存失败: ' + e };
  }
};

// 导出配置为JSON文件下载（用于保存到本地文件）
export const downloadConfigAsFile = () => {
  const configJson = exportConfigToJSON();
  const blob = new Blob([configJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regionConfigs.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 从localStorage加载配置
// 如果localStorage中的数据缺少biomassLinks/powerLinks，则从JSON文件补充
export const loadConfigFromStorage = (): boolean => {
  // 设置为false以使用localStorage缓存，设置为true强制从JSON重新加载
  const forceReload = false; // 使用localStorage缓存（已修复数据验证逻辑）
  if (forceReload) {
    console.log('强制从JSON文件重新加载配置');
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    initializeFromJson();
    return false;
  }
  
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      const parsedConfig = JSON.parse(stored);
      // 检查是否有连接数据（检查第一个区域）
      const firstRegion = parsedConfig.regionConfigs?.['1'];
      if (firstRegion && (!firstRegion.connections?.biomassLinks || firstRegion.connections.biomassLinks.length === 0)) {
        // localStorage中的数据缺少连接信息，清除并使用JSON文件
        console.log('localStorage数据缺少连接信息，使用JSON文件数据');
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        initializeFromJson();
        return false;
      }
      
      // 检查负荷数据是否有效
      if (firstRegion && (!firstRegion.resource?.load?.dayBase || firstRegion.resource.load.dayBase < 1000)) {
        console.log('localStorage数据负荷配置无效，使用JSON文件数据');
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        initializeFromJson();
        return false;
      }
      
      importConfigFromJSON(stored);
      return true;
    } catch (e) {
      console.error('加载配置失败:', e);
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      initializeFromJson();
    }
  }
  return false;
};

// 输入框组件 - 移到组件外部避免重新创建
const InputField: React.FC<{
  label: string;
  value: number | string;
  onChange: (v: any) => void;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  theme?: ThemeMode;
}> = React.memo(({ label, value, onChange, type = 'number', step = '1', min, max, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  return (
    <div>
      <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} block mb-1`}>{label}</label>
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none`}
      />
    </div>
  );
});

// 区块头部组件
const SectionHeader: React.FC<{
  title: string;
  icon: any;
  expanded: boolean;
  onToggle: () => void;
  color: string;
  theme?: ThemeMode;
}> = React.memo(({ title, icon: Icon, expanded, onToggle, color, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  // 浅色主题下使用对应的浅色背景
  const colorMap: Record<string, string> = {
    'bg-gray-700': 'bg-gray-200',
    'bg-cyan-900/50': 'bg-cyan-100',
    'bg-blue-900/50': 'bg-blue-100',
    'bg-yellow-900/50': 'bg-yellow-100',
    'bg-red-900/50': 'bg-red-100',
    'bg-green-900/50': 'bg-green-100',
    'bg-purple-900/50': 'bg-purple-100',
  };
  const lightColor = colorMap[color] || 'bg-gray-200';
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 rounded-lg ${isDark ? color : lightColor} hover:opacity-90 transition-all ${isDark ? 'text-white' : 'text-gray-800'}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );
});

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onConfigUpdate, initialRegionId, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [selectedRegionId, setSelectedRegionId] = useState<number>(initialRegionId || 1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    connections: true,
    wind: false,
    solar: false,
    load: false,
    biomass: false,
    material: false,
  });
  const [localConfig, setLocalConfig] = useState<SingleRegionConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 拖拽相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 初始化窗口位置为居中
  useEffect(() => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2,
      });
    }
  }, []);

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // 全局鼠标事件监听
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 0);
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };
    const handleGlobalMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  // 加载选中区域的配置
  useEffect(() => {
    const config = REGION_CONFIGS[selectedRegionId];
    if (config) {
      // 深拷贝配置
      const configCopy = JSON.parse(JSON.stringify(config));
      // 确保 connections 有 biomassLinks 和 powerLinks
      if (!configCopy.connections.biomassLinks) {
        configCopy.connections.biomassLinks = [];
      }
      if (!configCopy.connections.powerLinks) {
        configCopy.connections.powerLinks = [];
      }
      setLocalConfig(configCopy);
      setHasChanges(false);
    }
  }, [selectedRegionId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 更新本地配置
  const updateLocalConfig = (path: string, value: any) => {
    if (!localConfig) return;
    setLocalConfig(prev => {
      if (!prev) return prev;
      const newConfig = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newConfig;
    });
    setHasChanges(true);
  };

  // 保存当前区域配置（同时处理双向连接）
  const saveCurrentRegion = () => {
    if (!localConfig) return;

    // 获取原始配置的连接
    const originalConfig = REGION_CONFIGS[selectedRegionId];
    const originalBiomassLinks = originalConfig?.connections.biomassLinks || [];
    const originalPowerLinks = originalConfig?.connections.powerLinks || [];
    const newBiomassLinks = localConfig.connections.biomassLinks || [];
    const newPowerLinks = localConfig.connections.powerLinks || [];

    // 找出新增和删除的连接
    const addedBiomassLinks = newBiomassLinks.filter(id => !originalBiomassLinks.includes(id));
    const removedBiomassLinks = originalBiomassLinks.filter(id => !newBiomassLinks.includes(id));
    const addedPowerLinks = newPowerLinks.filter(id => !originalPowerLinks.includes(id));
    const removedPowerLinks = originalPowerLinks.filter(id => !newPowerLinks.includes(id));

    // 更新当前区域配置
    updateRegionConfig(selectedRegionId, localConfig);

    // 处理双向连接 - 生物质
    addedBiomassLinks.forEach(targetId => {
      const targetConfig = REGION_CONFIGS[targetId];
      if (targetConfig) {
        const targetLinks = targetConfig.connections.biomassLinks || [];
        if (!targetLinks.includes(selectedRegionId)) {
          targetConfig.connections.biomassLinks = [...targetLinks, selectedRegionId].sort((a, b) => a - b);
          targetConfig.connections.biomassCount = targetConfig.connections.biomassLinks.length;
        }
      }
    });
    removedBiomassLinks.forEach(targetId => {
      const targetConfig = REGION_CONFIGS[targetId];
      if (targetConfig && targetConfig.connections.biomassLinks) {
        targetConfig.connections.biomassLinks = targetConfig.connections.biomassLinks.filter(id => id !== selectedRegionId);
        targetConfig.connections.biomassCount = targetConfig.connections.biomassLinks.length;
      }
    });

    // 处理双向连接 - 电力
    addedPowerLinks.forEach(targetId => {
      const targetConfig = REGION_CONFIGS[targetId];
      if (targetConfig) {
        const targetLinks = targetConfig.connections.powerLinks || [];
        if (!targetLinks.includes(selectedRegionId)) {
          targetConfig.connections.powerLinks = [...targetLinks, selectedRegionId].sort((a, b) => a - b);
          targetConfig.connections.powerCount = targetConfig.connections.powerLinks.length;
        }
      }
    });
    removedPowerLinks.forEach(targetId => {
      const targetConfig = REGION_CONFIGS[targetId];
      if (targetConfig && targetConfig.connections.powerLinks) {
        targetConfig.connections.powerLinks = targetConfig.connections.powerLinks.filter(id => id !== selectedRegionId);
        targetConfig.connections.powerCount = targetConfig.connections.powerLinks.length;
      }
    });

    saveConfigToStorage();
    setHasChanges(false);
    onConfigUpdate();
  };

  // 导出配置到JSON文件（可直接替换 src/regionConfigs.json）
  const handleExportConfig = () => {
    const json = exportConfigToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regionConfigs.json'; // 文件名与源文件一致，方便替换
    a.click();
    URL.revokeObjectURL(url);
    alert('配置已导出！请将下载的 regionConfigs.json 文件复制到 energy-system/src/ 目录下替换原文件。');
  };

  // 导入配置从JSON文件
  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          importConfigFromJSON(content);
          saveConfigToStorage();
          const config = REGION_CONFIGS[selectedRegionId];
          if (config) {
            const configCopy = JSON.parse(JSON.stringify(config));
            if (!configCopy.connections.biomassLinks) configCopy.connections.biomassLinks = [];
            if (!configCopy.connections.powerLinks) configCopy.connections.powerLinks = [];
            setLocalConfig(configCopy);
          }
          setHasChanges(false);
          onConfigUpdate();
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // 重置当前区域
  const handleResetRegion = () => {
    if (confirm(`确定要重置区域 ${selectedRegionId} 的配置吗？`)) {
      resetRegionConfig(selectedRegionId);
      saveConfigToStorage();
      const config = REGION_CONFIGS[selectedRegionId];
      if (config) {
        const configCopy = JSON.parse(JSON.stringify(config));
        if (!configCopy.connections.biomassLinks) configCopy.connections.biomassLinks = [];
        if (!configCopy.connections.powerLinks) configCopy.connections.powerLinks = [];
        setLocalConfig(configCopy);
      }
      setHasChanges(false);
      onConfigUpdate();
    }
  };

  // 重置所有区域（从JSON文件重新加载）
  const handleResetAll = () => {
    if (confirm('确定要重置所有区域的配置吗？此操作将从JSON文件重新加载所有配置！')) {
      // 清除localStorage
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      initializeFromJson();
      const config = REGION_CONFIGS[selectedRegionId];
      if (config) {
        const configCopy = JSON.parse(JSON.stringify(config));
        if (!configCopy.connections.biomassLinks) configCopy.connections.biomassLinks = [];
        if (!configCopy.connections.powerLinks) configCopy.connections.powerLinks = [];
        setLocalConfig(configCopy);
      }
      setHasChanges(false);
      onConfigUpdate();
    }
  };

  // 添加生物质连接
  const addBiomassLink = (targetId: number) => {
    if (!localConfig || isNaN(targetId)) return;
    const currentLinks = localConfig.connections.biomassLinks || [];
    if (!currentLinks.includes(targetId)) {
      const newLinks = [...currentLinks, targetId].sort((a, b) => a - b);
      updateLocalConfig('connections.biomassLinks', newLinks);
      updateLocalConfig('connections.biomassCount', newLinks.length);
    }
  };

  // 删除生物质连接
  const removeBiomassLink = (targetId: number) => {
    if (!localConfig) return;
    const newLinks = (localConfig.connections.biomassLinks || []).filter(id => id !== targetId);
    updateLocalConfig('connections.biomassLinks', newLinks);
    updateLocalConfig('connections.biomassCount', newLinks.length);
  };

  // 添加电力连接
  const addPowerLink = (targetId: number) => {
    if (!localConfig || isNaN(targetId)) return;
    const currentLinks = localConfig.connections.powerLinks || [];
    if (!currentLinks.includes(targetId)) {
      const newLinks = [...currentLinks, targetId].sort((a, b) => a - b);
      updateLocalConfig('connections.powerLinks', newLinks);
      updateLocalConfig('connections.powerCount', newLinks.length);
    }
  };

  // 删除电力连接
  const removePowerLink = (targetId: number) => {
    if (!localConfig) return;
    const newLinks = (localConfig.connections.powerLinks || []).filter(id => id !== targetId);
    updateLocalConfig('connections.powerLinks', newLinks);
    updateLocalConfig('connections.powerCount', newLinks.length);
  };

  if (!localConfig) return null;

  return (
    <div className={`fixed inset-0 ${isDark ? 'bg-black/50' : 'bg-black/30'} z-50`}>
      <div
        ref={panelRef}
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'} border rounded-xl shadow-2xl w-[1000px] max-h-[85vh] flex flex-col absolute`}
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* 头部 - 可拖拽区域 */}
        <div
          className={`${isDark ? 'bg-purple-900/50 border-gray-700' : 'bg-purple-100 border-gray-300'} p-4 flex justify-between items-center border-b cursor-grab active:cursor-grabbing select-none`}
          onMouseDown={handleMouseDown}
        >
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <GripHorizontal className={`w-5 h-5 ${isDark ? 'text-purple-300' : 'text-purple-600'} mr-1`} />
            <Settings className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            管理员控制面板 - 区域参数配置
          </h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} p-1`}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：区域列表 */}
          <div className={`w-48 border-r ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} overflow-y-auto`}>
            <div className={`p-2 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>选择区域</div>
            </div>
            <div className="p-1">
              {Array.from({ length: GLOBAL_CONFIG.totalRegions }, (_, i) => i + 1).map(id => {
                const config = REGION_CONFIGS[id];
                const isTest = id >= GLOBAL_CONFIG.bufferRegionStart;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedRegionId(id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${
                      selectedRegionId === id
                        ? 'bg-blue-600 text-white'
                        : isTest
                          ? `${isDark ? 'text-yellow-400 hover:bg-gray-700' : 'text-yellow-600 hover:bg-gray-200'}`
                          : `${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`
                    }`}
                  >
                    {config?.name || `区域-${id}`}
                    <span className="text-xs ml-1 opacity-60">({config?.type})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右侧：配置编辑 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 基本信息 */}
            <div>
              <SectionHeader
                title="基本信息"
                icon={Settings}
                expanded={expandedSections.basic}
                onToggle={() => toggleSection('basic')}
                color="bg-gray-700"
                theme={theme}
              />
              {expandedSections.basic && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border space-y-3`}>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="区域名称" value={localConfig.name} onChange={(v) => updateLocalConfig('name', v)} type="text" theme={theme} />
                    <div>
                      <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} block mb-1`}>区域类型</label>
                      <select
                        value={localConfig.type}
                        onChange={(e) => updateLocalConfig('type', e.target.value as CityType)}
                        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1.5 text-sm`}
                      >
                        {CITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <InputField label="成本系数" value={localConfig.costMultiplier} onChange={(v) => updateLocalConfig('costMultiplier', v)} step="0.1" theme={theme} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="位置 X" value={localConfig.position.x} onChange={(v) => updateLocalConfig('position.x', v)} theme={theme} />
                    <InputField label="位置 Y" value={localConfig.position.y} onChange={(v) => updateLocalConfig('position.y', v)} theme={theme} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localConfig.enabled}
                      onChange={(e) => updateLocalConfig('enabled', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>启用该区域</label>
                  </div>
                </div>
              )}
            </div>

            {/* 连接配置 */}
            <div>
              <SectionHeader
                title="区域连接配置"
                icon={Link}
                expanded={expandedSections.connections}
                onToggle={() => toggleSection('connections')}
                color="bg-cyan-900/50"
                theme={theme}
              />
              {expandedSections.connections && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border space-y-4`}>
                  {/* 生物质连接 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'} uppercase tracking-wider flex items-center gap-1`}>
                        <Leaf className="w-3 h-3" /> 生物质连接 ({localConfig.connections.biomassLinks?.length || 0}个)
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                      {(localConfig.connections.biomassLinks || []).map(linkId => {
                        const linkedRegion = REGION_CONFIGS[linkId];
                        return (
                          <div
                            key={linkId}
                            className={`flex items-center gap-1 ${isDark ? 'bg-green-900/50 border-green-700' : 'bg-green-100 border-green-300'} border rounded px-2 py-1 text-sm`}
                          >
                            <span className={isDark ? 'text-green-300' : 'text-green-700'}>
                              {linkedRegion?.name || `区域-${linkId}`}
                            </span>
                            <button
                              onClick={() => removeBiomassLink(linkId)}
                              className="text-red-400 hover:text-red-300 ml-1"
                              title="删除连接"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      {(localConfig.connections.biomassLinks?.length || 0) === 0 && (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无连接</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        className={`flex-1 ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1.5 text-sm`}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            addBiomassLink(val);
                            e.target.value = '';
                          }
                        }}
                        value=""
                      >
                        <option value="">选择要添加的区域...</option>
                        {Array.from({ length: GLOBAL_CONFIG.totalRegions }, (_, i) => i + 1)
                          .filter(id => id !== selectedRegionId && !(localConfig.connections.biomassLinks || []).includes(id))
                          .map(id => {
                            const region = REGION_CONFIGS[id];
                            return (
                              <option key={id} value={id}>
                                {region?.name || `区域-${id}`} ({region?.type})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>

                  {/* 电力连接 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'} uppercase tracking-wider flex items-center gap-1`}>
                        <Zap className="w-3 h-3" /> 电力连接 ({localConfig.connections.powerLinks?.length || 0}个)
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                      {(localConfig.connections.powerLinks || []).map(linkId => {
                        const linkedRegion = REGION_CONFIGS[linkId];
                        return (
                          <div
                            key={linkId}
                            className={`flex items-center gap-1 ${isDark ? 'bg-yellow-900/50 border-yellow-700' : 'bg-yellow-100 border-yellow-300'} border rounded px-2 py-1 text-sm`}
                          >
                            <span className={isDark ? 'text-yellow-300' : 'text-yellow-700'}>
                              {linkedRegion?.name || `区域-${linkId}`}
                            </span>
                            <button
                              onClick={() => removePowerLink(linkId)}
                              className="text-red-400 hover:text-red-300 ml-1"
                              title="删除连接"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      {(localConfig.connections.powerLinks?.length || 0) === 0 && (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无连接</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        className={`flex-1 ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1.5 text-sm`}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            addPowerLink(val);
                            e.target.value = '';
                          }
                        }}
                        value=""
                      >
                        <option value="">选择要添加的区域...</option>
                        {Array.from({ length: GLOBAL_CONFIG.totalRegions }, (_, i) => i + 1)
                          .filter(id => id !== selectedRegionId && !(localConfig.connections.powerLinks || []).includes(id))
                          .map(id => {
                            const region = REGION_CONFIGS[id];
                            return (
                              <option key={id} value={id}>
                                {region?.name || `区域-${id}`} ({region?.type})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div className={`text-xs ${isDark ? 'text-gray-500 bg-gray-900/50' : 'text-gray-600 bg-gray-100'} p-2 rounded`}>
                    💡 提示：保存时连接会自动双向同步。添加 A→B 的连接后，区域 B 也会自动添加 B→A 的连接。
                  </div>
                </div>
              )}
            </div>

            {/* 风能配置 */}
            <div>
              <SectionHeader title="风能资源参数" icon={Wind} expanded={expandedSections.wind} onToggle={() => toggleSection('wind')} color="bg-blue-900/50" theme={theme} />
              {expandedSections.wind && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border`}>
                  <div className="grid grid-cols-4 gap-3">
                    <InputField label="基础风速 (m/s)" value={localConfig.resource.wind.baseSpeed} onChange={(v) => updateLocalConfig('resource.wind.baseSpeed', v)} step="0.5" theme={theme} />
                    <InputField label="随机波动范围" value={localConfig.resource.wind.variance} onChange={(v) => updateLocalConfig('resource.wind.variance', v)} step="0.5" theme={theme} />
                    <InputField label="日内波动幅度" value={localConfig.resource.wind.dailyAmplitude} onChange={(v) => updateLocalConfig('resource.wind.dailyAmplitude', v)} step="0.5" theme={theme} />
                    <InputField label="额外风速加成" value={localConfig.resource.wind.bonus} onChange={(v) => updateLocalConfig('resource.wind.bonus', v)} step="0.5" theme={theme} />
                  </div>
                </div>
              )}
            </div>

            {/* 太阳能配置 */}
            <div>
              <SectionHeader title="太阳能资源参数" icon={Sun} expanded={expandedSections.solar} onToggle={() => toggleSection('solar')} color="bg-yellow-900/50" theme={theme} />
              {expandedSections.solar && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border`}>
                  <div className="grid grid-cols-4 gap-3">
                    <InputField label="基础光照强度" value={localConfig.resource.solar.baseIntensity} onChange={(v) => updateLocalConfig('resource.solar.baseIntensity', v)} step="0.1" theme={theme} />
                    <InputField label="季节波动幅度" value={localConfig.resource.solar.seasonalAmplitude} onChange={(v) => updateLocalConfig('resource.solar.seasonalAmplitude', v)} step="0.1" theme={theme} />
                    <InputField label="随机波动" value={localConfig.resource.solar.variance} onChange={(v) => updateLocalConfig('resource.solar.variance', v)} step="0.05" theme={theme} />
                    <InputField label="光照系数" value={localConfig.resource.solar.multiplier} onChange={(v) => updateLocalConfig('resource.solar.multiplier', v)} step="0.1" theme={theme} />
                  </div>
                </div>
              )}
            </div>

            {/* 负荷配置 */}
            <div>
              <SectionHeader title="负荷参数" icon={Zap} expanded={expandedSections.load} onToggle={() => toggleSection('load')} color="bg-red-900/50" theme={theme} />
              {expandedSections.load && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border`}>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="白天基础负荷 (kW)" value={localConfig.resource.load.dayBase} onChange={(v) => updateLocalConfig('resource.load.dayBase', v)} theme={theme} />
                    <InputField label="夜间基础负荷 (kW)" value={localConfig.resource.load.nightBase} onChange={(v) => updateLocalConfig('resource.load.nightBase', v)} theme={theme} />
                    <InputField label="负荷波动" value={localConfig.resource.load.variance} onChange={(v) => updateLocalConfig('resource.load.variance', v)} theme={theme} />
                  </div>
                </div>
              )}
            </div>

            {/* 生物质配置 */}
            <div>
              <SectionHeader title="生物质资源参数" icon={Leaf} expanded={expandedSections.biomass} onToggle={() => toggleSection('biomass')} color="bg-green-900/50" theme={theme} />
              {expandedSections.biomass && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border space-y-3`}>
                  <div className="grid grid-cols-4 gap-3">
                    <InputField label="基础产量 (吨/天)" value={localConfig.resource.biomass.baseOutput} onChange={(v) => updateLocalConfig('resource.biomass.baseOutput', v)} theme={theme} />
                    <InputField label="收获期产量 (吨/天)" value={localConfig.resource.biomass.harvestOutput} onChange={(v) => updateLocalConfig('resource.biomass.harvestOutput', v)} theme={theme} />
                    <InputField label="产量波动" value={localConfig.resource.biomass.variance} onChange={(v) => updateLocalConfig('resource.biomass.variance', v)} theme={theme} />
                    <div>
                      <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} block mb-1`}>收获月份</label>
                      <input
                        type="text"
                        value={localConfig.resource.biomass.harvestMonths.join(',')}
                        onChange={(e) => {
                          const months = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 11);
                          updateLocalConfig('resource.biomass.harvestMonths', months);
                        }}
                        placeholder="如: 8,9"
                        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-2 py-1.5 text-sm`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 物料属性配置 */}
            <div>
              <SectionHeader title="物料属性配置" icon={Settings} expanded={expandedSections.material} onToggle={() => toggleSection('material')} color="bg-purple-900/50" theme={theme} />
              {expandedSections.material && (
                <div className={`mt-2 p-4 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border space-y-4`}>
                  {/* 工业分析 */}
                  <div>
                    <div className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'} uppercase tracking-wider mb-2`}>工业分析 (Proximate Analysis)</div>
                    <div className="grid grid-cols-4 gap-3">
                      <InputField label="水分 Moisture (%)" value={localConfig.material.proximate.Moisture} onChange={(v) => updateLocalConfig('material.proximate.Moisture', v)} step="0.5" theme={theme} />
                      <InputField label="挥发分 Volatiles (%)" value={localConfig.material.proximate.Volatiles} onChange={(v) => updateLocalConfig('material.proximate.Volatiles', v)} step="0.5" theme={theme} />
                      <InputField label="固定碳 FixedCarbon (%)" value={localConfig.material.proximate.FixedCarbon} onChange={(v) => updateLocalConfig('material.proximate.FixedCarbon', v)} step="0.5" theme={theme} />
                      <InputField label="灰分 Ash (%)" value={localConfig.material.proximate.Ash} onChange={(v) => updateLocalConfig('material.proximate.Ash', v)} step="0.5" theme={theme} />
                    </div>
                  </div>
                  {/* 元素分析 */}
                  <div>
                    <div className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'} uppercase tracking-wider mb-2`}>元素分析 (Elemental Analysis)</div>
                    <div className="grid grid-cols-5 gap-3">
                      <InputField label="碳 C (%)" value={localConfig.material.elemental.C} onChange={(v) => updateLocalConfig('material.elemental.C', v)} step="0.5" theme={theme} />
                      <InputField label="氢 H (%)" value={localConfig.material.elemental.H} onChange={(v) => updateLocalConfig('material.elemental.H', v)} step="0.5" theme={theme} />
                      <InputField label="氧 O (%)" value={localConfig.material.elemental.O} onChange={(v) => updateLocalConfig('material.elemental.O', v)} step="0.5" theme={theme} />
                      <InputField label="氮 N (%)" value={localConfig.material.elemental.N} onChange={(v) => updateLocalConfig('material.elemental.N', v)} step="0.1" theme={theme} />
                      <InputField label="硫 S (%)" value={localConfig.material.elemental.S} onChange={(v) => updateLocalConfig('material.elemental.S', v)} step="0.05" theme={theme} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className={`border-t ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} p-4 flex justify-between items-center`}>
          <div className="flex gap-2">
            <button onClick={handleExportConfig} className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
              <Download className="w-4 h-4" /> 导出配置
            </button>
            <button onClick={handleImportConfig} className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
              <Upload className="w-4 h-4" /> 导入配置
            </button>
            <button onClick={handleResetRegion} className="flex items-center gap-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm">
              <RefreshCw className="w-4 h-4" /> 重置当前区域
            </button>
            <button onClick={handleResetAll} className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
              <RefreshCw className="w-4 h-4" /> 重置所有
            </button>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <span className="text-yellow-400 text-sm mr-2 self-center">* 有未保存的更改</span>
            )}
            <button onClick={saveCurrentRegion} className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium">
              <Save className="w-4 h-4" /> 保存当前区域
            </button>
            <button 
              onClick={async () => {
                saveCurrentRegion();
                const result = await saveConfigToFile();
                if (result.success) {
                  alert('✓ 配置已保存到 regionConfigs.json 文件！');
                } else {
                  alert('保存失败: ' + result.message);
                }
              }} 
              className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium"
            >
              <Save className="w-4 h-4" /> 保存到文件
            </button>
            <button onClick={onClose} className={`flex items-center gap-1 px-4 py-2 ${isDark ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-400 hover:bg-gray-500'} text-white rounded text-sm`}>
              <X className="w-4 h-4" /> 关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
