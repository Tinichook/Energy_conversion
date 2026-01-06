// ============================================
// 能源系统设备数据库
// 包含太阳能、风机、生物质、蓄电池、系统设备
// ============================================

// --- 太阳能光伏组件 ---
export interface SolarPanelSpec {
  id: string;
  model: string;           // 型号
  manufacturer: string;    // 制造商
  type: '单晶硅' | '多晶硅' | '薄膜';
  // 基本参数
  power: number;           // 标称功率 Wp
  efficiency: number;      // 转换效率 %
  // 尺寸参数
  length: number;          // 长度 mm
  width: number;           // 宽度 mm
  thickness: number;       // 厚度 mm
  weight: number;          // 重量 kg
  // STC条件参数 (1000W/m², 25°C, AM1.5)
  Voc: number;             // 开路电压 V
  Isc: number;             // 短路电流 A
  Vmp: number;             // 最大功率点电压 V
  Imp: number;             // 最大功率点电流 A
  // 温度系数
  tempCoeffPmax: number;   // 功率温度系数 %/°C
  tempCoeffVoc: number;    // 电压温度系数 %/°C
  tempCoeffIsc: number;    // 电流温度系数 %/°C
  // 电气参数
  maxSystemVoltage: number; // 最大系统电压 V
  cellsPerModule: number;   // 电池片数量
  // 机械参数
  windLoad: number;        // 抗风压 Pa
  snowLoad: number;        // 抗雪压 Pa
  // 质保
  warrantyYears: number;   // 质保年限
  degradationYear1: number; // 首年衰减 %
  degradationAnnual: number; // 年衰减 %
  // 价格
  price: number;           // 参考价格 元
  pricePerWatt: number;    // 单瓦价格 元/W
}

export const SOLAR_PANELS: SolarPanelSpec[] = [
  {
    // 隆基Hi-MO 5 LR5-54HTH-410M 参考规格
    id: 'PV-410M',
    model: 'Hi-MO 5 410M',
    manufacturer: '隆基绿能',
    type: '单晶硅',
    power: 410,
    efficiency: 21.1,
    length: 1722, width: 1134, thickness: 30, weight: 21.5,
    Voc: 37.2, Isc: 13.96, Vmp: 31.0, Imp: 13.23,
    tempCoeffPmax: -0.34, tempCoeffVoc: -0.25, tempCoeffIsc: 0.045,
    maxSystemVoltage: 1500, cellsPerModule: 108,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 2, degradationAnnual: 0.45,
    price: 780, pricePerWatt: 1.90
  },
  {
    // 天合Vertex S TSM-DE09.08 430W 参考规格
    id: 'PV-430M',
    model: 'Vertex S 430M',
    manufacturer: '天合光能',
    type: '单晶硅',
    power: 430,
    efficiency: 21.3,
    length: 1762, width: 1134, thickness: 30, weight: 22,
    Voc: 38.8, Isc: 14.04, Vmp: 32.4, Imp: 13.27,
    tempCoeffPmax: -0.34, tempCoeffVoc: -0.24, tempCoeffIsc: 0.045,
    maxSystemVoltage: 1500, cellsPerModule: 108,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 2, degradationAnnual: 0.45,
    price: 820, pricePerWatt: 1.91
  },
  {
    // 晶科Tiger Neo JKM545N-72HL4 参考规格
    id: 'PV-545N',
    model: 'Tiger Neo 545N',
    manufacturer: '晶科能源',
    type: '单晶硅',
    power: 545,
    efficiency: 21.28,
    length: 2274, width: 1134, thickness: 30, weight: 28.1,
    Voc: 49.62, Isc: 13.98, Vmp: 41.58, Imp: 13.11,
    tempCoeffPmax: -0.30, tempCoeffVoc: -0.24, tempCoeffIsc: 0.045,
    maxSystemVoltage: 1500, cellsPerModule: 144,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 1, degradationAnnual: 0.40,
    price: 980, pricePerWatt: 1.80
  },
  {
    // 晶澳DeepBlue 3.0 JAM72S30-550/MR 参考规格
    id: 'PV-550M',
    model: 'DeepBlue 3.0 550M',
    manufacturer: '晶澳科技',
    type: '单晶硅',
    power: 550,
    efficiency: 21.3,
    length: 2278, width: 1134, thickness: 35, weight: 28.6,
    Voc: 49.65, Isc: 14.03, Vmp: 41.80, Imp: 13.16,
    tempCoeffPmax: -0.35, tempCoeffVoc: -0.25, tempCoeffIsc: 0.048,
    maxSystemVoltage: 1500, cellsPerModule: 144,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 1, degradationAnnual: 0.40,
    price: 990, pricePerWatt: 1.80
  },
  {
    // 通威TW-SF210R-66H 660W 参考规格
    id: 'PV-660M',
    model: 'TW-SF 660M',
    manufacturer: '通威太阳能',
    type: '单晶硅',
    power: 660,
    efficiency: 21.6,
    length: 2384, width: 1303, thickness: 35, weight: 34.5,
    Voc: 45.20, Isc: 18.65, Vmp: 37.80, Imp: 17.46,
    tempCoeffPmax: -0.29, tempCoeffVoc: -0.24, tempCoeffIsc: 0.045,
    maxSystemVoltage: 1500, cellsPerModule: 132,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 1, degradationAnnual: 0.40,
    price: 1150, pricePerWatt: 1.74
  },
  {
    // 协鑫多晶组件 参考规格
    id: 'PV-275P',
    model: 'GCL-P6/60 275P',
    manufacturer: '协鑫集成',
    type: '多晶硅',
    power: 275,
    efficiency: 16.9,
    length: 1650, width: 992, thickness: 35, weight: 18.5,
    Voc: 38.4, Isc: 9.15, Vmp: 31.2, Imp: 8.82,
    tempCoeffPmax: -0.40, tempCoeffVoc: -0.30, tempCoeffIsc: 0.05,
    maxSystemVoltage: 1000, cellsPerModule: 60,
    windLoad: 2400, snowLoad: 5400,
    warrantyYears: 25, degradationYear1: 2.5, degradationAnnual: 0.6,
    price: 440, pricePerWatt: 1.60
  }
];

