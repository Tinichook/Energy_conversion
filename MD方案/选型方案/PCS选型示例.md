# PCS选型示例与代码使用

## 1. 代码中的PCS选型函数

### 1.1 函数签名
```typescript
export function selectPCS(
  batteryMWh: number,        // 电池容量 (MWh)
  dischargeHours: number = 2, // 期望放电时长 (小时)，默认2小时
  batteryVoltage?: number     // 电池组电压 (V)，可选
): EquipmentSelection[]
```

### 1.2 使用示例

#### 示例1：基础使用（只提供电池容量）
```typescript
import { selectPCS } from './OptimizationEngine';

// 电池容量100kWh，默认2小时放电
const pcsConfig = selectPCS(0.1); // 0.1 MWh = 100 kWh

console.log(pcsConfig);
// 输出：
// [{
//   model: 'PCS-100',
//   manufacturer: '阳光电源',
//   count: 1,
//   unitCapacity: 100,
//   totalCapacity: 100,
//   unitPrice: 8,
//   totalPrice: 8
// }]
```

#### 示例2：指定放电时长
```typescript
// 电池容量200kWh，期望4小时放电
const pcsConfig = selectPCS(0.2, 4);

// 计算：200kWh / 4h = 50kW
// 选择：PCS-30 (30kW) × 2台 = 60kW
```

#### 示例3：指定电池电压
```typescript
// 电池容量500kWh，2小时放电，电池电压600V
const pcsConfig = selectPCS(0.5, 2, 600);

// 计算：500kWh / 2h = 250kW
// 筛选：电压范围包含600V的PCS
// 选择：PCS-250 (500-900V) × 1台
```

---

## 2. 在优化方案中的集成

### 2.1 自动选型
在优化引擎中，PCS会根据电池容量自动选型：

```typescript
const config: EquipmentConfig = {
  wind: selectWindTurbines(windMW),
  solar: selectSolarPanels(solarMW),
  biomass: selectBiomassEquipment(biomassMW, route),
  battery: selectBatteries(batteryMWh),
  inverter: selectInverters(solarMW, regionType),
  pcs: selectPCS(batteryMWh, 2)  // 自动选择PCS
};
```

### 2.2 成本计算
PCS成本会自动计入总成本：

```typescript
export function calculateTotalCost(config: EquipmentConfig): number {
  let total = 0;
  
  config.wind.forEach(w => total += w.totalPrice);
  config.solar.forEach(s => total += s.totalPrice);
  total += config.biomass.primary.totalPrice;
  total += config.biomass.secondary.totalPrice;
  config.battery.forEach(b => total += b.totalPrice);
  config.inverter.forEach(i => total += i.totalPrice);
  config.pcs.forEach(p => total += p.totalPrice);  // PCS成本
  
  return Math.round(total * 100) / 100;
}
```

---

## 3. 学生方案中的PCS配置

### 3.1 StudentConfig接口
```typescript
export interface StudentConfig {
  regionId: number;
  wind: { model: string; count: number }[];
  solar: { model: string; count: number }[];
  biomassRoute: BiomassRoute;
  biomassPrimary: { model: string; count: number };
  biomassSecondary: { model: string; count: number };
  battery: { model: string; count: number }[];
  inverter: { model: string; count: number }[];
  pcs?: { model: string; count: number }[];  // PCS配置（可选）
}
```

### 3.2 配置示例
```typescript
const studentConfig: StudentConfig = {
  regionId: 1,
  wind: [{ model: 'GW121/2500', count: 2 }],
  solar: [{ model: 'Tiger Neo 545N', count: 1000 }],
  biomassRoute: '直燃',
  biomassPrimary: { model: 'CFB-75', count: 1 },
  biomassSecondary: { model: 'ST-25', count: 1 },
  battery: [{ model: 'BAT-200L', count: 50 }],
  inverter: [{ model: 'INV-50K', count: 10 }],
  pcs: [{ model: 'PCS-250', count: 2 }]  // 添加PCS配置
};
```

---

## 4. PCS选型算法说明

