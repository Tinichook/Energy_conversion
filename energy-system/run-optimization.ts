// ============================================
// 能源系统优化求解脚本
// 调用 OptimizationEngine.ts 生成最优方案
// 输出格式化的求解报告
// ============================================

import {
  generateCities,
  City,
  CityType,
  getResourceData,
  getDaysInMonth,
  setCurrentStudentId,
} from './src/DataSetting';

import {
  findOptimalSolutions,
  Solution,
  EquipmentConfig,
  SimulationResult,
  SolutionScore,
  calculateTotalCost,
  calculateDailyLoad,
  calculatePeakLoad,
  calculateDailyBiomass,
  recommendBiomassRoutes,
  estimateSearchRanges,
  OptimizationProgress,
} from './src/OptimizationEngine';

// ============================================
// 配置参数
// ============================================

interface SolverConfig {
  regionId: number;           // 要求解的区域ID
  studentId?: string;         // 学号（用于数据波动）
  outputFormat: 'console' | 'markdown' | 'json';
  maxSolutions: number;       // 最大输出方案数
}

const DEFAULT_CONFIG: SolverConfig = {
  regionId: 53,               // 默认测试区-1
  studentId: '',
  outputFormat: 'markdown',
  maxSolutions: 20,
};

// ============================================
// 格式化输出函数
// ============================================

function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPercent(num: number, decimals: number = 1): string {
  return (num * 100).toFixed(decimals) + '%';
}

function formatCurrency(num: number): string {
  return formatNumber(num, 0) + ' 万元';
}

// ============================================
// 生成Markdown报告
// ============================================