// --- 风力发电机组 ---
export interface WindTurbineSpec {
  id: string;
  model: string;
  manufacturer: string;
  // 基本参数
  ratedPower: number;      // 额定功率 kW
  cutInSpeed: number;      // 切入风速 m/s
  ratedSpeed: number;      // 额定风速 m/s
  cutOutSpeed: number;     // 切出风速 m/s
  survivalSpeed: number;   // 生存风速 m/s
  // 叶轮参数
  rotorDiameter: number;   // 叶轮直径 m
  sweptArea: number;       // 扫风面积 m²
  bladeCount: number;      // 叶片数量
  bladeMaterial: string;   // 叶片材料
  // 塔架参数
  hubHeight: number;       // 轮毂高度 m
  towerType: string;       // 塔架类型
  // 发电机参数
  generatorType: string;   // 发电机类型
  outputVoltage: number;   // 输出电压 V
  frequency: number;       // 频率 Hz
  // 控制系统
  pitchControl: string;    // 变桨方式
  yawControl: string;      // 偏航方式
  // 性能参数
  annualOutput: number;    // 年发电量估算 MWh (按2000h)
  capacityFactor: number;  // 容量因子 %
  designLife: number;      // 设计寿命 年
  // 价格
  price: number;           // 参考价格 万元
  pricePerKW: number;      // 单位功率价格 万元/kW
}

export const WIND_TURBINES: WindTurbineSpec[] = [
  {
    // 小型风机 - 通用规格（非特定品牌）
    id: 'WT-3',
    model: 'SWT-3kW',
    manufacturer: '通用小型风机',
    ratedPower: 3,
    cutInSpeed: 2.5, ratedSpeed: 9, cutOutSpeed: 25, survivalSpeed: 45,
    rotorDiameter: 3.2, sweptArea: 8.0, bladeCount: 3, bladeMaterial: '玻璃钢',
    hubHeight: 8, towerType: '钢管塔',
    generatorType: '永磁同步', outputVoltage: 220, frequency: 50,
    pitchControl: '定桨距', yawControl: '被动偏航',
    annualOutput: 5, capacityFactor: 19, designLife: 15,
    price: 1.8, pricePerKW: 0.60
  },
  {
    // 小型风机 - 通用规格
    id: 'WT-10',
    model: 'SWT-10kW',
    manufacturer: '通用小型风机',
    ratedPower: 10,
    cutInSpeed: 3.0, ratedSpeed: 10, cutOutSpeed: 25, survivalSpeed: 50,
    rotorDiameter: 7.0, sweptArea: 38.5, bladeCount: 3, bladeMaterial: '玻璃钢',
    hubHeight: 12, towerType: '钢管塔',
    generatorType: '永磁同步', outputVoltage: 380, frequency: 50,
    pitchControl: '定桨距', yawControl: '被动偏航',
    annualOutput: 18, capacityFactor: 21, designLife: 15,
    price: 5, pricePerKW: 0.50
  },
  {
    // 中小型风机 - 通用规格
    id: 'WT-50',
    model: 'MWT-50kW',
    manufacturer: '通用中型风机',
    ratedPower: 50,
    cutInSpeed: 3.0, ratedSpeed: 11, cutOutSpeed: 25, survivalSpeed: 55,
    rotorDiameter: 15, sweptArea: 177, bladeCount: 3, bladeMaterial: '玻璃钢复合材料',
    hubHeight: 24, towerType: '钢管塔',
    generatorType: '永磁同步', outputVoltage: 380, frequency: 50,
    pitchControl: '电动变桨', yawControl: '主动偏航',
    annualOutput: 100, capacityFactor: 23, designLife: 20,
    price: 20, pricePerKW: 0.40
  },
  {
    // 金风GW87-1500 参考规格（真实产品）
    id: 'WT-1500',
    model: 'GW87/1500',
    manufacturer: '金风科技',
    ratedPower: 1500,
    cutInSpeed: 3.0, ratedSpeed: 11, cutOutSpeed: 25, survivalSpeed: 59.5,
    rotorDiameter: 87, sweptArea: 5945, bladeCount: 3, bladeMaterial: '玻璃钢/碳纤维复合',
    hubHeight: 65, towerType: '钢管塔',
    generatorType: '永磁直驱', outputVoltage: 690, frequency: 50,
    pitchControl: '独立变桨', yawControl: '主动偏航',
    annualOutput: 3200, capacityFactor: 24, designLife: 20,
    price: 520, pricePerKW: 0.35
  },
  {
    // 金风GW121-2500 参考规格（真实产品）
    id: 'WT-2500',
    model: 'GW121/2500',
    manufacturer: '金风科技',
    ratedPower: 2500,
    cutInSpeed: 3.0, ratedSpeed: 10.5, cutOutSpeed: 25, survivalSpeed: 59.5,
    rotorDiameter: 121, sweptArea: 11499, bladeCount: 3, bladeMaterial: '碳纤维复合材料',
    hubHeight: 90, towerType: '钢管塔/混凝土塔',
    generatorType: '永磁直驱', outputVoltage: 690, frequency: 50,
    pitchControl: '独立变桨', yawControl: '主动偏航',
    annualOutput: 5800, capacityFactor: 26, designLife: 25,
    price: 850, pricePerKW: 0.34
  },
  {
    // 明阳MySE3.0-135 参考规格（真实产品）
    id: 'WT-3000',
    model: 'MySE3.0-135',
    manufacturer: '明阳智能',
    ratedPower: 3000,
    cutInSpeed: 3.0, ratedSpeed: 10.5, cutOutSpeed: 25, survivalSpeed: 59.5,
    rotorDiameter: 135, sweptArea: 14314, bladeCount: 3, bladeMaterial: '碳纤维复合材料',
    hubHeight: 90, towerType: '钢管塔/混凝土塔',
    generatorType: '半直驱', outputVoltage: 690, frequency: 50,
    pitchControl: '独立变桨', yawControl: '主动偏航',
    annualOutput: 7000, capacityFactor: 27, designLife: 25,
    price: 1000, pricePerKW: 0.33
  },
  {
    // 远景EN-141/3.6 参考规格（真实产品）
    id: 'WT-3600',
    model: 'EN-141/3.6',
    manufacturer: '远景能源',
    ratedPower: 3600,
    cutInSpeed: 3.0, ratedSpeed: 10, cutOutSpeed: 25, survivalSpeed: 59.5,
    rotorDiameter: 141, sweptArea: 15615, bladeCount: 3, bladeMaterial: '碳纤维复合材料',
    hubHeight: 100, towerType: '混凝土-钢混合塔',
    generatorType: '永磁直驱', outputVoltage: 690, frequency: 50,
    pitchControl: '独立变桨', yawControl: '主动偏航',
    annualOutput: 8500, capacityFactor: 27, designLife: 25,
    price: 1200, pricePerKW: 0.33
  }
];