### 4.1 选型流程
```
1. 计算所需功率：P = E / t
   ├─ E: 电池容量 (kWh)
   └─ t: 放电时长 (h)

2. 电压筛选（如果提供）
   ├─ 筛选电压范围匹配的PCS
   └─ 如果无匹配，使用全部候选

3. 功率筛选
   └─ 筛选功率 ≥ 80% 需求的PCS

4. 综合评分
   ├─ 容量匹配度 (40%)
   ├─ 效率 (30%)
   └─ 经济性 (30%)

5. 确定数量
   └─ 数量 = ⌈需求功率 / 单台功率⌉
```

### 4.2 评分公式

#### 容量匹配度
$$S_{capacity} = 1 - \frac{|P_{PCS} - P_{需求}|}{P_{需求}}$$

#### 效率得分
$$S_{efficiency} = \frac{\eta - 90}{10}$$

#### 经济性得分
$$S_{economy} = 1 - \frac{Price/P_{PCS} - Price_{min}/P_{min}}{Price_{max}/P_{max} - Price_{min}/P_{min}}$$

#### 综合得分
$$Score = 0.4 \times S_{capacity} + 0.3 \times S_{efficiency} + 0.3 \times S_{economy}$$

---

## 5. 实际应用案例

### 案例1：工业区储能系统
**需求**：
- 区域：工业区
- 峰值负荷：65MW
- 电池容量：200MWh
- 期望放电时长：2小时

**代码**：
```typescript
const pcsConfig = selectPCS(200, 2);
```

**结果**：
- 所需功率：200MWh / 2h = 100MW = 100,000kW
- 选择方案：PCS-1000 × 100台
- 总功率：100,000kW
- 总价格：7200万元

---

### 案例2：居民区储能系统
**需求**：
- 区域：居民区
- 峰值负荷：35MW
- 电池容量：100MWh
- 期望放电时长：3小时

**代码**：
```typescript
const pcsConfig = selectPCS(100, 3);
```

**结果**：
- 所需功率：100MWh / 3h ≈ 33.3MW = 33,333kW
- 选择方案：PCS-1000 × 34台
- 总功率：34,000kW
- 总价格：2448万元

---

### 案例3：山地区小型储能
**需求**：
- 区域：山地区
- 峰值负荷：8MW
- 电池容量：20MWh
- 期望放电时长：2.5小时

**代码**：
```typescript
const pcsConfig = selectPCS(20, 2.5);
```

**结果**：
- 所需功率：20MWh / 2.5h = 8MW = 8,000kW
- 选择方案：PCS-250 × 32台
- 总功率：8,000kW
- 总价格：576万元

---

## 6. 注意事项

### 6.1 功率匹配
- PCS功率应略大于或等于最大充放电功率
- 建议留10-20%的功率裕度
- 考虑未来扩容需求

### 6.2 电压匹配
- 如果提供电池电压，系统会自动筛选匹配的PCS
- 电池电压应在PCS的工作范围内
- 考虑电池充满和放空时的电压变化

### 6.3 数量优化
- 系统会自动选择最优的PCS型号和数量
- 优先选择大功率PCS减少设备数量
- 在满足需求的前提下控制成本

### 6.4 效率考虑
- PCS效率影响系统往返效率
- 高效率PCS可减少能量损耗
- 效率每提高1%，年损耗可减少数千度电

---

## 7. 常见问题

### Q1: 为什么选择的PCS功率大于计算值？
A: 系统会选择略大于需求的PCS，留有功率裕度，确保系统稳定运行。

### Q2: 可以手动指定PCS型号吗？
A: 可以，在StudentConfig中直接指定pcs字段即可。

### Q3: PCS成本如何计算？
A: PCS成本 = 单台价格 × 数量，会自动计入系统总成本。

### Q4: 如何选择放电时长？
A: 
- 基荷储能：4-6小时
- 调峰储能：2-3小时
- 调频储能：0.5-1小时
- 应急备用：1-2小时

### Q5: PCS与逆变器有什么区别？
A:
- **逆变器**：单向，DC→AC，用于光伏发电
- **PCS**：双向，DC↔AC，用于储能充放电

---

## 8. 总结

PCS选型已完全集成到优化系统中：
- ✅ 自动根据电池容量选型
- ✅ 考虑功率、电压、效率、经济性
- ✅ 自动计入总成本
- ✅ 支持学生手动配置
- ✅ 提供完整的选型算法和评分机制

使用时只需调用`selectPCS()`函数，系统会自动完成最优选型！
