// ============================================
// 优化求解引擎
// 基于资源曲线的智能搜索与仿真
// 符合说明报告最新.md中的公式定义
// ============================================

import {
  City,
  CityType,
  getResourceData,
  getDaysInMonth,
  getCurrentStudentId,
  getStudentRegionMultiplier,
} from './DataSetting';
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
  PCS_UNITS,
  WindTurbineSpec,
} from './EquipmentData';

// 导入预计算的最优解数据
import optimalSolutionsData from './optimalSolutions.json';

// ============================================
// 类型定义
// ============================================

export type BiomassRoute = '直燃' | '气化' | '沼气';

export interface EquipmentSelection {
  model: string;
  manufacturer: string;
  count: number;
  unitCapacity: number;
  totalCapacity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface BiomassEquipmentSelection {
  route: BiomassRoute;
  primary: EquipmentSelection;    // 锅炉/气化炉/发酵罐
  secondary: EquipmentSelection;  // 汽轮机/燃气机/沼气机
}

export interface EquipmentConfig {
  wind: EquipmentSelection[];
  solar: EquipmentSelection[];
  biomass: BiomassEquipmentSelection;
  battery: EquipmentSelection[];
  inverter: EquipmentSelection[];
  pcs: EquipmentSelection[];
}

export interface HourlyData {
  windPower: number;      // MW
  solarPower: number;     // MW
  biomassPower: number;   // MW
  totalGeneration: number; // MW
  load: number;           // MW
  balance: number;        // MW (正=盈余，负=缺口)
  batterySOC: number;     // %
  batteryCharge: number;  // MW (正=充电，负=放电)
  curtailment: number;    // MW (弃电)
  shortage: number;       // MW (缺电)
}

export interface SimulationResult {
  feasible: boolean;
  hourlyData: HourlyData[];
  reliability: number;        // 供电可靠率 %
  curtailmentRate: number;    // 弃电率 %
  shortageHours: number;      // 缺电小时数
  totalGeneration: number;    // 总发电量 MWh
  totalLoad: number;          // 总负荷 MWh
  totalCurtailment: number;   // 总弃电量 MWh
  totalShortage: number;      // 总缺电量 MWh
  avgSOC: number;             // 平均SOC %
  minSOC: number;             // 最低SOC %
  maxSOC: number;             // 最高SOC %
  // 新增：能源占比数据
  windGeneration?: number;    // 风电发电量 MWh
  solarGeneration?: number;   // 光伏发电量 MWh
  biomassGeneration?: number; // 生物质发电量 MWh
  energyRatio?: {             // 能源占比
    wind: number;             // 风电占比
    solar: number;            // 光伏占比
    bio: number;              // 生物质占比
    total: number;            // 总占比
  };
  constraintViolations?: string[];  // 约束违反列表
}

export interface Solution {
  id: string;
  regionId: number;
  regionName: string;
  regionType: CityType;
  config: EquipmentConfig;
  totalCost: number;          // 万元
  simulation: SimulationResult;
  score: SolutionScore;
  timestamp: number;
}

export interface SolutionScore {
  total: number;              // 总分 0-100
  reliability: number;        // 工况满足 0-30
  matching: number;           // 设备匹配 0-20
  economics: number;          // 经济性 0-30
  stability: number;          // 稳定性 0-20
  groupBonus: number;         // 小组加分 0-10
  issues: string[];           // 问题列表
}

export interface CapacityRange {
  min: number;
  max: number;
  step: number;
  recommended: number;
}

export interface SearchRanges {
  wind: CapacityRange;        // MW
  solar: CapacityRange;       // MW
  biomass: CapacityRange;     // MW
  battery: CapacityRange;     // MWh
}

export interface BiomassRouteRecommendation {
  route: BiomassRoute;
  score: number;
  reason: string;
}

// ============================================
// 常量定义 - 符合文档公式
// ============================================

// 空气密度 kg/m³ (公式3.1)
const AIR_DENSITY = 1.225;

// 风能利用系数Cp计算参数 (公式3.5)
const CP_COEFFICIENTS = {
  c1: 0.5176,
  c2: 116,
  c3: 0.4,
  c4: 5,
  c5: 21,
  c6: 0.0068
};

// 传动系统效率 (公式3.11)
const ETA_TRANSMISSION = 0.92;  // η1
const ETA_GENERATOR = 0.95;     // η2

// 光伏降额因子 (公式3.14)
const PV_DERATING_FACTOR = 0.95;  // f_PV

// 标准测试条件光照强度 (公式3.15)
const G_STC = 1.0;  // kW/m²

// 生物质发电效率 (公式3.17) - 分设备效率
const GENERATION_EFFICIENCY = {
  biomass: {
    '直燃': { boiler: 0.80, engine: 0.30, gen: 0.96 },  // 锅炉、汽轮机、发电机效率
    '气化': { boiler: 0.75, engine: 0.25, gen: 0.95 },
    '沼气': { boiler: 0.85, engine: 0.35, gen: 0.97 },
  },
  battery: 0.92,  // 充放电效率
};

// ============================================
// 能源占比约束（按区域类型）
// 根据目标函数与约束条件文档定义
// ============================================
export interface EnergyRatioConstraints {
  wind: { min: number; max: number };
  solar: { min: number; max: number };
  bio: { min: number; max: number };
  totalMin: number;
  totalMax: number;
}

export const ENERGY_RATIO_CONSTRAINTS: Record<CityType, EnergyRatioConstraints> = {
  '工业区': { wind: { min: 0.15, max: 0.60 }, solar: { min: 0.30, max: 0.90 }, bio: { min: 0.05, max: 0.50 }, totalMin: 1.0, totalMax: 2.0 },
  '居民区': { wind: { min: 0.10, max: 0.50 }, solar: { min: 0.35, max: 0.90 }, bio: { min: 0.05, max: 0.40 }, totalMin: 1.0, totalMax: 2.0 },
  '山地区': { wind: { min: 0.30, max: 0.80 }, solar: { min: 0.25, max: 0.70 }, bio: { min: 0.05, max: 0.35 }, totalMin: 1.0, totalMax: 2.0 },
  '农业区': { wind: { min: 0.15, max: 0.65 }, solar: { min: 0.25, max: 0.80 }, bio: { min: 0.10, max: 0.50 }, totalMin: 1.0, totalMax: 2.0 },
  '林业区': { wind: { min: 0.02, max: 0.30 }, solar: { min: 0.45, max: 0.95 }, bio: { min: 0.15, max: 0.55 }, totalMin: 1.0, totalMax: 2.0 },
  '测试区': { wind: { min: 0.10, max: 0.60 }, solar: { min: 0.30, max: 0.90 }, bio: { min: 0.05, max: 0.50 }, totalMin: 1.0, totalMax: 2.0 },
};

export function getEnergyRatioConstraints(regionType: CityType): EnergyRatioConstraints {
  return ENERGY_RATIO_CONSTRAINTS[regionType] || ENERGY_RATIO_CONSTRAINTS['测试区'];
}

// ============================================
// 固定区域参数
// ============================================
const BASE_REGION_PARAMS: Record<
  CityType,
  {
    dailyLoad: number;
    peakLoad: number;
    dailyBiomass: number;
    windHours: number;
    solarHours: number;
    avgWindSpeed: number;
    avgSolarIntensity: number;
  }
> = {
  '工业区': { dailyLoad: 1320, peakLoad: 65, dailyBiomass: 60, windHours: 2000, solarHours: 1200, avgWindSpeed: 4.0, avgSolarIntensity: 0.5 },
  '居民区': { dailyLoad: 660, peakLoad: 35, dailyBiomass: 80, windHours: 1800, solarHours: 1200, avgWindSpeed: 3.5, avgSolarIntensity: 0.5 },
  '山地区': { dailyLoad: 120, peakLoad: 8, dailyBiomass: 30, windHours: 2500, solarHours: 1400, avgWindSpeed: 7.5, avgSolarIntensity: 0.6 },
  '农业区': { dailyLoad: 240, peakLoad: 12, dailyBiomass: 163, windHours: 2200, solarHours: 1300, avgWindSpeed: 5.0, avgSolarIntensity: 0.55 },
  '林业区': { dailyLoad: 72, peakLoad: 4, dailyBiomass: 150, windHours: 1500, solarHours: 1000, avgWindSpeed: 2.5, avgSolarIntensity: 0.4 },
  '测试区': { dailyLoad: 480, peakLoad: 20, dailyBiomass: 100, windHours: 2000, solarHours: 1200, avgWindSpeed: 4.0, avgSolarIntensity: 0.5 },
};

function getRegionParams(region: City) {
  const base = BASE_REGION_PARAMS[region.type];
  if (!base) return null;
  
  const studentId = getCurrentStudentId();
  const multiplier = getStudentRegionMultiplier(studentId, region.id);
  
  return {
    ...base,
    dailyLoad: base.dailyLoad * multiplier,
    peakLoad: base.peakLoad * multiplier,
    dailyBiomass: base.dailyBiomass * multiplier,
  };
}

export function calculateDailyLoad(region: City): number {
  const params = getRegionParams(region);
  return params?.dailyLoad || 240;
}

export function calculatePeakLoad(region: City): number {
  const params = getRegionParams(region);
  return params?.peakLoad || 12;
}

export function calculateDailyBiomass(region: City): number {
  const params = getRegionParams(region);
  return params?.dailyBiomass || 100;
}

// ============================================
// 生物质热值计算 - 公式3.16
// Q_net,ar = 35.16C + 116.23H - 11.09O + 6.28N + 10.47S - 2.51(9H + W)
// ============================================
export function calculateBiomassHeatValue(biomassComp: {
  C: number; H: number; O: number; N: number; S: number; Moisture: number;
}): number {
  const { C, H, O, N, S, Moisture } = biomassComp;
  // 公式3.16: Q_net,ar = 35.16C + 116.23H - 11.09O + 6.28N + 10.47S - 2.51(9H + W)
  // 结果单位: kJ/kg，需要转换为 MJ/kg
  const Q_net_ar = 35.16 * C + 116.23 * H - 11.09 * O + 6.28 * N + 10.47 * S - 2.51 * (9 * H + Moisture);
  return Q_net_ar / 100;  // kJ/kg -> MJ/kg (除以100是因为元素分析是百分比)
}

// ============================================
// 风能利用系数Cp计算 - 公式3.5, 3.6
// ============================================
function calculateCp(lambda: number, beta: number = 0): number {
  const { c1, c2, c3, c4, c5, c6 } = CP_COEFFICIENTS;
  
  // 公式3.6: λ_i = 1 / (1/(λ + 0.08β) - 0.035/(β³ + 1))
  const lambda_i = 1 / (1 / (lambda + 0.08 * beta) - 0.035 / (Math.pow(beta, 3) + 1));
  
  // 公式3.5: Cp = c1(c2/λ_i - c3β - c4)e^(-c5/λ_i) + c6λ
  const Cp = c1 * (c2 / lambda_i - c3 * beta - c4) * Math.exp(-c5 / lambda_i) + c6 * lambda;
  
  return Math.max(0, Math.min(0.593, Cp));  // Betz极限
}

// ============================================
// 叶尖速比计算 - 公式3.7
// λ = 2πnR/V = ωR/V
// ============================================
function calculateTipSpeedRatio(rotorDiameter: number, rotorSpeed: number, windSpeed: number): number {
  if (windSpeed <= 0) return 0;
  const R = rotorDiameter / 2;  // 半径 m
  const omega = 2 * Math.PI * rotorSpeed;  // 角速度 rad/s
  return omega * R / windSpeed;
}

// ============================================
// 风机功率计算 - 公式3.11 (符合文档)
// P = 0 (V ≤ Vc)
// P = (1/8)Cp·η1·η2·ρ·D³·V³ (Vc < V ≤ Vr)
// P = Pr (Vr < V ≤ Vcut)
// P = 0 (V > Vcut)
// ============================================
function calculateWindPowerByFormula(
  windSpeed: number,
  turbine: WindTurbineSpec
): number {
  const V = windSpeed;
  const Vc = turbine.cutInSpeed;      // 切入风速
  const Vr = turbine.ratedSpeed;      // 额定风速
  const Vcut = turbine.cutOutSpeed;   // 切出风速
  const Pr = turbine.ratedPower;      // 额定功率 kW
  const D = turbine.rotorDiameter;    // 风轮直径 m
  
  if (V <= Vc || V > Vcut) {
    return 0;
  } else if (V > Vr && V <= Vcut) {
    return Pr;
  } else {
    // Vc < V ≤ Vr: 使用公式3.11
    // 计算最佳叶尖速比下的Cp
    const n = turbine.ratedSpeed ? turbine.ratedSpeed / 60 : 0.2;  // 额定转速 r/s
    const lambda = calculateTipSpeedRatio(D, n, V);
    const Cp = calculateCp(lambda, 0);
    
    // 公式3.11: P = (1/8)Cp·η1·η2·ρ·D³·V³
    const P = (1/8) * Cp * ETA_TRANSMISSION * ETA_GENERATOR * AIR_DENSITY * Math.pow(D, 3) * Math.pow(V, 3);
    
    // 转换为kW并限制不超过额定功率
    return Math.min(P / 1000, Pr);
  }
}

// ============================================
// 光伏功率计算 - 公式3.12-3.15 (符合文档)
// ============================================
function calculateSolarPowerByFormula(
  solarIntensity: number,  // G_T (kW/m²)
  temperature: number,     // 环境温度 ℃
  panelConfig: EquipmentSelection[]
): number {
  let totalPower = 0;
  
  for (const config of panelConfig) {
    const panel = SOLAR_PANELS.find(p => p.model === config.model);
    if (!panel) continue;
    
    // 公式3.12: Y_pv = G_STC × A × η_pv,STC (这里直接用额定功率)
    const Y_pv = config.totalCapacity;  // 额定功率 kW
    
    // 公式3.13: η_pv = η_pv,STC × (1 + α_T × (T - 25))
    const alpha_T = (panel.tempCoeffPmax || -0.35) / 100;  // 温度系数 %/℃ -> /℃
    const eta_ratio = 1 + alpha_T * (temperature - 25);
    
    // 公式3.14: f = f_PV × (η_pv / η_pv,STC)
    const f = PV_DERATING_FACTOR * eta_ratio;
    
    // 公式3.15: P_PV = f × Y_pv × (G_T / G_STC)
    const P_PV = f * Y_pv * (solarIntensity / G_STC);
    
    totalPower += Math.max(0, P_PV);
  }
  
  return totalPower / 1000;  // kW -> MW
}

// ============================================
// 生物质发电功率计算 - 公式3.17
// P_bio = (B × Q_net,ar × η_boiler × η_engine × η_gen) / 3600
// ============================================
function calculateBiomassPowerByFormula(
  biomassConfig: BiomassEquipmentSelection,
  availableBiomass: number,  // 吨/天
  heatValue: number          // MJ/kg
): number {
  if (!biomassConfig.secondary.model) return 0;
  
  const route = biomassConfig.route;
  const eff = GENERATION_EFFICIENCY.biomass[route];
  
  // B: 燃料消耗量 kg/h = 日产量(t) × 1000(kg/t) / 24(h)
  const B = availableBiomass * 1000 / 24;
  
  // 公式3.17: P_bio = (B × Q_net,ar × η_boiler × η_engine × η_gen) / 3600
  // Q_net,ar 单位是 MJ/kg，需要转换为 kJ/kg
  const P_bio = (B * heatValue * 1000 * eff.boiler * eff.engine * eff.gen) / 3600;
  
  // 不超过设备额定功率
  const ratedPower = biomassConfig.secondary.totalCapacity / 1000;  // kW -> MW
  
  return Math.min(P_bio / 1000, ratedPower);  // kW -> MW
}

export function calculateMaxBiomassPower(region: City, route: BiomassRoute): number {
  const params = getRegionParams(region);
  if (!params) return 1;
  
  const dailyBiomass = params.dailyBiomass;
  // 使用公式3.16计算热值
  const heatValue = calculateBiomassHeatValue(region.biomassComp);
  const eff = GENERATION_EFFICIENCY.biomass[route];
  
  const B = dailyBiomass * 1000 / 24;
  const P_bio = (B * heatValue * 1000 * eff.boiler * eff.engine * eff.gen) / 3600;
  
  return P_bio / 1000;  // kW -> MW
}

// ============================================
// 生物质路线推荐
// ============================================
export function recommendBiomassRoutes(region: City): BiomassRouteRecommendation[] {
  const comp = region.biomassComp;
  const dailyOutput = calculateDailyBiomass(region);
  
  const recommendations: BiomassRouteRecommendation[] = [];
  
  // 直燃评分
  let directScore = 50;
  if (dailyOutput >= 100) directScore += 20;
  else if (dailyOutput >= 50) directScore += 15;
  else directScore += 5;
  
  if (comp.Moisture >= 20 && comp.Moisture <= 45) directScore += 15;
  else if (comp.Moisture < 20) directScore += 10;
  else directScore += 5;
  
  if (comp.Ash < 10) directScore += 15;
  else if (comp.Ash < 20) directScore += 10;
  else directScore += 5;
  
  recommendations.push({
    route: '直燃',
    score: Math.min(100, directScore),
    reason: dailyOutput > 50 ? '产量大，适合规模化直燃' : '产量较小，直燃效率偏低'
  });
  
  // 气化评分
  let gasScore = 50;
  if (dailyOutput >= 30 && dailyOutput <= 150) gasScore += 20;
  else if (dailyOutput < 30) gasScore += 15;
  else gasScore += 10;
  
  if (comp.Moisture < 20) gasScore += 15;
  else if (comp.Moisture < 30) gasScore += 10;
  else gasScore += 0;
  
  if (comp.Volatiles > 60) gasScore += 15;
  else if (comp.Volatiles > 50) gasScore += 10;
  else gasScore += 5;
  
  recommendations.push({
    route: '气化',
    score: Math.min(100, gasScore),
    reason: comp.Moisture < 25 ? '含水率低，气化效率高' : '含水率偏高，需预干燥'
  });
  
  // 沼气评分
  let biogasScore = 50;
  if (dailyOutput >= 50) biogasScore += 20;
  else if (dailyOutput >= 30) biogasScore += 15;
  else biogasScore += 10;
  
  if (comp.Moisture > 35) biogasScore += 15;
  else if (comp.Moisture > 25) biogasScore += 10;
  else biogasScore += 5;
  
  const cnRatio = comp.C / Math.max(comp.N, 0.1);
  if (cnRatio >= 20 && cnRatio <= 30) biogasScore += 15;
  else if (cnRatio >= 15 && cnRatio <= 40) biogasScore += 10;
  else biogasScore += 5;
  
  recommendations.push({
    route: '沼气',
    score: Math.min(100, biogasScore),
    reason: comp.Moisture > 30 ? '含水率高，适合厌氧发酵' : '含水率低，需补水'
  });
  
  return recommendations.sort((a, b) => b.score - a.score);
}

// ============================================
// 搜索范围估算
// ============================================
export function estimateSearchRanges(region: City): SearchRanges {
  const params = getRegionParams(region);
  if (!params) {
    return {
      wind: { min: 0, max: 10, step: 1, recommended: 5 },
      solar: { min: 0, max: 10, step: 1, recommended: 5 },
      biomass: { min: 0, max: 5, step: 0.5, recommended: 2 },
      battery: { min: 10, max: 100, step: 10, recommended: 50 }
    };
  }
  
  const dailyLoad = params.dailyLoad;
  const peakLoad = params.peakLoad;
  const annualLoad = dailyLoad * 365;
  
  const windForFull = annualLoad / params.windHours;
  const windMax = Math.max(5, Math.ceil(windForFull * 1.5));
  const windStep = windMax < 10 ? 1 : windMax < 30 ? 2 : 5;
  
  const solarForFull = annualLoad / params.solarHours;
  const solarMax = Math.max(5, Math.ceil(solarForFull * 1.5));
  const solarStep = solarMax < 10 ? 1 : solarMax < 30 ? 2 : 5;
  
  const biomassMax = Math.max(1, calculateMaxBiomassPower(region, '直燃') * 1.2);
  const biomassStep = biomassMax < 3 ? 0.5 : biomassMax < 10 ? 1 : 2;
  
  const batteryMin = Math.max(10, peakLoad * 2);
  const batteryMax = Math.max(100, peakLoad * 12);
  const batteryStep = peakLoad < 10 ? 2 : peakLoad < 30 ? 5 : 20;
  
  return {
    wind: { min: 0, max: windMax, step: windStep, recommended: Math.round(windForFull * 0.6) },
    solar: { min: 0, max: solarMax, step: solarStep, recommended: Math.round(solarForFull * 0.5) },
    biomass: { min: 0, max: Math.round(biomassMax * 10) / 10, step: biomassStep, recommended: Math.round(biomassMax * 0.8 * 10) / 10 },
    battery: { min: batteryMin, max: batteryMax, step: batteryStep, recommended: Math.round(peakLoad * 6) }
  };
}


// ============================================
// 设备选型函数
// ============================================

/**
 * 选择风机配置
 */
export function selectWindTurbines(targetMW: number): EquipmentSelection[] {
  if (targetMW <= 0) return [];
  
  const targetKW = targetMW * 1000;
  const selections: EquipmentSelection[] = [];
  
  let candidates: WindTurbineSpec[];
  if (targetKW < 100) {
    candidates = WIND_TURBINES.filter(w => w.ratedPower <= 10);
  } else if (targetKW < 500) {
    candidates = WIND_TURBINES.filter(w => w.ratedPower >= 10 && w.ratedPower <= 50);
  } else if (targetKW < 3000) {
    candidates = WIND_TURBINES.filter(w => w.ratedPower >= 50 && w.ratedPower <= 1500);
  } else {
    candidates = WIND_TURBINES.filter(w => w.ratedPower >= 1500);
  }
  
  if (candidates.length === 0) {
    candidates = WIND_TURBINES;
  }
  
  candidates.sort((a, b) => a.pricePerKW - b.pricePerKW);
  
  let remaining = targetKW;
  for (const turbine of candidates) {
    if (remaining <= 0) break;
    
    const count = Math.ceil(remaining / turbine.ratedPower);
    if (count > 100) continue;
    
    selections.push({
      model: turbine.model,
      manufacturer: turbine.manufacturer,
      count,
      unitCapacity: turbine.ratedPower,
      totalCapacity: count * turbine.ratedPower,
      unitPrice: turbine.price,
      totalPrice: count * turbine.price
    });
    remaining = 0;
  }
  
  return selections;
}

/**
 * 选择光伏配置
 */
export function selectSolarPanels(targetMW: number): EquipmentSelection[] {
  if (targetMW <= 0) return [];
  
  const targetWp = targetMW * 1000000;
  
  const sorted = [...SOLAR_PANELS].sort((a, b) => a.pricePerWatt - b.pricePerWatt);
  const best = sorted[0];
  
  const count = Math.ceil(targetWp / best.power);
  
  return [{
    model: best.model,
    manufacturer: best.manufacturer,
    count,
    unitCapacity: best.power / 1000,
    totalCapacity: count * best.power / 1000,
    unitPrice: best.price / 10000,
    totalPrice: count * best.price / 10000
  }];
}

/**
 * 获取光伏组件的电气参数
 */
function getSolarPanelParams(solarConfig: EquipmentSelection[]): { Vmp: number; Voc: number; Isc: number } | null {
  if (solarConfig.length === 0) return null;
  
  const modelName = solarConfig[0].model;
  const panel = SOLAR_PANELS.find(p => p.model === modelName);
  
  if (!panel) return null;
  
  return {
    Vmp: panel.Vmp,
    Voc: panel.Voc,
    Isc: panel.Isc
  };
}

/**
 * 选择生物质设备配置
 */
export function selectBiomassEquipment(targetMW: number, route: BiomassRoute): BiomassEquipmentSelection {
  const emptySelection: EquipmentSelection = {
    model: '', manufacturer: '', count: 0,
    unitCapacity: 0, totalCapacity: 0, unitPrice: 0, totalPrice: 0
  };
  
  if (targetMW <= 0) {
    return { route, primary: emptySelection, secondary: emptySelection };
  }
  
  let primary: EquipmentSelection = emptySelection;
  let secondary: EquipmentSelection = emptySelection;
  
  if (route === '直燃') {
    const boilers = [...DIRECT_COMBUSTION_BOILERS].sort((a, b) => 
      (a.price / a.steamCapacity) - (b.price / b.steamCapacity)
    );
    const steamNeeded = targetMW * 4.5;
    for (const boiler of boilers) {
      const count = Math.ceil(steamNeeded / boiler.steamCapacity);
      if (count <= 5) {
        primary = {
          model: boiler.model,
          manufacturer: boiler.manufacturer,
          count,
          unitCapacity: boiler.steamCapacity,
          totalCapacity: count * boiler.steamCapacity,
          unitPrice: boiler.price,
          totalPrice: count * boiler.price
        };
        break;
      }
    }
    
    const turbines = [...STEAM_TURBINES].sort((a, b) => 
      (a.price / a.ratedPower) - (b.price / b.ratedPower)
    );
    for (const turbine of turbines) {
      if (turbine.ratedPower >= targetMW * 0.8) {
        secondary = {
          model: turbine.model,
          manufacturer: turbine.manufacturer,
          count: 1,
          unitCapacity: turbine.ratedPower * 1000,
          totalCapacity: turbine.ratedPower * 1000,
          unitPrice: turbine.price,
          totalPrice: turbine.price
        };
        break;
      }
    }
  } else if (route === '气化') {
    const gasifiers = [...GASIFIERS].sort((a, b) => 
      (a.price / a.gasOutput) - (b.price / b.gasOutput)
    );
    const gasNeeded = targetMW * 1000 * 2.5;
    for (const gasifier of gasifiers) {
      const count = Math.ceil(gasNeeded / gasifier.gasOutput);
      if (count <= 10) {
        primary = {
          model: gasifier.model,
          manufacturer: gasifier.manufacturer,
          count,
          unitCapacity: gasifier.gasOutput,
          totalCapacity: count * gasifier.gasOutput,
          unitPrice: gasifier.price,
          totalPrice: count * gasifier.price
        };
        break;
      }
    }
    
    const engines = GAS_ENGINES.filter(e => e.fuelType === '燃气')
      .sort((a, b) => (a.price / a.ratedPower) - (b.price / b.ratedPower));
    const targetKW = targetMW * 1000;
    for (const engine of engines) {
      const count = Math.ceil(targetKW / engine.ratedPower);
      if (count <= 10) {
        secondary = {
          model: engine.model,
          manufacturer: engine.manufacturer,
          count,
          unitCapacity: engine.ratedPower,
          totalCapacity: count * engine.ratedPower,
          unitPrice: engine.price,
          totalPrice: count * engine.price
        };
        break;
      }
    }
  } else {
    const digesters = [...ANAEROBIC_DIGESTERS].sort((a, b) => 
      (a.price / a.dailyGasOutput) - (b.price / b.dailyGasOutput)
    );
    const dailyGasNeeded = targetMW * 1000 * 20 * 2;
    for (const digester of digesters) {
      const count = Math.ceil(dailyGasNeeded / digester.dailyGasOutput);
      if (count <= 10) {
        primary = {
          model: digester.model,
          manufacturer: digester.manufacturer,
          count,
          unitCapacity: digester.dailyGasOutput,
          totalCapacity: count * digester.dailyGasOutput,
          unitPrice: digester.price,
          totalPrice: count * digester.price
        };
        break;
      }
    }
    
    const engines = GAS_ENGINES.filter(e => e.fuelType === '沼气')
      .sort((a, b) => (a.price / a.ratedPower) - (b.price / b.ratedPower));
    const targetKW = targetMW * 1000;
    for (const engine of engines) {
      const count = Math.ceil(targetKW / engine.ratedPower);
      if (count <= 10) {
        secondary = {
          model: engine.model,
          manufacturer: engine.manufacturer,
          count,
          unitCapacity: engine.ratedPower,
          totalCapacity: count * engine.ratedPower,
          unitPrice: engine.price,
          totalPrice: count * engine.price
        };
        break;
      }
    }
  }
  
  return { route, primary, secondary };
}

/**
 * 选择储能电池配置
 */
export function selectBatteries(targetMWh: number): EquipmentSelection[] {
  if (targetMWh <= 0) return [];
  
  const targetKWh = targetMWh * 1000;
  
  const sorted = [...BATTERIES].sort((a, b) => a.pricePerKWh - b.pricePerKWh);
  const best = sorted[0];
  
  const count = Math.ceil(targetKWh / best.energyCapacity);
  
  return [{
    model: best.model,
    manufacturer: best.manufacturer,
    count,
    unitCapacity: best.energyCapacity,
    totalCapacity: count * best.energyCapacity,
    unitPrice: best.price,
    totalPrice: count * best.price
  }];
}

/**
 * 选择储能变流器(PCS)配置 - 公式3.32-3.35
 */
export function selectPCS(
  batteryMWh: number,
  dischargeHours: number = 2,
  batteryVoltage?: number
): EquipmentSelection[] {
  if (batteryMWh <= 0) return [];
  
  // 公式3.35: P_dis = E_battery / t_discharge
  const targetPowerKW = (batteryMWh * 1000) / dischargeHours;
  
  let candidates = [...PCS_UNITS];
  // 公式3.33: 电压匹配
  if (batteryVoltage) {
    candidates = candidates.filter(pcs => 
      batteryVoltage >= pcs.batteryVoltageMin && 
      batteryVoltage <= pcs.batteryVoltageMax
    );
  }
  
  if (candidates.length === 0) {
    candidates = [...PCS_UNITS];
  }
  
  // 公式3.32: P_PCS = 2 × P_average,discharge
  const suitablePCS = candidates.filter(pcs => pcs.ratedPower >= targetPowerKW * 0.8);
  
  if (suitablePCS.length === 0) {
    const maxPowerPCS = candidates.sort((a, b) => b.ratedPower - a.ratedPower)[0];
    const count = Math.ceil(targetPowerKW / maxPowerPCS.ratedPower);
    return [{
      model: maxPowerPCS.model,
      manufacturer: maxPowerPCS.manufacturer,
      count,
      unitCapacity: maxPowerPCS.ratedPower,
      totalCapacity: count * maxPowerPCS.ratedPower,
      unitPrice: maxPowerPCS.price,
      totalPrice: count * maxPowerPCS.price
    }];
  }
  
  const scoredPCS = suitablePCS.map(pcs => {
    let score = 0;
    const capacityDiff = Math.abs(pcs.ratedPower - targetPowerKW) / Math.max(targetPowerKW, pcs.ratedPower);
    const capacityMatch = Math.max(0, 1 - capacityDiff);
    score += capacityMatch * 40;
    const efficiencyScore = (pcs.efficiency - 90) / 10;
    score += Math.max(0, Math.min(1, efficiencyScore)) * 30;
    const pricePerKW = pcs.price / pcs.ratedPower;
    const allPricesPerKW = candidates.map(p => p.price / p.ratedPower);
    const minPrice = Math.min(...allPricesPerKW);
    const maxPrice = Math.max(...allPricesPerKW);
    const economyScore = 1 - (pricePerKW - minPrice) / (maxPrice - minPrice || 1);
    score += economyScore * 30;
    return { pcs, score };
  }).sort((a, b) => b.score - a.score);
  
  const bestPCS = scoredPCS[0].pcs;
  const count = Math.ceil(targetPowerKW / bestPCS.ratedPower);
  
  return [{
    model: bestPCS.model,
    manufacturer: bestPCS.manufacturer,
    count,
    unitCapacity: bestPCS.ratedPower,
    totalCapacity: count * bestPCS.ratedPower,
    unitPrice: bestPCS.price,
    totalPrice: count * bestPCS.price
  }];
}

/**
 * 根据区域类型获取推荐容配比 - 公式3.26
 */
function getCapacityRatio(regionType: CityType): number {
  const ratios: Record<CityType, number> = {
    '山地区': 1.25,
    '农业区': 1.20,
    '工业区': 1.10,
    '居民区': 1.10,
    '林业区': 1.00,
    '测试区': 1.10
  };
  return ratios[regionType] || 1.10;
}

/**
 * 逆变器评分函数
 */
function scoreInverter(
  inverter: typeof INVERTERS[0],
  targetKW: number,
  panelVmp: number
): number {
  let score = 0;
  
  const capacityDiff = Math.abs(inverter.ratedPower - targetKW) / Math.max(targetKW, inverter.ratedPower);
  const capacityMatch = Math.max(0, 1 - capacityDiff);
  score += capacityMatch * 40;
  
  const efficiencyScore = (inverter.maxEfficiency - 95) / 5;
  score += Math.max(0, Math.min(1, efficiencyScore)) * 30;
  
  const optimalVoltage = (inverter.MPPTVoltageMin + inverter.MPPTVoltageMax) / 2;
  const stringsInSeries = Math.round(optimalVoltage / panelVmp);
  const actualVoltage = stringsInSeries * panelVmp;
  const voltageMatch = 1 - Math.abs(actualVoltage - optimalVoltage) / optimalVoltage;
  score += Math.max(0, voltageMatch) * 20;
  
  const pricePerKW = inverter.price / inverter.ratedPower;
  const economyScore = 1 - (pricePerKW - 0.03) / 0.05;
  score += Math.max(0, Math.min(1, economyScore)) * 10;
  
  return score;
}

/**
 * 选择逆变器配置 - 公式3.26-3.31
 */
export function selectInverters(
  solarMW: number,
  regionType?: CityType,
  panelConfig?: { Vmp: number; Voc: number; Isc: number }
): EquipmentSelection[] {
  if (solarMW <= 0) return [];
  
  const defaultPanel = { Vmp: 41.58, Voc: 49.62, Isc: 13.98 };
  const panel = panelConfig || defaultPanel;
  
  // 公式3.27: V_oc,max = V_oc,STC × [1 + β_oc × (T_min - 25)]
  const tempCoeffVoc = 0.0025;
  const T_min = -10;
  const Voc_max = panel.Voc * (1 + tempCoeffVoc * (25 - T_min));
  
  // 公式3.26: R_dc/ac = P_pv / P_inv
  const capacityRatio = regionType ? getCapacityRatio(regionType) : 1.10;
  const targetInverterKW = (solarMW * 1000) / capacityRatio;
  
  // 公式3.29, 3.30: 串联组件数量约束
  const suitableInverters = INVERTERS.filter(inv => {
    const minStrings = Math.ceil(inv.MPPTVoltageMin / panel.Vmp);
    const maxStrings = Math.floor((inv.maxDCVoltage * 0.9) / Voc_max);
    
    if (minStrings > maxStrings) return false;
    
    // 公式3.31: 电流匹配
    const maxCurrentPerMPPT = panel.Isc * 1.25;
    if (maxCurrentPerMPPT > inv.maxInputCurrent) return false;
    
    const recommendedStrings = Math.round((inv.MPPTVoltageMin + inv.MPPTVoltageMax) / 2 / panel.Vmp);
    const workingVoltage = recommendedStrings * panel.Vmp;
    if (workingVoltage < inv.MPPTVoltageMin || workingVoltage > inv.MPPTVoltageMax) return false;
    
    return true;
  });
  
  if (suitableInverters.length === 0) {
    return selectInvertersBasic(solarMW);
  }
  
  const scoredInverters = suitableInverters.map(inv => ({
    inverter: inv,
    score: scoreInverter(inv, targetInverterKW, panel.Vmp)
  })).sort((a, b) => b.score - a.score);
  
  const selections: EquipmentSelection[] = [];
  let remaining = targetInverterKW;
  
  const primary = scoredInverters[0].inverter;
  const primaryCount = Math.floor(remaining / primary.ratedPower);
  
  if (primaryCount > 0) {
    selections.push({
      model: primary.model,
      manufacturer: primary.manufacturer,
      count: primaryCount,
      unitCapacity: primary.ratedPower,
      totalCapacity: primaryCount * primary.ratedPower,
      unitPrice: primary.price,
      totalPrice: primaryCount * primary.price
    });
    remaining -= primaryCount * primary.ratedPower;
  }
  
  if (remaining > 0) {
    let bestSecondary = scoredInverters[0].inverter;
    let minDiff = Math.abs(bestSecondary.ratedPower - remaining);
    
    for (const scored of scoredInverters) {
      const diff = Math.abs(scored.inverter.ratedPower - remaining);
      if (diff < minDiff && scored.inverter.ratedPower <= remaining * 1.5) {
        bestSecondary = scored.inverter;
        minDiff = diff;
      }
    }
    
    const secondaryCount = Math.ceil(remaining / bestSecondary.ratedPower);
    
    if (secondaryCount <= 5) {
      selections.push({
        model: bestSecondary.model,
        manufacturer: bestSecondary.manufacturer,
        count: secondaryCount,
        unitCapacity: bestSecondary.ratedPower,
        totalCapacity: secondaryCount * bestSecondary.ratedPower,
        unitPrice: bestSecondary.price,
        totalPrice: secondaryCount * bestSecondary.price
      });
    } else {
      const additionalCount = Math.ceil(remaining / primary.ratedPower);
      selections[0].count += additionalCount;
      selections[0].totalCapacity += additionalCount * primary.ratedPower;
      selections[0].totalPrice += additionalCount * primary.price;
    }
  }
  
  return selections;
}

/**
 * 基础逆变器选型
 */
function selectInvertersBasic(solarMW: number): EquipmentSelection[] {
  const targetKW = solarMW * 1000;
  
  const sorted = [...INVERTERS].sort((a, b) => {
    const scoreA = a.maxEfficiency / (a.price / a.ratedPower);
    const scoreB = b.maxEfficiency / (b.price / b.ratedPower);
    return scoreB - scoreA;
  });
  
  let remaining = targetKW;
  const selections: EquipmentSelection[] = [];
  
  const primary = sorted[0];
  const primaryCount = Math.floor(remaining / primary.ratedPower);
  
  if (primaryCount > 0) {
    selections.push({
      model: primary.model,
      manufacturer: primary.manufacturer,
      count: primaryCount,
      unitCapacity: primary.ratedPower,
      totalCapacity: primaryCount * primary.ratedPower,
      unitPrice: primary.price,
      totalPrice: primaryCount * primary.price
    });
    remaining -= primaryCount * primary.ratedPower;
  }
  
  if (remaining > 0) {
    let bestFit = sorted[0];
    let minDiff = Math.abs(bestFit.ratedPower - remaining);
    
    for (const inv of sorted) {
      const diff = Math.abs(inv.ratedPower - remaining);
      if (diff < minDiff) {
        bestFit = inv;
        minDiff = diff;
      }
    }
    
    const count = Math.ceil(remaining / bestFit.ratedPower);
    selections.push({
      model: bestFit.model,
      manufacturer: bestFit.manufacturer,
      count,
      unitCapacity: bestFit.ratedPower,
      totalCapacity: count * bestFit.ratedPower,
      unitPrice: bestFit.price,
      totalPrice: count * bestFit.price
    });
  }
  
  return selections;
}

/**
 * 计算配置总成本 - 公式5.4
 */
export function calculateTotalCost(config: EquipmentConfig): number {
  let total = 0;
  
  // 公式5.1: C_wind
  config.wind.forEach(w => total += w.totalPrice);
  // 公式5.2: C_solar + C_inv
  config.solar.forEach(s => total += s.totalPrice);
  // 公式5.2: C_bio
  total += config.biomass.primary.totalPrice;
  total += config.biomass.secondary.totalPrice;
  // 公式5.3: C_ess
  config.battery.forEach(b => total += b.totalPrice);
  config.inverter.forEach(i => total += i.totalPrice);
  config.pcs.forEach(p => total += p.totalPrice);
  
  return Math.round(total * 100) / 100;
}


// ============================================
// 8760小时仿真引擎 - 使用文档公式
// ============================================

/**
 * 计算风机发电功率 - 使用公式3.11
 */
function calculateWindPower(
  windSpeed: number,
  windConfig: EquipmentSelection[]
): number {
  let totalPower = 0;
  
  for (const config of windConfig) {
    const turbine = WIND_TURBINES.find(t => t.model === config.model);
    if (!turbine) continue;
    
    // 使用公式3.11计算功率
    const power = calculateWindPowerByFormula(windSpeed, turbine);
    totalPower += power * config.count / 1000; // kW -> MW
  }
  
  return totalPower;
}

/**
 * 计算光伏发电功率 - 使用公式3.15
 */
function calculateSolarPower(
  solarIntensity: number,
  temperature: number,
  solarConfig: EquipmentSelection[]
): number {
  // 使用公式3.12-3.15计算功率
  return calculateSolarPowerByFormula(solarIntensity, temperature, solarConfig);
}

/**
 * 计算生物质发电功率 - 使用公式3.17
 */
function calculateBiomassPower(
  biomassConfig: BiomassEquipmentSelection,
  availableBiomass: number,
  heatValue: number
): number {
  // 使用公式3.17计算功率
  return calculateBiomassPowerByFormula(biomassConfig, availableBiomass, heatValue);
}

/**
 * 轻量级仿真 - 用于优化搜索
 */
function simulateLightweight(
  config: EquipmentConfig,
  region: City
): { 
  feasible: boolean; 
  reliability: number; 
  curtailmentRate: number; 
  shortageHours: number; 
  totalGeneration: number; 
  totalLoad: number; 
  totalCurtailment: number; 
  totalShortage: number; 
  avgSOC: number; 
  minSOC: number; 
  maxSOC: number;
  windGeneration: number;
  solarGeneration: number;
  biomassGeneration: number;
  energyRatio: { wind: number; solar: number; bio: number; total: number };
  constraintViolations: string[];
} {
  const batteryCapacity = config.battery.reduce((sum, b) => sum + b.totalCapacity, 0) / 1000;
  const maxChargeRate = batteryCapacity * 1.0;
  const maxDischargeRate = batteryCapacity * 1.0;
  const batteryEfficiency = GENERATION_EFFICIENCY.battery;
  
  let batteryEnergy = batteryCapacity * 0.5;
  
  const dailyBiomass = calculateDailyBiomass(region);
  // 使用公式3.16计算热值
  const heatValue = calculateBiomassHeatValue(region.biomassComp);
  
  let totalGeneration = 0;
  let totalLoad = 0;
  let totalCurtailment = 0;
  let totalShortage = 0;
  let shortageHours = 0;
  let socSum = 0;
  let minSOC = 100;
  let maxSOC = 0;
  
  let windGeneration = 0;
  let solarGeneration = 0;
  let biomassGeneration = 0;
  
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = getDaysInMonth(month);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const resourceData = getResourceData(region, '日', month, day);
      
      for (let hour = 0; hour < 24; hour++) {
        const windPower = calculateWindPower(resourceData.wind[hour] || 0, config.wind);
        // 获取温度数据用于光伏计算
        const temperature = resourceData.temperature?.[hour] ?? 25;
        const solarPower = calculateSolarPower(resourceData.solar[hour] || 0, temperature, config.solar);
        const biomassPower = calculateBiomassPower(config.biomass, dailyBiomass, heatValue);
        const totalGen = windPower + solarPower + biomassPower;
        
        windGeneration += windPower;
        solarGeneration += solarPower;
        biomassGeneration += biomassPower;
        
        const rawLoad = resourceData.load[hour];
        const load = (rawLoad !== undefined && rawLoad !== null && !isNaN(rawLoad)) 
          ? rawLoad / 1000 : 0;
        
        const LPS = load - totalGen;
        const CSC = batteryEnergy;
        const E = batteryCapacity;
        
        let CP = 0, DP = 0, curtailment = 0, shortage = 0;
        
        if (LPS < 0 && CSC < E) {
          const surplus = -LPS;
          const batteryDeficit = (E - CSC) / batteryEfficiency;
          CP = Math.min(surplus, maxChargeRate, batteryDeficit);
          batteryEnergy += CP * batteryEfficiency;
          curtailment = surplus - CP;
        } else if (LPS > 0 && CSC > 0) {
          const deficit = LPS;
          const batteryAvailable = CSC * batteryEfficiency;
          DP = Math.min(deficit, maxDischargeRate, batteryAvailable);
          batteryEnergy -= DP / batteryEfficiency;
          shortage = deficit - DP;
          if (shortage > 0.001) shortageHours++;
        } else {
          if (LPS > 0) {
            shortage = LPS;
            if (shortage > 0.001) shortageHours++;
          } else if (LPS < 0) {
            curtailment = -LPS;
          }
        }
        
        batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy));
        const soc = batteryCapacity > 0 ? (batteryEnergy / batteryCapacity) * 100 : 0;
        
