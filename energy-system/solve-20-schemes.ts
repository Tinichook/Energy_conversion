// ============================================
// 测试区-1 多方案优化求解器
// 生成20套最优方案
// ============================================

import {
  SOLAR_PANELS,
  WIND_TURBINES,
  WindTurbineSpec,
  BATTERIES,
  INVERTERS,
  PCS_UNITS,
  GAS_ENGINES,
} from './src/EquipmentData';

// ============================================
// 类型定义
// ============================================

interface EquipmentSelection {
  id: string;
  model: string;
  count: number;
  unitPower: number;
  totalPower: number;
  unitPrice: number;
  totalPrice: number;
}

interface EnergyRatio {
  wind: number;
  solar: number;
  bio: number;
  total: number;
}

interface SolutionScheme {
  id: string;
  name: string;
  wind: EquipmentSelection[];
  solar: EquipmentSelection[];
  inverter: EquipmentSelection[];
  biomass: EquipmentSelection[];
  battery: EquipmentSelection[];
  pcs: EquipmentSelection[];
  capacity: {
    windMW: number;
    solarMW: number;
    bioMW: number;
    batteryMWh: number;
    pcsMW: number;
    inverterMW: number;
  };
  energyRatio: EnergyRatio;
  economics: {
    totalInvestment: number;
    annualGeneration: number;
    LCOE: number;
  };
  score: number;
  violations: string[];
}

// ============================================
// 测试区-1 参数
// ============================================

const REGION_PARAMS = {
  annualLoad: 240900,     // MWh
  dailyLoad: 660,         // MWh
  peakLoad: 50,           // MW
  avgWindSpeed: 3.5,      // m/s
  solarHours: 1200,       // 年等效利用小时数
  biomassTonPerDay: 80,   // 吨/天
  // 能源占比约束
  constraints: {
    wind: { min: 0.20, max: 0.35 },
    solar: { min: 0.55, max: 0.75 },
    bio: { min: 0.10, max: 0.25 },
    totalMin: 1.10,
    totalMax: 1.35,
  },
};

// ============================================
// 辅助函数
// ============================================

function estimateWindAnnualMWh(turbine: WindTurbineSpec, avgWindSpeed: number): number {
  const capacityFactor = turbine.capacityFactor / 100;
  const windFactor = avgWindSpeed < 5 ? 0.6 : (avgWindSpeed < 7 ? 0.8 : 1.0);
  return turbine.ratedPower * 8760 * capacityFactor * windFactor / 1000;
}

function selectInverters(solarDCkW: number, ratio: number = 1.05): EquipmentSelection[] {
  const targetACkW = solarDCkW / ratio;
  const results: EquipmentSelection[] = [];
  let remaining = targetACkW;
  const sorted = [...INVERTERS].sort((a, b) => b.ratedPower - a.ratedPower);
  
  for (const inv of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / inv.ratedPower);
    if (count > 0) {
      results.push({
        id: inv.id, model: inv.model, count,
        unitPower: inv.ratedPower, totalPower: count * inv.ratedPower,
        unitPrice: inv.price, totalPrice: count * inv.price,
      });
      remaining -= count * inv.ratedPower;
    }
  }
  if (remaining > 0) {
    const small = sorted[sorted.length - 1];
    const count = Math.ceil(remaining / small.ratedPower);
    results.push({
      id: small.id, model: small.model, count,
      unitPower: small.ratedPower, totalPower: count * small.ratedPower,
      unitPrice: small.price, totalPrice: count * small.price,
    });
  }
  return results;
}

function selectPCS(batteryMWh: number, hours: number = 3): EquipmentSelection[] {
  const requiredKW = (batteryMWh * 1000) / hours;
  const results: EquipmentSelection[] = [];
  let remaining = requiredKW;
  const sorted = [...PCS_UNITS].sort((a, b) => b.ratedPower - a.ratedPower);
  
  for (const pcs of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / pcs.ratedPower);
    if (count > 0) {
      results.push({
        id: pcs.id, model: pcs.model, count,
        unitPower: pcs.ratedPower, totalPower: count * pcs.ratedPower,
        unitPrice: pcs.price, totalPrice: count * pcs.price,
      });
      remaining -= count * pcs.ratedPower;
    }
  }
  if (remaining > 0) {
    const small = sorted[sorted.length - 1];
    const count = Math.ceil(remaining / small.ratedPower);
    results.push({
      id: small.id, model: small.model, count,
      unitPower: small.ratedPower, totalPower: count * small.ratedPower,
      unitPrice: small.price, totalPrice: count * small.price,
    });
  }
  return results;
}

