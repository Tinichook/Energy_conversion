// ============================================
// 能源系统数据配置与生成模块
// 支持55个区域（1-52常规区域 + 53-55缓冲调试区域）
// 每个区域可独立配置所有参数
// ============================================

// --- 辅助函数（需要在模块初始化时使用，所以放在最前面）---

/**
 * 基于种子的伪随机数生成器
 */
const seededRandomInternal = (seed: number): number => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// --- 类型定义 ---

export type CityType = '工业区' | '林业区' | '农业区' | '居民区' | '山地区' | '测试区';
export type TimeUnit = '年' | '月' | '日';

export interface BiomassComposition {
  // 元素分析 (Elemental Analysis) - Sum = 100%
  C: number; H: number; O: number; N: number; S: number;
  // 工业分析 (Proximate Analysis) - Sum = 100%
  Moisture: number; Volatiles: number; FixedCarbon: number; Ash: number;
}

export interface City {
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

export interface ResourceData {
  wind: number[];
  solar: number[];
  load: number[];
  biomass: number[];
  temperature: number[];
}

// --- 单个区域的完整配置接口 ---

export interface RegionResourceConfig {
  /** 风速配置 */
  wind: {
    baseSpeed: number;      // 基础风速 (m/s)
    variance: number;       // 随机波动范围
    dailyAmplitude: number; // 日内波动幅度
    bonus: number;          // 额外风速加成
  };
  /** 光照配置 */
  solar: {
    baseIntensity: number;    // 基础光照强度
    seasonalAmplitude: number; // 季节波动幅度
    variance: number;          // 随机波动
    multiplier: number;        // 光照系数
  };
  /** 负荷配置 */
  load: {
    dayBase: number;    // 白天基础负荷
    nightBase: number;  // 夜间基础负荷
    variance: number;   // 负荷波动
  };
  /** 生物质配置 */
  biomass: {
    baseOutput: number;       // 基础产量
    harvestOutput: number;    // 收获期产量
    harvestMonths: number[];  // 收获月份
    variance: number;         // 产量波动
  };
  /** 温度配置 */
  temperature: {
    baseTemp: number;         // 年均基础温度 (°C)
    seasonalAmplitude: number; // 季节波动幅度 (°C)
    dailyAmplitude: number;   // 日内波动幅度 (°C)
    variance: number;         // 随机波动 (°C)
  };
}

export interface RegionMaterialConfig {
  /** 工业分析 (Proximate Analysis) */
  proximate: {
    Moisture: number;
    Volatiles: number;
    FixedCarbon: number;
    Ash: number;
  };
  /** 元素分析 (Elemental Analysis) */
  elemental: {
    C: number;
    H: number;
    O: number;
    N: number;
    S: number;
  };
  /** 成分波动范围 */
  variance: {
    proximate: { Moisture: number; Volatiles: number; FixedCarbon: number; Ash: number };
    elemental: { C: number; H: number; O: number; N: number; S: number };
  };
}

export interface SingleRegionConfig {
  id: number;
  name: string;
  type: CityType;
  enabled: boolean;           // 是否启用该区域
  position: { x: number; y: number };
  costMultiplier: number;     // 成本系数
  resource: RegionResourceConfig;
  material: RegionMaterialConfig;
  connections: {
    biomassCount: number;     // 生物质连接数
    powerCount: number;       // 电力连接数
    biomassLinks?: number[];  // 生物质连接的区域ID列表
    powerLinks?: number[];    // 电力连接的区域ID列表
  };
}

// --- 全局配置 ---

export interface GlobalConfig {
  mapWidth: number;
  mapHeight: number;
  totalRegions: number;       // 总区域数 (55)
  bufferRegionStart: number;  // 缓冲区域起始编号 (53)
}

export const GLOBAL_CONFIG: GlobalConfig = {
  mapWidth: 2000,
  mapHeight: 1500,
  totalRegions: 55,
  bufferRegionStart: 53,
};

// --- 区域类型列表 ---

export const CITY_TYPES: CityType[] = ['工业区', '林业区', '农业区', '居民区', '山地区', '测试区'];

// --- 默认配置模板（按区域类型） ---

const DEFAULT_RESOURCE_BY_TYPE: Record<CityType, RegionResourceConfig> = {
  '工业区': {
    // 风能：正常水平
    wind: { baseSpeed: 4.0, variance: 3.0, dailyAmplitude: 1.5, bonus: 0 },
    // 光能：正常水平
    solar: { baseIntensity: 0.5, seasonalAmplitude: 0.3, variance: 0.15, multiplier: 1.0 },
    // 负荷：夜间高于白天（三班倒生产），kW单位，日用电1320 MWh
    load: { dayBase: 45000, nightBase: 65000, variance: 8000 },
    // 生物质：很低（生活垃圾/工业废料），日产60吨
    biomass: { baseOutput: 60, harvestOutput: 60, harvestMonths: [], variance: 15 },
    // 温度：工业区热岛效应，温度偏高
    temperature: { baseTemp: 16, seasonalAmplitude: 12, dailyAmplitude: 6, variance: 2 },
  },
  '林业区': {
    // 风能：匮乏（树木阻挡）
    wind: { baseSpeed: 2.5, variance: 2.0, dailyAmplitude: 1.0, bonus: -1.0 },
    // 光能：匮乏（树冠遮挡）
    solar: { baseIntensity: 0.4, seasonalAmplitude: 0.25, variance: 0.1, multiplier: 0.7 },
    // 负荷：最低，kW单位，日用电72 MWh
    load: { dayBase: 4000, nightBase: 2000, variance: 1500 },
    // 生物质：最充足（木屑/树皮），日产150吨，全年稳定
    biomass: { baseOutput: 150, harvestOutput: 150, harvestMonths: [], variance: 20 },
    // 温度：林区温度适中，日夜温差较小
    temperature: { baseTemp: 14, seasonalAmplitude: 10, dailyAmplitude: 5, variance: 1.5 },
  },
  '农业区': {
    // 风能：充足（开阔地带）
    wind: { baseSpeed: 4.5, variance: 3.5, dailyAmplitude: 2.0, bonus: 0.5 },
    // 光能：充足
    solar: { baseIntensity: 0.55, seasonalAmplitude: 0.3, variance: 0.15, multiplier: 1.1 },
    // 负荷：中等，kW单位，日用电240 MWh
    load: { dayBase: 12000, nightBase: 8000, variance: 5000 },
    // 生物质：季节性（秸秆），非丰收季100吨/日，丰收季350吨/日
    biomass: { baseOutput: 100, harvestOutput: 350, harvestMonths: [8, 9, 10], variance: 30 },
    // 温度：农业区温度正常，日夜温差较大
    temperature: { baseTemp: 15, seasonalAmplitude: 13, dailyAmplitude: 8, variance: 2 },
  },
  '居民区': {
    // 风能：正常水平，城区略低
    wind: { baseSpeed: 3.5, variance: 2.5, dailyAmplitude: 1.5, bonus: 0 },
    // 光能：正常水平
    solar: { baseIntensity: 0.5, seasonalAmplitude: 0.3, variance: 0.15, multiplier: 1.0 },
    // 负荷：白天高于夜间，kW单位，日用电660 MWh
    load: { dayBase: 35000, nightBase: 20000, variance: 8000 },
    // 生物质：低（生活垃圾），日产80吨
    biomass: { baseOutput: 80, harvestOutput: 80, harvestMonths: [], variance: 20 },
    // 温度：居民区热岛效应，温度略高
    temperature: { baseTemp: 15.5, seasonalAmplitude: 11, dailyAmplitude: 5, variance: 1.5 },
  },
  '山地区': {
    // 风能：充足（地形加成）
    wind: { baseSpeed: 5.5, variance: 4.0, dailyAmplitude: 2.5, bonus: 2.0 },
    // 光能：充足（高海拔）
    solar: { baseIntensity: 0.6, seasonalAmplitude: 0.35, variance: 0.2, multiplier: 1.2 },
    // 负荷：白天高夜间几乎为0，kW单位，日用电120 MWh
    load: { dayBase: 8000, nightBase: 2000, variance: 3000 },
    // 生物质：较低（灌木枝条），日产30吨
    biomass: { baseOutput: 30, harvestOutput: 30, harvestMonths: [], variance: 10 },
    // 温度：山区海拔高，温度偏低，日夜温差大
    temperature: { baseTemp: 10, seasonalAmplitude: 14, dailyAmplitude: 10, variance: 3 },
  },
  '测试区': {
    wind: { baseSpeed: 4.0, variance: 3.0, dailyAmplitude: 2.0, bonus: 0 },
    solar: { baseIntensity: 0.5, seasonalAmplitude: 0.3, variance: 0.15, multiplier: 1.0 },
    load: { dayBase: 20000, nightBase: 20000, variance: 5000 },
    biomass: { baseOutput: 100, harvestOutput: 100, harvestMonths: [], variance: 20 },
    // 温度：测试区使用标准温度
    temperature: { baseTemp: 15, seasonalAmplitude: 12, dailyAmplitude: 7, variance: 2 },
  },
};

const DEFAULT_MATERIAL_BY_TYPE: Record<CityType, RegionMaterialConfig> = {
  '工业区': {
    // 生活垃圾/工业废料（质量最差），热值约10.3 MJ/kg (收到基ar)
    // Boie公式验证: HHV=11.8, LHV=10.3 MJ/kg
    proximate: { Moisture: 40, Volatiles: 28, FixedCarbon: 10, Ash: 22 },
    elemental: { C: 25, H: 3.5, O: 8, N: 1, S: 0.5 },
    variance: {
      proximate: { Moisture: 5, Volatiles: 4, FixedCarbon: 3, Ash: 3 },
      elemental: { C: 3, H: 0.5, O: 2, N: 0.3, S: 0.2 },
    },
  },
  '林业区': {
    // 木屑/树皮（最优质），热值约17.7 MJ/kg (收到基ar)
    // Boie公式验证: HHV=19.5, LHV=17.7 MJ/kg
    proximate: { Moisture: 10, Volatiles: 72, FixedCarbon: 16, Ash: 2 },
    elemental: { C: 47, H: 5.6, O: 35, N: 0.3, S: 0.1 },
    variance: {
      proximate: { Moisture: 2, Volatiles: 4, FixedCarbon: 3, Ash: 1 },
      elemental: { C: 3, H: 0.4, O: 3, N: 0.1, S: 0.05 },
    },
  },
  '农业区': {
    // 秸秆（良好质量），热值约16.0 MJ/kg (收到基ar)
    // Boie公式验证: HHV=17.7, LHV=16.0 MJ/kg
    proximate: { Moisture: 15, Volatiles: 65, FixedCarbon: 13, Ash: 7 },
    elemental: { C: 42, H: 5.2, O: 30, N: 0.6, S: 0.2 },
    variance: {
      proximate: { Moisture: 3, Volatiles: 4, FixedCarbon: 3, Ash: 2 },
      elemental: { C: 3, H: 0.4, O: 3, N: 0.2, S: 0.1 },
    },
  },
  '居民区': {
    // 生活垃圾（略好于工业区），热值约11.2 MJ/kg (收到基ar)
    // Boie公式验证: HHV=12.6, LHV=11.2 MJ/kg
    proximate: { Moisture: 35, Volatiles: 35, FixedCarbon: 12, Ash: 18 },
    elemental: { C: 28, H: 3.8, O: 13.5, N: 1, S: 0.7 },
    variance: {
      proximate: { Moisture: 5, Volatiles: 4, FixedCarbon: 3, Ash: 3 },
      elemental: { C: 3, H: 0.4, O: 2, N: 0.3, S: 0.2 },
    },
  },
  '山地区': {
    // 灌木枝条（中等质量），热值约15.1 MJ/kg (收到基ar)
    // Boie公式验证: HHV=16.7, LHV=15.1 MJ/kg
    proximate: { Moisture: 20, Volatiles: 60, FixedCarbon: 15, Ash: 5 },
    elemental: { C: 40, H: 5, O: 29, N: 0.8, S: 0.2 },
    variance: {
      proximate: { Moisture: 3, Volatiles: 4, FixedCarbon: 3, Ash: 2 },
      elemental: { C: 3, H: 0.4, O: 3, N: 0.2, S: 0.1 },
    },
  },
  '测试区': {
    proximate: { Moisture: 15, Volatiles: 60, FixedCarbon: 15, Ash: 10 },
    elemental: { C: 40, H: 5, O: 29, N: 0.8, S: 0.2 },
    variance: {
      proximate: { Moisture: 5, Volatiles: 5, FixedCarbon: 5, Ash: 3 },
      elemental: { C: 5, H: 1, O: 5, N: 0.3, S: 0.1 },
    },
  },
};

const DEFAULT_COST_BY_TYPE: Record<CityType, number> = {
  '工业区': 0.9,
  '林业区': 1.0,
  '农业区': 1.0,
  '居民区': 1.0,
  '山地区': 1.5,
  '测试区': 1.0,
};

// ============================================
// 55个区域的完整配置
// 区域1-52: 常规区域
// 区域53-55: 测试区域（相互连接）
// 数据优先从JSON文件加载，localStorage次之，最后使用默认值
// ============================================

// 导入JSON配置文件
import regionConfigsJson from './regionConfigs.json';

/**
 * 创建单个区域的默认配置（包含随机偏移的固定位置）
 */
const createDefaultRegionConfig = (id: number): SingleRegionConfig => {
  const isTestRegion = id >= GLOBAL_CONFIG.bufferRegionStart;
  const typeIndex = isTestRegion ? 5 : ((id - 1) % 5); // 测试区使用'测试区'类型
  const type = CITY_TYPES[typeIndex];

  const gridSize = Math.ceil(Math.sqrt(GLOBAL_CONFIG.totalRegions));
  const cellWidth = GLOBAL_CONFIG.mapWidth / gridSize;
  const cellHeight = GLOBAL_CONFIG.mapHeight / gridSize;
  const row = Math.floor((id - 1) / gridSize);
  const col = (id - 1) % gridSize;

  // 使用种子生成固定的随机偏移（这样每个区域的位置是确定的）
  const seed = id * 137;
  const offsetX = (seededRandomInternal(seed + 1) - 0.5) * cellWidth * 0.6;
  const offsetY = (seededRandomInternal(seed + 2) - 0.5) * cellHeight * 0.6;

  return {
    id,
    name: isTestRegion ? `测试区-${id - 52}` : `区域-${id}`,
    type,
    enabled: true,
    position: {
      // 位置已包含随机偏移，后续直接使用此位置
      x: Math.round((col * cellWidth + cellWidth * 0.5 + offsetX) * 100) / 100,
      y: Math.round((row * cellHeight + cellHeight * 0.5 + offsetY) * 100) / 100,
    },
    costMultiplier: DEFAULT_COST_BY_TYPE[type],
    resource: JSON.parse(JSON.stringify(DEFAULT_RESOURCE_BY_TYPE[type])),
    material: JSON.parse(JSON.stringify(DEFAULT_MATERIAL_BY_TYPE[type])),
    connections: {
      biomassCount: 3,
      powerCount: 5,
    },
  };
};

/**
 * 所有55个区域的配置
 * 优先从JSON文件加载，如果JSON中没有则使用默认值
 */
export const REGION_CONFIGS: Record<number, SingleRegionConfig> = {};

/**
 * 从JSON文件初始化区域配置
 * 如果JSON中的负荷数据太小（可能是旧数据），则使用默认配置
 */
export const initializeFromJson = () => {
  const jsonRegions = regionConfigsJson.regionConfigs as Record<string, any>;
  
  for (let i = 1; i <= GLOBAL_CONFIG.totalRegions; i++) {
    const jsonConfig = jsonRegions[String(i)];
    if (jsonConfig) {
      // 使用JSON中的配置
      REGION_CONFIGS[i] = JSON.parse(JSON.stringify(jsonConfig));
      
      // 检查并补充缺失的temperature配置
      if (!REGION_CONFIGS[i].resource.temperature) {
        const defaultResource = DEFAULT_RESOURCE_BY_TYPE[REGION_CONFIGS[i].type];
        if (defaultResource && defaultResource.temperature) {
          REGION_CONFIGS[i].resource.temperature = JSON.parse(JSON.stringify(defaultResource.temperature));
        }
      }
      
      // 检查负荷数据是否太小（可能是旧的测试数据）
      // 如果负荷小于1000kW，则使用默认配置的负荷数据
      const currentLoad = REGION_CONFIGS[i].resource.load;
      if (currentLoad.dayBase < 1000 && currentLoad.nightBase < 1000) {
        const defaultResource = DEFAULT_RESOURCE_BY_TYPE[REGION_CONFIGS[i].type];
        if (defaultResource) {
          REGION_CONFIGS[i].resource.load = JSON.parse(JSON.stringify(defaultResource.load));
          REGION_CONFIGS[i].resource.biomass = JSON.parse(JSON.stringify(defaultResource.biomass));
          REGION_CONFIGS[i].resource.wind = JSON.parse(JSON.stringify(defaultResource.wind));
          REGION_CONFIGS[i].resource.solar = JSON.parse(JSON.stringify(defaultResource.solar));
        }
      }
    } else {
      // JSON中没有该区域，使用默认配置
      REGION_CONFIGS[i] = createDefaultRegionConfig(i);
    }
  }
};

// 执行初始化
initializeFromJson();

// ============================================
// 区域配置快捷修改函数
// ============================================

/**
 * 更新指定区域的配置
 * @param regionId 区域编号 (1-55)
 * @param updates 要更新的配置项
 */
export const updateRegionConfig = (
  regionId: number,
  updates: Partial<SingleRegionConfig>
): void => {
  if (regionId < 1 || regionId > GLOBAL_CONFIG.totalRegions) {
    console.warn(`区域编号 ${regionId} 无效，有效范围: 1-${GLOBAL_CONFIG.totalRegions}`);
    return;
  }
  REGION_CONFIGS[regionId] = { ...REGION_CONFIGS[regionId], ...updates };
};

/**
 * 更新指定区域的资源配置
 * @param regionId 区域编号 (1-55)
 * @param resourceUpdates 资源配置更新
 */
export const updateRegionResource = (
  regionId: number,
  resourceUpdates: Partial<RegionResourceConfig>
): void => {
  if (!REGION_CONFIGS[regionId]) return;
  REGION_CONFIGS[regionId].resource = {
    ...REGION_CONFIGS[regionId].resource,
    ...resourceUpdates,
  };
};

/**
 * 更新指定区域的物料配置
 * @param regionId 区域编号 (1-55)
 * @param materialUpdates 物料配置更新
 */
export const updateRegionMaterial = (
  regionId: number,
  materialUpdates: Partial<RegionMaterialConfig>
): void => {
  if (!REGION_CONFIGS[regionId]) return;
  REGION_CONFIGS[regionId].material = {
    ...REGION_CONFIGS[regionId].material,
    ...materialUpdates,
  };
};

/**
 * 批量更新多个区域的配置
 * @param regionIds 区域编号数组
 * @param updates 要更新的配置项
 */
export const updateMultipleRegions = (
  regionIds: number[],
  updates: Partial<SingleRegionConfig>
): void => {
  regionIds.forEach(id => updateRegionConfig(id, updates));
};

/**
 * 按区域类型批量更新
 * @param type 区域类型
 * @param updates 要更新的配置项
 */
export const updateRegionsByType = (
  type: CityType,
  updates: Partial<SingleRegionConfig>
): void => {
  Object.values(REGION_CONFIGS)
    .filter(r => r.type === type)
    .forEach(r => updateRegionConfig(r.id, updates));
};

/**
 * 获取指定区域的配置
 * @param regionId 区域编号 (1-55)
 */
export const getRegionConfig = (regionId: number): SingleRegionConfig | undefined => {
  return REGION_CONFIGS[regionId];
};

/**
 * 获取所有启用的区域配置
 */
export const getEnabledRegions = (): SingleRegionConfig[] => {
  return Object.values(REGION_CONFIGS).filter(r => r.enabled);
};

/**
 * 获取测试区域配置 (53-55)
 */
export const getTestRegions = (): SingleRegionConfig[] => {
  return Object.values(REGION_CONFIGS).filter(r => r.id >= GLOBAL_CONFIG.bufferRegionStart);
};

// ============================================
// 辅助函数
// ============================================

/**
 * 基于种子的伪随机数生成器（导出版本）
 */
export const seededRandom = seededRandomInternal;

/**
 * 获取指定月份的天数
 */
export const getDaysInMonth = (month: number): number => {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};

/**
 * 归一化成分使总和为100%
 */
export const normalizeComposition = <T extends Record<string, number>>(
  obj: T,
  precision = 2
): T => {
  const keys = Object.keys(obj) as (keyof T)[];
  const sum = keys.reduce((acc, k) => acc + (obj[k] as number), 0);
  const normalized = {} as T;
  let currentSum = 0;

  keys.forEach((k, index) => {
    if (index === keys.length - 1) {
      (normalized as any)[k] = parseFloat((100 - currentSum).toFixed(precision));
    } else {
      const val = parseFloat((((obj[k] as number) / sum) * 100).toFixed(precision));
      (normalized as any)[k] = val;
      currentSum += val;
    }
  });
  return normalized;
};

// ============================================
// 太阳运动参数（北纬35°）
// ============================================

const SOLAR_PARAMS = [
  { month: 1, sunrise: 7.25, sunset: 17.25, intensity: 0.5 },
  { month: 2, sunrise: 6.83, sunset: 17.83, intensity: 0.6 },
  { month: 3, sunrise: 6.25, sunset: 18.33, intensity: 0.75 },
  { month: 4, sunrise: 5.67, sunset: 18.83, intensity: 0.85 },
  { month: 5, sunrise: 5.17, sunset: 19.33, intensity: 0.95 },
  { month: 6, sunrise: 5.0, sunset: 19.67, intensity: 1.0 },
  { month: 7, sunrise: 5.17, sunset: 19.58, intensity: 0.98 },
  { month: 8, sunrise: 5.58, sunset: 19.0, intensity: 0.9 },
  { month: 9, sunrise: 6.0, sunset: 18.33, intensity: 0.8 },
  { month: 10, sunrise: 6.42, sunset: 17.67, intensity: 0.65 },
  { month: 11, sunrise: 6.92, sunset: 17.17, intensity: 0.55 },
  { month: 12, sunrise: 7.25, sunset: 17.0, intensity: 0.45 },
];

// ============================================
// 数据生成函数
// ============================================

/**
 * 根据区域配置生成生物质成分数据
 */
export const generateBiomassComp = (config: SingleRegionConfig, seed: number): BiomassComposition => {
  const r = (offset: number) => seededRandom(seed + offset);
  const mat = config.material;

  const proxRandom = {
    Moisture: Math.max(1, mat.proximate.Moisture + (r(1) - 0.5) * 2 * mat.variance.proximate.Moisture),
    Volatiles: Math.max(1, mat.proximate.Volatiles + (r(2) - 0.5) * 2 * mat.variance.proximate.Volatiles),
    FixedCarbon: Math.max(1, mat.proximate.FixedCarbon + (r(3) - 0.5) * 2 * mat.variance.proximate.FixedCarbon),
    Ash: Math.max(1, mat.proximate.Ash + (r(4) - 0.5) * 2 * mat.variance.proximate.Ash),
  };
  const proximate = normalizeComposition(proxRandom);

  const elemRandom = {
    C: Math.max(1, mat.elemental.C + (r(5) - 0.5) * 2 * mat.variance.elemental.C),
    H: Math.max(1, mat.elemental.H + (r(6) - 0.5) * 2 * mat.variance.elemental.H),
    O: Math.max(1, mat.elemental.O + (r(7) - 0.5) * 2 * mat.variance.elemental.O),
    N: Math.max(0.1, mat.elemental.N + (r(8) - 0.5) * 2 * mat.variance.elemental.N),
    S: Math.max(0.01, mat.elemental.S + (r(9) - 0.5) * 2 * mat.variance.elemental.S),
  };
  const elemental = normalizeComposition(elemRandom);

  return { ...proximate, ...elemental };
};

/**
 * 基于学号生成区域资源波动系数（5%-10%的随机波动）
 * 确保每位同学的数据有差异，防止抄袭
 * @param studentId 学号
 * @param regionId 区域ID
 * @returns 波动系数 (1.05 - 1.10)
 */
export const getStudentRegionMultiplier = (studentId: string, regionId: number): number => {
  if (!studentId) return 1.0;
  
  // 基于学号和区域ID生成固定的种子
  const studentNum = parseInt(studentId.replace(/\D/g, '')) || 0;
  const seed = studentNum * 1000 + regionId * 7;
  
  // 使用种子生成5%-10%的波动
  const random = seededRandom(seed);
  const multiplier = 1.05 + random * 0.05; // 1.05 - 1.10
  
  return multiplier;
};

// 当前登录学号（用于资源数据生成）
let currentStudentId: string = '';

/**
 * 设置当前学号（登录时调用）
 */
export const setCurrentStudentId = (studentId: string): void => {
  currentStudentId = studentId;
};

/**
 * 获取当前学号
 */
export const getCurrentStudentId = (): string => {
  return currentStudentId;
};

/**
 * 获取区域资源数据（使用区域独立配置）
 * 种子固定：基于区域ID + 月份 + 日期，确保数据稳定可复现
 * 资源总量会根据学号产生5-10%的波动，确保每位同学数据有差异
 */
export const getResourceData = (
  city: City,
  scale: TimeUnit,
  month: number = 1,
  day: number = 1
): ResourceData => {
  const config = REGION_CONFIGS[city.id];
  if (!config) {
    console.warn(`区域配置不存在: ${city.id}, 使用默认配置`);
    // 返回基于区域类型的默认数据
    const defaultResource = DEFAULT_RESOURCE_BY_TYPE[city.type];
    if (!defaultResource) {
      return { wind: [], solar: [], load: [], biomass: [], temperature: [] };
    }
    // 创建临时配置
    const tempConfig: SingleRegionConfig = {
      id: city.id,
      name: city.name,
      type: city.type,
      enabled: true,
      position: { x: city.x, y: city.y },
      costMultiplier: 1,
      resource: defaultResource,
      material: DEFAULT_MATERIAL_BY_TYPE[city.type],
      connections: { biomassCount: 3, powerCount: 5 }
    };
    // 使用临时配置生成数据
    return generateResourceDataFromConfig(tempConfig, scale, month, day);
  }

  return generateResourceDataFromConfig(config, scale, month, day);
};

/**
 * 根据配置生成资源数据
 * 资源总量会根据当前学号产生5-10%的波动
 */
const generateResourceDataFromConfig = (
  config: SingleRegionConfig,
  scale: TimeUnit,
  month: number,
  day: number
): ResourceData => {

  // 固定种子：区域ID * 10000 + 月份 * 100 + 日期
  const baseSeed = config.id * 10000 + month * 100 + day;
  const r = (i: number) => seededRandom(baseSeed + i);
  
  // 获取学号波动系数（5%-10%的波动）
  const studentMultiplier = getStudentRegionMultiplier(currentStudentId, config.id);
  
  const data: ResourceData = { wind: [], solar: [], load: [], biomass: [], temperature: [] };
  const res = config.resource;

  // 温度配置，如果没有则使用默认值
  const tempConfig = res.temperature || { baseTemp: 15, seasonalAmplitude: 12, dailyAmplitude: 7, variance: 2 };

  let count = 24;
  if (scale === '月') count = getDaysInMonth(month);
  if (scale === '年') count = 12;

  // 获取当月太阳参数
  const solarParam = SOLAR_PARAMS[month - 1] || SOLAR_PARAMS[0];

  // 月度温度偏移（基于季节）
  // 1月最冷，7月最热
  const getMonthTempOffset = (m: number) => {
    // 使用余弦函数模拟季节变化，1月为最低点
    return Math.cos((m - 7) * Math.PI / 6) * tempConfig.seasonalAmplitude;
  };

  for (let i = 0; i < count; i++) {
    // ========== 光照计算 ==========
    let s = 0;
    if (scale === '日') {
      const hour = i;
      // 根据日出日落时间计算光照
      if (hour >= solarParam.sunrise && hour <= solarParam.sunset) {
        const dayLength = solarParam.sunset - solarParam.sunrise;
        const progress = (hour - solarParam.sunrise) / dayLength;
        // 正弦曲线模拟日内光照变化
        const baseIntensity = Math.sin(progress * Math.PI) * solarParam.intensity;
        // 添加天气随机波动（云量影响）
        const weatherFactor = 0.7 + r(i) * 0.3; // 0.7-1.0
        s = baseIntensity * weatherFactor * res.solar.multiplier;
      }
    } else {
      // 月/年视图：使用月度平均值
      const monthIdx = scale === '年' ? i : month - 1;
      const monthParam = SOLAR_PARAMS[monthIdx] || SOLAR_PARAMS[0];
      s = res.solar.baseIntensity * monthParam.intensity * res.solar.multiplier;
      s += (r(i) - 0.5) * res.solar.variance;
    }

    // ========== 风速计算 ==========
    let w = res.wind.baseSpeed + res.wind.bonus;
    
    if (scale === '日') {
      // 日内周期变化
      w += Math.sin(i / 3) * res.wind.dailyAmplitude;
      // 随机波动
      w += (r(i + 100) - 0.5) * res.wind.variance;
      
      // 突发事件：10%概率无风天，5%概率大风天
      const eventRand = r(i + 500);
      if (eventRand < 0.1) {
        w = Math.max(0, w * 0.3); // 无风天
      } else if (eventRand > 0.95) {
        w = w * 1.8; // 大风天
      }
    } else {
      // 月/年视图：平均值 + 随机波动
      w += (r(i + 100) - 0.5) * res.wind.variance * 0.5;
    }
    w = Math.max(0, w); // 风速不能为负

    // ========== 负荷计算 ==========
    let l: number;
    if (scale === '日') {
      // 根据小时判断日间/夜间
      const hour = i;
      if (hour >= 8 && hour <= 18) {
        l = res.load.dayBase;
      } else {
        l = res.load.nightBase;
      }
      // 添加随机波动
      l += (r(i + 200) - 0.5) * res.load.variance;
    } else {
      // 月/年视图：日均负荷
      l = (res.load.dayBase * 10 + res.load.nightBase * 14) / 24;
      l += (r(i + 200) - 0.5) * res.load.variance * 0.3;
    }

    // ========== 生物质计算 ==========
    const currentMonth = scale === '年' ? i + 1 : month;
    const isHarvest = res.biomass.harvestMonths.includes(currentMonth);
    let b = isHarvest ? res.biomass.harvestOutput : res.biomass.baseOutput;
    // 添加随机波动
    b += (r(i + 300) - 0.5) * res.biomass.variance;
    b = Math.max(0, b); // 产量不能为负

    // ========== 温度计算 ==========
    let t: number;
    if (scale === '日') {
      const hour = i;
      // 日内温度变化：凌晨最低（5-6点），下午最高（14-15点）
      const dailyOffset = Math.sin((hour - 5) * Math.PI / 12) * tempConfig.dailyAmplitude;
      // 月度季节偏移
      const monthOffset = getMonthTempOffset(month);
      // 基础温度 + 季节偏移 + 日内偏移 + 随机波动
      t = tempConfig.baseTemp + monthOffset + dailyOffset + (r(i + 400) - 0.5) * tempConfig.variance;
    } else if (scale === '月') {
      // 月视图：每天的平均温度
      const monthOffset = getMonthTempOffset(month);
      // 每天温度略有波动
      t = tempConfig.baseTemp + monthOffset + (r(i + 400) - 0.5) * tempConfig.variance * 1.5;
    } else {
      // 年视图：每月的平均温度
      const monthOffset = getMonthTempOffset(i + 1);
      t = tempConfig.baseTemp + monthOffset + (r(i + 400) - 0.5) * tempConfig.variance * 0.5;
    }

    data.wind.push(parseFloat(Math.max(0, w).toFixed(2)));
    data.solar.push(parseFloat(Math.max(0, s).toFixed(2)));
    // 负荷和生物质应用学号波动系数（5%-10%的差异）
    data.load.push(parseFloat(Math.max(0, l * studentMultiplier).toFixed(2)));
    data.biomass.push(parseFloat(Math.max(0, b * studentMultiplier).toFixed(2)));
    data.temperature.push(parseFloat(t.toFixed(1)));
  }
  return data;
};


// ============================================
// 区域生成函数
// ============================================

/**
 * 根据配置生成区域数据
 * 位置直接使用配置中的坐标，连接使用配置中预定义的链接
 * @param onlyEnabled 是否只生成启用的区域
 */
export const generateCities = (onlyEnabled = true): City[] => {
  const configs = onlyEnabled ? getEnabledRegions() : Object.values(REGION_CONFIGS);
  const cities: City[] = [];

  configs.forEach(config => {
    const seed = config.id * 137;
    cities.push({
      id: config.id,
      name: config.name,
      type: config.type,
      // 直接使用配置中的位置
      x: config.position.x,
      y: config.position.y,
      baseCostMultiplier: config.costMultiplier,
      biomassComp: generateBiomassComp(config, seed),
      biomassConnections: [],
      powerConnections: [],
    });
  });

  // 建立连接 - 优先使用配置中预定义的链接
  cities.forEach(city => {
    const config = REGION_CONFIGS[city.id];
    if (!config) return;

    const validCityIds = new Set(cities.map(c => c.id));
    
    // 检查是否有预定义的链接配置（biomassLinks或powerLinks任一有值）
    const hasPredefinedLinks = 
      (config.connections.biomassLinks && config.connections.biomassLinks.length > 0) ||
      (config.connections.powerLinks && config.connections.powerLinks.length > 0);

    if (hasPredefinedLinks) {
      // 使用预定义的链接，过滤掉不存在的区域ID
      city.biomassConnections = (config.connections.biomassLinks || []).filter(id => validCityIds.has(id));
      city.powerConnections = (config.connections.powerLinks || []).filter(id => validCityIds.has(id));
    } else {
      // 没有预定义链接时，按距离计算
      const isTestRegion = city.id >= GLOBAL_CONFIG.bufferRegionStart;
      const testRegionIds = [53, 54, 55];

      if (isTestRegion) {
        // 测试区域53-55相互连接
        const otherTestIds = testRegionIds.filter(id => id !== city.id);
        city.biomassConnections = otherTestIds;
        city.powerConnections = otherTestIds;
      } else {
        // 常规区域：按距离连接最近的N个区域（排除测试区域）
        const biomassOthers = cities
          .filter(c => c.id !== city.id && !testRegionIds.includes(c.id))
          .map(c => ({ id: c.id, dist: Math.hypot(c.x - city.x, c.y - city.y) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, config.connections.biomassCount);
        city.biomassConnections = biomassOthers.map(o => o.id);

        const powerOthers = cities
          .filter(c => c.id !== city.id && !testRegionIds.includes(c.id))
          .map(c => ({ id: c.id, dist: Math.hypot(c.x - city.x, c.y - city.y) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, config.connections.powerCount);
        city.powerConnections = powerOthers.map(o => o.id);
      }
    }
  });

  return cities;
};

/**
 * 兼容旧API - 按数量生成区域
 */
export const generateCitiesByCount = (count: number): City[] => {
  // 临时启用指定数量的区域
  const originalStates: Record<number, boolean> = {};
  Object.keys(REGION_CONFIGS).forEach(id => {
    const numId = parseInt(id);
    originalStates[numId] = REGION_CONFIGS[numId].enabled;
    REGION_CONFIGS[numId].enabled = numId <= count;
  });

  const cities = generateCities(true);

  // 恢复原始状态
  Object.keys(originalStates).forEach(id => {
    REGION_CONFIGS[parseInt(id)].enabled = originalStates[parseInt(id)];
  });

  return cities;
};

// ============================================
// 配置导出/导入功能
// ============================================

export interface FullSystemConfig {
  globalConfig: GlobalConfig;
  regionConfigs: Record<number, SingleRegionConfig>;
}

/**
 * 获取完整系统配置
 */
export const getFullConfig = (): FullSystemConfig => ({
  globalConfig: GLOBAL_CONFIG,
  regionConfigs: REGION_CONFIGS,
});

/**
 * 导出配置为JSON字符串
 */
export const exportConfigToJSON = (): string => {
  return JSON.stringify(getFullConfig(), null, 2);
};

/**
 * 从JSON导入配置
 */
export const importConfigFromJSON = (json: string): void => {
  try {
    const config = JSON.parse(json) as FullSystemConfig;
    if (config.regionConfigs) {
      Object.keys(config.regionConfigs).forEach(id => {
        const numId = parseInt(id);
        if (REGION_CONFIGS[numId]) {
          const importedConfig = config.regionConfigs[numId];
          REGION_CONFIGS[numId] = importedConfig;
          
          // 验证并修复负荷数据
          const currentLoad = REGION_CONFIGS[numId].resource?.load;
          if (!currentLoad || currentLoad.dayBase < 1000 || currentLoad.nightBase < 500) {
            // 负荷数据无效，使用默认配置
            const defaultResource = DEFAULT_RESOURCE_BY_TYPE[REGION_CONFIGS[numId].type];
            if (defaultResource) {
              REGION_CONFIGS[numId].resource.load = JSON.parse(JSON.stringify(defaultResource.load));
            }
          }
        }
      });
    }
  } catch (e) {
    console.error('配置导入失败:', e);
  }
};

/**
 * 重置所有区域为JSON文件中的配置
 */
export const resetAllConfigs = (): void => {
  initializeFromJson();
};

/**
 * 重置指定区域为JSON文件中的配置
 */
export const resetRegionConfig = (regionId: number): void => {
  if (regionId >= 1 && regionId <= GLOBAL_CONFIG.totalRegions) {
    const jsonRegions = regionConfigsJson.regionConfigs as Record<string, any>;
    const jsonConfig = jsonRegions[String(regionId)];
    if (jsonConfig) {
      REGION_CONFIGS[regionId] = JSON.parse(JSON.stringify(jsonConfig));
      
      // 检查并补充缺失的temperature配置
      if (!REGION_CONFIGS[regionId].resource.temperature) {
        const defaultResource = DEFAULT_RESOURCE_BY_TYPE[REGION_CONFIGS[regionId].type];
        if (defaultResource && defaultResource.temperature) {
          REGION_CONFIGS[regionId].resource.temperature = JSON.parse(JSON.stringify(defaultResource.temperature));
        }
      }
    } else {
      REGION_CONFIGS[regionId] = createDefaultRegionConfig(regionId);
    }
  }
};

// ============================================
// 兼容旧版本的导出
// ============================================

// 保留旧的类型导出以兼容现有代码
export interface RegionConfig {
  cityCount: number;
  mapWidth: number;
  mapHeight: number;
  biomassConnectionCount: number;
  powerConnectionCount: number;
}

export const DEFAULT_REGION_CONFIG: RegionConfig = {
  cityCount: 52,
  mapWidth: GLOBAL_CONFIG.mapWidth,
  mapHeight: GLOBAL_CONFIG.mapHeight,
  biomassConnectionCount: 3,
  powerConnectionCount: 5,
};

export interface ResourceConfig {
  wind: { baseSpeed: number; variance: number; dailyAmplitude: number; mountainBonus: number };
  solar: { baseIntensity: number; seasonalAmplitude: number; variance: number; mountainMultiplier: number; forestMultiplier: number };
  load: { industrial: { dayBase: number; nightBase: number }; residential: { dayBase: number; nightBase: number }; default: number; variance: number };
  biomass: { industrial: number; forestry: number; agriculture: { harvest: number; normal: number; harvestMonths: number[] }; default: number; variance: number };
}

export const DEFAULT_RESOURCE_CONFIG: ResourceConfig = {
  wind: { baseSpeed: 4, variance: 3, dailyAmplitude: 2, mountainBonus: 2 },
  solar: { baseIntensity: 0.5, seasonalAmplitude: 0.3, variance: 0.15, mountainMultiplier: 1.2, forestMultiplier: 0.7 },
  load: { industrial: { dayBase: 45000, nightBase: 65000 }, residential: { dayBase: 35000, nightBase: 20000 }, default: 12000, variance: 5000 },
  biomass: { industrial: 60, forestry: 150, agriculture: { harvest: 350, normal: 100, harvestMonths: [8, 9, 10] }, default: 80, variance: 20 },
};

export const COST_MULTIPLIERS: Record<CityType, number> = DEFAULT_COST_BY_TYPE;

export interface ProximateAnalysis {
  Moisture: number; Volatiles: number; FixedCarbon: number; Ash: number;
}

export interface ElementalAnalysis {
  C: number; H: number; O: number; N: number; S: number;
}

export const PROXIMATE_BASE: Record<CityType, ProximateAnalysis> = {
  '工业区': { Moisture: 40, Volatiles: 28, FixedCarbon: 10, Ash: 22 },
  '林业区': { Moisture: 10, Volatiles: 72, FixedCarbon: 16, Ash: 2 },
  '农业区': { Moisture: 15, Volatiles: 65, FixedCarbon: 13, Ash: 7 },
  '居民区': { Moisture: 35, Volatiles: 35, FixedCarbon: 12, Ash: 18 },
  '山地区': { Moisture: 20, Volatiles: 60, FixedCarbon: 15, Ash: 5 },
  '测试区': { Moisture: 15, Volatiles: 60, FixedCarbon: 15, Ash: 10 },
};

export const ELEMENTAL_BASE: Record<CityType, ElementalAnalysis> = {
  '工业区': { C: 25, H: 3.5, O: 8, N: 1, S: 0.5 },
  '林业区': { C: 47, H: 5.6, O: 35, N: 0.3, S: 0.1 },
  '农业区': { C: 42, H: 5.2, O: 30, N: 0.6, S: 0.2 },
  '居民区': { C: 28, H: 3.8, O: 13.5, N: 1, S: 0.7 },
  '山地区': { C: 40, H: 5, O: 29, N: 0.8, S: 0.2 },
  '测试区': { C: 40, H: 5, O: 29, N: 0.8, S: 0.2 },
};

export const COMPOSITION_VARIANCE = {
  proximate: { Moisture: 10, Volatiles: 10, FixedCarbon: 10, Ash: 5 },
  elemental: { C: 10, H: 2, O: 10, N: 1, S: 0.5 },
};