        totalGeneration += totalGen;
        totalLoad += load;
        totalCurtailment += curtailment;
        totalShortage += shortage;
        socSum += soc;
        minSOC = Math.min(minSOC, soc);
        maxSOC = Math.max(maxSOC, soc);
      }
    }
  }
  
  const totalHours = 8760;
  const reliability = ((totalHours - shortageHours) / totalHours) * 100;
  const curtailmentRate = totalGeneration > 0 ? (totalCurtailment / totalGeneration) * 100 : 0;
  
  // 公式4.2, 4.4, 4.5: 能源占比计算
  const annualLoad = totalLoad;
  const windRatio = annualLoad > 0 ? windGeneration / annualLoad : 0;
  const solarRatio = annualLoad > 0 ? solarGeneration / annualLoad : 0;
  const bioRatio = annualLoad > 0 ? biomassGeneration / annualLoad : 0;
  const totalRatio = windRatio + solarRatio + bioRatio;
  
  const energyRatio = { wind: windRatio, solar: solarRatio, bio: bioRatio, total: totalRatio };
  const constraintViolations: string[] = [];
  const feasible = reliability >= 98;
  
  return {
    feasible, reliability, curtailmentRate, shortageHours,
    totalGeneration, totalLoad, totalCurtailment, totalShortage,
    avgSOC: socSum / totalHours, minSOC, maxSOC,
    windGeneration, solarGeneration, biomassGeneration,
    energyRatio, constraintViolations
  };
}

