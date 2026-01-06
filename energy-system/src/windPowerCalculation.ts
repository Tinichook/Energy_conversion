/**
 * 风机年发电量计算脚本
 * 基于8760小时风速数据和风机功率曲线计算年发电量和年利用小时数
 * 
 * 参考公式：
 * - 功能利用系数 Cp = λ/k (k=44)
 * - 叶尖速比 λ = ωR/V = 2πnR/V
 * - 功率曲线 P = (1/8) × Cp × η1 × η2 × η3 × ρ × π × D² × V³
 */

import { getResourceData, REGION_CONFIGS } from './DataSetting';
import { WIND_TURBINES } from './EquipmentData';

// ============================================
// 风能利用系数计算
// ============================================

/**
 * 风能利用系数查表数据（表2）
 * 以1m/s为步长的风能利用系数
 * 基于公式 Cp = λ/k (k=44) 和最佳叶尖速比计算
 */
const CP_TABLE: Record<number, number> = {
  3: 0.147,
  4: 0.202,
  5: 0.235,
  6: 0.257,
  7: 0.273,
  8: 0.285,
  9: 0.298,
  10: 0.301,
  11: 0.307,
  12: 0.312,
  13: 0.316,
  14: 0.320,
  15: 0.323,
  16: 0.326,
  17: 0.329,
};

/**
 * 根据风速获取风能利用系数 Cp
 * 使用查表法 + 线性插值
 * 
 * @param windSpeed 风速 (m/s)
 * @returns 风能利用系数 Cp
 */
function getCpByWindSpeed(windSpeed: number): number {
  // 风速小于3m/s，使用最小值
  if (windSpeed <= 3) {
    return CP_TABLE[3];
  }
  
  // 风速大于17m/s，使用最大值
  if (windSpeed >= 17) {
    return CP_TABLE[17];
  }
  
  // 线性插值
  const lowerSpeed = Math.floor(windSpeed);
  const upperSpeed = Math.ceil(windSpeed);
  
  if (lowerSpeed === upperSpeed) {
    return CP_TABLE[lowerSpeed] || 0.30;
  }
  
  const lowerCp = CP_TABLE[lowerSpeed] || 0.30;
  const upperCp = CP_TABLE[upperSpeed] || 0.30;
  const fraction = windSpeed - lowerSpeed;
  
  return lowerCp + (upperCp - lowerCp) * fraction;
}

/**
 * 根据叶尖速比计算风能利用系数
 * 公式：Cp = λ/k (k=44)
 * 
 * @param lambda 叶尖速比
 * @returns 风能利用系数 Cp
 */
function getCpByLambda(lambda: number): number {
  const k = 44; // 常数k
  const Cp = lambda / k;
  // Cp最大不超过贝茨极限 0.593，实际取0.48左右
  return Math.min(Cp, 0.48);
}

/**
 * 计算叶尖速比
 * 公式：λ = ωR/V = 2πnR/V
 * 
 * @param rotorDiameter 叶轮直径 (m)
 * @param windSpeed 风速 (m/s)
 * @param rpm 转速 (rpm)，如果不提供则使用最佳叶尖速比反推
 * @returns 叶尖速比 λ
 */
function calculateLambda(rotorDiameter: number, windSpeed: number, rpm?: number): number {
  const R = rotorDiameter / 2; // 叶轮半径
  
  if (rpm !== undefined) {
    // 根据转速计算叶尖速比
    const omega = (2 * Math.PI * rpm) / 60; // 角速度 rad/s
    return (omega * R) / windSpeed;
  }
  
  // 使用最佳叶尖速比（约8.1）
  return 8.1;
}

// ============================================
// 功率曲线计算
// ============================================

/**
 * 风机功率曲线计算
 * 
 * 公式(3.9)：
 * P_WTG,STP = {
 *   0                                    V ≤ V_in
 *   (1/8) × Cp × η1 × η2 × η3 × ρ × π × D² × V³   V_in < V ≤ V_r
 *   P_r                                  V_r < V ≤ V_out
 *   0                                    V > V_out
 * }
 * 
 * @param windSpeed 风速 (m/s)
 * @param turbine 风机参数
 * @returns 输出功率 (kW)
 */
function calculateWindPower(
  windSpeed: number,
  turbine: typeof WIND_TURBINES[0]
): number {
  const { cutInSpeed, ratedSpeed, cutOutSpeed, ratedPower, rotorDiameter } = turbine;
  
  // 区间1: V ≤ V_in，输出为0
  if (windSpeed <= cutInSpeed) {
    return 0;
  }
  
  // 区间4: V > V_out，输出为0
  if (windSpeed > cutOutSpeed) {
    return 0;
  }
  
  // 区间3: V_r < V ≤ V_out，输出额定功率
  if (windSpeed > ratedSpeed) {
    return ratedPower;
  }
  
  // 区间2: V_in < V ≤ V_r，按功率曲线计算
  // P = (1/8) × Cp × η1 × η2 × η3 × ρ × π × D² × V³
  
  const rho = 1.225;  // 空气密度 kg/m³
  const eta1 = 0.92;  // 传动效率
  const eta2 = 0.95;  // 发电机效率
  const eta3 = 0.95;  // 变流器效率
  const D = rotorDiameter; // 叶轮直径 m
  
  // 获取风能利用系数（使用查表法）
  const Cp = getCpByWindSpeed(windSpeed);
  
  // 计算功率 (kW)
  // P = (1/8) × Cp × η1 × η2 × η3 × ρ × π × D² × V³
  // 注意：结果单位为 W，需要除以1000转换为 kW
  const power = (1/8) * Cp * eta1 * eta2 * eta3 * rho * Math.PI * Math.pow(D, 2) * Math.pow(windSpeed, 3) / 1000;
  
  // 取计算功率和额定功率的较小值
  return Math.min(power, ratedPower);
}

