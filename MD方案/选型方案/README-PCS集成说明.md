# 储能变流器(PCS)集成说明

## ✅ 已完成的工作

### 1. 设备数据库 ✓
**文件**: `energy-system/src/EquipmentData.ts`

已添加5款PCS设备：
- PCS-30 (30kW, 95%, 科华数据) - 2.5万元
- PCS-100 (100kW, 96%, 阳光电源) - 8万元
- PCS-250 (250kW, 97%, 南瑞继保) - 18万元
- PCS-500 (500kW, 97.5%, 许继电气) - 38万元
- PCS-1000 (1000kW, 98%, 阳光电源) - 72万元

### 2. 选型算法 ✓
**文件**: `energy-system/src/OptimizationEngine.ts`

新增函数：
```typescript
export function selectPCS(
  batteryMWh: number,
  dischargeHours: number = 2,
  batteryVoltage?: number
): EquipmentSelection[]
```

**选型逻辑**：
1. 根据电池容量和放电时长计算所需功率
2. 可选：根据电池电压筛选匹配的PCS
3. 综合评分（容量40% + 效率30% + 经济性30%）
4. 自动确定最优型号和数量

### 3. 数据结构更新 ✓
**文件**: `energy-system/src/OptimizationEngine.ts`

#### EquipmentConfig接口
```typescript
export interface EquipmentConfig {
  wind: EquipmentSelection[];
  solar: EquipmentSelection[];
  biomass: BiomassEquipmentSelection;
  battery: EquipmentSelection[];
  inverter: EquipmentSelection[];
  pcs: EquipmentSelection[];  // ✓ 新增
}
```

#### StudentConfig接口
```typescript
export interface StudentConfig {
  // ... 其他字段
  pcs?: { model: string; count: number }[];  // ✓ 新增（可选）
}
```

### 4. 成本计算集成 ✓
**文件**: `energy-system/src/OptimizationEngine.ts`

```typescript
export function calculateTotalCost(config: EquipmentConfig): number {
  let total = 0;
  // ... 其他设备成本
  config.pcs.forEach(p => total += p.totalPrice);  // ✓ 新增
  return Math.round(total * 100) / 100;
}
```

### 5. 优化引擎集成 ✓
**文件**: `energy-system/src/OptimizationEngine.ts`

在3个关键位置添加了PCS选型：
1. **预计算方案加载** (第1597行)
2. **智能搜索算法** (第1861行)
3. **暴力搜索算法** (第2796行)

所有生成的配置都会自动包含PCS选型。

### 6. 文档完善 ✓
**文件**: `MD方案/选型方案/`

创建了3个文档：
1. **储能变流器选型方法.md** - 完整的选型理论和方法
2. **PCS选型示例.md** - 代码使用示例和实际案例
3. **README-PCS集成说明.md** - 本文档

---

## 📋 使用指南

### 方法1：自动选型（推荐）
系统会根据电池容量自动选择最优PCS：

```typescript
// 在优化引擎中自动调用
const config: EquipmentConfig = {
  // ... 其他设备
  battery: selectBatteries(batteryMWh),
  pcs: selectPCS(batteryMWh, 2)  // 自动选型
};
```

### 方法2：手动配置
学生可以在方案中手动指定PCS：

```typescript
const studentConfig: StudentConfig = {
  // ... 其他配置
  battery: [{ model: 'BAT-200L', count: 50 }],
  pcs: [{ model: 'PCS-250', count: 2 }]  // 手动指定
};
```

---

## 🔍 验证方法

### 1. 检查设备数据
```typescript
import { PCS_UNITS } from './EquipmentData';
console.log(PCS_UNITS);
```

### 2. 测试选型函数
```typescript
import { selectPCS } from './OptimizationEngine';

// 测试：100kWh电池，2小时放电
const result = selectPCS(0.1, 2);
console.log(result);
// 预期：选择PCS-30或PCS-100
```

### 3. 检查完整配置
```typescript
import { getOptimalSolution } from './OptimizationEngine';

const solution = getOptimalSolution(region);
console.log(solution.config.pcs);
// 应该包含PCS配置
```

