/**
 * 风机年发电量计算（8760小时仿真）
 * 基于Cp-λ曲线和实际风速数据计算
 */

import { getResourceData, REGION_CONFIGS, getDaysInMonth, City } from './DataSetting';
import { WIND_TURBINES, WindTurbineSpec } from './EquipmentData';

// ============================================
// Cp-λ 计算参数
// ============================================
const CP_PARAMS = {
  c1: 0.5176,
  c2: 116,
  c3: 0.4,
  c4: 5,
  c5: 21,
  c6: 0.0068
};

// 空气密度 kg/m³
const RHO = 1.225;

// 最佳叶尖速比
const LAMBDA_OPT = 8.10;

// 最大风能利用系数
const CP_MAX = 0.48;

// ============================================
// Cp 计算函数
// ============================================

/**
 * 计算风能利用系数 Cp
 * @param lambda 叶尖速比
 * @param beta 桨距角（度）
 */
function calculateCp(lambda: number, beta: number = 0): number {
  const { c1, c2, c3, c4, c5, c6 } = CP_PARAMS;
  
  // 计算 λi
  const lambdaI = 1 / (1 / (lambda + 0.08 * beta) - 0.035 / (Math.pow(beta, 3) + 1));
  
  // 计算 Cp
  const Cp = c1 * ((c2 / lambdaI) - c3 * beta - c4) * Math.exp(-c5 / lambdaI) + c6 * lambda;
  
  return Math.max(0, Cp); // Cp不能为负
}

/**
 * 根据风速计算实际叶尖速比
 * 变速风机会调整转速以保持最佳叶尖速比
 */
function calculateLambda(windSpeed: number, turbine: WindTurbineSpec): number {
  // 在切入风速到额定风速之间，变速风机保持最佳叶尖速比
  if (windSpeed >= turbine.cutInSpeed && windSpeed <= turbine.ratedSpeed) {
    return LAMBDA_OPT;
  }
  
  // 超过额定风速后，转速固定，叶尖速比随风速变化
  if (windSpeed > turbine.ratedSpeed && windSpeed <= turbine.cutOutSpeed) {
    // 额定转速时的叶尖速比
    const lambdaRated = LAMBDA_OPT;
    // 实际叶尖速比 = 额定叶尖速比 × (额定风速/实际风速)
    return lambdaRated * (turbine.ratedSpeed / windSpeed);
  }
  
  return 0;
}

/**
 * 计算风机在给定风速下的输出功率
 * @param windSpeed 风速 m/s
 * @param turbine 风机参数
 * @returns 输出功率 kW
 */
function calculateWindPower(windSpeed: number, turbine: WindTurbineSpec): number {
  // 风速低于切入风速或高于切出风速，输出为0
  if (windSpeed < turbine.cutInSpeed || windSpeed > turbine.cutOutSpeed) {
    return 0;
  }
  
  // 风速达到额定风速，输出额定功率
  if (windSpeed >= turbine.ratedSpeed) {
    return turbine.ratedPower;
  }
  
  // 切入风速到额定风速之间，按功率曲线计算
  const lambda = calculateLambda(windSpeed, turbine);
  const Cp = calculateCp(lambda, 0);
  
  // 扫风面积
  const A = Math.PI * Math.pow(turbine.rotorDiameter / 2, 2);
  
  // 理论功率 P = 0.5 * ρ * A * V³ * Cp
  const theoreticalPower = 0.5 * RHO * A * Math.pow(windSpeed, 3) * Cp / 1000; // W -> kW
  
  // 取理论功率和额定功率的较小值
  return Math.min(theoreticalPower, turbine.ratedPower);
}

// ============================================
// 8760小时数据生成
// ============================================

/**
 * 生成8760小时风速数据
 */
function generate8760WindData(regionId: number): number[] {
  const config = REGION_CONFIGS[regionId];
  if (!config) {
    console.error(`区域 ${regionId} 配置不存在`);
    return [];
  }
  
  const windData: number[] = [];
  
  // 构建City对象
  const city: City = {
    id: regionId,
    name: config.name,
    type: config.type,
    x: config.position.x,
    y: config.position.y,
    biomassComp: {} as any,
    baseCostMultiplier: config.costMultiplier,
    biomassConnections: [],
    powerConnections: []
  };
  
  // 遍历12个月，每月每天每小时
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = getDaysInMonth(month);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = getResourceData(city, '日', month, day);
      windData.push(...dayData.wind);
    }
  }
  
  return windData;
}

// ============================================
// 年发电量计算
// ============================================

export interface AnnualEnergyResult {
  turbine: {
    model: string;
    manufacturer: string;
    ratedPower: number;
    rotorDiameter: number;
    cutInSpeed: number;
    ratedSpeed: number;
    cutOutSpeed: number;
  };
  windStats: {
    avgSpeed: number;
    maxSpeed: number;
    minSpeed: number;
    distribution: Record<string, number>;
  };
  output: {
    annualEnergy_kWh: number;
    annualEnergy_MWh: number;
    equivalentHours: number;
    capacityFactor: number;
    effectiveHours: number;
  };
  hourlyPower: number[];
  cpStats: {
    avgCp: number;
    maxCp: number;
  };
}

/**
 * 计算单台风机的年发电量
 */