// --- 生物质发电设备 ---

// 直燃锅炉
export interface DirectCombustionBoilerSpec {
  id: string;
  model: string;
  manufacturer: string;
  type: '循环流化床' | '炉排炉';
  // 基本参数
  steamCapacity: number;   // 蒸发量 t/h
  steamPressure: number;   // 蒸汽压力 MPa
  steamTemp: number;       // 蒸汽温度 °C
  fuelConsumption: number; // 燃料消耗 t/h
  efficiency: number;      // 锅炉效率 %
  // 适用燃料
  suitableFuels: string[];
  fuelMoistureMax: number; // 最大燃料含水率 %
  // 尺寸参数
  length: number;          // 长度 m
  width: number;           // 宽度 m
  height: number;          // 高度 m
  // 环保参数
  dustEmission: number;    // 烟尘排放 mg/Nm³
  SO2Emission: number;     // SO2排放 mg/Nm³
  NOxEmission: number;     // NOx排放 mg/Nm³
  // 价格
  price: number;           // 设备价格 万元（直燃发电设为0）
  processingCost: number;  // 燃料处理成本 元/吨
}

export const DIRECT_COMBUSTION_BOILERS: DirectCombustionBoilerSpec[] = [
  {
    id: 'GF-20',
    model: 'GF-20',
    manufacturer: '杭州锅炉',
    type: '炉排炉',
    steamCapacity: 20, steamPressure: 2.5, steamTemp: 400, fuelConsumption: 9, efficiency: 82,
    suitableFuels: ['木屑', '树皮', '木片'],
    fuelMoistureMax: 45,
    length: 8, width: 4, height: 10,
    dustEmission: 30, SO2Emission: 100, NOxEmission: 200,
    price: 0, processingCost: 150
  },
  {
    id: 'GF-50',
    model: 'GF-50',
    manufacturer: '无锡华光',
    type: '炉排炉',
    steamCapacity: 50, steamPressure: 3.82, steamTemp: 450, fuelConsumption: 22, efficiency: 85,
    suitableFuels: ['秸秆', '稻壳', '木屑'],
    fuelMoistureMax: 40,
    length: 12, width: 6, height: 15,
    dustEmission: 25, SO2Emission: 80, NOxEmission: 180,
    price: 0, processingCost: 120
  },
  {
    id: 'CFB-35',
    model: 'CFB-35',
    manufacturer: '东方锅炉',
    type: '循环流化床',
    steamCapacity: 35, steamPressure: 3.82, steamTemp: 450, fuelConsumption: 15, efficiency: 85,
    suitableFuels: ['秸秆', '木屑', '稻壳', '树皮'],
    fuelMoistureMax: 50,
    length: 15, width: 8, height: 25,
    dustEmission: 20, SO2Emission: 50, NOxEmission: 150,
    price: 0, processingCost: 100
  },
  {
    id: 'CFB-75',
    model: 'CFB-75',
    manufacturer: '哈尔滨锅炉',
    type: '循环流化床',
    steamCapacity: 75, steamPressure: 5.29, steamTemp: 485, fuelConsumption: 32, efficiency: 87,
    suitableFuels: ['秸秆', '木屑', '成型燃料', '混合生物质'],
    fuelMoistureMax: 50,
    length: 20, width: 10, height: 30,
    dustEmission: 15, SO2Emission: 35, NOxEmission: 120,
    price: 0, processingCost: 80
  },
  {
    id: 'CFB-130',
    model: 'CFB-130',
    manufacturer: '上海锅炉',
    type: '循环流化床',
    steamCapacity: 130, steamPressure: 9.81, steamTemp: 540, fuelConsumption: 55, efficiency: 88,
    suitableFuels: ['混合生物质', '成型燃料', '秸秆'],
    fuelMoistureMax: 45,
    length: 25, width: 12, height: 35,
    dustEmission: 10, SO2Emission: 30, NOxEmission: 100,
    price: 0, processingCost: 60
  }
];