function selectBatteries(targetMWh: number): EquipmentSelection[] {
  const targetKWh = targetMWh * 1000;
  const lfp = BATTERIES.filter(b => b.type === '磷酸铁锂').sort((a, b) => b.energyCapacity - a.energyCapacity);
  if (lfp.length === 0) return [];
  
  const bat = lfp[0];
  const count = Math.ceil(targetKWh / bat.energyCapacity);
  return [{
    id: bat.id, model: bat.model, count,
    unitPower: bat.energyCapacity, totalPower: count * bat.energyCapacity,
    unitPrice: bat.price, totalPrice: count * bat.price,
  }];
}

// ============================================
// 方案生成函数
// ============================================

function generateScheme(
  schemeId: number,
  windRatio: number,
  solarRatio: number,
  bioRatio: number,
  batteryRatio: number,
  windTurbineId: string,
  solarPanelId: string,
  bioEngineId: string,
  inverterRatio: number = 1.05
): SolutionScheme {
  const params = REGION_PARAMS;
  const annualLoad = params.annualLoad;
  
  // 计算目标发电量
  const windTargetMWh = annualLoad * windRatio;
  const solarTargetMWh = annualLoad * solarRatio;
  const bioTargetMWh = annualLoad * bioRatio;
  
  // === 风电配置 ===
  const turbine = WIND_TURBINES.find(t => t.id === windTurbineId) || WIND_TURBINES[0];
  const turbineAnnualMWh = estimateWindAnnualMWh(turbine, params.avgWindSpeed);
  const windCount = Math.ceil(windTargetMWh / turbineAnnualMWh);
  const windSelection: EquipmentSelection = {
    id: turbine.id, model: turbine.model, count: windCount,
    unitPower: turbine.ratedPower, totalPower: windCount * turbine.ratedPower,
    unitPrice: turbine.price, totalPrice: windCount * turbine.price,
  };
  const actualWindMWh = windCount * turbineAnnualMWh;
  
  // === 光伏配置 ===
  const panel = SOLAR_PANELS.find(p => p.id === solarPanelId) || SOLAR_PANELS[0];
  const panelAnnualMWh = (panel.power / 1000) * params.solarHours / 1000;
  const panelCount = Math.ceil(solarTargetMWh / panelAnnualMWh);
  const solarDCkW = panelCount * panel.power / 1000;
  const solarSelection: EquipmentSelection = {
    id: panel.id, model: panel.model, count: panelCount,
    unitPower: panel.power / 1000, totalPower: solarDCkW,
    unitPrice: panel.price / 10000, totalPrice: panelCount * panel.price / 10000,
  };
  const actualSolarMWh = panelCount * panelAnnualMWh;
  
  // === 逆变器配置 ===
  const inverterSelection = selectInverters(solarDCkW, inverterRatio);
  const inverterTotalKW = inverterSelection.reduce((s, i) => s + i.totalPower, 0);
  
  // === 生物质配置 ===
  const bioRunHours = 7000;
  const bioTargetMW = bioTargetMWh / bioRunHours;
  const engine = GAS_ENGINES.find(g => g.id === bioEngineId) || GAS_ENGINES[0];
  const engineCount = Math.ceil(bioTargetMW * 1000 / engine.ratedPower);
  const bioSelection: EquipmentSelection = {
    id: engine.id, model: engine.model, count: engineCount,
    unitPower: engine.ratedPower, totalPower: engineCount * engine.ratedPower,
    unitPrice: engine.price, totalPrice: engineCount * engine.price,
  };
  const actualBioMWh = engineCount * engine.ratedPower * bioRunHours / 1000;
  
  // === 储能配置 ===
  const batteryMWh = params.dailyLoad * batteryRatio;
  const batterySelection = selectBatteries(batteryMWh);
  const batteryTotalKWh = batterySelection.reduce((s, b) => s + b.totalPower, 0);
  
  // === PCS配置 ===
  const pcsSelection = selectPCS(batteryTotalKWh / 1000, 3);
  const pcsTotalKW = pcsSelection.reduce((s, p) => s + p.totalPower, 0);
  
  // === 计算能源占比 ===
  const totalGenMWh = actualWindMWh + actualSolarMWh + actualBioMWh;
  const energyRatio: EnergyRatio = {
    wind: actualWindMWh / annualLoad,
    solar: actualSolarMWh / annualLoad,
    bio: actualBioMWh / annualLoad,
    total: totalGenMWh / annualLoad,
  };
  
  // === 计算经济指标 ===
  const windInv = windSelection.totalPrice;
  const solarInv = solarSelection.totalPrice + inverterSelection.reduce((s, i) => s + i.totalPrice, 0);
  const bioInv = bioSelection.totalPrice;
  const batteryInv = batterySelection.reduce((s, b) => s + b.totalPrice, 0);
  const pcsInv = pcsSelection.reduce((s, p) => s + p.totalPrice, 0);
  const totalInvestment = windInv + solarInv + bioInv + batteryInv + pcsInv;
  
  const CRF = 0.08;
  const OMrate = 0.02;
  const annualCost = totalInvestment * 10000 * (CRF + OMrate);
  const LCOE = annualCost / (totalGenMWh * 1000);
  
  // === 约束检查 ===
  const violations: string[] = [];
  const rc = params.constraints;
  if (energyRatio.wind < rc.wind.min) violations.push(`风电${(energyRatio.wind*100).toFixed(1)}%<${rc.wind.min*100}%`);
  if (energyRatio.wind > rc.wind.max) violations.push(`风电${(energyRatio.wind*100).toFixed(1)}%>${rc.wind.max*100}%`);
  if (energyRatio.solar < rc.solar.min) violations.push(`光伏${(energyRatio.solar*100).toFixed(1)}%<${rc.solar.min*100}%`);
  if (energyRatio.solar > rc.solar.max) violations.push(`光伏${(energyRatio.solar*100).toFixed(1)}%>${rc.solar.max*100}%`);
  if (energyRatio.bio < rc.bio.min) violations.push(`生物质${(energyRatio.bio*100).toFixed(1)}%<${rc.bio.min*100}%`);
  if (energyRatio.bio > rc.bio.max) violations.push(`生物质${(energyRatio.bio*100).toFixed(1)}%>${rc.bio.max*100}%`);
  if (energyRatio.total < rc.totalMin) violations.push(`总占比${(energyRatio.total*100).toFixed(1)}%<${rc.totalMin*100}%`);
  
  // === 评分计算 ===
  let score = 100;
  // 约束违反扣分
  score -= violations.length * 10;
  // 经济性评分 (LCOE越低越好)
  if (LCOE < 0.25) score += 5;
  else if (LCOE > 0.35) score -= 5;
  // 设备匹配评分
  const invRatio = solarDCkW / inverterTotalKW;
  if (invRatio >= 1.0 && invRatio <= 1.1) score += 3;
  // 储能配置评分
  if (batteryRatio >= 0.08 && batteryRatio <= 0.12) score += 2;
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    id: `scheme-${schemeId}`,
    name: `方案${schemeId}`,
    wind: [windSelection],
    solar: [solarSelection],
    inverter: inverterSelection,
    biomass: [bioSelection],
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
    economics: { totalInvestment, annualGeneration: totalGenMWh, LCOE },
    score,
    violations,
  };
}

