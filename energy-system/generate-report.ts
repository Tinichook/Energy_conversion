import * as fs from 'fs';
import * as path from 'path';

// 读取JSON文件
const jsonPath = path.join(__dirname, '../MD方案/所有区域最优解 (2).json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

interface Solution {
  id: string;
  regionId: number;
  regionName: string;
  regionType: string;
  totalCost: number;
  config: {
    wind: Array<{ model: string; count: number; totalCapacity: number; totalPrice: number }>;
    solar: Array<{ model: string; count: number; totalCapacity: number; totalPrice: number }>;
    biomass: { route: string; primary: any; secondary: any };
    battery: Array<{ model: string; count: number; totalCapacity: number; totalPrice: number }>;
    inverter: Array<{ model: string; count: number; totalCapacity: number; totalPrice: number }>;
    pcs: Array<{ model: string; count: number; totalCapacity: number; totalPrice: number }>;
  };
  simResult: {
    reliability: number;
    curtailmentRate: number;
    totalGeneration: number;
    totalLoad: number;
    windGeneration: number;
    solarGeneration: number;
    biomassGeneration: number;
    energyRatio: { wind: number; solar: number; bio: number; total: number };
  };
}

// 生成报告
let report = `# 所有区域最优解报告

> 生成时间: ${new Date().toLocaleString('zh-CN')}

## 概览

`;

const regions = data.regions as Record<string, Solution[]>;
const regionIds = Object.keys(regions).sort((a, b) => parseInt(a) - parseInt(b));

// 统计信息
let totalRegions = 0;
let totalSolutions = 0;
let minCost = Infinity;
let maxCost = 0;
let avgCost = 0;
let costSum = 0;

const summaryData: Array<{
  regionId: number;
  regionName: string;
  regionType: string;
  solutionCount: number;
  bestCost: number;
  bestReliability: number;
  bestCurtailment: number;
  windMW: number;
  solarMW: number;
  bioMW: number;
  batteryMWh: number;
}> = [];

for (const regionId of regionIds) {
  const solutions = regions[regionId];
  if (!solutions || solutions.length === 0) continue;
  
  totalRegions++;
  totalSolutions += solutions.length;
  
  // 找最优方案（成本最低）
  const best = solutions.reduce((a, b) => a.totalCost < b.totalCost ? a : b);
  
  if (best.totalCost < minCost) minCost = best.totalCost;
  if (best.totalCost > maxCost) maxCost = best.totalCost;
  costSum += best.totalCost;
  
  const windMW = best.config.wind.reduce((s, w) => s + w.totalCapacity, 0) / 1000;
  const solarMW = best.config.solar.reduce((s, p) => s + p.totalCapacity, 0) / 1000;
  const bioMW = (best.config.biomass.secondary?.totalCapacity || 0) / 1000;
  const batteryMWh = best.config.battery.reduce((s, b) => s + b.totalCapacity, 0) / 1000;
  
  summaryData.push({
    regionId: parseInt(regionId),
    regionName: best.regionName,
    regionType: best.regionType,
    solutionCount: solutions.length,
    bestCost: best.totalCost,
    bestReliability: best.simResult.reliability,
    bestCurtailment: best.simResult.curtailmentRate,
    windMW,
    solarMW,
    bioMW,
    batteryMWh,
  });
}

avgCost = costSum / totalRegions;

report += `- 区域总数: **${totalRegions}** 个
- 方案总数: **${totalSolutions}** 个
- 最低投资: **${minCost.toFixed(0)}** 万元
- 最高投资: **${maxCost.toFixed(0)}** 万元
- 平均投资: **${avgCost.toFixed(0)}** 万元

---

## 各区域最优方案汇总

| 区域 | 类型 | 方案数 | 最优投资(万元) | 可靠率 | 弃电率 | 风电(MW) | 光伏(MW) | 生物质(MW) | 储能(MWh) |
|:----:|:----:|:------:|:--------------:|:------:|:------:|:--------:|:--------:|:----------:|:---------:|
`;

for (const item of summaryData) {
  report += `| ${item.regionName} | ${item.regionType} | ${item.solutionCount} | ${item.bestCost.toFixed(0)} | ${item.bestReliability.toFixed(1)}% | ${item.bestCurtailment.toFixed(1)}% | ${item.windMW.toFixed(1)} | ${item.solarMW.toFixed(1)} | ${item.bioMW.toFixed(1)} | ${item.batteryMWh.toFixed(0)} |\n`;
}

report += `
---

## 各区域详细方案

`;

// 按区域类型分组
const typeGroups: Record<string, typeof summaryData> = {};
for (const item of summaryData) {
  if (!typeGroups[item.regionType]) typeGroups[item.regionType] = [];
  typeGroups[item.regionType].push(item);
}

for (const [type, items] of Object.entries(typeGroups)) {
  report += `### ${type}\n\n`;
  
  for (const item of items) {
    const solutions = regions[item.regionId.toString()];
    const best = solutions.reduce((a, b) => a.totalCost < b.totalCost ? a : b);
    
    report += `#### ${item.regionName}\n\n`;
    report += `**基本信息**\n`;
    report += `- 区域类型: ${item.regionType}\n`;
    report += `- 可行方案数: ${item.solutionCount}\n`;
    report += `- 最优投资: ¥${item.bestCost.toFixed(0)}万元\n\n`;
    
    report += `**设备配置**\n\n`;
    report += `| 设备类型 | 型号 | 数量 | 容量 | 投资(万元) |\n`;
    report += `|:--------:|:----:|:----:|:----:|:----------:|\n`;
    
    // 风机
    for (const w of best.config.wind) {
      report += `| 风机 | ${w.model} | ${w.count}台 | ${(w.totalCapacity/1000).toFixed(1)}MW | ${w.totalPrice.toFixed(0)} |\n`;
    }
    // 光伏
    for (const s of best.config.solar) {
      report += `| 光伏 | ${s.model} | ${s.count}块 | ${(s.totalCapacity/1000).toFixed(1)}MW | ${s.totalPrice.toFixed(0)} |\n`;
    }
    // 生物质
    if (best.config.biomass.primary) {
      report += `| 生物质(${best.config.biomass.route}) | ${best.config.biomass.secondary?.model || '-'} | ${best.config.biomass.secondary?.count || 0}台 | ${((best.config.biomass.secondary?.totalCapacity || 0)/1000).toFixed(1)}MW | - |\n`;
    }
    // 储能
    for (const b of best.config.battery) {
      report += `| 储能电池 | ${b.model} | ${b.count}组 | ${(b.totalCapacity/1000).toFixed(1)}MWh | ${b.totalPrice.toFixed(0)} |\n`;
    }
    // 逆变器
    const invMerged: Record<string, { count: number; capacity: number; price: number }> = {};
    for (const inv of best.config.inverter) {
      if (!invMerged[inv.model]) invMerged[inv.model] = { count: 0, capacity: 0, price: 0 };
      invMerged[inv.model].count += inv.count;
      invMerged[inv.model].capacity += inv.totalCapacity;
      invMerged[inv.model].price += inv.totalPrice;
    }
    for (const [model, inv] of Object.entries(invMerged)) {
      report += `| 逆变器 | ${model} | ${inv.count}台 | ${(inv.capacity/1000).toFixed(1)}MW | ${inv.price.toFixed(0)} |\n`;
    }
    // PCS
    for (const p of best.config.pcs) {
      report += `| 变流器(PCS) | ${p.model} | ${p.count}台 | ${(p.totalCapacity/1000).toFixed(1)}MW | ${p.totalPrice.toFixed(0)} |\n`;
    }
    
    report += `\n**仿真结果**\n`;
    report += `- 供电可靠率: ${best.simResult.reliability.toFixed(1)}%\n`;
    report += `- 弃电率: ${best.simResult.curtailmentRate.toFixed(1)}%\n`;
    report += `- 年发电量: ${(best.simResult.totalGeneration/1000).toFixed(0)} GWh\n`;
    report += `- 年用电量: ${(best.simResult.totalLoad/1000).toFixed(0)} GWh\n`;
    report += `- 能源占比: 风电 ${(best.simResult.energyRatio.wind*100).toFixed(1)}% / 光伏 ${(best.simResult.energyRatio.solar*100).toFixed(1)}% / 生物质 ${(best.simResult.energyRatio.bio*100).toFixed(1)}%\n\n`;
    
    report += `---\n\n`;
  }
}

// 写入文件
const outputPath = path.join(__dirname, '../MD方案/所有区域最优解报告.md');
fs.writeFileSync(outputPath, report, 'utf-8');
console.log(`报告已生成: ${outputPath}`);