// 气化炉
export interface GasifierSpec {
  id: string;
  model: string;
  manufacturer: string;
  type: '下吸式' | '上吸式' | '流化床';
  // 基本参数
  feedCapacity: number;    // 处理能力 kg/h
  gasOutput: number;       // 产气量 Nm³/h
  gasHeatValue: number;    // 燃气热值 MJ/Nm³
  efficiency: number;      // 气化效率 %
  // 气化参数
  gasificationTemp: number; // 气化温度 °C
  tarContent: number;      // 焦油含量 mg/Nm³
  ashCarbonContent: number; // 灰渣含碳量 %
  // 适用燃料
  suitableFuels: string[];
  fuelSizeMax: number;     // 最大燃料粒径 mm
  fuelMoistureMax: number; // 最大燃料含水率 %
  // 运行参数
  startupTime: number;     // 启动时间 min
  annualRunHours: number;  // 年运行小时数 h
  // 价格
  price: number;           // 参考价格 万元
}

export const GASIFIERS: GasifierSpec[] = [
  {
    id: 'DG-50',
    model: 'DG-50',
    manufacturer: '合肥德博',
    type: '下吸式',
    feedCapacity: 50, gasOutput: 80, gasHeatValue: 5.0, efficiency: 70,
    gasificationTemp: 850, tarContent: 30, ashCarbonContent: 5,
    suitableFuels: ['木屑', '秸秆颗粒'],
    fuelSizeMax: 30, fuelMoistureMax: 20,
    startupTime: 30, annualRunHours: 7200,
    price: 10
  },
  {
    id: 'DG-100',
    model: 'DG-100',
    manufacturer: '合肥德博',
    type: '下吸式',
    feedCapacity: 100, gasOutput: 160, gasHeatValue: 5.2, efficiency: 72,
    gasificationTemp: 850, tarContent: 25, ashCarbonContent: 4,
    suitableFuels: ['木屑', '秸秆颗粒', '稻壳'],
    fuelSizeMax: 30, fuelMoistureMax: 20,
    startupTime: 40, annualRunHours: 7500,
    price: 18
  },
  {
    id: 'DG-200',
    model: 'DG-200',
    manufacturer: '广州迪森',
    type: '下吸式',
    feedCapacity: 200, gasOutput: 320, gasHeatValue: 5.5, efficiency: 75,
    gasificationTemp: 900, tarContent: 20, ashCarbonContent: 3,
    suitableFuels: ['木屑', '秸秆', '稻壳', '木片'],
    fuelSizeMax: 50, fuelMoistureMax: 25,
    startupTime: 45, annualRunHours: 7500,
    price: 32
  },
  {
    id: 'UG-300',
    model: 'UG-300',
    manufacturer: '山东百川',
    type: '上吸式',
    feedCapacity: 300, gasOutput: 450, gasHeatValue: 5.8, efficiency: 72,
    gasificationTemp: 800, tarContent: 80, ashCarbonContent: 6,
    suitableFuels: ['块状木材', '木片', '树枝'],
    fuelSizeMax: 100, fuelMoistureMax: 35,
    startupTime: 60, annualRunHours: 7000,
    price: 48
  },
  {
    id: 'FB-500',
    model: 'FB-500',
    manufacturer: '中科院广州能源所',
    type: '流化床',
    feedCapacity: 500, gasOutput: 800, gasHeatValue: 5.0, efficiency: 78,
    gasificationTemp: 850, tarContent: 15, ashCarbonContent: 3,
    suitableFuels: ['混合生物质', '秸秆', '稻壳', '木屑'],
    fuelSizeMax: 30, fuelMoistureMax: 30,
    startupTime: 90, annualRunHours: 7500,
    price: 70
  },
  {
    id: 'FB-1000',
    model: 'FB-1000',
    manufacturer: '中科院广州能源所',
    type: '流化床',
    feedCapacity: 1000, gasOutput: 1600, gasHeatValue: 5.2, efficiency: 80,
    gasificationTemp: 850, tarContent: 10, ashCarbonContent: 2,
    suitableFuels: ['混合生物质', '秸秆', '稻壳', '木屑', '成型燃料'],
    fuelSizeMax: 30, fuelMoistureMax: 30,
    startupTime: 120, annualRunHours: 8000,
    price: 135
  }
];

// 沼气发酵罐
export interface AnaerobicDigesterSpec {
  id: string;
  model: string;
  manufacturer: string;
  // 基本参数
  effectiveVolume: number; // 有效容积 m³
  dailyFeedCapacity: number; // 日处理量 t/d
  dailyGasOutput: number;  // 日产气量 Nm³/d
  methaneContent: number;  // 甲烷含量 %
  // 发酵参数
  fermentationType: '中温' | '高温';
  fermentationTemp: number; // 发酵温度 °C
  retentionTime: number;   // 停留时间 天
  // 适用原料
  suitableFeedstocks: string[];
  // 尺寸参数
  diameter: number;        // 直径 m
  height: number;          // 高度 m
  // 价格
  price: number;           // 参考价格 万元
}