// ============================================
// 生成20套方案（参数组合搜索）
// ============================================

function generate20Schemes(): SolutionScheme[] {
  const schemes: SolutionScheme[] = [];
  
  // 定义参数搜索空间
  const windRatios = [0.20, 0.22, 0.25, 0.28, 0.30, 0.33, 0.35];
  const solarRatios = [0.55, 0.60, 0.65, 0.68, 0.70, 0.72, 0.75];
  const bioRatios = [0.10, 0.12, 0.15, 0.18, 0.20, 0.22, 0.25];
  const batteryRatios = [0.08, 0.10, 0.12, 0.15];
  const windTurbines = ['WT-3', 'WT-10', 'WT-50'];
  const solarPanels = ['PV-545N', 'PV-660M'];
  const bioEngines = ['BG-200', 'BG-500'];
  
  let schemeId = 1;
  
  // 遍历参数组合
  for (const windR of windRatios) {
    for (const solarR of solarRatios) {
      for (const bioR of bioRatios) {
        // 检查总占比约束
        const total = windR + solarR + bioR;
        if (total < 1.05 || total > 1.40) continue;
        
        for (const batR of batteryRatios) {
          for (const wt of windTurbines) {
            for (const sp of solarPanels) {
              for (const be of bioEngines) {
                const scheme = generateScheme(
                  schemeId, windR, solarR, bioR, batR, wt, sp, be
                );
                schemes.push(scheme);
                schemeId++;
              }
            }
          }
        }
      }
    }
  }
  
  // 按评分排序
  schemes.sort((a, b) => b.score - a.score);
  
  // 返回前20个最优方案
  return schemes.slice(0, 20);
}

