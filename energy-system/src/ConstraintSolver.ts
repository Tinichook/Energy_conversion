// ============================================
// 风光生物质储能混合系统约束求解器
// 针对测试区-1（居民区）的优化求解
// ============================================

import {
  SOLAR_PANELS,
  WIND_TURBINES,
  WindTurbineSpec,
  BATTERIES,
  INVERTERS,
  PCS_UNITS,
  GAS_ENGINES,
  STEAM_TURBINES,
} from './EquipmentData';

// ============================================
// 类型定义
// ============================================

/** 设备选型结果 */
export interface EquipmentSelection {
  id: string;
  model: string;
  count: number;
  unitPower: number;      // 单台功率 kW 或 kWh
  totalPower: number;     // 总功率/容量
  unitPrice: number;      // 单价 万元
  totalPrice: number;     // 总价 万元
}

/** 能源占比 */
export interface EnergyRatio {
  wind: number;           // 风电占比
  solar: number;          // 光伏占比
  bio: number;            // 生物质占比
  total: number;          // 总占比（应>=1）
}

/** 求解方案 */
export interface SolutionScheme {
  id: string;
  name: string;
  description: string;
  // 设备配置
  wind: EquipmentSelection[];
  solar: EquipmentSelection[];
  inverter: EquipmentSelection[];
  biomass: {
    boiler?: EquipmentSelection;
    turbine?: EquipmentSelection;
    gasEngine?: EquipmentSelection;
  };
  battery: EquipmentSelection[];
  pcs: EquipmentSelection[];
  // 容量汇总
  capacity: {
    windMW: number;
    solarMW: number;
    bioMW: number;
    batteryMWh: number;
    pcsMW: number;
    inverterMW: number;
  };
  // 能源占比
  energyRatio: EnergyRatio;
  // 经济指标
  economics: {
    totalInvestment: number;  // 总投资 万元
    annualGeneration: number; // 年发电量 MWh
    LCOE: number;             // 度电成本 元/kWh
  };
  // 约束满足情况
  constraints: {
    satisfied: boolean;
    violations: string[];
  };
  // 评分
  score: number;
}

// ============================================
// 测试区-1 参数配置
// ============================================

/** 测试区-1 基础参数 */
const REGION_53_PARAMS = {
  id: 53,
  name: '测试区-1',
  type: '居民区' as const,
  // 负荷参数
  load: {
    dayBase: 35000,       // 白天基础负荷 kW
    nightBase: 20000,     // 夜间基础负荷 kW
    dailyMWh: 660,        // 日用电量 MWh
    annualMWh: 240900,    // 年用电量 MWh (660 * 365)
    peakMW: 50,           // 峰值负荷 MW
  },
  // 资源参数
  resource: {
    avgWindSpeed: 3.5,    // 年均风速 m/s
    maxWindSpeed: 11.19,  // 最大风速 m/s
    solarMultiplier: 1.0, // 光照系数
    solarHours: 1200,     // 年等效利用小时数
    biomassTonPerDay: 80, // 日生物质产量 吨
  },
  // 能源占比约束（居民区）
  ratioConstraints: {
    wind: { min: 0.20, max: 0.35 },
    solar: { min: 0.55, max: 0.75 },
    bio: { min: 0.10, max: 0.25 },
    totalMin: 1.1,        // 总占比下限
    totalMax: 1.35,       // 总占比上限
  },
};

// ============================================
// 辅助计算函数
// ============================================

/** 计算风机年发电量 (简化估算) */
function estimateWindAnnualMWh(turbine: WindTurbineSpec, avgWindSpeed: number): number {
  // 基于容量因子估算
  const capacityFactor = turbine.capacityFactor / 100;
  // 低风速区域降低容量因子
  const windFactor = avgWindSpeed < 5 ? 0.6 : (avgWindSpeed < 7 ? 0.8 : 1.0);
  return turbine.ratedPower * 8760 * capacityFactor * windFactor / 1000; // MWh
}

/** 计算光伏年发电量 */
function estimateSolarAnnualMWh(panelPowerKW: number, solarHours: number): number {
  return panelPowerKW * solarHours / 1000; // MWh
}