export const ANAEROBIC_DIGESTERS: AnaerobicDigesterSpec[] = [
  {
    id: 'AD-100',
    model: 'AD-100',
    manufacturer: '青岛天人',
    effectiveVolume: 100, dailyFeedCapacity: 5, dailyGasOutput: 150, methaneContent: 58,
    fermentationType: '中温', fermentationTemp: 37, retentionTime: 25,
    suitableFeedstocks: ['畜禽粪便', '农作物秸秆'],
    diameter: 5, height: 6,
    price: 20
  },
  {
    id: 'AD-300',
    model: 'AD-300',
    manufacturer: '北京中持',
    effectiveVolume: 300, dailyFeedCapacity: 15, dailyGasOutput: 500, methaneContent: 60,
    fermentationType: '中温', fermentationTemp: 37, retentionTime: 25,
    suitableFeedstocks: ['畜禽粪便', '秸秆', '有机废水'],
    diameter: 8, height: 7,
    price: 50
  },
  {
    id: 'AD-500',
    model: 'AD-500',
    manufacturer: '首创环境',
    effectiveVolume: 500, dailyFeedCapacity: 25, dailyGasOutput: 900, methaneContent: 62,
    fermentationType: '中温', fermentationTemp: 38, retentionTime: 22,
    suitableFeedstocks: ['混合有机物', '畜禽粪便', '餐厨垃圾'],
    diameter: 10, height: 8,
    price: 85
  },
  {
    id: 'AD-1000',
    model: 'AD-1000',
    manufacturer: '维尔利',
    effectiveVolume: 1000, dailyFeedCapacity: 50, dailyGasOutput: 2000, methaneContent: 63,
    fermentationType: '中温', fermentationTemp: 38, retentionTime: 20,
    suitableFeedstocks: ['混合有机物', '餐厨垃圾', '污泥'],
    diameter: 14, height: 8,
    price: 155
  },
  {
    id: 'AD-2000',
    model: 'AD-2000',
    manufacturer: '朗坤环境',
    effectiveVolume: 2000, dailyFeedCapacity: 100, dailyGasOutput: 4500, methaneContent: 65,
    fermentationType: '高温', fermentationTemp: 55, retentionTime: 18,
    suitableFeedstocks: ['餐厨垃圾', '污泥', '有机废水'],
    diameter: 18, height: 10,
    price: 330
  }
];

// 燃气/沼气发电机组
export interface GasEngineSpec {
  id: string;
  model: string;
  manufacturer: string;
  fuelType: '燃气' | '沼气' | '双燃料';
  // 基本参数
  ratedPower: number;      // 额定功率 kW
  gasConsumption: number;  // 燃气消耗 Nm³/h
  electricalEfficiency: number; // 发电效率 %
  thermalEfficiency: number;    // 热效率 %
  CHPEfficiency: number;   // 热电联产效率 %
  // 发电机参数
  outputVoltage: number;   // 输出电压 V
  frequency: number;       // 频率 Hz
  powerFactor: number;     // 功率因数
  // 运行参数
  ratedSpeed: number;      // 额定转速 rpm
  coolingType: string;     // 冷却方式
  startupType: string;     // 启动方式
  noiseLevel: number;      // 噪音 dB(A)
  // 尺寸参数
  length: number;          // 长度 mm
  width: number;           // 宽度 mm
  height: number;          // 高度 mm
  weight: number;          // 重量 kg
  // 价格
  price: number;           // 参考价格 万元
}

export const GAS_ENGINES: GasEngineSpec[] = [
  {
    id: 'GE-30',
    model: 'GE-30',
    manufacturer: '潍柴动力',
    fuelType: '燃气',
    ratedPower: 30, gasConsumption: 25, electricalEfficiency: 28, thermalEfficiency: 40, CHPEfficiency: 68,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 82,
    length: 2200, width: 900, height: 1400, weight: 1200,
    price: 7
  },
  {
    id: 'GE-60',
    model: 'GE-60',
    manufacturer: '玉柴动力',
    fuelType: '燃气',
    ratedPower: 60, gasConsumption: 50, electricalEfficiency: 30, thermalEfficiency: 42, CHPEfficiency: 72,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 83,
    length: 2800, width: 1100, height: 1600, weight: 2000,
    price: 12
  },
  {
    id: 'GE-120',
    model: 'GE-120',
    manufacturer: '济柴动力',
    fuelType: '燃气',
    ratedPower: 120, gasConsumption: 95, electricalEfficiency: 32, thermalEfficiency: 43, CHPEfficiency: 75,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 85,
    length: 3500, width: 1300, height: 1800, weight: 3500,
    price: 25
  },
  {
    id: 'GE-300',
    model: 'GE-300',
    manufacturer: '卡特彼勒',
    fuelType: '燃气',
    ratedPower: 300, gasConsumption: 230, electricalEfficiency: 33, thermalEfficiency: 44, CHPEfficiency: 77,
    outputVoltage: 10000, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 88,
    length: 5000, width: 1800, height: 2200, weight: 8000,
    price: 58
  },
  {
    id: 'GE-600',
    model: 'GE-600',
    manufacturer: '颜巴赫',
    fuelType: '燃气',
    ratedPower: 600, gasConsumption: 450, electricalEfficiency: 35, thermalEfficiency: 45, CHPEfficiency: 80,
    outputVoltage: 10000, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 90,
    length: 6500, width: 2200, height: 2600, weight: 15000,
    price: 108
  },
  {
    id: 'BG-50',
    model: 'BG-50',
    manufacturer: '潍柴动力',
    fuelType: '沼气',
    ratedPower: 50, gasConsumption: 28, electricalEfficiency: 32, thermalEfficiency: 46, CHPEfficiency: 78,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 82,
    length: 2600, width: 1000, height: 1500, weight: 1800,
    price: 15
  },
  {
    id: 'BG-100',
    model: 'BG-100',
    manufacturer: '玉柴动力',
    fuelType: '沼气',
    ratedPower: 100, gasConsumption: 55, electricalEfficiency: 33, thermalEfficiency: 47, CHPEfficiency: 80,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 84,
    length: 3200, width: 1200, height: 1700, weight: 3000,
    price: 30
  },
  {
    id: 'BG-200',
    model: 'BG-200',
    manufacturer: '济柴动力',
    fuelType: '沼气',
    ratedPower: 200, gasConsumption: 105, electricalEfficiency: 35, thermalEfficiency: 47, CHPEfficiency: 82,
    outputVoltage: 380, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 86,
    length: 4200, width: 1500, height: 2000, weight: 5500,
    price: 60
  },
  {
    id: 'BG-500',
    model: 'BG-500',
    manufacturer: '颜巴赫',
    fuelType: '沼气',
    ratedPower: 500, gasConsumption: 250, electricalEfficiency: 38, thermalEfficiency: 47, CHPEfficiency: 85,
    outputVoltage: 10000, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 1500, coolingType: '水冷', startupType: '电启动', noiseLevel: 89,
    length: 6000, width: 2000, height: 2400, weight: 12000,
    price: 140
  }
];

