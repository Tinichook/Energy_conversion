// ============================================
// 能源系统优化求解报告生成器
// 生成完整的Markdown格式求解报告
// ============================================

import * as fs from 'fs';
import * as path from 'path';

import {
  generateCities,
  City,
  CityType,
  setCurrentStudentId,
  REGION_CONFIGS,
} from './src/DataSetting';

import {
  findOptimalSolutions,
  Solution,
  calculateDailyLoad,
  calculatePeakLoad,
  calculateDailyBiomass,
  recommendBiomassRoutes,
  estimateSearchRanges,
  OptimizationProgress,
  BiomassRoute,
  getEnergyRatioConstraints,
} from './src/OptimizationEngine';

// ============================================
// 报告生成配置
// ============================================

interface ReportConfig {
  regionId: number;
  studentId?: string;
  outputPath: string;
  maxSolutions: number;
}

// ============================================
// 格式化函数
// ============================================

function fmt(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

function fmtInt(num: number): string {
  return Math.round(num).toLocaleString('zh-CN');
}

function fmtPercent(num: number): string {
  return (num * 100).toFixed(1) + '%';
}

// ============================================
// 方案命名
// ============================================

function getSolutionName(sol: Solution, idx: number, allSolutions: Solution[]): string {
  // 根据方案特点命名
  const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
  const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
  const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
  const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
  
  const avgWind = allSolutions.reduce((s, sol) => s + sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000, 0) / allSolutions.length;
  const avgSolar = allSolutions.reduce((s, sol) => s + sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000, 0) / allSolutions.length;
  const avgBattery = allSolutions.reduce((s, sol) => s + sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000, 0) / allSolutions.length;
  
  if (idx === 0) return '综合最优型 ⭐推荐';
  if (sol.simulation.reliability >= 99.9) return '高可靠型';
  if (sol.totalCost === Math.min(...allSolutions.map(s => s.totalCost))) return '经济优先型';
  if (windMW > avgWind * 1.3) return '风电增强型';
  if (solarMW > avgSolar * 1.2) return '光伏主导型';
  if (bioMW > 5) return '生物质增强型';
  if (batteryMWh > avgBattery * 1.5) return '大容量储能型';
  if (batteryMWh < avgBattery * 0.7) return '低储能配置型';
  
  const names = [
    '平衡配置型', '储能优化型', '混合风机型', '高效光伏型', '稳定供电型',
    '紧凑配置型', '双逆变器型', '多样化生物质型', '平衡投资型', '综合优化型',
    '低风速优化型', '高冗余型', '低成本型', '标准配置型', '优化配置型'
  ];
  return names[idx % names.length];
}

function getBiomassEquipName(route: BiomassRoute, type: 'primary' | 'secondary'): string {
  const names: Record<BiomassRoute, { primary: string; secondary: string }> = {
    '直燃': { primary: '锅炉', secondary: '汽轮机' },
    '气化': { primary: '气化炉', secondary: '燃气发电机' },
    '沼气': { primary: '发酵罐', secondary: '沼气发电机' },
  };
  return names[route][type];
}

function calcLCOE(totalCost: number, annualGen: number): number {
  const CRF = 0.08;
  const OMrate = 0.02;
  return (totalCost * 10000 * (CRF + OMrate)) / (annualGen * 1000);
}

// ============================================
// 生成报告
// ============================================

async function generateReport(config: ReportConfig): Promise<string> {
  const lines: string[] = [];
  
  // 设置学号
  if (config.studentId) {
    setCurrentStudentId(config.studentId);
  }
  
  // 获取区域
  const cities = generateCities(true);
  const region = cities.find(c => c.id === config.regionId);
  
  if (!region) {
    throw new Error(`未找到区域ID: ${config.regionId}`);
  }
  
  console.log(`\n开始为 ${region.name} 生成优化报告...`);
  
  // 执行优化
  let lastProgress: OptimizationProgress | null = null;
  const solutions = await findOptimalSolutions(region, (progress) => {
    lastProgress = progress;
    const pct = ((progress.current / progress.total) * 100).toFixed(0);
    process.stdout.write(`\r优化进度: ${pct}% | 可行方案: ${progress.feasibleCount}`);
  });
  
  console.log(`\n找到 ${solutions.length} 个可行方案`);
  
  if (solutions.length === 0) {
    throw new Error('未找到可行方案');
  }
  
  const topSolutions = solutions.slice(0, config.maxSolutions);
  
  // 区域参数
  const dailyLoad = calculateDailyLoad(region);
  const peakLoad = calculatePeakLoad(region);
  const dailyBiomass = calculateDailyBiomass(region);
  const annualLoad = dailyLoad * 365;
  const biomassRoutes = recommendBiomassRoutes(region);
  const ranges = estimateSearchRanges(region);
  const constraints = getEnergyRatioConstraints(region.type);
  
  // ========== 报告内容 ==========
  
  lines.push(`# ${region.name} 优化求解方案（${topSolutions.length}套）`);
  lines.push('');
  lines.push('## 求解方法说明');
  lines.push('');
  lines.push('本方案基于 `energy-system/src/OptimizationEngine.ts` 中的优化算法生成：');
  lines.push('');
  lines.push('1. **8760小时仿真**：对全年8760小时进行逐时仿真，计算风光生物质发电与负荷匹配');
  lines.push('2. **储能调度策略**：基于供需平衡的充放电控制，优化电池SOC管理');
  lines.push('3. **多目标优化**：综合考虑可靠率、经济性、设备匹配度、系统稳定性');
  lines.push('4. **约束满足**：确保供电可靠率≥98%，设备容量匹配合理');
  lines.push('');
  
  // 一、区域参数
  lines.push('---');
  lines.push('');
  lines.push('## 一、区域参数');
  lines.push('');
  lines.push('| 参数 | 数值 | 单位 |');
  lines.push('|------|------|------|');
  lines.push(`| 区域编号 | ${region.id} | - |`);
  lines.push(`| 区域类型 | ${region.type} | - |`);
  lines.push(`| 年用电量 | ${fmtInt(annualLoad)} | MWh |`);
  lines.push(`| 日用电量 | ${fmtInt(dailyLoad)} | MWh |`);
  lines.push(`| 峰值负荷 | ${fmt(peakLoad, 1)} | MW |`);
  lines.push(`| 日生物质产量 | ${fmtInt(dailyBiomass)} | 吨 |`);
  lines.push('');
  
  // 约束条件
  lines.push('### 约束条件');
  lines.push('');
  lines.push('| 约束项 | 下限 | 上限 |');
  lines.push('|--------|------|------|');
  lines.push(`| 风电占比 | ${fmtPercent(constraints.wind.min)} | ${fmtPercent(constraints.wind.max)} |`);
  lines.push(`| 光伏占比 | ${fmtPercent(constraints.solar.min)} | ${fmtPercent(constraints.solar.max)} |`);
  lines.push(`| 生物质占比 | ${fmtPercent(constraints.bio.min)} | ${fmtPercent(constraints.bio.max)} |`);
  lines.push(`| 总占比 | ${fmtPercent(constraints.totalMin)} | ${fmtPercent(constraints.totalMax)} |`);
  lines.push('');
  
  // 生物质路线推荐
  lines.push('### 生物质路线推荐');
  lines.push('');
  lines.push('| 路线 | 评分 | 推荐理由 |');
  lines.push('|------|------|---------|');
  biomassRoutes.forEach(r => {
    lines.push(`| ${r.route} | ${r.score}分 | ${r.reason} |`);
  });
  lines.push('');
  
  // 二、求解结果
  lines.push('---');
  lines.push('');
  lines.push(`## 二、求解结果（${topSolutions.length}套最优方案）`);
  lines.push('');
  
  topSolutions.forEach((sol, idx) => {
    const name = getSolutionName(sol, idx, topSolutions);
    const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
    const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
    const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
    const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
    const inverterMW = sol.config.inverter.reduce((s, i) => s + i.totalCapacity, 0) / 1000;
    const pcsMW = sol.config.pcs.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
    const LCOE = calcLCOE(sol.totalCost, sol.simulation.totalGeneration);
    
    lines.push(`### 方案${idx + 1}：${name}`);
    lines.push(`**评分：${fmt(sol.score.total, 0)}分** | 约束：${sol.simulation.feasible ? '✓全部满足' : '⚠部分违反'}`);
    lines.push('');
    
    // 设备配置表
    lines.push('| 设备类型 | 型号 | 数量 | 单台功率 | 总容量 | 总价(万元) |');
    lines.push('|---------|------|------|---------|--------|-----------|');
    
    sol.config.wind.forEach(w => {
      lines.push(`| 风机 | ${w.model} | ${fmtInt(w.count)} | ${w.unitCapacity} kW | ${fmt(w.totalCapacity/1000, 2)} MW | ${fmtInt(w.totalPrice)} |`);
    });
    
    sol.config.solar.forEach(s => {
      lines.push(`| 光伏组件 | ${s.model} | ${fmtInt(s.count)} | ${fmt(s.unitCapacity, 3)} kW | ${fmt(s.totalCapacity/1000, 2)} MW | ${fmtInt(s.totalPrice)} |`);
    });
    
    sol.config.inverter.forEach(i => {
      lines.push(`| 逆变器 | ${i.model} | ${i.count} | ${fmtInt(i.unitCapacity)} kW | ${fmt(i.totalCapacity/1000, 2)} MW | ${fmtInt(i.totalPrice)} |`);
    });
    
    if (sol.config.biomass.secondary.model) {
      lines.push(`| ${getBiomassEquipName(sol.config.biomass.route, 'secondary')} | ${sol.config.biomass.secondary.model} | ${sol.config.biomass.secondary.count} | ${fmtInt(sol.config.biomass.secondary.unitCapacity)} kW | ${fmt(sol.config.biomass.secondary.totalCapacity/1000, 2)} MW | ${fmtInt(sol.config.biomass.secondary.totalPrice)} |`);
    }
    
    sol.config.battery.forEach(b => {
      lines.push(`| 电池 | ${b.model} | ${fmtInt(b.count)} | ${fmt(b.unitCapacity, 2)} kWh | ${fmt(b.totalCapacity/1000, 2)} MWh | ${fmtInt(b.totalPrice)} |`);
    });
    
    sol.config.pcs.forEach(p => {
      lines.push(`| PCS | ${p.model} | ${p.count} | ${fmtInt(p.unitCapacity)} kW | ${fmt(p.totalCapacity/1000, 2)} MW | ${fmtInt(p.totalPrice)} |`);
    });
    
    lines.push('');
    
    // 能源占比
    if (sol.simulation.energyRatio) {
      const er = sol.simulation.energyRatio;
      lines.push(`**能源占比：** 风电 ${fmtPercent(er.wind)} | 光伏 ${fmtPercent(er.solar)} | 生物质 ${fmtPercent(er.bio)} | **总计 ${fmtPercent(er.total)}**`);
    }
    
    lines.push(`**经济指标：** 总投资 ${fmtInt(sol.totalCost)}万元 | 年发电量 ${fmtInt(sol.simulation.totalGeneration)} MWh | LCOE ${fmt(LCOE, 3)}元/kWh`);
    lines.push('');
    lines.push(`**仿真结果：** 可靠率 ${fmt(sol.simulation.reliability, 2)}% | 弃电率 ${fmt(sol.simulation.curtailmentRate, 2)}% | 缺电${sol.simulation.shortageHours}h | SOC ${fmt(sol.simulation.minSOC, 0)}-${fmt(sol.simulation.maxSOC, 0)}%`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  // 三、方案综合排名
  lines.push('## 三、方案综合排名');
  lines.push('');
  lines.push('| 排名 | 方案名称 | 评分 | 风电MW | 光伏MW | 生物质MW | 储能MWh | 总投资(万) | LCOE | 可靠率 | 总占比 |');
  lines.push('|------|---------|------|--------|--------|----------|---------|-----------|------|--------|--------|');
  
  topSolutions.forEach((sol, idx) => {
    const name = getSolutionName(sol, idx, topSolutions).replace(' ⭐推荐', '');
    const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
    const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
    const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
    const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
    const LCOE = calcLCOE(sol.totalCost, sol.simulation.totalGeneration);
    const totalRatio = sol.simulation.energyRatio?.total || 0;
    
    lines.push(`| ${idx + 1} | ${name} | **${fmt(sol.score.total, 0)}** | ${fmt(windMW, 1)} | ${fmt(solarMW, 1)} | ${fmt(bioMW, 2)} | ${fmt(batteryMWh, 1)} | ${fmtInt(sol.totalCost)} | ${fmt(LCOE, 3)} | ${fmt(sol.simulation.reliability, 1)}% | ${fmtPercent(totalRatio)} |`);
  });
  lines.push('');
  
  // 四、推荐方案
  lines.push('---');
  lines.push('');
  lines.push('## 四、推荐方案');
  lines.push('');
  
  // 综合最优
  const best = topSolutions[0];
  lines.push('### 4.1 综合最优：方案1（综合最优型）');
  lines.push(`- 评分最高（${fmt(best.score.total, 0)}分），可靠率${fmt(best.simulation.reliability, 2)}%`);
  lines.push(`- 总投资 ${fmtInt(best.totalCost)}万元，LCOE ${fmt(calcLCOE(best.totalCost, best.simulation.totalGeneration), 3)}元/kWh`);
  lines.push(`- 设备匹配度好，储能配置合理`);
  lines.push('');
  
  // 经济最优
  const economicBest = [...topSolutions].sort((a, b) => a.totalCost - b.totalCost)[0];
  const economicIdx = topSolutions.indexOf(economicBest) + 1;
  lines.push(`### 4.2 经济最优：方案${economicIdx}（${getSolutionName(economicBest, economicIdx - 1, topSolutions).replace(' ⭐推荐', '')}）`);
  lines.push(`- 总投资最低（${fmtInt(economicBest.totalCost)}万元）`);
  lines.push(`- LCOE ${fmt(calcLCOE(economicBest.totalCost, economicBest.simulation.totalGeneration), 3)}元/kWh`);
  lines.push(`- 适合预算有限的项目`);
  lines.push('');
  
  // 可靠性最优
  const reliabilityBest = [...topSolutions].sort((a, b) => b.simulation.reliability - a.simulation.reliability)[0];
  const reliabilityIdx = topSolutions.indexOf(reliabilityBest) + 1;
  lines.push(`### 4.3 可靠性最优：方案${reliabilityIdx}（${getSolutionName(reliabilityBest, reliabilityIdx - 1, topSolutions).replace(' ⭐推荐', '')}）`);
  lines.push(`- 可靠率最高（${fmt(reliabilityBest.simulation.reliability, 2)}%）`);
  lines.push(`- 缺电小时数最少（${reliabilityBest.simulation.shortageHours}h）`);
  lines.push(`- 适合对供电可靠性要求高的场景`);
  lines.push('');
  
  // 文档信息
  lines.push('---');
  lines.push('');
  lines.push(`**文档版本**：v1.0（代码求解版）`);
  lines.push(`**编制日期**：${new Date().toLocaleDateString('zh-CN')}`);
  lines.push(`**求解方法**：基于OptimizationEngine.ts的8760小时仿真优化`);
  if (config.studentId) {
    lines.push(`**学号**：${config.studentId}`);
  }
  lines.push('');
  
  return lines.join('\n');
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('能源系统优化求解报告生成器');
  console.log('='.repeat(60));
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const config: ReportConfig = {
    regionId: 53,
    studentId: '',
    outputPath: '../MD方案',
    maxSolutions: 20,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) {
      config.regionId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--student' && args[i + 1]) {
      config.studentId = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--max' && args[i + 1]) {
      config.maxSolutions = parseInt(args[i + 1]);
      i++;
    }
  }
  
  console.log(`\n配置: 区域${config.regionId}, 学号${config.studentId || '(无)'}, 最大${config.maxSolutions}套方案`);
  
  try {
    const report = await generateReport(config);
    
    // 获取区域名称
    const cities = generateCities(true);
    const region = cities.find(c => c.id === config.regionId);
    const regionName = region?.name || `区域-${config.regionId}`;
    
    // 保存文件
    const fileName = `${regionName}代码求解方案.md`;
    const filePath = path.join(__dirname, config.outputPath, fileName);
    
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, report, 'utf-8');
    console.log(`\n报告已保存到: ${filePath}`);
    
    // 同时输出到控制台
    console.log('\n' + '='.repeat(60));
    console.log('报告预览（前100行）:');
    console.log('='.repeat(60));
    console.log(report.split('\n').slice(0, 100).join('\n'));
    console.log('\n... (完整报告已保存到文件)');
    
  } catch (err) {
    console.error('生成报告失败:', err);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('完成');
  console.log('='.repeat(60));
}

main();