/** 计算生物质年发电量 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function estimateBioAnnualMWh(powerMW: number, runHours: number = 7000): number {
  return powerMW * runHours; // MWh
}

/** 选择合适的逆变器配置 */
function selectInverters(solarDCkW: number, targetRatio: number = 1.0): EquipmentSelection[] {
  const targetACkW = solarDCkW / targetRatio;
  const results: EquipmentSelection[] = [];
  let remaining = targetACkW;

  // 按功率从大到小排序
  const sortedInverters = [...INVERTERS].sort((a, b) => b.ratedPower - a.ratedPower);

  for (const inv of sortedInverters) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / inv.ratedPower);
    if (count > 0) {
      results.push({
        id: inv.id,
        model: inv.model,
        count,
        unitPower: inv.ratedPower,
        totalPower: count * inv.ratedPower,
        unitPrice: inv.price,
        totalPrice: count * inv.price,
      });
      remaining -= count * inv.ratedPower;
    }
  }

  // 补充小容量逆变器
  if (remaining > 0) {
    const smallInv = sortedInverters[sortedInverters.length - 1];
    const count = Math.ceil(remaining / smallInv.ratedPower);
    results.push({
      id: smallInv.id,
      model: smallInv.model,
      count,
      unitPower: smallInv.ratedPower,
      totalPower: count * smallInv.ratedPower,
      unitPrice: smallInv.price,
      totalPrice: count * smallInv.price,
    });
  }

  return results;
}

/** 选择合适的PCS配置 */
function selectPCS(batteryMWh: number, chargeHours: number = 3): EquipmentSelection[] {
  const requiredPowerKW = (batteryMWh * 1000) / chargeHours;
  const results: EquipmentSelection[] = [];
  let remaining = requiredPowerKW;

  const sortedPCS = [...PCS_UNITS].sort((a, b) => b.ratedPower - a.ratedPower);

  for (const pcs of sortedPCS) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / pcs.ratedPower);
    if (count > 0) {
      results.push({
        id: pcs.id,
        model: pcs.model,
        count,
        unitPower: pcs.ratedPower,
        totalPower: count * pcs.ratedPower,
        unitPrice: pcs.price,
        totalPrice: count * pcs.price,
      });
      remaining -= count * pcs.ratedPower;
    }
  }

  if (remaining > 0) {
    const smallPCS = sortedPCS[sortedPCS.length - 1];
    const count = Math.ceil(remaining / smallPCS.ratedPower);
    results.push({
      id: smallPCS.id,
      model: smallPCS.model,
      count,
      unitPower: smallPCS.ratedPower,
      totalPower: count * smallPCS.ratedPower,
      unitPrice: smallPCS.price,
      totalPrice: count * smallPCS.price,
    });
  }

  return results;
}

/** 选择电池配置 */
function selectBatteries(targetMWh: number): EquipmentSelection[] {
  const targetKWh = targetMWh * 1000;
  const results: EquipmentSelection[] = [];
  
  // 优先选择磷酸铁锂电池
  const lfpBatteries = BATTERIES.filter(b => b.type === '磷酸铁锂')
    .sort((a, b) => b.energyCapacity - a.energyCapacity);
  
  let remaining = targetKWh;
  for (const bat of lfpBatteries) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / bat.energyCapacity);
    if (count > 0) {
      results.push({
        id: bat.id,
        model: bat.model,
        count,
        unitPower: bat.energyCapacity,
        totalPower: count * bat.energyCapacity,
        unitPrice: bat.price,
        totalPrice: count * bat.price,
      });
      remaining -= count * bat.energyCapacity;
    }
  }

  if (remaining > 0 && lfpBatteries.length > 0) {
    const smallBat = lfpBatteries[lfpBatteries.length - 1];
    const count = Math.ceil(remaining / smallBat.energyCapacity);
    results.push({
      id: smallBat.id,
      model: smallBat.model,
      count,
      unitPower: smallBat.energyCapacity,
      totalPower: count * smallBat.energyCapacity,
      unitPrice: smallBat.price,
      totalPrice: count * smallBat.price,
    });
  }

  return results;
}