// 汽轮发电机组
export interface SteamTurbineSpec {
  id: string;
  model: string;
  manufacturer: string;
  // 基本参数
  ratedPower: number;      // 额定功率 MW
  steamConsumption: number; // 汽耗率 kg/kWh
  efficiency: number;      // 发电效率 %
  // 进汽参数
  inletPressure: number;   // 进汽压力 MPa
  inletTemp: number;       // 进汽温度 °C
  // 发电机参数
  outputVoltage: number;   // 输出电压 kV
  frequency: number;       // 频率 Hz
  powerFactor: number;     // 功率因数
  // 运行参数
  ratedSpeed: number;      // 额定转速 rpm
  coolingType: string;     // 冷却方式
  // 价格
  price: number;           // 参考价格 万元
}

export const STEAM_TURBINES: SteamTurbineSpec[] = [
  {
    id: 'ST-6',
    model: 'ST-6',
    manufacturer: '杭州汽轮机',
    ratedPower: 6, steamConsumption: 5.5, efficiency: 28,
    inletPressure: 3.82, inletTemp: 450,
    outputVoltage: 10.5, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 3000, coolingType: '空冷',
    price: 0
  },
  {
    id: 'ST-12',
    model: 'ST-12',
    manufacturer: '南京汽轮电机',
    ratedPower: 12, steamConsumption: 5.2, efficiency: 30,
    inletPressure: 3.82, inletTemp: 450,
    outputVoltage: 10.5, frequency: 50, powerFactor: 0.8,
    ratedSpeed: 3000, coolingType: '空冷',
    price: 0
  },
  {
    id: 'ST-25',
    model: 'ST-25',
    manufacturer: '上海电气',
    ratedPower: 25, steamConsumption: 4.8, efficiency: 32,
    inletPressure: 5.29, inletTemp: 485,
    outputVoltage: 10.5, frequency: 50, powerFactor: 0.85,
    ratedSpeed: 3000, coolingType: '水氢冷',
    price: 0
  },
  {
    id: 'ST-50',
    model: 'ST-50',
    manufacturer: '东方电气',
    ratedPower: 50, steamConsumption: 4.2, efficiency: 35,
    inletPressure: 9.81, inletTemp: 540,
    outputVoltage: 10.5, frequency: 50, powerFactor: 0.85,
    ratedSpeed: 3000, coolingType: '水氢冷',
    price: 0
  }
];

// --- 蓄电池系统 ---
export interface BatterySpec {
  id: string;
  model: string;
  manufacturer: string;
  type: '磷酸铁锂' | '铅碳电池' | '三元锂';
  // 基本参数
  nominalCapacity: number; // 标称容量 Ah
  nominalVoltage: number;  // 标称电压 V
  energyCapacity: number;  // 能量容量 kWh
  // 电气参数
  chargeCurrent: number;   // 标准充电电流 A
  dischargeCurrent: number; // 标准放电电流 A
  maxChargeCurrent: number; // 最大充电电流 A
  maxDischargeCurrent: number; // 最大放电电流 A
  // 性能参数
  cycleLife: number;       // 循环寿命 次
  DOD: number;             // 放电深度 %
  efficiency: number;      // 充放电效率 %
  selfDischarge: number;   // 自放电率 %/月
  // 环境参数
  operatingTempMin: number; // 最低工作温度 °C
  operatingTempMax: number; // 最高工作温度 °C
  // 尺寸参数
  length: number;          // 长度 mm
  width: number;           // 宽度 mm
  height: number;          // 高度 mm
  weight: number;          // 重量 kg
  // 质保
  warrantyYears: number;   // 质保年限
  // 价格
  price: number;           // 参考价格 万元
  pricePerKWh: number;     // 单位容量价格 元/kWh
}