/**
 * 执行8760小时仿真 - 使用文档公式
 */
export function simulate8760Hours(
  config: EquipmentConfig,
  region: City
): SimulationResult {
  const hourlyData: HourlyData[] = [];
  
  const batteryCapacity = config.battery.reduce((sum, b) => sum + b.totalCapacity, 0) / 1000;
  const maxChargeRate = batteryCapacity * 1.0;
  const maxDischargeRate = batteryCapacity * 1.0;
  const batteryEfficiency = GENERATION_EFFICIENCY.battery;
  
  let batteryEnergy = batteryCapacity * 0.5;
  
  const dailyBiomass = calculateDailyBiomass(region);
  // 使用公式3.16计算热值
  const heatValue = calculateBiomassHeatValue(region.biomassComp);
  
  let totalGeneration = 0;
  let totalLoad = 0;
  let totalCurtailment = 0;
  let totalShortage = 0;
  let shortageHours = 0;
  let socSum = 0;
  let minSOC = 100;
  let maxSOC = 0;
  
  let windGeneration = 0;
  let solarGeneration = 0;
  let biomassGeneration = 0;
  
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = getDaysInMonth(month);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const resourceData = getResourceData(region, '日', month, day);
      
      for (let hour = 0; hour < 24; hour++) {
        // 使用公式3.11计算风机功率
        const windPower = calculateWindPower(resourceData.wind[hour] || 0, config.wind);
        // 使用公式3.15计算光伏功率
        const temperature = resourceData.temperature?.[hour] ?? 25;
        const solarPower = calculateSolarPower(resourceData.solar[hour] || 0, temperature, config.solar);
        // 使用公式3.17计算生物质功率
        const biomassPower = calculateBiomassPower(config.biomass, dailyBiomass, heatValue);
        const totalGen = windPower + solarPower + biomassPower;
        
        windGeneration += windPower;
        solarGeneration += solarPower;
        biomassGeneration += biomassPower;
        
        const rawLoad = resourceData.load[hour];
        const load = (rawLoad !== undefined && rawLoad !== null && !isNaN(rawLoad)) 
          ? rawLoad / 1000 : 0;
        
        // 电池充放电控制策略
        const LPS = load - totalGen;
        const CSC = batteryEnergy;
        const E = batteryCapacity;
        
        let f_ic = 0, f_id = 0;
        
        if (LPS < 0 && CSC < E) {
          f_ic = 1; f_id = 0;
        } else if (LPS > 0 && CSC > 0) {
          f_ic = 0; f_id = 1;
        }
        
        let CP = 0, DP = 0, curtailment = 0, shortage = 0;
        
        if (f_ic === 1 && f_id === 0) {
          const surplus = -LPS;
          const batteryDeficit = (E - CSC) / batteryEfficiency;
          
          if (surplus <= maxChargeRate) {
            CP = surplus <= batteryDeficit ? surplus : batteryDeficit;
          } else {
            CP = maxChargeRate <= batteryDeficit ? maxChargeRate : batteryDeficit;
          }
          
          batteryEnergy += CP * batteryEfficiency;
          curtailment = surplus - CP;
          
        } else if (f_ic === 0 && f_id === 1) {
          const deficit = LPS;
          const batteryAvailable = CSC * batteryEfficiency;
          
          if (deficit <= maxDischargeRate) {
            DP = deficit <= batteryAvailable ? deficit : batteryAvailable;
          } else {
            DP = maxDischargeRate <= batteryAvailable ? maxDischargeRate : batteryAvailable;
          }
          
          batteryEnergy -= DP / batteryEfficiency;
          shortage = deficit - DP;
          
          if (shortage > 0.001) shortageHours++;
        } else {
          if (LPS > 0) {
            shortage = LPS;
            if (shortage > 0.001) shortageHours++;
          } else if (LPS < 0) {
            curtailment = -LPS;
          }
        }
        
        const batteryCharge = CP - DP;
        batteryEnergy = Math.max(0, Math.min(batteryCapacity, batteryEnergy));
        const soc = batteryCapacity > 0 ? (batteryEnergy / batteryCapacity) * 100 : 0;
        const balance = -LPS;
        
        hourlyData.push({
          windPower, solarPower, biomassPower,
          totalGeneration: totalGen, load, balance,
          batterySOC: soc, batteryCharge, curtailment, shortage
        });
        
        totalGeneration += totalGen;
        totalLoad += load;
        totalCurtailment += curtailment;
        totalShortage += shortage;
        socSum += soc;
        minSOC = Math.min(minSOC, soc);
        maxSOC = Math.max(maxSOC, soc);
      }
    }
  }
  
  const totalHours = 8760;
  const reliability = ((totalHours - shortageHours) / totalHours) * 100;
  const curtailmentRate = totalGeneration > 0 ? (totalCurtailment / totalGeneration) * 100 : 0;
  
  // 公式4.2, 4.4, 4.5: 能源占比
  const annualLoad = totalLoad;
  const windRatio = annualLoad > 0 ? windGeneration / annualLoad : 0;
  const solarRatio = annualLoad > 0 ? solarGeneration / annualLoad : 0;
  const bioRatio = annualLoad > 0 ? biomassGeneration / annualLoad : 0;
  const totalRatio = windRatio + solarRatio + bioRatio;
  
  const energyRatio = { wind: windRatio, solar: solarRatio, bio: bioRatio, total: totalRatio };
  const constraintViolations: string[] = [];
  const feasible = reliability >= 98;
  
  return {
    feasible, hourlyData, reliability, curtailmentRate, shortageHours,
    totalGeneration, totalLoad, totalCurtailment, totalShortage,
    avgSOC: socSum / totalHours, minSOC, maxSOC,
    windGeneration, solarGeneration, biomassGeneration,
    energyRatio, constraintViolations
  };
}