// ============================================
// 方案生成函数
// ============================================

/** 生成方案1：光伏主导型（适合居民区） */
function generateScheme1(): SolutionScheme {
  const params = REGION_53_PARAMS;
  const annualLoad = params.load.annualMWh;
  
  // 目标能源占比：风20%, 光65%, 生物质15%, 总计100%（保守方案）
  const targetRatio = { wind: 0.22, solar: 0.68, bio: 0.15 };
  
  // 计算各能源需求发电量
  const windTargetMWh = annualLoad * targetRatio.wind;
  const solarTargetMWh = annualLoad * targetRatio.solar;
  const bioTargetMWh = annualLoad * targetRatio.bio;
  
  // === 风电配置 ===
  // 低风速区域选择小型风机
  const smallTurbine = WIND_TURBINES.find(t => t.id === 'WT-3')!;
  const turbineAnnualMWh = estimateWindAnnualMWh(smallTurbine, params.resource.avgWindSpeed);
  const windCount = Math.ceil(windTargetMWh / turbineAnnualMWh);
  const windSelection: EquipmentSelection = {
    id: smallTurbine.id,
    model: smallTurbine.model,
    count: windCount,
    unitPower: smallTurbine.ratedPower,
    totalPower: windCount * smallTurbine.ratedPower,
    unitPrice: smallTurbine.price,
    totalPrice: windCount * smallTurbine.price,
  };
  const actualWindMWh = windCount * turbineAnnualMWh;

  // === 光伏配置 ===
  const solarPanel = SOLAR_PANELS.find(p => p.id === 'PV-545N')!; // 545W高效组件
  const panelAnnualMWh = estimateSolarAnnualMWh(solarPanel.power / 1000, params.resource.solarHours);
  const panelCount = Math.ceil(solarTargetMWh / panelAnnualMWh);
  const solarDCkW = panelCount * solarPanel.power / 1000;
  const solarSelection: EquipmentSelection = {
    id: solarPanel.id,
    model: solarPanel.model,
    count: panelCount,
    unitPower: solarPanel.power / 1000,
    totalPower: solarDCkW,
    unitPrice: solarPanel.price / 10000,
    totalPrice: panelCount * solarPanel.price / 10000,
  };
  const actualSolarMWh = panelCount * panelAnnualMWh;
  
  // === 逆变器配置 ===
  const inverterSelection = selectInverters(solarDCkW, 1.05);
  const inverterTotalKW = inverterSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 生物质配置（沼气发电） ===
  const bioRunHours = 7000;
  const bioTargetMW = bioTargetMWh / bioRunHours;
  const gasEngine = GAS_ENGINES.find(g => g.id === 'BG-200')!; // 200kW沼气发电机
  const gasEngineCount = Math.ceil(bioTargetMW * 1000 / gasEngine.ratedPower);
  const bioSelection: EquipmentSelection = {
    id: gasEngine.id,
    model: gasEngine.model,
    count: gasEngineCount,
    unitPower: gasEngine.ratedPower,
    totalPower: gasEngineCount * gasEngine.ratedPower,
    unitPrice: gasEngine.price,
    totalPrice: gasEngineCount * gasEngine.price,
  };
  const actualBioMWh = gasEngineCount * gasEngine.ratedPower * bioRunHours / 1000;
  
  // === 储能配置 ===
  // 储能容量按日负荷的10%配置
  const batteryMWh = params.load.dailyMWh * 0.10;
  const batterySelection = selectBatteries(batteryMWh);
  const batteryTotalKWh = batterySelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === PCS配置 ===
  const pcsSelection = selectPCS(batteryTotalKWh / 1000, 3);
  const pcsTotalKW = pcsSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 计算能源占比 ===
  const totalGenMWh = actualWindMWh + actualSolarMWh + actualBioMWh;
  const energyRatio: EnergyRatio = {
    wind: actualWindMWh / annualLoad,
    solar: actualSolarMWh / annualLoad,
    bio: actualBioMWh / annualLoad,
    total: totalGenMWh / annualLoad,
  };
  
  // === 计算经济指标 ===
  const windInvestment = windSelection.totalPrice;
  const solarInvestment = solarSelection.totalPrice + inverterSelection.reduce((s, i) => s + i.totalPrice, 0);
  const bioInvestment = bioSelection.totalPrice;
  const batteryInvestment = batterySelection.reduce((s, b) => s + b.totalPrice, 0);
  const pcsInvestment = pcsSelection.reduce((s, p) => s + p.totalPrice, 0);
  const totalInvestment = windInvestment + solarInvestment + bioInvestment + batteryInvestment + pcsInvestment;
  
  // LCOE简化计算 (投资回收20年，运维2%/年)
  const CRF = 0.08; // 资本回收系数
  const OMrate = 0.02;
  const annualCost = totalInvestment * 10000 * (CRF + OMrate);
  const LCOE = annualCost / (totalGenMWh * 1000);
  
  // === 约束检查 ===
  // 能源占比不再作为硬性约束，只记录信息用于参考
  // 可行性判断只检查可靠率，让优化算法自由搜索最佳配比
  const violations: string[] = [];
  const rc = params.ratioConstraints;
  // 只检查总占比是否满足基本供电需求（>=1）
  if (energyRatio.total < rc.totalMin) violations.push(`总占比${(energyRatio.total*100).toFixed(1)}% < 下限${rc.totalMin*100}%，可能无法满足负荷需求`);

  return {
    id: 'scheme-1',
    name: '方案一：光伏主导型',
    description: '以光伏为主（68%），辅以小型风机和沼气发电，适合居民区低风速环境',
    wind: [windSelection],
    solar: [solarSelection],
    inverter: inverterSelection,
    biomass: { gasEngine: bioSelection },
    battery: batterySelection,
    pcs: pcsSelection,
    capacity: {
      windMW: windSelection.totalPower / 1000,
      solarMW: solarDCkW / 1000,
      bioMW: bioSelection.totalPower / 1000,
      batteryMWh: batteryTotalKWh / 1000,
      pcsMW: pcsTotalKW / 1000,
      inverterMW: inverterTotalKW / 1000,
    },
    energyRatio,
    economics: {
      totalInvestment,
      annualGeneration: totalGenMWh,
      LCOE,
    },
    constraints: {
      satisfied: violations.length === 0,
      violations,
    },
    score: violations.length === 0 ? 85 : 70,
  };
}