export const BATTERIES: BatterySpec[] = [
  {
    id: 'BAT-100L',
    model: 'BAT-100L',
    manufacturer: '宁德时代',
    type: '磷酸铁锂',
    nominalCapacity: 100, nominalVoltage: 51.2, energyCapacity: 5.12,
    chargeCurrent: 50, dischargeCurrent: 100, maxChargeCurrent: 100, maxDischargeCurrent: 200,
    cycleLife: 6000, DOD: 90, efficiency: 95, selfDischarge: 3,
    operatingTempMin: -20, operatingTempMax: 55,
    length: 600, width: 400, height: 200, weight: 55,
    warrantyYears: 10,
    price: 1.35, pricePerKWh: 2637
  },
  {
    id: 'BAT-200L',
    model: 'BAT-200L',
    manufacturer: '比亚迪',
    type: '磷酸铁锂',
    nominalCapacity: 200, nominalVoltage: 51.2, energyCapacity: 10.24,
    chargeCurrent: 100, dischargeCurrent: 200, maxChargeCurrent: 200, maxDischargeCurrent: 400,
    cycleLife: 6000, DOD: 90, efficiency: 95, selfDischarge: 3,
    operatingTempMin: -20, operatingTempMax: 55,
    length: 800, width: 500, height: 250, weight: 105,
    warrantyYears: 10,
    price: 2.5, pricePerKWh: 2441
  },
  {
    id: 'BAT-280L',
    model: 'BAT-280L',
    manufacturer: '亿纬锂能',
    type: '磷酸铁锂',
    nominalCapacity: 280, nominalVoltage: 51.2, energyCapacity: 14.34,
    chargeCurrent: 140, dischargeCurrent: 280, maxChargeCurrent: 280, maxDischargeCurrent: 560,
    cycleLife: 6000, DOD: 90, efficiency: 96, selfDischarge: 2.5,
    operatingTempMin: -20, operatingTempMax: 55,
    length: 900, width: 550, height: 280, weight: 140,
    warrantyYears: 10,
    price: 3.4, pricePerKWh: 2371
  },
  {
    id: 'BAT-100G',
    model: 'BAT-100G',
    manufacturer: '南都电源',
    type: '铅碳电池',
    nominalCapacity: 100, nominalVoltage: 48, energyCapacity: 4.8,
    chargeCurrent: 20, dischargeCurrent: 50, maxChargeCurrent: 30, maxDischargeCurrent: 100,
    cycleLife: 3000, DOD: 70, efficiency: 85, selfDischarge: 5,
    operatingTempMin: -10, operatingTempMax: 45,
    length: 500, width: 350, height: 300, weight: 120,
    warrantyYears: 5,
    price: 0.7, pricePerKWh: 1458
  },
  {
    id: 'BAT-200G',
    model: 'BAT-200G',
    manufacturer: '双登集团',
    type: '铅碳电池',
    nominalCapacity: 200, nominalVoltage: 48, energyCapacity: 9.6,
    chargeCurrent: 40, dischargeCurrent: 100, maxChargeCurrent: 60, maxDischargeCurrent: 200,
    cycleLife: 3000, DOD: 70, efficiency: 85, selfDischarge: 5,
    operatingTempMin: -10, operatingTempMax: 45,
    length: 650, width: 450, height: 350, weight: 230,
    warrantyYears: 5,
    price: 1.2, pricePerKWh: 1250
  }
];

// --- 系统设备 ---

// 逆变器
export interface InverterSpec {
  id: string;
  model: string;
  manufacturer: string;
  type: '组串式' | '集中式' | '微型';
  // 基本参数
  ratedPower: number;      // 额定功率 kW
  maxEfficiency: number;   // 最大效率 %
  euroEfficiency: number;  // 欧洲效率 %
  // 输入参数
  maxDCVoltage: number;    // 最大直流电压 V
  MPPTVoltageMin: number;  // MPPT电压范围下限 V
  MPPTVoltageMax: number;  // MPPT电压范围上限 V
  MPPTCount: number;       // MPPT路数
  maxInputCurrent: number; // 最大输入电流 A
  // 输出参数
  outputVoltage: number;   // 输出电压 V
  outputFrequency: number; // 输出频率 Hz
  powerFactor: number;     // 功率因数
  THD: number;             // 谐波畸变率 %
  // 保护功能
  protections: string[];
  // 环境参数
  operatingTempMin: number;
  operatingTempMax: number;
  IP: string;              // 防护等级
  // 尺寸参数
  length: number;
  width: number;
  height: number;
  weight: number;
  // 价格
  price: number;           // 参考价格 万元
}

export const INVERTERS: InverterSpec[] = [
  {
    id: 'INV-5K',
    model: 'INV-5K',
    manufacturer: '华为',
    type: '组串式',
    ratedPower: 5, maxEfficiency: 97.5, euroEfficiency: 97.0,
    maxDCVoltage: 600, MPPTVoltageMin: 90, MPPTVoltageMax: 580, MPPTCount: 1, maxInputCurrent: 12,
    outputVoltage: 220, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护'],
    operatingTempMin: -25, operatingTempMax: 60, IP: 'IP65',
    length: 365, width: 156, height: 365, weight: 12,
    price: 0.4
  },
  {
    id: 'INV-20K',
    model: 'INV-20K',
    manufacturer: '阳光电源',
    type: '组串式',
    ratedPower: 20, maxEfficiency: 98.2, euroEfficiency: 97.8,
    maxDCVoltage: 1100, MPPTVoltageMin: 200, MPPTVoltageMax: 1000, MPPTCount: 2, maxInputCurrent: 26,
    outputVoltage: 380, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护', '防雷保护'],
    operatingTempMin: -25, operatingTempMax: 60, IP: 'IP66',
    length: 520, width: 240, height: 560, weight: 35,
    price: 1.0
  },
  {
    id: 'INV-50K',
    model: 'INV-50K',
    manufacturer: '华为',
    type: '组串式',
    ratedPower: 50, maxEfficiency: 98.6, euroEfficiency: 98.3,
    maxDCVoltage: 1100, MPPTVoltageMin: 200, MPPTVoltageMax: 1000, MPPTCount: 4, maxInputCurrent: 32,
    outputVoltage: 380, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护', '防雷保护', 'PID防护'],
    operatingTempMin: -25, operatingTempMax: 60, IP: 'IP66',
    length: 600, width: 300, height: 700, weight: 55,
    price: 2.2
  },
  {
    id: 'INV-110K',
    model: 'INV-110K',
    manufacturer: '阳光电源',
    type: '组串式',
    ratedPower: 110, maxEfficiency: 98.8, euroEfficiency: 98.5,
    maxDCVoltage: 1500, MPPTVoltageMin: 200, MPPTVoltageMax: 1100, MPPTCount: 6, maxInputCurrent: 30,
    outputVoltage: 380, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护', '防雷保护', 'PID防护', '智能IV诊断'],
    operatingTempMin: -25, operatingTempMax: 60, IP: 'IP66',
    length: 1035, width: 360, height: 700, weight: 95,
    price: 4.2
  },
  {
    id: 'INV-500K',
    model: 'INV-500K',
    manufacturer: '特变电工',
    type: '集中式',
    ratedPower: 500, maxEfficiency: 98.5, euroEfficiency: 98.2,
    maxDCVoltage: 1500, MPPTVoltageMin: 500, MPPTVoltageMax: 1500, MPPTCount: 1, maxInputCurrent: 1000,
    outputVoltage: 315, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护', '防雷保护'],
    operatingTempMin: -25, operatingTempMax: 50, IP: 'IP20',
    length: 2200, width: 1000, height: 2200, weight: 2500,
    price: 18
  },
  {
    id: 'INV-1250K',
    model: 'INV-1250K',
    manufacturer: '阳光电源',
    type: '集中式',
    ratedPower: 1250, maxEfficiency: 98.7, euroEfficiency: 98.4,
    maxDCVoltage: 1500, MPPTVoltageMin: 500, MPPTVoltageMax: 1500, MPPTCount: 1, maxInputCurrent: 2600,
    outputVoltage: 520, outputFrequency: 50, powerFactor: 1, THD: 3,
    protections: ['过压保护', '欠压保护', '过流保护', '短路保护', '孤岛保护', '接地故障保护', '防雷保护', '智能监控'],
    operatingTempMin: -25, operatingTempMax: 50, IP: 'IP20',
    length: 2600, width: 1200, height: 2200, weight: 4500,
    price: 42
  }
];