export function calculateAnnualEnergy(
  regionId: number,
  turbineId: string
): AnnualEnergyResult | null {
  // 获取风机参数
  const turbine = WIND_TURBINES.find(t => t.id === turbineId);
  if (!turbine) {
    console.error(`风机 ${turbineId} 不存在`);
    return null;
  }
  
  // 生成8760小时风速数据
  const windData = generate8760WindData(regionId);
  
  if (windData.length === 0) {
    console.error('风速数据生成失败');
    return null;
  }
  
  // 统计变量
  let totalSpeed = 0;
  let maxSpeed = 0;
  let minSpeed = Infinity;
  const speedDistribution: Record<string, number> = {};
  
  let totalEnergy = 0;
  let totalCp = 0;
  let cpCount = 0;
  let maxCp = 0;
  const hourlyPower: number[] = [];
  
  // 逐时计算
  for (let i = 0; i < windData.length; i++) {
    const windSpeed = windData[i];
    
    // 风速统计
    totalSpeed += windSpeed;
    maxSpeed = Math.max(maxSpeed, windSpeed);
    minSpeed = Math.min(minSpeed, windSpeed);
    
    // 风速分布（按1m/s区间）
    const speedBin = Math.floor(windSpeed).toString();
    speedDistribution[speedBin] = (speedDistribution[speedBin] || 0) + 1;
    
    // 计算该小时的发电功率
    const power = calculateWindPower(windSpeed, turbine);
    hourlyPower.push(power);
    
    // 累加发电量（1小时 = 1kWh/kW）
    totalEnergy += power;
    
    // Cp统计（仅在有效发电时）
    if (windSpeed >= turbine.cutInSpeed && windSpeed <= turbine.cutOutSpeed) {
      const lambda = calculateLambda(windSpeed, turbine);
      const cp = calculateCp(lambda, 0);
      totalCp += cp;
      cpCount++;
      maxCp = Math.max(maxCp, cp);
    }
  }
  
  // 计算统计指标
  const avgSpeed = totalSpeed / windData.length;
  const annualEnergy_MWh = totalEnergy / 1000;
  const equivalentHours = totalEnergy / turbine.ratedPower;
  const capacityFactor = (equivalentHours / 8760) * 100;
  const effectiveHours = hourlyPower.filter(p => p > 0).length;
  const avgCp = cpCount > 0 ? totalCp / cpCount : 0;
  
  return {
    turbine: {
      model: turbine.model,
      manufacturer: turbine.manufacturer,
      ratedPower: turbine.ratedPower,
      rotorDiameter: turbine.rotorDiameter,
      cutInSpeed: turbine.cutInSpeed,
      ratedSpeed: turbine.ratedSpeed,
      cutOutSpeed: turbine.cutOutSpeed
    },
    windStats: {
      avgSpeed: parseFloat(avgSpeed.toFixed(2)),
      maxSpeed: parseFloat(maxSpeed.toFixed(2)),
      minSpeed: parseFloat(minSpeed.toFixed(2)),
      distribution: speedDistribution
    },
    output: {
      annualEnergy_kWh: Math.round(totalEnergy),
      annualEnergy_MWh: parseFloat(annualEnergy_MWh.toFixed(2)),
      equivalentHours: Math.round(equivalentHours),
      capacityFactor: parseFloat(capacityFactor.toFixed(2)),
      effectiveHours
    },
    hourlyPower,
    cpStats: {
      avgCp: parseFloat(avgCp.toFixed(4)),
      maxCp: parseFloat(maxCp.toFixed(4))
    }
  };
}

/**
 * 计算所有风机在指定区域的年发电量
 */
export function calculateAllTurbinesAnnualEnergy(regionId: number): AnnualEnergyResult[] {
  const results: AnnualEnergyResult[] = [];
  
  for (const turbine of WIND_TURBINES) {
    const result = calculateAnnualEnergy(regionId, turbine.id);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

// ============================================
// 导出计算函数
// ============================================
export { calculateCp, calculateLambda, calculateWindPower, generate8760WindData };

// ============================================
// 测试运行
// ============================================
console.log('=== 测试区-1 (区域53) 风机年发电量计算 ===\n');
console.log('基于8760小时风速数据和Cp-λ曲线计算\n');
console.log(`最佳叶尖速比 λ_opt = ${LAMBDA_OPT}`);
console.log(`最大风能利用系数 Cp_max = ${CP_MAX}\n`);
console.log('-------------------------------------------\n');

const testTurbines = ['WT-3', 'WT-10', 'WT-50', 'WT-1500', 'WT-2500'];

testTurbines.forEach(turbineId => {
  const result = calculateAnnualEnergy(53, turbineId);
  if (result) {
    console.log(`【${result.turbine.model}】 ${result.turbine.manufacturer}`);
    console.log(`  额定功率: ${result.turbine.ratedPower} kW`);
    console.log(`  叶轮直径: ${result.turbine.rotorDiameter} m`);
    console.log(`  切入/额定/切出风速: ${result.turbine.cutInSpeed}/${result.turbine.ratedSpeed}/${result.turbine.cutOutSpeed} m/s`);
    console.log(`  风速统计: 平均${result.windStats.avgSpeed}m/s, 最大${result.windStats.maxSpeed}m/s, 最小${result.windStats.minSpeed}m/s`);
    console.log(`  年发电量: ${result.output.annualEnergy_MWh} MWh`);
    console.log(`  等效利用小时数: ${result.output.equivalentHours} h`);
    console.log(`  容量因子: ${result.output.capacityFactor}%`);
    console.log(`  有效发电小时数: ${result.output.effectiveHours} h`);
    console.log(`  平均Cp: ${result.cpStats.avgCp}, 最大Cp: ${result.cpStats.maxCp}`);
    console.log('');
  }
});