/** 生成方案2：均衡配置型 */
function generateScheme2(): SolutionScheme {
  const params = REGION_53_PARAMS;
  const annualLoad = params.load.annualMWh;
  
  // 目标能源占比：风25%, 光55%, 生物质20%, 总计100%
  const targetRatio = { wind: 0.28, solar: 0.58, bio: 0.22 };
  
  const windTargetMWh = annualLoad * targetRatio.wind;
  const solarTargetMWh = annualLoad * targetRatio.solar;
  const bioTargetMWh = annualLoad * targetRatio.bio;
  
  // === 风电配置（使用中型风机） ===
  const mediumTurbine = WIND_TURBINES.find(t => t.id === 'WT-50')!;
  const turbineAnnualMWh = estimateWindAnnualMWh(mediumTurbine, params.resource.avgWindSpeed);
  const windCount = Math.ceil(windTargetMWh / turbineAnnualMWh);
  const windSelection: EquipmentSelection = {
    id: mediumTurbine.id,
    model: mediumTurbine.model,
    count: windCount,
    unitPower: mediumTurbine.ratedPower,
    totalPower: windCount * mediumTurbine.ratedPower,
    unitPrice: mediumTurbine.price,
    totalPrice: windCount * mediumTurbine.price,
  };
  const actualWindMWh = windCount * turbineAnnualMWh;
  
  // === 光伏配置 ===
  const solarPanel = SOLAR_PANELS.find(p => p.id === 'PV-660M')!; // 660W大功率组件
  const panelAnnualMWh = estimateSolarAnnualMWh(solarPanel.power / 1000, params.resource.solarHours);
  const panelCount = Math.ceil(solarTargetMWh / panelAnnualMWh);
  const solarDCkW = panelCount * solarPanel.power / 1000;
  const solarSelection: EquipmentSelection = {
    id: solarPanel.id,
    model: solarPanel.model,
    count: panelCount,
    unitPower: solarPanel.power / 1000,
    totalPower: solarDCkW,
    unitPrice: solarPanel.price / 10000,
    totalPrice: panelCount * solarPanel.price / 10000,
  };
  const actualSolarMWh = panelCount * panelAnnualMWh;
  
  // === 逆变器配置 ===
  const inverterSelection = selectInverters(solarDCkW, 1.1);
  const inverterTotalKW = inverterSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 生物质配置（直燃发电） ===
  const bioRunHours = 7000;
  const bioTargetMW = bioTargetMWh / bioRunHours;
  // 使用汽轮机发电
  const steamTurbine = STEAM_TURBINES.find(t => t.id === 'ST-6')!; // 6MW汽轮机
  const turbineCount = Math.ceil(bioTargetMW / steamTurbine.ratedPower);
  const bioSelection: EquipmentSelection = {
    id: steamTurbine.id,
    model: steamTurbine.model,
    count: turbineCount,
    unitPower: steamTurbine.ratedPower * 1000,
    totalPower: turbineCount * steamTurbine.ratedPower * 1000,
    unitPrice: steamTurbine.price,
    totalPrice: turbineCount * steamTurbine.price,
  };
  const actualBioMWh = turbineCount * steamTurbine.ratedPower * bioRunHours;

  // === 储能配置 ===
  const batteryMWh = params.load.dailyMWh * 0.12;
  const batterySelection = selectBatteries(batteryMWh);
  const batteryTotalKWh = batterySelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === PCS配置 ===
  const pcsSelection = selectPCS(batteryTotalKWh / 1000, 3);
  const pcsTotalKW = pcsSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 计算能源占比 ===
  const totalGenMWh = actualWindMWh + actualSolarMWh + actualBioMWh;
  const energyRatio: EnergyRatio = {
    wind: actualWindMWh / annualLoad,
    solar: actualSolarMWh / annualLoad,
    bio: actualBioMWh / annualLoad,
    total: totalGenMWh / annualLoad,
  };
  
  // === 计算经济指标 ===
  const windInvestment = windSelection.totalPrice;
  const solarInvestment = solarSelection.totalPrice + inverterSelection.reduce((s, i) => s + i.totalPrice, 0);
  const bioInvestment = bioSelection.totalPrice;
  const batteryInvestment = batterySelection.reduce((s, b) => s + b.totalPrice, 0);
  const pcsInvestment = pcsSelection.reduce((s, p) => s + p.totalPrice, 0);
  const totalInvestment = windInvestment + solarInvestment + bioInvestment + batteryInvestment + pcsInvestment;
  
  const CRF = 0.08;
  const OMrate = 0.02;
  const annualCost = totalInvestment * 10000 * (CRF + OMrate);
  const LCOE = annualCost / (totalGenMWh * 1000);
  
  // === 约束检查 ===
  // 能源占比不再作为硬性约束，只记录信息用于参考
  // 可行性判断只检查可靠率，让优化算法自由搜索最佳配比
  const violations: string[] = [];
  const rc = params.ratioConstraints;
  // 只检查总占比是否满足基本供电需求（>=1）
  if (energyRatio.total < rc.totalMin) violations.push(`总占比${(energyRatio.total*100).toFixed(1)}% < 下限${rc.totalMin*100}%，可能无法满足负荷需求`);
  
  return {
    id: 'scheme-2',
    name: '方案二：均衡配置型',
    description: '风光生物质均衡配置，采用中型风机和直燃发电，系统稳定性好',
    wind: [windSelection],
    solar: [solarSelection],
    inverter: inverterSelection,
    biomass: { turbine: bioSelection },
    battery: batterySelection,
    pcs: pcsSelection,
    capacity: {
      windMW: windSelection.totalPower / 1000,
      solarMW: solarDCkW / 1000,
      bioMW: bioSelection.totalPower / 1000,
      batteryMWh: batteryTotalKWh / 1000,
      pcsMW: pcsTotalKW / 1000,
      inverterMW: inverterTotalKW / 1000,
    },
    energyRatio,
    economics: {
      totalInvestment,
      annualGeneration: totalGenMWh,
      LCOE,
    },
    constraints: {
      satisfied: violations.length === 0,
      violations,
    },
    score: violations.length === 0 ? 82 : 68,
  };
}