// ============================================
// 评分系统 - 严格符合文档公式4.6-4.22
// 总分100分 = 工况满足(30) + 设备匹配(20) + 经济性(30) + 稳定性(20)
// ============================================

/**
 * 计算方案评分 - 基于文档评分体系
 * S_total = S_condition + S_equipment + S_economy + S_stability (公式4.22)
 */
export function calculateScore(
  config: EquipmentConfig,
  simulation: SimulationResult,
  optimalCost: number
): SolutionScore {
  const issues: string[] = [];
  const dailyLoad = simulation.totalLoad / 365;
  
  // ============================================
  // 1. 工况满足评分 (30分) - 公式4.6-4.9
  // ============================================
  
  // 公式4.6: S_load = 12 × (1 - LPSP/LPSP_max)
  const LPSP = simulation.totalLoad > 0 ? simulation.totalShortage / simulation.totalLoad : 0;
  const LPSP_max = 0.05;
  const S_load = Math.min(12, 12 * Math.max(0, 1 - LPSP / LPSP_max));
  
  // 公式4.7: S_ratio = 10 × (1 - |Σ|k_i - k_target|| / k_benchmark)
  const energyRatio = simulation.energyRatio || { wind: 0, solar: 0, bio: 0, total: 0 };
  const k_benchmark = 0.3;
  // 目标占比：风0.3, 光0.4, 生物质0.3
  const ratioDeviation = Math.abs(energyRatio.wind - 0.3) + Math.abs(energyRatio.solar - 0.4) + Math.abs(energyRatio.bio - 0.3);
  const S_ratio = Math.min(10, 10 * Math.max(0, 1 - ratioDeviation / k_benchmark));
  
  // 公式4.8: S_balance = 8 × (1 - T_deficit/8760)
  const T_deficit = simulation.shortageHours;
  const S_balance = Math.min(8, 8 * Math.max(0, 1 - T_deficit / 8760));
  
  // 公式4.9: S_condition = S_load + S_ratio + S_balance (最高30分)
  const reliabilityScore = Math.min(30, Math.round(S_load + S_ratio + S_balance));
  
  if (simulation.reliability < 99) {
    issues.push(`供电可靠率${simulation.reliability.toFixed(1)}%，缺电${simulation.shortageHours}小时`);
  }
  
  // ============================================
  // 2. 设备匹配评分 (20分) - 公式4.10-4.15
  // ============================================
  
  // 公式4.10: 逆变器容配比评分 (7分)
  // k_inv = P_solar,DC / P_inv,AC
  const pvCapacity = config.solar.reduce((sum, s) => sum + s.totalCapacity, 0);
  const inverterCapacity = config.inverter.reduce((sum, i) => sum + i.totalCapacity, 0);
  const k_inv = inverterCapacity > 0 ? pvCapacity / inverterCapacity : 0;  // DC/AC比
  
  let f_inv = 0.5;
  if (k_inv >= 1.0 && k_inv <= 1.1) {
    f_inv = 1.0;
  } else if (k_inv >= 0.8 && k_inv < 1.0) {
    f_inv = Math.max(0, 1 - Math.abs(k_inv - 1.05) / 0.25);
  } else if (k_inv > 1.1 && k_inv <= 1.2) {
    f_inv = Math.max(0, 1 - Math.abs(k_inv - 1.05) / 0.25);
  } else {
    f_inv = 0.5;
  }
  const S_inv = Math.min(7, 7 * Math.max(0, Math.min(1, f_inv)));
  
  // 公式4.11-4.12: PCS匹配评分 (7分)
  // k_PCS = P_PCS / P_storage,max
  const batteryCapacity = config.battery.reduce((sum, b) => sum + b.totalCapacity, 0); // kWh
  const pcsCapacity = config.pcs.reduce((sum, p) => sum + p.totalCapacity, 0); // kW
  const P_storage_max = batteryCapacity / 2; // 假设2小时放电，kW
  const k_PCS = P_storage_max > 0 ? pcsCapacity / P_storage_max : 1;
  
  let f_PCS = 0.5;
  if (k_PCS >= 1.0 && k_PCS <= 1.2) {
    f_PCS = 1.0;
  } else if (k_PCS >= 0.8 && k_PCS < 1.0) {
    f_PCS = Math.max(0, 1 - Math.abs(k_PCS - 1.1) / 0.3);
  } else if (k_PCS > 1.2 && k_PCS <= 1.5) {
    f_PCS = Math.max(0, 1 - Math.abs(k_PCS - 1.1) / 0.3);
  } else {
    f_PCS = 0.5;
  }
  const S_PCS = Math.min(7, 7 * Math.max(0, Math.min(1, f_PCS)));
  
  // 公式4.13-4.14: 储能配置评分 (6分)
  // R_ess = E_ess / E_daily
  const R_ess = dailyLoad > 0 ? (batteryCapacity / 1000) / dailyLoad : 0; // MWh/MWh
  
  let f_ess = 0.5;
  if (R_ess >= 0.08 && R_ess <= 0.12) {
    f_ess = 1.0;
  } else if (R_ess >= 0.05 && R_ess < 0.08) {
    f_ess = Math.max(0, 1 - Math.abs(R_ess - 0.10) / 0.05);
  } else if (R_ess > 0.12 && R_ess <= 0.15) {
    f_ess = Math.max(0, 1 - Math.abs(R_ess - 0.10) / 0.05);
  } else {
    f_ess = 0.5;
  }
  const S_ess = Math.min(6, 6 * Math.max(0, Math.min(1, f_ess)));
  
  // 公式4.15: S_equipment = S_inv + S_PCS + S_ess (最高20分)
  const matchingScore = Math.min(20, Math.round(S_inv + S_PCS + S_ess));
  
  if (k_inv < 0.8 || k_inv > 1.2) {
    issues.push(`容配比${k_inv.toFixed(2)}不在最优范围[0.8-1.2]`);
  }
  
  if (config.biomass.primary.model && !config.biomass.secondary.model) {
    issues.push('生物质设备链路不完整');
  }
  
  // ============================================
  // 3. 稳定性评分 (20分) - 公式4.16-4.21
  // ============================================
  
  // 公式4.16-4.17: 备用容量评分 (8分)
  // R_cap = (P_installed - P_rated,max) / P_rated,max
  const P_installed = config.wind.reduce((sum, w) => sum + w.totalCapacity, 0) / 1000 +
                      config.solar.reduce((sum, s) => sum + s.totalCapacity, 0) / 1000; // MW
  const P_rated_max = simulation.totalLoad / 8760; // 平均负荷 MW
  const R_cap = P_rated_max > 0 ? (P_installed - P_rated_max) / P_rated_max : 0;
  
  let f_reserve = 0.5;
  if (R_cap >= 0.15 && R_cap <= 0.25) {
    f_reserve = 1.0;
  } else if (R_cap >= 0.10 && R_cap < 0.15) {
    f_reserve = Math.max(0, 1 - Math.abs(R_cap - 0.20) / 0.15);
  } else if (R_cap > 0.25 && R_cap <= 0.35) {
    f_reserve = Math.max(0, 1 - Math.abs(R_cap - 0.20) / 0.15);
  } else {
    f_reserve = 0.5;
  }
  const S_reserve = Math.min(8, 8 * Math.max(0, Math.min(1, f_reserve)));
  
  // 公式4.18-4.19: 储能调节评分 (7分)
  // η_esi = E_discharge,annual / (E_ess × 365)
  // 这里用实际放电量/储能容量来估算利用率
  const batteryMWh = batteryCapacity / 1000;
  const eta_esi = batteryMWh > 0 ? (simulation.totalGeneration - simulation.totalCurtailment) / (batteryMWh * 365) : 0;
  // 限制在合理范围内
  const eta_esi_clamped = Math.min(2, Math.max(0, eta_esi));
  
  let f_ESS = 0.5;
  if (eta_esi_clamped >= 0.6 && eta_esi_clamped <= 0.8) {
    f_ESS = 1.0;
  } else if (eta_esi_clamped >= 0.4 && eta_esi_clamped < 0.6) {
    f_ESS = Math.max(0, 1 - Math.abs(eta_esi_clamped - 0.7) / 0.3);
  } else if (eta_esi_clamped > 0.8 && eta_esi_clamped <= 0.9) {
    f_ESS = Math.max(0, 1 - Math.abs(eta_esi_clamped - 0.7) / 0.3);
  } else {
    f_ESS = 0.5;
  }
  const S_ESS = Math.min(7, 7 * Math.max(0, Math.min(1, f_ESS)));
  
  // 公式4.20: 能源差异性评分 (5分)
  // S_coverage = 5 × (1 - σ_energy / σ_max)
  const k_values = [energyRatio.wind, energyRatio.solar, energyRatio.bio];
  const k_avg = k_values.reduce((a, b) => a + b, 0) / 3;
  const sigma_energy = Math.sqrt(k_values.reduce((sum, k) => sum + Math.pow(k - k_avg, 2), 0) / 3);
  const sigma_max = 0.3;
  const S_coverage = Math.min(5, 5 * Math.max(0, 1 - sigma_energy / sigma_max));
  
  // 公式4.21: S_stability = S_reserve + S_ESS + S_coverage (最高20分)
  const stabilityScore = Math.min(20, Math.round(S_reserve + S_ESS + S_coverage));
  
  if (simulation.curtailmentRate > 15) {
    issues.push(`弃电率${simulation.curtailmentRate.toFixed(1)}%偏高`);
  }
  
  // ============================================
  // 4. 经济性评分 (30分) - 基于成本比较
  // ============================================
  let economicsScore = 0;
  const totalCost = calculateTotalCost(config);
  const costRatio = optimalCost > 0 ? totalCost / optimalCost : 1;
  
  if (costRatio <= 1.05) economicsScore = 30;
  else if (costRatio <= 1.10) economicsScore = 28;
  else if (costRatio <= 1.15) economicsScore = 26;
  else if (costRatio <= 1.20) economicsScore = 24;
  else if (costRatio <= 1.25) economicsScore = 22;
  else if (costRatio <= 1.30) economicsScore = 20;
  else if (costRatio <= 1.40) economicsScore = 15;
  else if (costRatio <= 1.50) economicsScore = 10;
  else economicsScore = 5;
  
  economicsScore = Math.min(30, economicsScore);
  
  if (costRatio > 1.1) {
    issues.push(`投资成本高于最优解${((costRatio - 1) * 100).toFixed(1)}%`);
  }
  
  // 5. 小组加分 (暂时设为0，最高10分)
  const groupBonus = 0;
  
  // 公式4.22: S_total = S_condition + S_equipment + S_economy + S_stability (最高100分)
  const total = Math.min(100, reliabilityScore + matchingScore + economicsScore + stabilityScore + groupBonus);
  
  return {
    total,
    reliability: reliabilityScore,
    matching: matchingScore,
    economics: economicsScore,
    stability: stabilityScore,
    groupBonus,
    issues
  };
}