// 储能变流器(PCS)
export interface PCSSpec {
  id: string;
  model: string;
  manufacturer: string;
  // 基本参数
  ratedPower: number;      // 额定功率 kW
  efficiency: number;      // 效率 %
  // 电池侧参数
  batteryVoltageMin: number;
  batteryVoltageMax: number;
  maxChargeCurrent: number;
  maxDischargeCurrent: number;
  // 电网侧参数
  gridVoltage: number;
  gridFrequency: number;
  // 功能
  functions: string[];
  // 价格
  price: number;           // 参考价格 万元
}

export const PCS_UNITS: PCSSpec[] = [
  {
    id: 'PCS-30',
    model: 'PCS-30',
    manufacturer: '科华数据',
    ratedPower: 30, efficiency: 95,
    batteryVoltageMin: 200, batteryVoltageMax: 750, maxChargeCurrent: 60, maxDischargeCurrent: 60,
    gridVoltage: 380, gridFrequency: 50,
    functions: ['双向变流', '并网', '离网', '无缝切换'],
    price: 2.5
  },
  {
    id: 'PCS-100',
    model: 'PCS-100',
    manufacturer: '阳光电源',
    ratedPower: 100, efficiency: 96,
    batteryVoltageMin: 400, batteryVoltageMax: 850, maxChargeCurrent: 150, maxDischargeCurrent: 150,
    gridVoltage: 380, gridFrequency: 50,
    functions: ['双向变流', '并网', '离网', '无缝切换', '黑启动'],
    price: 8
  },
  {
    id: 'PCS-250',
    model: 'PCS-250',
    manufacturer: '南瑞继保',
    ratedPower: 250, efficiency: 97,
    batteryVoltageMin: 500, batteryVoltageMax: 900, maxChargeCurrent: 350, maxDischargeCurrent: 350,
    gridVoltage: 380, gridFrequency: 50,
    functions: ['双向变流', '并网', '离网', '无缝切换', '黑启动', '虚拟同步机'],
    price: 18
  },
  {
    id: 'PCS-500',
    model: 'PCS-500',
    manufacturer: '许继电气',
    ratedPower: 500, efficiency: 97.5,
    batteryVoltageMin: 600, batteryVoltageMax: 1000, maxChargeCurrent: 600, maxDischargeCurrent: 600,
    gridVoltage: 380, gridFrequency: 50,
    functions: ['双向变流', '并网', '离网', '无缝切换', '黑启动', '虚拟同步机', '一次调频'],
    price: 38
  },
  {
    id: 'PCS-1000',
    model: 'PCS-1000',
    manufacturer: '阳光电源',
    ratedPower: 1000, efficiency: 98,
    batteryVoltageMin: 600, batteryVoltageMax: 1500, maxChargeCurrent: 1200, maxDischargeCurrent: 1200,
    gridVoltage: 10000, gridFrequency: 50,
    functions: ['双向变流', '并网', '离网', '无缝切换', '黑启动', '虚拟同步机', '一次调频', '集装箱式'],
    price: 72
  }
];

// 设备分类
export type EquipmentCategory = 'solar' | 'wind' | 'biomass' | 'battery' | 'system';
export type BiomassSubCategory = 'direct' | 'gasification' | 'biogas';

// 获取所有设备列表
export const getAllEquipment = () => ({
  solar: {
    panels: SOLAR_PANELS,
    inverters: INVERTERS.filter(inv => inv.type !== '集中式' || inv.ratedPower <= 500)
  },
  wind: {
    turbines: WIND_TURBINES
  },
  biomass: {
    direct: {
      boilers: DIRECT_COMBUSTION_BOILERS,
      steamTurbines: STEAM_TURBINES
    },
    gasification: {
      gasifiers: GASIFIERS,
      gasEngines: GAS_ENGINES.filter(ge => ge.fuelType === '燃气')
    },
    biogas: {
      digesters: ANAEROBIC_DIGESTERS,
      biogasEngines: GAS_ENGINES.filter(ge => ge.fuelType === '沼气')
    }
  },
  battery: {
    batteries: BATTERIES
  },
  system: {
    inverters: INVERTERS,
    pcs: PCS_UNITS
  }
});