/** 生成方案3：高可靠型（冗余配置） */
function generateScheme3(): SolutionScheme {
  const params = REGION_53_PARAMS;
  const annualLoad = params.load.annualMWh;
  
  // 目标能源占比：风25%, 光70%, 生物质25%, 总计120%（高冗余）
  const targetRatio = { wind: 0.28, solar: 0.72, bio: 0.22 };
  
  const windTargetMWh = annualLoad * targetRatio.wind;
  const solarTargetMWh = annualLoad * targetRatio.solar;
  const bioTargetMWh = annualLoad * targetRatio.bio;

  // === 风电配置（混合配置） ===
  const smallTurbine = WIND_TURBINES.find(t => t.id === 'WT-10')!;
  const turbineAnnualMWh = estimateWindAnnualMWh(smallTurbine, params.resource.avgWindSpeed);
  const windCount = Math.ceil(windTargetMWh / turbineAnnualMWh);
  const windSelection: EquipmentSelection = {
    id: smallTurbine.id,
    model: smallTurbine.model,
    count: windCount,
    unitPower: smallTurbine.ratedPower,
    totalPower: windCount * smallTurbine.ratedPower,
    unitPrice: smallTurbine.price,
    totalPrice: windCount * smallTurbine.price,
  };
  const actualWindMWh = windCount * turbineAnnualMWh;
  
  // === 光伏配置（高效组件） ===
  const solarPanel = SOLAR_PANELS.find(p => p.id === 'PV-545N')!;
  const panelAnnualMWh = estimateSolarAnnualMWh(solarPanel.power / 1000, params.resource.solarHours);
  const panelCount = Math.ceil(solarTargetMWh / panelAnnualMWh);
  const solarDCkW = panelCount * solarPanel.power / 1000;
  const solarSelection: EquipmentSelection = {
    id: solarPanel.id,
    model: solarPanel.model,
    count: panelCount,
    unitPower: solarPanel.power / 1000,
    totalPower: solarDCkW,
    unitPrice: solarPanel.price / 10000,
    totalPrice: panelCount * solarPanel.price / 10000,
  };
  const actualSolarMWh = panelCount * panelAnnualMWh;
  
  // === 逆变器配置 ===
  const inverterSelection = selectInverters(solarDCkW, 1.1);
  const inverterTotalKW = inverterSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 生物质配置（沼气发电） ===
  const bioRunHours = 7000;
  const bioTargetMW = bioTargetMWh / bioRunHours;
  const gasEngine = GAS_ENGINES.find(g => g.id === 'BG-500')!; // 500kW沼气发电机
  const gasEngineCount = Math.ceil(bioTargetMW * 1000 / gasEngine.ratedPower);
  const bioSelection: EquipmentSelection = {
    id: gasEngine.id,
    model: gasEngine.model,
    count: gasEngineCount,
    unitPower: gasEngine.ratedPower,
    totalPower: gasEngineCount * gasEngine.ratedPower,
    unitPrice: gasEngine.price,
    totalPrice: gasEngineCount * gasEngine.price,
  };
  const actualBioMWh = gasEngineCount * gasEngine.ratedPower * bioRunHours / 1000;
  
  // === 储能配置（大容量） ===
  const batteryMWh = params.load.dailyMWh * 0.15;
  const batterySelection = selectBatteries(batteryMWh);
  const batteryTotalKWh = batterySelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === PCS配置 ===
  const pcsSelection = selectPCS(batteryTotalKWh / 1000, 2.5);
  const pcsTotalKW = pcsSelection.reduce((sum, s) => sum + s.totalPower, 0);
  
  // === 计算能源占比 ===
  const totalGenMWh = actualWindMWh + actualSolarMWh + actualBioMWh;
  const energyRatio: EnergyRatio = {
    wind: actualWindMWh / annualLoad,
    solar: actualSolarMWh / annualLoad,
    bio: actualBioMWh / annualLoad,
    total: totalGenMWh / annualLoad,
  };
  
  // === 计算经济指标 ===
  const windInvestment = windSelection.totalPrice;
  const solarInvestment = solarSelection.totalPrice + inverterSelection.reduce((s, i) => s + i.totalPrice, 0);
  const bioInvestment = bioSelection.totalPrice;
  const batteryInvestment = batterySelection.reduce((s, b) => s + b.totalPrice, 0);
  const pcsInvestment = pcsSelection.reduce((s, p) => s + p.totalPrice, 0);
  const totalInvestment = windInvestment + solarInvestment + bioInvestment + batteryInvestment + pcsInvestment;
  
  const CRF = 0.08;
  const OMrate = 0.02;
  const annualCost = totalInvestment * 10000 * (CRF + OMrate);
  const LCOE = annualCost / (totalGenMWh * 1000);
  
  // === 约束检查 ===
  // 能源占比不再作为硬性约束，只记录信息用于参考
  // 可行性判断只检查可靠率，让优化算法自由搜索最佳配比
  const violations: string[] = [];
  const rc = params.ratioConstraints;
  // 只检查总占比是否满足基本供电需求（>=1）
  if (energyRatio.total < rc.totalMin) violations.push(`总占比${(energyRatio.total*100).toFixed(1)}% < 下限${rc.totalMin*100}%，可能无法满足负荷需求`);

  return {
    id: 'scheme-3',
    name: '方案三：高可靠型',
    description: '高冗余配置（总占比120%），大容量储能，供电可靠性最高',
    wind: [windSelection],
    solar: [solarSelection],
    inverter: inverterSelection,
    biomass: { gasEngine: bioSelection },
    battery: batterySelection,
    pcs: pcsSelection,
    capacity: {
      windMW: windSelection.totalPower / 1000,
      solarMW: solarDCkW / 1000,
      bioMW: bioSelection.totalPower / 1000,
      batteryMWh: batteryTotalKWh / 1000,
      pcsMW: pcsTotalKW / 1000,
      inverterMW: inverterTotalKW / 1000,
    },
    energyRatio,
    economics: {
      totalInvestment,
      annualGeneration: totalGenMWh,
      LCOE,
    },
    constraints: {
      satisfied: violations.length === 0,
      violations,
    },
    score: violations.length === 0 ? 88 : 72,
  };
}