// ============================================
// 优化求解主函数
// ============================================

export interface OptimizationProgress {
  current: number;
  total: number;
  phase: string;
  bestCost: number;
  bestReliability?: number;
  feasibleCount: number;
  currentSolutions?: Solution[];
}

export type ProgressCallback = (progress: OptimizationProgress) => void;

interface PrecomputedSolution {
  dailyLoad: number;
  peakLoad: number;
  biomassOutput: number;
  recommendedRoute: BiomassRoute;
  optimalConfig: {
    wind: { model: string; count: number; totalMW: number };
    solar: { model: string; count: number; totalMW: number };
    biomass: {
      route: BiomassRoute;
      primary: { model: string; count: number };
      secondary: { model: string; count: number };
    };
    battery: { model: string; count: number; totalMWh: number };
    inverter: { model: string; count: number };
  };
  totalCost: number;
  reliability: number;
  curtailmentRate: number;
}

export function getPrecomputedSolution(regionType: CityType): PrecomputedSolution | null {
  const solutions = optimalSolutionsData.solutionsByType as Record<string, PrecomputedSolution>;
  return solutions[regionType] || null;
}

export function getOptimalCostForRegion(region: City): number {
  const precomputed = getPrecomputedSolution(region.type);
  return precomputed?.totalCost || 10000;
}

export function buildSolutionFromPrecomputed(region: City): Solution | null {
  const precomputed = getPrecomputedSolution(region.type);
  if (!precomputed) return null;
  
  const pc = precomputed.optimalConfig;
  
  const solarConfig = selectSolarPanels(pc.solar.totalMW);
  const solarPanelParams = getSolarPanelParams(solarConfig);
  const batteryConfig = selectBatteries(pc.battery.totalMWh);
  
  const config: EquipmentConfig = {
    wind: selectWindTurbines(pc.wind.totalMW),
    solar: solarConfig,
    biomass: selectBiomassEquipment(
      pc.biomass.route === '直燃' ? 3 : pc.biomass.route === '气化' ? 2 : 2,
      pc.biomass.route
    ),
    battery: batteryConfig,
    inverter: selectInverters(pc.solar.totalMW, region.type, solarPanelParams || undefined),
    pcs: selectPCS(pc.battery.totalMWh, 2)
  };
  
  const simulation = simulate8760Hours(config, region);
  const score = calculateScore(config, simulation, precomputed.totalCost);
  
  return {
    id: `precomputed-${region.id}-${region.type}`,
    regionId: region.id,
    regionName: region.name,
    regionType: region.type,
    config,
    totalCost: calculateTotalCost(config),
    simulation,
    score,
    timestamp: Date.now()
  };
}

export interface CancelSignal {
  cancelled: boolean;
}

/**
 * 寻找最优解
 */