// ============================================
// 输出结果
// ============================================

function printResults(schemes: SolutionScheme[]): void {
  console.log('='.repeat(80));
  console.log('测试区-1 最优方案求解结果（基于约束条件的多参数搜索）');
  console.log('='.repeat(80));
  console.log(`\n共搜索方案数: 大量组合，筛选出前20个最优方案\n`);
  
  schemes.forEach((s, idx) => {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`【排名 ${idx + 1}】${s.name} | 评分: ${s.score}分`);
    console.log(`${'─'.repeat(60)}`);
    
    console.log('\n[设备配置]');
    s.wind.forEach(w => console.log(`  风机: ${w.model} × ${w.count}台 = ${(w.totalPower/1000).toFixed(2)} MW`));
    s.solar.forEach(p => console.log(`  光伏: ${p.model} × ${p.count}块 = ${(p.totalPower/1000).toFixed(2)} MW`));
    s.inverter.forEach(i => console.log(`  逆变器: ${i.model} × ${i.count}台 = ${(i.totalPower/1000).toFixed(2)} MW`));
    s.biomass.forEach(b => console.log(`  生物质: ${b.model} × ${b.count}台 = ${(b.totalPower/1000).toFixed(3)} MW`));
    s.battery.forEach(b => console.log(`  电池: ${b.model} × ${b.count}组 = ${(b.totalPower/1000).toFixed(2)} MWh`));
    s.pcs.forEach(p => console.log(`  PCS: ${p.model} × ${p.count}台 = ${(p.totalPower/1000).toFixed(2)} MW`));
    
    console.log('\n[能源占比]');
    console.log(`  风电: ${(s.energyRatio.wind * 100).toFixed(1)}% | 光伏: ${(s.energyRatio.solar * 100).toFixed(1)}% | 生物质: ${(s.energyRatio.bio * 100).toFixed(1)}% | 总计: ${(s.energyRatio.total * 100).toFixed(1)}%`);
    
    console.log('\n[经济指标]');
    console.log(`  总投资: ${s.economics.totalInvestment.toFixed(0)} 万元 | 年发电量: ${s.economics.annualGeneration.toFixed(0)} MWh | LCOE: ${s.economics.LCOE.toFixed(3)} 元/kWh`);
    
    if (s.violations.length > 0) {
      console.log('\n[约束违反]');
      s.violations.forEach(v => console.log(`  ⚠ ${v}`));
    } else {
      console.log('\n[约束检查] ✓ 全部满足');
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('求解完成');
  console.log('='.repeat(80));
}

// ============================================
// 执行求解
// ============================================

const topSchemes = generate20Schemes();
printResults(topSchemes);

// 导出JSON格式结果
console.log('\n\n===== JSON格式输出 =====\n');
console.log(JSON.stringify(topSchemes.map(s => ({
  rank: topSchemes.indexOf(s) + 1,
  score: s.score,
  wind: { model: s.wind[0]?.model, count: s.wind[0]?.count, MW: s.capacity.windMW },
  solar: { model: s.solar[0]?.model, count: s.solar[0]?.count, MW: s.capacity.solarMW },
  biomass: { model: s.biomass[0]?.model, count: s.biomass[0]?.count, MW: s.capacity.bioMW },
  battery: { MWh: s.capacity.batteryMWh },
  ratio: { wind: (s.energyRatio.wind*100).toFixed(1)+'%', solar: (s.energyRatio.solar*100).toFixed(1)+'%', bio: (s.energyRatio.bio*100).toFixed(1)+'%', total: (s.energyRatio.total*100).toFixed(1)+'%' },
  investment: s.economics.totalInvestment,
  LCOE: s.economics.LCOE.toFixed(3),
  violations: s.violations,
})), null, 2));