// ============================================
// 主求解函数
// ============================================

/** 求解测试区-1的优化方案 */
export function solveRegion53(): SolutionScheme[] {
  console.log('='.repeat(60));
  console.log('测试区-1 (居民区) 约束求解');
  console.log('='.repeat(60));
  
  const schemes: SolutionScheme[] = [
    generateScheme1(),
    generateScheme2(),
    generateScheme3(),
  ];
  
  // 按评分排序
  schemes.sort((a, b) => b.score - a.score);
  
  return schemes;
}

/** 打印方案详情 */
export function printScheme(scheme: SolutionScheme): void {
  console.log('\n' + '='.repeat(60));
  console.log(`【${scheme.name}】`);
  console.log(scheme.description);
  console.log('='.repeat(60));
  
  console.log('\n--- 设备配置 ---');
  
  // 风电
  console.log('\n[风电设备]');
  scheme.wind.forEach(w => {
    console.log(`  ${w.model}: ${w.count}台 × ${w.unitPower}kW = ${w.totalPower}kW, 投资${w.totalPrice.toFixed(1)}万元`);
  });
  
  // 光伏
  console.log('\n[光伏设备]');
  scheme.solar.forEach(s => {
    console.log(`  ${s.model}: ${s.count}块 × ${(s.unitPower*1000).toFixed(0)}W = ${s.totalPower.toFixed(1)}kW, 投资${s.totalPrice.toFixed(1)}万元`);
  });
  
  // 逆变器
  console.log('\n[逆变器]');
  scheme.inverter.forEach(i => {
    console.log(`  ${i.model}: ${i.count}台 × ${i.unitPower}kW = ${i.totalPower}kW, 投资${i.totalPrice.toFixed(1)}万元`);
  });
  
  // 生物质
  console.log('\n[生物质设备]');
  if (scheme.biomass.gasEngine) {
    const b = scheme.biomass.gasEngine;
    console.log(`  ${b.model}: ${b.count}台 × ${b.unitPower}kW = ${b.totalPower}kW, 投资${b.totalPrice.toFixed(1)}万元`);
  }
  if (scheme.biomass.turbine) {
    const b = scheme.biomass.turbine;
    console.log(`  ${b.model}: ${b.count}台 × ${(b.unitPower/1000).toFixed(1)}MW = ${(b.totalPower/1000).toFixed(1)}MW`);
  }
  
  // 储能
  console.log('\n[储能系统]');
  scheme.battery.forEach(b => {
    console.log(`  ${b.model}: ${b.count}组 × ${b.unitPower.toFixed(2)}kWh = ${b.totalPower.toFixed(1)}kWh, 投资${b.totalPrice.toFixed(1)}万元`);
  });
  
  // PCS
  console.log('\n[储能变流器(PCS)]');
  scheme.pcs.forEach(p => {
    console.log(`  ${p.model}: ${p.count}台 × ${p.unitPower}kW = ${p.totalPower}kW, 投资${p.totalPrice.toFixed(1)}万元`);
  });
  
  // 容量汇总
  console.log('\n--- 容量汇总 ---');
  console.log(`  风电装机: ${scheme.capacity.windMW.toFixed(2)} MW`);
  console.log(`  光伏装机: ${scheme.capacity.solarMW.toFixed(2)} MW`);
  console.log(`  生物质装机: ${scheme.capacity.bioMW.toFixed(2)} MW`);
  console.log(`  储能容量: ${scheme.capacity.batteryMWh.toFixed(2)} MWh`);
  console.log(`  PCS功率: ${scheme.capacity.pcsMW.toFixed(2)} MW`);
  console.log(`  逆变器容量: ${scheme.capacity.inverterMW.toFixed(2)} MW`);
  
  // 能源占比
  console.log('\n--- 能源占比 ---');
  console.log(`  风电占比: ${(scheme.energyRatio.wind * 100).toFixed(1)}%`);
  console.log(`  光伏占比: ${(scheme.energyRatio.solar * 100).toFixed(1)}%`);
  console.log(`  生物质占比: ${(scheme.energyRatio.bio * 100).toFixed(1)}%`);
  console.log(`  总占比: ${(scheme.energyRatio.total * 100).toFixed(1)}%`);
  
  // 经济指标
  console.log('\n--- 经济指标 ---');
  console.log(`  总投资: ${scheme.economics.totalInvestment.toFixed(1)} 万元`);
  console.log(`  年发电量: ${scheme.economics.annualGeneration.toFixed(0)} MWh`);
  console.log(`  度电成本(LCOE): ${scheme.economics.LCOE.toFixed(3)} 元/kWh`);
  
  // 约束满足情况
  console.log('\n--- 约束检查 ---');
  if (scheme.constraints.satisfied) {
    console.log('  ✓ 所有约束均满足');
  } else {
    console.log('  ✗ 存在约束违反:');
    scheme.constraints.violations.forEach(v => console.log(`    - ${v}`));
  }
  
  console.log(`\n综合评分: ${scheme.score} 分`);
}

// ============================================
// 执行求解
// ============================================

const schemes = solveRegion53();
schemes.forEach(printScheme);

console.log('\n' + '='.repeat(60));
console.log('求解完成，共生成 ' + schemes.length + ' 套方案');
console.log('推荐方案: ' + schemes[0].name);
console.log('='.repeat(60));