function generateMarkdownReport(
  region: City,
  solutions: Solution[],
  config: SolverConfig
): string {
  const lines: string[] = [];
  
  // 标题
  lines.push(`# ${region.name} 优化求解方案（${solutions.length}套）`);
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString()}`);
  lines.push(`> 求解引擎: OptimizationEngine.ts`);
  if (config.studentId) {
    lines.push(`> 学号: ${config.studentId}`);
  }
  lines.push('');
  
  // 一、区域参数
  lines.push('## 一、区域参数与约束条件');
  lines.push('');
  lines.push('### 1.1 基础参数');
  lines.push('');
  lines.push('| 参数 | 数值 | 单位 |');
  lines.push('|------|------|------|');
  lines.push(`| 区域编号 | ${region.id} | - |`);
  lines.push(`| 区域类型 | ${region.type} | - |`);
  lines.push(`| 区域名称 | ${region.name} | - |`);
  
  const dailyLoad = calculateDailyLoad(region);
  const peakLoad = calculatePeakLoad(region);
  const dailyBiomass = calculateDailyBiomass(region);
  const annualLoad = dailyLoad * 365;
  
  lines.push(`| 日用电量 | ${formatNumber(dailyLoad, 0)} | MWh |`);
  lines.push(`| 年用电量 | ${formatNumber(annualLoad, 0)} | MWh |`);
  lines.push(`| 峰值负荷 | ${formatNumber(peakLoad, 1)} | MW |`);
  lines.push(`| 日生物质产量 | ${formatNumber(dailyBiomass, 0)} | 吨 |`);
  lines.push('');
  
  // 生物质路线推荐
  const biomassRoutes = recommendBiomassRoutes(region);
  lines.push('### 1.2 生物质路线推荐');
  lines.push('');
  lines.push('| 路线 | 评分 | 推荐理由 |');
  lines.push('|------|------|---------|');
  biomassRoutes.forEach(r => {
    lines.push(`| ${r.route} | ${r.score}分 | ${r.reason} |`);
  });
  lines.push('');
  
  // 搜索范围
  const ranges = estimateSearchRanges(region);
  lines.push('### 1.3 搜索范围估算');
  lines.push('');
  lines.push('| 能源类型 | 最小值 | 最大值 | 推荐值 | 步长 |');
  lines.push('|---------|--------|--------|--------|------|');
  lines.push(`| 风电 (MW) | ${ranges.wind.min} | ${ranges.wind.max} | ${ranges.wind.recommended} | ${ranges.wind.step} |`);
  lines.push(`| 光伏 (MW) | ${ranges.solar.min} | ${ranges.solar.max} | ${ranges.solar.recommended} | ${ranges.solar.step} |`);
  lines.push(`| 生物质 (MW) | ${ranges.biomass.min} | ${ranges.biomass.max} | ${ranges.biomass.recommended} | ${ranges.biomass.step} |`);
  lines.push(`| 储能 (MWh) | ${ranges.battery.min} | ${ranges.battery.max} | ${ranges.battery.recommended} | ${ranges.battery.step} |`);
  lines.push('');
  
  // 二、最优方案列表
  lines.push('## 二、最优方案列表');
  lines.push('');
  
  const topSolutions = solutions.slice(0, config.maxSolutions);
  
  topSolutions.forEach((sol, idx) => {
    lines.push(`### 方案${idx + 1}：${getSolutionTypeName(sol, idx)}`);
    lines.push('');
    lines.push(`**综合评分：${sol.score.total.toFixed(1)}分** | 可靠率：${sol.simulation.reliability.toFixed(2)}%`);
    lines.push('');
    
    // 设备配置表
    lines.push('| 设备类型 | 型号 | 数量 | 单台功率/容量 | 总容量 | 总价(万元) |');
    lines.push('|---------|------|------|--------------|--------|-----------|');
    
    // 风机
    sol.config.wind.forEach(w => {
      lines.push(`| 风机 | ${w.model} | ${formatNumber(w.count, 0)} | ${w.unitCapacity} kW | ${formatNumber(w.totalCapacity/1000, 2)} MW | ${formatNumber(w.totalPrice, 0)} |`);
    });
    
    // 光伏
    sol.config.solar.forEach(s => {
      lines.push(`| 光伏组件 | ${s.model} | ${formatNumber(s.count, 0)} | ${s.unitCapacity} kW | ${formatNumber(s.totalCapacity/1000, 2)} MW | ${formatNumber(s.totalPrice, 0)} |`);
    });
    
    // 逆变器
    sol.config.inverter.forEach(i => {
      lines.push(`| 逆变器 | ${i.model} | ${i.count} | ${i.unitCapacity} kW | ${formatNumber(i.totalCapacity/1000, 2)} MW | ${formatNumber(i.totalPrice, 0)} |`);
    });
    
    // 生物质
    if (sol.config.biomass.primary.model) {
      lines.push(`| ${getBiomassEquipmentName(sol.config.biomass.route, 'primary')} | ${sol.config.biomass.primary.model} | ${sol.config.biomass.primary.count} | ${sol.config.biomass.primary.unitCapacity} | ${formatNumber(sol.config.biomass.primary.totalCapacity, 0)} | ${formatNumber(sol.config.biomass.primary.totalPrice, 0)} |`);
    }
    if (sol.config.biomass.secondary.model) {
      lines.push(`| ${getBiomassEquipmentName(sol.config.biomass.route, 'secondary')} | ${sol.config.biomass.secondary.model} | ${sol.config.biomass.secondary.count} | ${sol.config.biomass.secondary.unitCapacity} kW | ${formatNumber(sol.config.biomass.secondary.totalCapacity/1000, 2)} MW | ${formatNumber(sol.config.biomass.secondary.totalPrice, 0)} |`);
    }
    
    // 电池
    sol.config.battery.forEach(b => {
      lines.push(`| 电池 | ${b.model} | ${formatNumber(b.count, 0)} | ${b.unitCapacity} kWh | ${formatNumber(b.totalCapacity/1000, 2)} MWh | ${formatNumber(b.totalPrice, 0)} |`);
    });
    
    // PCS
    sol.config.pcs.forEach(p => {
      lines.push(`| PCS | ${p.model} | ${p.count} | ${p.unitCapacity} kW | ${formatNumber(p.totalCapacity/1000, 2)} MW | ${formatNumber(p.totalPrice, 0)} |`);
    });
    
    lines.push('');
    
    // 能源占比
    const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
    const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
    const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
    const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
    
    lines.push('**容量与能源占比：**');
    lines.push('');
    lines.push('| 项目 | 装机容量 | 年发电量(MWh) | 占比 |');
    lines.push('|------|---------|--------------|------|');
    
    if (sol.simulation.energyRatio) {
      const er = sol.simulation.energyRatio;
      lines.push(`| 风电 | ${formatNumber(windMW, 2)} MW | ${formatNumber(sol.simulation.windGeneration || 0, 0)} | ${formatPercent(er.wind)} |`);
      lines.push(`| 光伏 | ${formatNumber(solarMW, 2)} MW | ${formatNumber(sol.simulation.solarGeneration || 0, 0)} | ${formatPercent(er.solar)} |`);
      lines.push(`| 生物质 | ${formatNumber(bioMW, 2)} MW | ${formatNumber(sol.simulation.biomassGeneration || 0, 0)} | ${formatPercent(er.bio)} |`);
      lines.push(`| 储能 | ${formatNumber(batteryMWh, 2)} MWh | - | - |`);
      lines.push(`| **总计** | - | **${formatNumber(sol.simulation.totalGeneration, 0)}** | **${formatPercent(er.total)}** |`);
    }
    lines.push('');
    
    // 经济指标
    const LCOE = calculateLCOE(sol.totalCost, sol.simulation.totalGeneration);
    lines.push(`**经济指标：** 总投资 ${formatCurrency(sol.totalCost)} | 年发电量 ${formatNumber(sol.simulation.totalGeneration, 0)} MWh | LCOE ${LCOE.toFixed(3)} 元/kWh`);
    lines.push('');
    
    // 仿真结果
    lines.push(`**仿真结果：** 可靠率 ${sol.simulation.reliability.toFixed(2)}% | 弃电率 ${sol.simulation.curtailmentRate.toFixed(2)}% | 缺电小时 ${sol.simulation.shortageHours}h | SOC范围 ${sol.simulation.minSOC.toFixed(1)}%-${sol.simulation.maxSOC.toFixed(1)}%`);
    lines.push('');
    
    // 评分明细
    lines.push(`**评分明细：** 可靠性 ${sol.score.reliability}/30 | 设备匹配 ${sol.score.matching}/20 | 经济性 ${sol.score.economics}/30 | 稳定性 ${sol.score.stability}/10`);
    if (sol.score.issues.length > 0) {
      lines.push(`**问题：** ${sol.score.issues.join('；')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  // 三、方案综合对比
  lines.push('## 三、方案综合对比排名');
  lines.push('');
  lines.push('| 排名 | 方案名称 | 评分 | 风电(MW) | 光伏(MW) | 生物质(MW) | 储能(MWh) | 总投资(万元) | LCOE | 可靠率 |');
  lines.push('|------|---------|------|---------|---------|-----------|----------|-------------|------|--------|');
  
  topSolutions.forEach((sol, idx) => {
    const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
    const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
    const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
    const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
    const LCOE = calculateLCOE(sol.totalCost, sol.simulation.totalGeneration);
    
    lines.push(`| ${idx + 1} | ${getSolutionTypeName(sol, idx)} | **${sol.score.total.toFixed(1)}** | ${windMW.toFixed(1)} | ${solarMW.toFixed(1)} | ${bioMW.toFixed(2)} | ${batteryMWh.toFixed(1)} | ${formatNumber(sol.totalCost, 0)} | ${LCOE.toFixed(3)} | ${sol.simulation.reliability.toFixed(2)}% |`);
  });
  lines.push('');
  
  // 四、推荐方案
  lines.push('## 四、推荐方案说明');
  lines.push('');
  
  if (topSolutions.length > 0) {
    const best = topSolutions[0];
    lines.push('### 4.1 综合最优方案');
    lines.push('');
    lines.push(`**方案1（${getSolutionTypeName(best, 0)}）** 综合评分最高（${best.score.total.toFixed(1)}分），推荐理由：`);
    lines.push(`- 供电可靠率 ${best.simulation.reliability.toFixed(2)}%，满足98%以上要求`);
    lines.push(`- 弃电率 ${best.simulation.curtailmentRate.toFixed(2)}%，资源利用合理`);
    lines.push(`- 总投资 ${formatCurrency(best.totalCost)}，经济性良好`);
    lines.push('');
  }
  
  // 找经济性最优
  const economicBest = [...topSolutions].sort((a, b) => a.totalCost - b.totalCost)[0];
  if (economicBest) {
    const idx = topSolutions.indexOf(economicBest);
    lines.push('### 4.2 经济性最优方案');
    lines.push('');
    lines.push(`**方案${idx + 1}（${getSolutionTypeName(economicBest, idx)}）** 总投资最低（${formatCurrency(economicBest.totalCost)}），适合预算有限的项目。`);
    lines.push('');
  }
  
  // 找可靠性最优
  const reliabilityBest = [...topSolutions].sort((a, b) => b.simulation.reliability - a.simulation.reliability)[0];
  if (reliabilityBest) {
    const idx = topSolutions.indexOf(reliabilityBest);
    lines.push('### 4.3 可靠性最优方案');
    lines.push('');
    lines.push(`**方案${idx + 1}（${getSolutionTypeName(reliabilityBest, idx)}）** 可靠率最高（${reliabilityBest.simulation.reliability.toFixed(2)}%），适合对供电可靠性要求高的场景。`);
    lines.push('');
  }
  
  // 文档信息
  lines.push('---');
  lines.push('');
  lines.push(`**文档版本**：v1.0`);
  lines.push(`**编制日期**：${new Date().toLocaleDateString()}`);
  lines.push(`**适用区域**：${region.name}（${region.type}）`);
  lines.push(`**求解方法**：基于OptimizationEngine.ts的8760小时仿真优化`);
  
  return lines.join('\n');
}

// ============================================
// 辅助函数
// ============================================

function getSolutionTypeName(sol: Solution, idx: number): string {
  const names = [
    '综合最优型', '高可靠型', '经济优先型', '储能优化型', '风电增强型',
    '光伏主导型', '生物质增强型', '平衡配置型', '低成本型', '高冗余型',
    '紧凑配置型', '大容量储能型', '混合风机型', '高效光伏型', '稳定供电型',
    '低风速优化型', '双逆变器型', '多样化生物质型', '平衡投资型', '综合优化型'
  ];
  return names[idx % names.length];
}

function getBiomassEquipmentName(route: string, type: 'primary' | 'secondary'): string {
  if (route === '直燃') {
    return type === 'primary' ? '锅炉' : '汽轮机';
  } else if (route === '气化') {
    return type === 'primary' ? '气化炉' : '燃气发电机';
  } else {
    return type === 'primary' ? '发酵罐' : '沼气发电机';
  }
}

function calculateLCOE(totalCost: number, annualGeneration: number): number {
  // LCOE = (总投资 × (CRF + 运维率)) / 年发电量
  // CRF = 0.08 (资本回收系数), 运维率 = 0.02
  const CRF = 0.08;
  const OMrate = 0.02;
  const annualCost = totalCost * 10000 * (CRF + OMrate); // 万元转元
  return annualCost / (annualGeneration * 1000); // MWh转kWh
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('能源系统优化求解器');
  console.log('='.repeat(60));
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const config: SolverConfig = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--region' && args[i + 1]) {
      config.regionId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--student' && args[i + 1]) {
      config.studentId = args[i + 1];
      i++;
    } else if (args[i] === '--format' && args[i + 1]) {
      config.outputFormat = args[i + 1] as 'console' | 'markdown' | 'json';
      i++;
    } else if (args[i] === '--max' && args[i + 1]) {
      config.maxSolutions = parseInt(args[i + 1]);
      i++;
    }
  }
  
  console.log(`\n配置参数:`);
  console.log(`  区域ID: ${config.regionId}`);
  console.log(`  学号: ${config.studentId || '(未设置)'}`);
  console.log(`  输出格式: ${config.outputFormat}`);
  console.log(`  最大方案数: ${config.maxSolutions}`);
  
  // 设置学号
  if (config.studentId) {
    setCurrentStudentId(config.studentId);
  }
  
  // 生成区域数据
  console.log('\n正在生成区域数据...');
  const cities = generateCities(true);
  const region = cities.find(c => c.id === config.regionId);
  
  if (!region) {
    console.error(`错误: 未找到区域ID ${config.regionId}`);
    console.log(`可用区域: ${cities.map(c => c.id).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`\n目标区域: ${region.name} (${region.type})`);
  console.log(`  日负荷: ${calculateDailyLoad(region).toFixed(0)} MWh`);
  console.log(`  峰值负荷: ${calculatePeakLoad(region).toFixed(1)} MW`);
  console.log(`  日生物质: ${calculateDailyBiomass(region).toFixed(0)} 吨`);
  
  // 进度回调
  const onProgress = (progress: OptimizationProgress) => {
    const percent = ((progress.current / progress.total) * 100).toFixed(1);
    process.stdout.write(`\r优化进度: ${percent}% | ${progress.phase} | 可行方案: ${progress.feasibleCount} | 最优成本: ${progress.bestCost.toFixed(0)}万元`);
  };
  
  // 执行优化
  console.log('\n\n开始优化求解...\n');
  const startTime = Date.now();
  
  const solutions = await findOptimalSolutions(region, onProgress);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log(`\n\n优化完成! 耗时: ${duration}秒, 找到 ${solutions.length} 个可行方案`);
  
  if (solutions.length === 0) {
    console.log('\n警告: 未找到可行方案，请检查区域参数或放宽约束条件');
    process.exit(1);
  }
  
  // 输出结果
  if (config.outputFormat === 'markdown') {
    const report = generateMarkdownReport(region, solutions, config);
    console.log('\n' + '='.repeat(60));
    console.log('Markdown报告:');
    console.log('='.repeat(60) + '\n');
    console.log(report);
  } else if (config.outputFormat === 'json') {
    const jsonOutput = solutions.slice(0, config.maxSolutions).map((sol, idx) => ({
      rank: idx + 1,
      name: getSolutionTypeName(sol, idx),
      score: sol.score.total,
      reliability: sol.simulation.reliability,
      curtailmentRate: sol.simulation.curtailmentRate,
      totalCost: sol.totalCost,
      LCOE: calculateLCOE(sol.totalCost, sol.simulation.totalGeneration),
      capacity: {
        windMW: sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000,
        solarMW: sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000,
        biomassMW: sol.config.biomass.secondary.totalCapacity / 1000,
        batteryMWh: sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000,
      },
      energyRatio: sol.simulation.energyRatio,
    }));
    console.log('\n' + JSON.stringify(jsonOutput, null, 2));
  } else {
    // console格式
    console.log('\n' + '='.repeat(60));
    console.log('求解结果摘要:');
    console.log('='.repeat(60));
    
    solutions.slice(0, config.maxSolutions).forEach((sol, idx) => {
      const windMW = sol.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
      const solarMW = sol.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
      const bioMW = sol.config.biomass.secondary.totalCapacity / 1000;
      const batteryMWh = sol.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
      
      console.log(`\n【方案${idx + 1}】${getSolutionTypeName(sol, idx)}`);
      console.log(`  评分: ${sol.score.total.toFixed(1)}分 | 可靠率: ${sol.simulation.reliability.toFixed(2)}%`);
      console.log(`  风电: ${windMW.toFixed(1)}MW | 光伏: ${solarMW.toFixed(1)}MW | 生物质: ${bioMW.toFixed(2)}MW | 储能: ${batteryMWh.toFixed(1)}MWh`);
      console.log(`  总投资: ${sol.totalCost.toFixed(0)}万元 | LCOE: ${calculateLCOE(sol.totalCost, sol.simulation.totalGeneration).toFixed(3)}元/kWh`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('求解完成');
  console.log('='.repeat(60));
}

// 执行主函数
main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