export async function findOptimalSolutions(
  region: City,
  onProgress?: ProgressCallback,
  cancelSignal?: CancelSignal
): Promise<Solution[]> {
  const solutions: Solution[] = [];
  const params = getRegionParams(region);

  if (!params) {
    console.error('未找到区域参数:', region.type);
    return solutions;
  }

  const dailyLoad = params.dailyLoad;
  const peakLoad = params.peakLoad;
  const annualLoad = dailyLoad * 365;
  const avgWindSpeed = params.avgWindSpeed;

  const biomassRoutes = recommendBiomassRoutes(region);

  const availableTurbines = WIND_TURBINES.filter(t => t.cutInSpeed < avgWindSpeed);
  if (availableTurbines.length === 0) {
    availableTurbines.push(WIND_TURBINES[0]);
  }

  const turbineScores = availableTurbines
    .map(t => {
      let score = 0;
      const cutInMargin = avgWindSpeed - t.cutInSpeed;
      score += cutInMargin >= 2 ? 30 : cutInMargin >= 1 ? 20 : 10;
      const optimalRatedSpeed = avgWindSpeed * 1.5;
      const ratedSpeedDiff = Math.abs(t.ratedSpeed - optimalRatedSpeed);
      score += ratedSpeedDiff <= 2 ? 40 : ratedSpeedDiff <= 4 ? 25 : 10;
      score += t.pricePerKW <= 0.35 ? 30 : t.pricePerKW <= 0.45 ? 20 : 10;
      return { turbine: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const panelScores = SOLAR_PANELS.map(p => {
    let score = 0;
    score += p.efficiency >= 22 ? 40 : p.efficiency >= 21 ? 30 : 20;
    score += p.pricePerWatt <= 1.6 ? 30 : p.pricePerWatt <= 2.0 ? 20 : 10;
    return { panel: p, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const batteryScores = BATTERIES.map(b => {
    let score = 0;
    score += b.cycleLife >= 6000 ? 40 : b.cycleLife >= 4000 ? 30 : 20;
    score += b.pricePerKWh <= 1.0 ? 30 : b.pricePerKWh <= 1.3 ? 20 : 10;
    return { battery: b, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const maxBiomassPower = calculateMaxBiomassPower(region, biomassRoutes[0].route);
  const biomassCoverage = maxBiomassPower / peakLoad;
  const windSolarMultiplier = biomassCoverage < 0.3 ? 1.5 : biomassCoverage < 0.5 ? 1.2 : 1.0;
  
  const totalAdvantage = params.windHours / 2000 + params.solarHours / 1200;
  const baseWindRatio = (params.windHours / 2000 / totalAdvantage) * windSolarMultiplier;
  const baseSolarRatio = (params.solarHours / 1200 / totalAdvantage) * windSolarMultiplier;
  
  const ratioConfigs: Array<{windRatio: number; solarRatio: number; batteryHours: number; name: string}> = [];
  
  const maxRatio = dailyLoad > 1000 ? 2.0 : dailyLoad > 500 ? 1.5 : 1.2;
  
  const windRatios = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4,
    baseWindRatio * 0.5, baseWindRatio * 0.8, baseWindRatio * 1.0, baseWindRatio * 1.5, baseWindRatio * 2.0
  ].map(r => Math.min(Math.max(r, 0.1), maxRatio));
  
  const solarRatios = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6,
    baseSolarRatio * 0.5, baseSolarRatio * 0.8, baseSolarRatio * 1.0, baseSolarRatio * 1.5, baseSolarRatio * 2.0
  ].map(r => Math.min(Math.max(r, 0.2), maxRatio));
  
  const loadFactor = dailyLoad / 500;
  const storageMultiplier = biomassCoverage < 0.2 ? 1.5 : biomassCoverage < 0.4 ? 1.2 : 1.0;
  const baseBatteryHours = Math.max(2, Math.min(16, 4 * loadFactor * storageMultiplier));
  
  const batteryHoursOptions = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0, 24.0,
    baseBatteryHours * 0.5, baseBatteryHours * 0.75, baseBatteryHours * 1.0, baseBatteryHours * 1.5, baseBatteryHours * 2.0, baseBatteryHours * 3.0
  ].map(h => Math.max(0.5, Math.min(24, h)));
  
  const uniqueWindRatios = [...new Set(windRatios.map(r => Math.round(r * 100) / 100))];
  const uniqueSolarRatios = [...new Set(solarRatios.map(r => Math.round(r * 100) / 100))];
  const uniqueBatteryHours = [...new Set(batteryHoursOptions.map(h => Math.round(h * 10) / 10))];
  
  for (const windRatio of uniqueWindRatios) {
    for (const solarRatio of uniqueSolarRatios) {
      for (const batteryHours of uniqueBatteryHours) {
        ratioConfigs.push({
          windRatio, solarRatio, batteryHours,
          name: `风${(windRatio*100).toFixed(0)}%光${(solarRatio*100).toFixed(0)}%储${batteryHours.toFixed(1)}h`
        });
      }
    }
  }

  const totalCombinations = biomassRoutes.slice(0, 2).length * turbineScores.length * panelScores.length * batteryScores.length * ratioConfigs.length;

  let current = 0;
  let bestCost = Infinity;
  let bestReliability = 0;

  if (onProgress) {
    onProgress({ current: 0, total: totalCombinations, phase: '开始遍历方案...', bestCost: 0, bestReliability: 0, feasibleCount: 0 });
  }

  for (const routeRec of biomassRoutes.slice(0, 2)) {
    if (cancelSignal?.cancelled) break;
    
    const selectedRoute = routeRec.route;
    const routeMaxBiomassPower = calculateMaxBiomassPower(region, selectedRoute);

    for (const { turbine } of turbineScores) {
      if (cancelSignal?.cancelled) break;

      for (const { panel } of panelScores) {
        if (cancelSignal?.cancelled) break;

        for (const { battery } of batteryScores) {
          if (cancelSignal?.cancelled) break;

          for (const ratio of ratioConfigs) {
            if (cancelSignal?.cancelled) break;
            current++;

            const windMW = (annualLoad / params.windHours) * ratio.windRatio;
            const solarMW = (annualLoad / params.solarHours) * ratio.solarRatio;
            const batteryMWh = peakLoad * ratio.batteryHours;
            const biomassPowerMW = Math.min(routeMaxBiomassPower, peakLoad * 0.3);

            const windCount = Math.max(1, Math.ceil((windMW * 1000) / turbine.ratedPower));
            const solarCount = Math.max(1, Math.ceil((solarMW * 1000000) / panel.power));
            const batteryCount = Math.max(1, Math.ceil((batteryMWh * 1000) / battery.energyCapacity));

            const actualSolarMW = (solarCount * panel.power) / 1000000;

            const solarConfig: EquipmentSelection[] = [{
              model: panel.model, manufacturer: panel.manufacturer, count: solarCount,
              unitCapacity: panel.power / 1000, totalCapacity: (solarCount * panel.power) / 1000,
              unitPrice: panel.price / 10000, totalPrice: (solarCount * panel.price) / 10000
            }];
            const solarPanelParams = { Vmp: panel.Vmp, Voc: panel.Voc, Isc: panel.Isc };
            
            const config: EquipmentConfig = {
              wind: [{
                model: turbine.model, manufacturer: turbine.manufacturer, count: windCount,
                unitCapacity: turbine.ratedPower, totalCapacity: windCount * turbine.ratedPower,
                unitPrice: turbine.price, totalPrice: windCount * turbine.price
              }],
              solar: solarConfig,
              biomass: selectBiomassEquipment(biomassPowerMW, selectedRoute),
              battery: [{
                model: battery.model, manufacturer: battery.manufacturer, count: batteryCount,
                unitCapacity: battery.energyCapacity, totalCapacity: batteryCount * battery.energyCapacity,
                unitPrice: battery.price, totalPrice: batteryCount * battery.price
              }],
              inverter: selectInverters(actualSolarMW, region.type, solarPanelParams),
              pcs: selectPCS(batteryMWh, 2)
            };

            const simResult = simulateLightweight(config, region);
            const totalCost = calculateTotalCost(config);

            if (simResult.feasible) {
              if (simResult.reliability > bestReliability) {
                bestReliability = simResult.reliability;
                bestCost = totalCost;
              } else if (simResult.reliability === bestReliability && totalCost < bestCost) {
                bestCost = totalCost;
              }

              const tempSolution = {
                id: `opt-${region.id}-${current}`,
                regionId: region.id,
                regionName: region.name,
                regionType: region.type,
                config,
                totalCost,
                simResult,
                timestamp: Date.now()
              };

              if (solutions.length < 20) {
                solutions.push(tempSolution as any);
              } else {
                const worstIdx = solutions.reduce((worstIdx, s, idx, arr) => {
                  const worst = arr[worstIdx] as any;
                  const curr = s as any;
                  if (curr.simResult.reliability < worst.simResult.reliability) return idx;
                  else if (curr.simResult.reliability === worst.simResult.reliability) {
                    return curr.totalCost > worst.totalCost ? idx : worstIdx;
                  }
                  return worstIdx;
                }, 0);
                const worstSolution = solutions[worstIdx] as any;
                if (simResult.reliability > worstSolution.simResult.reliability ||
                    (simResult.reliability === worstSolution.simResult.reliability && totalCost < worstSolution.totalCost)) {
                  solutions[worstIdx] = tempSolution as any;
                }
              }
            }

            if (onProgress && current % 10 === 0) {
              onProgress({
                current, total: totalCombinations, phase: `${ratio.name} - ${turbine.model}`,
                bestCost, bestReliability, feasibleCount: solutions.length,
                currentSolutions: solutions.length > 0 ? [...solutions] : undefined
              });
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }
      }
    }
  }

  if (solutions.length > 0) {
    const minCost = Math.min(...solutions.map(s => s.totalCost));
    
    for (let i = 0; i < solutions.length; i++) {
      const s = solutions[i] as any;
      const fullSimulation = simulate8760Hours(s.config, region);
      s.simulation = fullSimulation;
      s.score = calculateScore(s.config, fullSimulation, minCost);
      delete s.simResult;
    }
    
    solutions.sort((a, b) => {
      if (b.simulation.reliability !== a.simulation.reliability) {
        return b.simulation.reliability - a.simulation.reliability;
      }
      return a.totalCost - b.totalCost;
    });
  }

  saveSolutions(region.id, solutions);

  if (onProgress) {
    onProgress({
      current: totalCombinations, total: totalCombinations, phase: '优化完成',
      bestCost, bestReliability, feasibleCount: solutions.length
    });
  }

  return solutions;
}


// ============================================
// 解决方案存储
// ============================================

const STORAGE_KEY = 'energy_system_solutions';

export interface StoredSolutions {
  version: string;
  lastUpdate: number;
  regions: Record<number, Solution[]>;
}

export function saveSolutions(regionId: number, solutions: Solution[]): void {
  try {
    const stored = loadAllSolutions();
    
    // 为了节省空间，只保存前20个方案，并且不保存完整的hourlyData
    const compactSolutions = solutions.slice(0, 20).map(s => ({
      ...s,
      simulation: {
        ...s.simulation,
        // 不保存完整的8760小时数据，只保存统计信息
        hourlyData: [] as HourlyData[]
      }
    }));
    
    stored.regions[regionId] = compactSolutions;
    stored.lastUpdate = Date.now();
    
    const jsonStr = JSON.stringify(stored);
    
    // 检查大小，如果超过4MB则清理旧数据
    if (jsonStr.length > 4 * 1024 * 1024) {
      console.warn('存储数据过大，清理旧数据...');
      // 只保留最近更新的10个区域
      const regionIds = Object.keys(stored.regions).map(Number);
      if (regionIds.length > 10) {
        const toRemove = regionIds.slice(0, regionIds.length - 10);
        toRemove.forEach(id => delete stored.regions[id]);
      }
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('保存解决方案失败:', e);
    // 如果是配额超出错误，尝试清理并重试
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage配额超出，清理数据...');
      try {
        // 清理所有旧数据
        localStorage.removeItem(STORAGE_KEY);
        // 只保存当前区域的数据
        const newStored = {
          version: '1.0',
          lastUpdate: Date.now(),
          regions: {
            [regionId]: solutions.slice(0, 10).map(s => ({
              ...s,
              simulation: { ...s.simulation, hourlyData: [] as HourlyData[] }
            }))
          }
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStored));
      } catch (e2) {
        console.error('清理后仍然无法保存:', e2);
      }
    }
  }
}

export function loadAllSolutions(): StoredSolutions {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('加载解决方案失败:', e);
  }
  return { version: '1.0', lastUpdate: 0, regions: {} };
}

export function loadRegionSolutions(regionId: number): Solution[] {
  const stored = loadAllSolutions();
  return stored.regions[regionId] || [];
}

export function clearAllSolutions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSolutionsToJSON(): string {
  const stored = loadAllSolutions();
  return JSON.stringify(stored, null, 2);
}

export function importSolutionsFromJSON(json: string): boolean {
  try {
    const data = JSON.parse(json) as StoredSolutions;
    if (data.version && data.regions) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    }
  } catch (e) {
    console.error('导入解决方案失败:', e);
  }
  return false;
}

// ============================================
// 学生方案评估
// ============================================

export interface StudentConfig {
  regionId: number;
  wind: { model: string; count: number }[];
  solar: { model: string; count: number }[];
  biomassRoute: BiomassRoute;
  biomassPrimary: { model: string; count: number };
  biomassSecondary: { model: string; count: number };
  battery: { model: string; count: number }[];
  inverter: { model: string; count: number }[];
  pcs?: { model: string; count: number }[];
}

export function convertStudentConfig(studentConfig: StudentConfig): EquipmentConfig {
  const wind: EquipmentSelection[] = studentConfig.wind.map(w => {
    const turbine = WIND_TURBINES.find(t => t.model === w.model);
    return {
      model: w.model, manufacturer: turbine?.manufacturer || '', count: w.count,
      unitCapacity: turbine?.ratedPower || 0, totalCapacity: (turbine?.ratedPower || 0) * w.count,
      unitPrice: turbine?.price || 0, totalPrice: (turbine?.price || 0) * w.count
    };
  });
  
  const solar: EquipmentSelection[] = studentConfig.solar.map(s => {
    const panel = SOLAR_PANELS.find(p => p.model === s.model);
    return {
      model: s.model, manufacturer: panel?.manufacturer || '', count: s.count,
      unitCapacity: (panel?.power || 0) / 1000, totalCapacity: ((panel?.power || 0) / 1000) * s.count,
      unitPrice: (panel?.price || 0) / 10000, totalPrice: ((panel?.price || 0) / 10000) * s.count
    };
  });
  
  let primaryEquip: EquipmentSelection = { model: '', manufacturer: '', count: 0, unitCapacity: 0, totalCapacity: 0, unitPrice: 0, totalPrice: 0 };
  let secondaryEquip: EquipmentSelection = { model: '', manufacturer: '', count: 0, unitCapacity: 0, totalCapacity: 0, unitPrice: 0, totalPrice: 0 };
  
  if (studentConfig.biomassRoute === '直燃') {
    const boiler = DIRECT_COMBUSTION_BOILERS.find(b => b.model === studentConfig.biomassPrimary.model);
    const turbine = STEAM_TURBINES.find(t => t.model === studentConfig.biomassSecondary.model);
    if (boiler) {
      primaryEquip = {
        model: boiler.model, manufacturer: boiler.manufacturer, count: studentConfig.biomassPrimary.count,
        unitCapacity: boiler.steamCapacity, totalCapacity: boiler.steamCapacity * studentConfig.biomassPrimary.count,
        unitPrice: boiler.price, totalPrice: boiler.price * studentConfig.biomassPrimary.count
      };
    }
    if (turbine) {
      secondaryEquip = {
        model: turbine.model, manufacturer: turbine.manufacturer, count: studentConfig.biomassSecondary.count,
        unitCapacity: turbine.ratedPower * 1000, totalCapacity: turbine.ratedPower * 1000 * studentConfig.biomassSecondary.count,
        unitPrice: turbine.price, totalPrice: turbine.price * studentConfig.biomassSecondary.count
      };
    }
  } else if (studentConfig.biomassRoute === '气化') {
    const gasifier = GASIFIERS.find(g => g.model === studentConfig.biomassPrimary.model);
    const engine = GAS_ENGINES.find(e => e.model === studentConfig.biomassSecondary.model);
    if (gasifier) {
      primaryEquip = {
        model: gasifier.model, manufacturer: gasifier.manufacturer, count: studentConfig.biomassPrimary.count,
        unitCapacity: gasifier.gasOutput, totalCapacity: gasifier.gasOutput * studentConfig.biomassPrimary.count,
        unitPrice: gasifier.price, totalPrice: gasifier.price * studentConfig.biomassPrimary.count
      };
    }
    if (engine) {
      secondaryEquip = {
        model: engine.model, manufacturer: engine.manufacturer, count: studentConfig.biomassSecondary.count,
        unitCapacity: engine.ratedPower, totalCapacity: engine.ratedPower * studentConfig.biomassSecondary.count,
        unitPrice: engine.price, totalPrice: engine.price * studentConfig.biomassSecondary.count
      };
    }
  } else {
    const digester = ANAEROBIC_DIGESTERS.find(d => d.model === studentConfig.biomassPrimary.model);
    const engine = GAS_ENGINES.find(e => e.model === studentConfig.biomassSecondary.model);
    if (digester) {
      primaryEquip = {
        model: digester.model, manufacturer: digester.manufacturer, count: studentConfig.biomassPrimary.count,
        unitCapacity: digester.dailyGasOutput, totalCapacity: digester.dailyGasOutput * studentConfig.biomassPrimary.count,
        unitPrice: digester.price, totalPrice: digester.price * studentConfig.biomassPrimary.count
      };
    }
    if (engine) {
      secondaryEquip = {
        model: engine.model, manufacturer: engine.manufacturer, count: studentConfig.biomassSecondary.count,
        unitCapacity: engine.ratedPower, totalCapacity: engine.ratedPower * studentConfig.biomassSecondary.count,
        unitPrice: engine.price, totalPrice: engine.price * studentConfig.biomassSecondary.count
      };
    }
  }
  
  const battery: EquipmentSelection[] = studentConfig.battery.map(b => {
    const bat = BATTERIES.find(bt => bt.model === b.model);
    return {
      model: b.model, manufacturer: bat?.manufacturer || '', count: b.count,
      unitCapacity: bat?.energyCapacity || 0, totalCapacity: (bat?.energyCapacity || 0) * b.count,
      unitPrice: bat?.price || 0, totalPrice: (bat?.price || 0) * b.count
    };
  });
  
  const inverter: EquipmentSelection[] = studentConfig.inverter.map(i => {
    const inv = INVERTERS.find(iv => iv.model === i.model);
    return {
      model: i.model, manufacturer: inv?.manufacturer || '', count: i.count,
      unitCapacity: inv?.ratedPower || 0, totalCapacity: (inv?.ratedPower || 0) * i.count,
      unitPrice: inv?.price || 0, totalPrice: (inv?.price || 0) * i.count
    };
  });
  
  const pcs: EquipmentSelection[] = (studentConfig.pcs || []).map(p => {
    const pcsUnit = PCS_UNITS.find(pu => pu.model === p.model);
    return {
      model: p.model, manufacturer: pcsUnit?.manufacturer || '', count: p.count,
      unitCapacity: pcsUnit?.ratedPower || 0, totalCapacity: (pcsUnit?.ratedPower || 0) * p.count,
      unitPrice: pcsUnit?.price || 0, totalPrice: (pcsUnit?.price || 0) * p.count
    };
  });
  
  return {
    wind, solar,
    biomass: { route: studentConfig.biomassRoute, primary: primaryEquip, secondary: secondaryEquip },
    battery, inverter, pcs
  };
}

export function evaluateStudentSolution(studentConfig: StudentConfig, region: City): Solution {
  const config = convertStudentConfig(studentConfig);
  const simulation = simulate8760Hours(config, region);
  
  let optimalCost = getOptimalCostForRegion(region);
  const storedSolutions = loadRegionSolutions(region.id);
  if (storedSolutions.length > 0 && storedSolutions[0].totalCost < optimalCost) {
    optimalCost = storedSolutions[0].totalCost;
  }
  
  const score = calculateScore(config, simulation, optimalCost);
  const totalCost = calculateTotalCost(config);
  
  return {
    id: `student-${region.id}-${Date.now()}`,
    regionId: region.id,
    regionName: region.name,
    regionType: region.type,
    config, totalCost, simulation, score,
    timestamp: Date.now()
  };
}


// ============================================
// 小组联合求解模块
// ============================================

export type GroupType = '区域-10小组' | '区域-12小组' | '区域-14小组' | '区域-23小组' | '区域-26小组' | '区域-28小组' | '区域-37小组' | '区域-39小组' | '区域-42小组' | '区域-44小组';

export interface GroupDefinition {
  name: GroupType;
  regionIds: number[];
  centerRegionId: number;
  centerType: CityType;
}

export const GROUP_DEFINITIONS: GroupDefinition[] = [
  { name: '区域-10小组', regionIds: [10, 1, 2, 3, 9], centerRegionId: 10, centerType: '工业区' },
  { name: '区域-12小组', regionIds: [12, 4, 5, 11, 20], centerRegionId: 12, centerType: '居民区' },
  { name: '区域-14小组', regionIds: [14, 6, 7, 13, 15, 22], centerRegionId: 14, centerType: '居民区' },
  { name: '区域-23小组', regionIds: [23, 16, 24, 31, 32], centerRegionId: 23, centerType: '工业区' },
  { name: '区域-26小组', regionIds: [26, 17, 18, 19, 25], centerRegionId: 26, centerType: '工业区' },
  { name: '区域-28小组', regionIds: [28, 21, 27, 35, 36], centerRegionId: 28, centerType: '工业区' },
  { name: '区域-37小组', regionIds: [37, 29, 30, 38, 46], centerRegionId: 37, centerType: '工业区' },
  { name: '区域-39小组', regionIds: [39, 40, 47, 48], centerRegionId: 39, centerType: '居民区' },
  { name: '区域-42小组', regionIds: [42, 33, 34, 41, 49, 50], centerRegionId: 42, centerType: '居民区' },
  { name: '区域-44小组', regionIds: [44, 8, 43, 45, 51, 52], centerRegionId: 44, centerType: '居民区' },
];

export interface TransferConfig {
  fromRegionId: number;
  toRegionId: number;
  biomassTransfer: number;
  powerTransfer: number;
}

export interface HourlyTransfer {
  hour: number;
  fromRegionId: number;
  toRegionId: number;
  biomassTransfer: number;
  powerTransfer: number;
  powerLoss: number;
}

export interface RegionDetailedSolution {
  regionId: number;
  regionName: string;
  regionType: CityType;
  isCenter: boolean;
  equipment: {
    wind: { models: Array<{ model: string; manufacturer: string; count: number; unitPower: number }>; totalCapacity: number; totalCost: number };
    solar: { models: Array<{ model: string; manufacturer: string; count: number; unitPower: number }>; totalCapacity: number; totalCost: number };
    biomass: { route: BiomassRoute; primary: { model: string; manufacturer: string; count: number; capacity: number }; secondary: { model: string; manufacturer: string; count: number; capacity: number }; totalCapacity: number; totalCost: number };
    battery: { models: Array<{ model: string; manufacturer: string; count: number; unitCapacity: number }>; totalCapacity: number; totalCost: number };
    inverter: { models: Array<{ model: string; manufacturer: string; count: number; unitCapacity: number }>; totalCapacity: number; totalCost: number };
  };
  resources: { dailyLoad: number; peakLoad: number; dailyBiomass: number; receivedBiomass: number; sentBiomass: number; netBiomass: number };
  simulation: SimulationResult;
  costs: { windCost: number; solarCost: number; biomassCost: number; batteryCost: number; inverterCost: number; totalCost: number };
  score: SolutionScore;
}

export interface GroupSolution {
  groupName: GroupType;
  centerRegionId: number;
  regionSolutions: Solution[];
  regionDetails: RegionDetailedSolution[];
  transfers: TransferConfig[];
  hourlyTransfers: HourlyTransfer[];
  totalGroupCost: number;
  totalGroupGeneration: number;
  totalGroupLoad: number;
  groupReliability: number;
  groupCurtailmentRate: number;
  costComparison: {
    independentTotalCost: number;
    jointTotalCost: number;
    savingsAmount: number;
    savingsRate: number;
    regionIndependentCosts: { regionId: number; regionName: string; independentCost: number; jointCost: number }[];
  };
  groupEquipmentSummary: { totalWindCapacity: number; totalSolarCapacity: number; totalBiomassCapacity: number; totalBatteryCapacity: number; totalInverterCapacity: number };
  biomassFlowSummary: { totalProduction: number; totalTransferred: number; centerReceived: number; utilizationRate: number };
  groupScore: GroupScore;
  timestamp: number;
}

export interface GroupScore {
  total: number;
  avgRegionScore: number;
  resourceSharing: number;
  loadBalancing: number;
  economicOptimization: number;
  issues: string[];
}

export function getRegionGroup(regionId: number): GroupDefinition | null {
  return GROUP_DEFINITIONS.find(g => g.regionIds.includes(regionId)) || null;
}

export function getGroupRegions(groupName: GroupType, cities: City[]): City[] {
  const group = GROUP_DEFINITIONS.find(g => g.name === groupName);
  if (!group) return [];
  return cities.filter(c => group.regionIds.includes(c.id));
}

export function calculateDistance(city1: City, city2: City): number {
  return Math.hypot(city1.x - city2.x, city1.y - city2.y);
}

export function calculateTransferCost(distance: number, biomassAmount: number, powerAmount: number): number {
  const biomassCost = biomassAmount * distance * 0.5 * 365 / 10000;
  const powerCost = powerAmount * 1000 * 8000 * distance * 0.02 / 10000 / 10000;
  return biomassCost + powerCost;
}

export function calculateTransferLoss(distance: number, biomassAmount: number, powerAmount: number): { biomassLoss: number; powerLoss: number } {
  const biomassLoss = biomassAmount * (distance * 0.001);
  const powerLoss = powerAmount * (distance * 0.00005);
  return { biomassLoss, powerLoss };
}

export function evaluateGroupSolution(regionSolutions: Solution[], transfers: TransferConfig[], _cities: City[]): GroupScore {
  const issues: string[] = [];
  
  const avgRegionScore = regionSolutions.length > 0
    ? regionSolutions.reduce((sum, s) => sum + s.score.total, 0) / regionSolutions.length : 0;
  
  let resourceSharing = 0;
  const totalBiomassTransfer = transfers.reduce((sum, t) => sum + t.biomassTransfer, 0);
  const totalPowerTransfer = transfers.reduce((sum, t) => sum + t.powerTransfer, 0);
  
  if (totalBiomassTransfer > 0 || totalPowerTransfer > 0) {
    resourceSharing = Math.min(5, (totalBiomassTransfer / 50 + totalPowerTransfer / 10));
  }
  
  let loadBalancing = 0;
  const reliabilities = regionSolutions.map(s => s.simulation.reliability);
  if (reliabilities.length > 0) {
    const minReliability = Math.min(...reliabilities);
    const maxReliability = Math.max(...reliabilities);
    const reliabilitySpread = maxReliability - minReliability;
    
    if (reliabilitySpread < 1) loadBalancing = 5;
    else if (reliabilitySpread < 3) loadBalancing = 4;
    else if (reliabilitySpread < 5) loadBalancing = 3;
    else if (reliabilitySpread < 10) loadBalancing = 2;
    else loadBalancing = 1;
    
    if (minReliability < 95) {
      issues.push(`部分区域可靠率低于95%`);
      loadBalancing = Math.max(0, loadBalancing - 2);
    }
  }
  
  let economicOptimization = 0;
  const totalCost = regionSolutions.reduce((sum, s) => sum + s.totalCost, 0);
  const avgCostPerRegion = totalCost / Math.max(regionSolutions.length, 1);
  
  const expectedCosts: Record<CityType, number> = {
    '工业区': 35000, '居民区': 22000, '山地区': 18000,
    '农业区': 15000, '林业区': 12000, '测试区': 15000
  };
  
  if (regionSolutions.length > 0) {
    let totalExpectedCost = 0;
    regionSolutions.forEach(sol => { totalExpectedCost += expectedCosts[sol.regionType] || 10000; });
    const avgExpectedCost = totalExpectedCost / regionSolutions.length;
    const costRatio = avgCostPerRegion / avgExpectedCost;
    
    if (costRatio <= 1.0) economicOptimization = 5;
    else if (costRatio <= 1.1) economicOptimization = 4;
    else if (costRatio <= 1.2) economicOptimization = 3;
    else if (costRatio <= 1.3) economicOptimization = 2;
    else economicOptimization = 1;
    
    if (costRatio > 1.3) issues.push(`平均成本高于预期${((costRatio - 1) * 100).toFixed(0)}%`);
  }
  
  const total = Math.round(avgRegionScore + resourceSharing + loadBalancing + economicOptimization);
  
  return { total: Math.min(100, total), avgRegionScore, resourceSharing, loadBalancing, economicOptimization, issues };
}

function calculateGroupBiomassTransfers(groupRegions: City[], centerRegionId: number): TransferConfig[] {
  const transfers: TransferConfig[] = [];
  for (const region of groupRegions) {
    if (region.id !== centerRegionId) {
      const dailyBiomass = calculateDailyBiomass(region);
      if (dailyBiomass > 0) {
        transfers.push({ fromRegionId: region.id, toRegionId: centerRegionId, biomassTransfer: dailyBiomass * 0.5, powerTransfer: 0 });
      }
    }
  }
  return transfers;
}

function calculateGroupPowerTransfers(groupRegions: City[], solutions: Solution[], transfers: TransferConfig[]): void {
  for (const solution of solutions) {
    const region = groupRegions.find(r => r.id === solution.regionId);
    if (!region) continue;
    
    const surplus = solution.simulation.totalGeneration - solution.simulation.totalLoad;
    if (surplus > 0) {
      const deficitRegions = solutions.filter(s => s.simulation.totalGeneration < s.simulation.totalLoad);
      for (const deficitSol of deficitRegions) {
        const existingTransfer = transfers.find(t => t.fromRegionId === solution.regionId && t.toRegionId === deficitSol.regionId);
        if (existingTransfer) {
          existingTransfer.powerTransfer = Math.min(surplus / deficitRegions.length, 10);
        } else {
          transfers.push({ fromRegionId: solution.regionId, toRegionId: deficitSol.regionId, biomassTransfer: 0, powerTransfer: Math.min(surplus / deficitRegions.length, 10) });
        }
      }
    }
  }
}

function buildGroupRegionDetails(solutions: Solution[], groupRegions: City[], centerRegionId: number, transfers: TransferConfig[]): RegionDetailedSolution[] {
  return solutions.map(sol => {
    const region = groupRegions.find(r => r.id === sol.regionId);
    const isCenter = sol.regionId === centerRegionId;
    
    const receivedBiomass = transfers.filter(t => t.toRegionId === sol.regionId).reduce((sum, t) => sum + t.biomassTransfer, 0);
    const sentBiomass = transfers.filter(t => t.fromRegionId === sol.regionId).reduce((sum, t) => sum + t.biomassTransfer, 0);
    const dailyBiomass = region ? calculateDailyBiomass(region) : 0;
    
    return {
      regionId: sol.regionId,
      regionName: sol.regionName,
      regionType: sol.regionType,
      isCenter,
      equipment: {
        wind: {
          models: sol.config.wind.map(w => ({ model: w.model, manufacturer: w.manufacturer, count: w.count, unitPower: w.unitCapacity })),
          totalCapacity: sol.config.wind.reduce((sum, w) => sum + w.totalCapacity, 0) / 1000,
          totalCost: sol.config.wind.reduce((sum, w) => sum + w.totalPrice, 0)
        },
        solar: {
          models: sol.config.solar.map(s => ({ model: s.model, manufacturer: s.manufacturer, count: s.count, unitPower: s.unitCapacity })),
          totalCapacity: sol.config.solar.reduce((sum, s) => sum + s.totalCapacity, 0) / 1000,
          totalCost: sol.config.solar.reduce((sum, s) => sum + s.totalPrice, 0)
        },
        biomass: {
          route: sol.config.biomass.route,
          primary: { model: sol.config.biomass.primary.model, manufacturer: sol.config.biomass.primary.manufacturer, count: sol.config.biomass.primary.count, capacity: sol.config.biomass.primary.unitCapacity },
          secondary: { model: sol.config.biomass.secondary.model, manufacturer: sol.config.biomass.secondary.manufacturer, count: sol.config.biomass.secondary.count, capacity: sol.config.biomass.secondary.unitCapacity },
          totalCapacity: sol.config.biomass.secondary.totalCapacity / 1000,
          totalCost: sol.config.biomass.primary.totalPrice + sol.config.biomass.secondary.totalPrice
        },
        battery: {
          models: sol.config.battery.map(b => ({ model: b.model, manufacturer: b.manufacturer, count: b.count, unitCapacity: b.unitCapacity })),
          totalCapacity: sol.config.battery.reduce((sum, b) => sum + b.totalCapacity, 0) / 1000,
          totalCost: sol.config.battery.reduce((sum, b) => sum + b.totalPrice, 0)
        },
        inverter: {
          models: sol.config.inverter.map(i => ({ model: i.model, manufacturer: i.manufacturer, count: i.count, unitCapacity: i.unitCapacity })),
          totalCapacity: sol.config.inverter.reduce((sum, i) => sum + i.totalCapacity, 0),
          totalCost: sol.config.inverter.reduce((sum, i) => sum + i.totalPrice, 0)
        }
      },
      resources: {
        dailyLoad: sol.simulation.totalLoad / 365,
        peakLoad: region ? calculatePeakLoad(region) : 0,
        dailyBiomass,
        receivedBiomass,
        sentBiomass,
        netBiomass: dailyBiomass + receivedBiomass - sentBiomass
      },
      simulation: sol.simulation,
      costs: {
        windCost: sol.config.wind.reduce((sum, w) => sum + w.totalPrice, 0),
        solarCost: sol.config.solar.reduce((sum, s) => sum + s.totalPrice, 0),
        biomassCost: sol.config.biomass.primary.totalPrice + sol.config.biomass.secondary.totalPrice,
        batteryCost: sol.config.battery.reduce((sum, b) => sum + b.totalPrice, 0),
        inverterCost: sol.config.inverter.reduce((sum, i) => sum + i.totalPrice, 0),
        totalCost: sol.totalCost
      },
      score: sol.score
    };
  });
}

async function generateRegionCandidatesForGroup(region: City, _isCenter: boolean): Promise<Solution[]> {
  const solutions = await findOptimalSolutions(region, undefined, undefined);
  return solutions.slice(0, 5);
}

function incrementGroupIndices(indices: number[], counts: number[]): void {
  for (let i = indices.length - 1; i >= 0; i--) {
    indices[i]++;
    if (indices[i] < counts[i]) return;
    indices[i] = 0;
  }
}

export async function findGroupOptimalSolutions(
  groupName: GroupType,
  cities: City[],
  onProgress?: ProgressCallback
): Promise<GroupSolution | null> {
  const groupRegions = getGroupRegions(groupName, cities);
  if (groupRegions.length === 0) return null;
  
  const groupDef = GROUP_DEFINITIONS.find(g => g.name === groupName);
  if (!groupDef) return null;
  
  const centerRegionId = groupDef.centerRegionId;
  
  const regionCandidates: Map<number, Solution[]> = new Map();
  
  if (onProgress) {
    onProgress({ current: 0, total: groupRegions.length * 2, phase: '生成区域候选方案...', bestCost: 0, feasibleCount: 0 });
  }
  
  for (let i = 0; i < groupRegions.length; i++) {
    const region = groupRegions[i];
    if (onProgress) {
      onProgress({ current: i + 1, total: groupRegions.length * 2, phase: `生成 ${region.name} 候选方案...`, bestCost: 0, feasibleCount: 0 });
    }
    const candidates = await generateRegionCandidatesForGroup(region, region.id === centerRegionId);
    regionCandidates.set(region.id, candidates);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  let totalCombinations = 1;
  const candidateCounts: number[] = [];
  for (const region of groupRegions) {
    const count = regionCandidates.get(region.id)?.length || 1;
    candidateCounts.push(count);
    totalCombinations *= count;
  }
  
  const maxCombinations = 5000;
  const samplingRate = totalCombinations > maxCombinations ? maxCombinations / totalCombinations : 1;
  
  if (onProgress) {
    onProgress({ current: groupRegions.length, total: groupRegions.length + Math.min(totalCombinations, maxCombinations), phase: `遍历 ${Math.min(totalCombinations, maxCombinations)} 种组合...`, bestCost: 0, feasibleCount: 0 });
  }
  
  let bestSolution: GroupSolution | null = null;
  let bestScore = -Infinity;
  
  const indices = new Array(groupRegions.length).fill(0);
  let done = false;
  
  while (!done) {
    if (samplingRate < 1 && Math.random() > samplingRate) {
      incrementGroupIndices(indices, candidateCounts);
      if (indices.every((idx) => idx === 0)) done = true;
      continue;
    }
    
    const currentSolutions: Solution[] = [];
    for (let i = 0; i < groupRegions.length; i++) {
      const regionId = groupRegions[i].id;
      const candidates = regionCandidates.get(regionId) || [];
      if (candidates.length > 0) currentSolutions.push(candidates[indices[i]]);
    }
    
    const transfers = calculateGroupBiomassTransfers(groupRegions, centerRegionId);
    calculateGroupPowerTransfers(groupRegions, currentSolutions, transfers);
    
    const groupScore = evaluateGroupSolution(currentSolutions, transfers, cities);
    const totalCost = currentSolutions.reduce((sum, s) => sum + s.totalCost, 0);
    const totalGeneration = currentSolutions.reduce((sum, s) => sum + s.simulation.totalGeneration, 0);
    const totalLoad = currentSolutions.reduce((sum, s) => sum + s.simulation.totalLoad, 0);
    const totalShortageHours = currentSolutions.reduce((sum, s) => sum + s.simulation.shortageHours, 0);
    const totalCurtailment = currentSolutions.reduce((sum, s) => sum + s.simulation.totalCurtailment, 0);
    
    const combinedScore = groupScore.total - (totalCost / 10000) + (transfers.length > 0 ? 5 : 0);
    
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      const groupReliability = totalLoad > 0 ? ((totalLoad - totalShortageHours * (totalLoad / 8760 / groupRegions.length)) / totalLoad) * 100 : 0;
      const groupCurtailmentRate = totalGeneration > 0 ? (totalCurtailment / totalGeneration) * 100 : 0;
      const regionDetails = buildGroupRegionDetails(currentSolutions, groupRegions, centerRegionId, transfers);
      
      const groupEquipmentSummary = {
        totalWindCapacity: regionDetails.reduce((sum, r) => sum + r.equipment.wind.totalCapacity, 0),
        totalSolarCapacity: regionDetails.reduce((sum, r) => sum + r.equipment.solar.totalCapacity, 0),
        totalBiomassCapacity: regionDetails.reduce((sum, r) => sum + r.equipment.biomass.totalCapacity, 0),
        totalBatteryCapacity: regionDetails.reduce((sum, r) => sum + r.equipment.battery.totalCapacity, 0),
        totalInverterCapacity: regionDetails.reduce((sum, r) => sum + r.equipment.inverter.totalCapacity, 0)
      };
      
      const totalProduction = regionDetails.reduce((sum, r) => sum + r.resources.dailyBiomass, 0);
      const totalTransferred = transfers.reduce((sum, t) => sum + t.biomassTransfer, 0);
      const centerDetail = regionDetails.find(r => r.isCenter);
      const centerReceived = centerDetail?.resources.receivedBiomass || 0;
      
      bestSolution = {
        groupName,
        centerRegionId,
        regionSolutions: currentSolutions,
        regionDetails,
        transfers,
        hourlyTransfers: [],
        totalGroupCost: totalCost,
        totalGroupGeneration: totalGeneration,
        totalGroupLoad: totalLoad,
        groupReliability,
        groupCurtailmentRate,
        costComparison: {
          independentTotalCost: totalCost,
          jointTotalCost: totalCost,
          savingsAmount: 0,
          savingsRate: 0,
          regionIndependentCosts: currentSolutions.map(s => ({ regionId: s.regionId, regionName: s.regionName, independentCost: s.totalCost, jointCost: s.totalCost }))
        },
        groupEquipmentSummary,
        biomassFlowSummary: {
          totalProduction,
          totalTransferred,
          centerReceived,
          utilizationRate: totalProduction > 0 ? (totalTransferred / totalProduction) * 100 : 0
        },
        groupScore,
        timestamp: Date.now()
      };
    }
    
    incrementGroupIndices(indices, candidateCounts);
    if (indices.every((idx) => idx === 0)) done = true;
  }
  
  return bestSolution;
}


// ============================================
// 小组方案存储
// ============================================

const GROUP_STORAGE_KEY = 'energy_system_group_solutions';

export function saveGroupSolution(groupName: GroupType, solution: GroupSolution): void {
  try {
    const stored = loadAllGroupSolutions();
    stored[groupName] = solution;
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('保存小组方案失败:', e);
  }
}

export function loadGroupSolution(groupName: GroupType): GroupSolution | null {
  try {
    const stored = loadAllGroupSolutions();
    return stored[groupName] || null;
  } catch (e) {
    console.error('加载小组方案失败:', e);
    return null;
  }
}

function loadAllGroupSolutions(): Record<GroupType, GroupSolution> {
  try {
    const data = localStorage.getItem(GROUP_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('加载小组方案失败:', e);
  }
  return {} as Record<GroupType, GroupSolution>;
}

export function clearGroupSolutions(): void {
  localStorage.removeItem(GROUP_STORAGE_KEY);
}