/**
 * 生成功率曲线数据点
 * 用于绘制功率曲线图
 * 
 * @param turbine 风机参数
 * @param step 风速步长 (m/s)
 * @returns 功率曲线数据点数组
 */
function generatePowerCurve(
  turbine: typeof WIND_TURBINES[0],
  step: number = 0.5
): { windSpeed: number; power: number; Cp: number }[] {
  const data: { windSpeed: number; power: number; Cp: number }[] = [];
  
  for (let v = 0; v <= 30; v += step) {
    const power = calculateWindPower(v, turbine);
    const Cp = v > turbine.cutInSpeed && v <= turbine.ratedSpeed ? getCpByWindSpeed(v) : 0;
    data.push({ windSpeed: v, power, Cp });
  }
  
  return data;
}

// 生成8760小时风速数据
function generate8760WindData(regionId: number): number[] {
  const config = REGION_CONFIGS[regionId];
  if (!config) {
    console.error(`区域 ${regionId} 配置不存在`);
    return [];
  }
  
  const windData: number[] = [];
  
  // 遍历12个月，每月每天每小时
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    
    for (let day = 1; day <= daysInMonth; day++) {
      // 获取该天的24小时数据
      const city = {
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
      
      const dayData = getResourceData(city, '日', month, day);
      windData.push(...dayData.wind);
    }
  }
  
  return windData;
}

// 计算年发电量和年利用小时数
function calculateAnnualOutput(regionId: number, turbineId: string) {
  // 获取风机参数
  const turbine = WIND_TURBINES.find(t => t.id === turbineId);
  if (!turbine) {
    console.error(`风机 ${turbineId} 不存在`);
    return null;
  }
  
  // 生成8760小时风速数据
  const windData = generate8760WindData(regionId);
  
  if (windData.length !== 8760) {
    console.warn(`风速数据点数: ${windData.length}，预期8760`);
  }
  
  // 统计风速分布
  const speedDistribution: Record<string, number> = {};
  let totalSpeed = 0;
  let maxSpeed = 0;
  let minSpeed = Infinity;
  
  // 逐时计算发电量
  let totalEnergy = 0; // kWh
  const hourlyPower: number[] = [];
  
  for (let i = 0; i < windData.length; i++) {
    const windSpeed = windData[i];
    totalSpeed += windSpeed;
    maxSpeed = Math.max(maxSpeed, windSpeed);
    minSpeed = Math.min(minSpeed, windSpeed);
    
    // 统计风速分布（按1m/s区间）
    const speedBin = Math.floor(windSpeed).toString();
    speedDistribution[speedBin] = (speedDistribution[speedBin] || 0) + 1;
    
    // 计算该小时的发电功率
    const power = calculateWindPower(windSpeed, turbine);
    hourlyPower.push(power);
    
    // 累加发电量（1小时 = 1kWh/kW）
    totalEnergy += power;
  }
  
  // 计算统计指标
  const avgSpeed = totalSpeed / windData.length;
  const annualOutput = totalEnergy / 1000; // MWh
  const equivalentHours = totalEnergy / turbine.ratedPower; // 年等效利用小时数
  const capacityFactor = equivalentHours / 8760 * 100; // 容量因子 %
  
  // 计算有效发电小时数（功率>0的小时数）
  const effectiveHours = hourlyPower.filter(p => p > 0).length;
  
  return {
    turbine: {
      model: turbine.model,
      ratedPower: turbine.ratedPower,
      cutInSpeed: turbine.cutInSpeed,
      ratedSpeed: turbine.ratedSpeed,
      cutOutSpeed: turbine.cutOutSpeed
    },
    windStats: {
      avgSpeed: avgSpeed.toFixed(2),
      maxSpeed: maxSpeed.toFixed(2),
      minSpeed: minSpeed.toFixed(2),
      distribution: speedDistribution
    },
    output: {
      annualEnergy_kWh: Math.round(totalEnergy),
      annualEnergy_MWh: annualOutput.toFixed(1),
      equivalentHours: Math.round(equivalentHours),
      capacityFactor: capacityFactor.toFixed(1),
      effectiveHours: effectiveHours
    }
  };
}

// 导出计算函数
export { 
  calculateAnnualOutput, 
  generate8760WindData, 
  calculateWindPower,
  getCpByWindSpeed,
  getCpByLambda,
  calculateLambda,
  generatePowerCurve,
  CP_TABLE
};

// 测试计算（测试区-1，区域ID=53）
console.log('=== 测试区-1 风机年发电量计算 ===\n');

const turbines = ['WT-50', 'WT-1500', 'WT-2500'];

turbines.forEach(turbineId => {
  const result = calculateAnnualOutput(53, turbineId);
  if (result) {
    console.log(`\n【${result.turbine.model}】`);
    console.log(`额定功率: ${result.turbine.ratedPower} kW`);
    console.log(`切入/额定/切出风速: ${result.turbine.cutInSpeed}/${result.turbine.ratedSpeed}/${result.turbine.cutOutSpeed} m/s`);
    console.log(`\n风速统计:`);
    console.log(`  平均风速: ${result.windStats.avgSpeed} m/s`);
    console.log(`  最大风速: ${result.windStats.maxSpeed} m/s`);
    console.log(`  最小风速: ${result.windStats.minSpeed} m/s`);
    console.log(`\n发电量计算结果:`);
    console.log(`  年发电量: ${result.output.annualEnergy_MWh} MWh`);
    console.log(`  年等效利用小时数: ${result.output.equivalentHours} h`);
    console.log(`  容量因子: ${result.output.capacityFactor}%`);
    console.log(`  有效发电小时数: ${result.output.effectiveHours} h`);
    console.log('---');
  }
});