---

## 📊 PCS在系统中的作用

### 1. 充放电控制
- **充电**：新能源盈余时，通过PCS给电池充电
- **放电**：新能源不足时，通过PCS从电池放电

### 2. 能量损耗
PCS充放电效率影响系统往返效率：
- 充电损耗：$E_{loss} = E_{charge} \times (1 - \eta_{PCS})$
- 放电损耗：$E_{loss} = E_{discharge} \times (1 - \eta_{PCS})$
- 往返效率：$\eta_{round} = \eta_{charge} \times \eta_{battery} \times \eta_{discharge}$

### 3. 成本影响
PCS成本占储能系统总成本的10-15%：
- 小型系统（<100kW）：约占15%
- 中型系统（100-500kW）：约占12%
- 大型系统（>500kW）：约占10%

---

## 🎯 选型示例

### 示例1：小型系统
- 电池：50kWh
- 放电时长：2h
- 所需功率：25kW
- **选择**：PCS-30 × 1台
- 成本：2.5万元

### 示例2：中型系统
- 电池：200kWh
- 放电时长：2h
- 所需功率：100kW
- **选择**：PCS-100 × 1台
- 成本：8万元

### 示例3：大型系统
- 电池：1000kWh
- 放电时长：2h
- 所需功率：500kW
- **选择**：PCS-500 × 1台 或 PCS-250 × 2台
- 成本：38万元 或 36万元（推荐）

---

## ⚠️ 注意事项

### 1. 功率匹配
- PCS功率应≥最大充放电功率
- 建议留10-20%裕度
- 考虑未来扩容

### 2. 电压匹配
- 电池电压应在PCS工作范围内
- 考虑充满/放空时的电压变化
- 留10-15%电压裕度

### 3. 效率优化
- 优先选择高效率PCS
- 效率每提高1%，年损耗减少数千度电
- 高效率PCS虽贵但长期更经济

### 4. 冗余配置
- 关键系统建议N+1冗余
- 多台小功率PCS比单台大功率更可靠
- 单台故障不影响整体运行

---

## 📈 后续优化建议

### 1. 充放电策略优化
可以在仿真引擎中考虑PCS的实际效率：
```typescript
// 充电时考虑PCS效率
batteryCharge = excessPower * pcsEfficiency;

// 放电时考虑PCS效率
batteryDischarge = shortage / pcsEfficiency;
```

### 2. 电压匹配优化
可以根据电池配置自动计算电池电压：
```typescript
const batteryVoltage = calculateBatteryVoltage(batteryConfig);
const pcs = selectPCS(batteryMWh, 2, batteryVoltage);
```

### 3. 动态功率调节
可以根据实际负荷动态调整PCS功率：
```typescript
const actualPower = Math.min(pcsPower, batterySOC * maxDischargeRate);
```

---

## ✅ 集成完成清单

- [x] PCS设备数据库（5款设备）
- [x] PCS选型算法（智能评分）
- [x] EquipmentConfig接口更新
- [x] StudentConfig接口更新
- [x] 成本计算集成
- [x] 优化引擎集成（3处）
- [x] 选型方法文档
- [x] 代码使用示例
- [x] 集成说明文档

---

## 📞 技术支持

如有问题，请参考：
1. `储能变流器选型方法.md` - 理论和方法
2. `PCS选型示例.md` - 代码示例
3. `energy-system/src/OptimizationEngine.ts` - 源代码

---

## 🎉 总结

储能变流器(PCS)已完全集成到能源系统优化方案中！

**核心特性**：
- ✅ 自动选型，无需手动配置
- ✅ 智能评分，选择最优方案
- ✅ 成本计入，准确核算
- ✅ 灵活配置，支持手动指定
- ✅ 完整文档，易于使用

**使用方式**：
- 系统会自动为每个方案选择合适的PCS
- 学生也可以手动指定PCS配置
- PCS成本会自动计入总成本
- 所有优化算法都已集成PCS选型

现在，能源系统优化方案已经包含完整的储能变流器选型功能！🚀
