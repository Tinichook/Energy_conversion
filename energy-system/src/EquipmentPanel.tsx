import { useState } from 'react';
import { X, Sun, Wind, Leaf, Battery, Settings, Flame, Zap, Droplets, ChevronRight, Download } from 'lucide-react';
import {
  SOLAR_PANELS, WIND_TURBINES, DIRECT_COMBUSTION_BOILERS, GASIFIERS,
  ANAEROBIC_DIGESTERS, GAS_ENGINES, STEAM_TURBINES, BATTERIES, PCS_UNITS, INVERTERS,
  SolarPanelSpec, WindTurbineSpec, DirectCombustionBoilerSpec, GasifierSpec,
  AnaerobicDigesterSpec, GasEngineSpec, SteamTurbineSpec, BatterySpec, PCSSpec, InverterSpec
} from './EquipmentData';

type CategoryType = 'solar' | 'wind' | 'biomass' | 'battery' | 'system';
type BiomassSubType = 'direct' | 'gasification' | 'biogas';
type ThemeMode = 'dark' | 'light';

interface EquipmentPanelProps {
  onClose: () => void;
  theme?: ThemeMode;
}

// 设备分类介绍信息
const categoryInfo: Record<CategoryType, { title: string; slogan: string; description: string; features: string[] }> = {
  solar: {
    title: '☀️ 太阳能光伏组件',
    slogan: '捕捉阳光，点亮未来',
    description: '光伏组件是太阳能发电系统的核心部件，通过光电效应将太阳辐射能直接转换为电能。现代单晶硅组件转换效率已超过21%，是清洁能源的主力军。',
    features: ['零排放清洁发电', '25年超长质保', '模块化灵活安装', '维护成本极低']
  },
  wind: {
    title: '🌬️ 风力发电机组',
    slogan: '驾驭风能，创造绿电',
    description: '风力发电机组将风的动能转换为电能，是目前技术最成熟、成本最低的可再生能源之一。从3kW小型风机到MW级大型机组，满足不同规模需求。',
    features: ['风能取之不尽', '单机容量大', '占地面积小', '可与农牧业结合']
  },
  biomass: {
    title: '🌿 生物质发电设备',
    slogan: '变废为宝，循环利用',
    description: '生物质发电利用农林废弃物、畜禽粪便等有机物质产生电能和热能，实现废弃物资源化利用，是农村地区理想的分布式能源方案。',
    features: ['废弃物资源化', '碳中和发电', '热电联产高效', '带动农村经济']
  },
  battery: {
    title: '🔋 储能电池系统',
    slogan: '储存能量，随需释放',
    description: '储能系统是新能源电力系统的关键环节，解决风光发电的间歇性问题。磷酸铁锂电池具有高安全性、长寿命、环保等优势。',
    features: ['削峰填谷', '平滑输出', '应急备电', '提高自用率']
  },
  system: {
    title: '⚙️ 系统配套设备',
    slogan: '智能转换，高效并网',
    description: '逆变器是光伏系统的"心脏"，将直流电转换为交流电并网。现代逆变器集成MPPT、监控、保护等功能，转换效率高达98%以上。',
    features: ['高效率转换', '智能MPPT', '多重保护', '远程监控']
  }
};

// 参数行组件
const ParamRow = ({ label, value, unit, isDark = true }: { label: string; value: string | number; unit?: string; isDark?: boolean }) => (
  <div className={`flex justify-between py-1.5 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
    <span className={`font-mono text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}{unit && <span className={`ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{unit}</span>}</span>
  </div>
);

// 参数组标题
const ParamGroup = ({ title, isDark = true }: { title: string; isDark?: boolean }) => (
  <div className={`text-xs uppercase tracking-wider mt-4 mb-2 font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{title}</div>
);

// 生成Excel数据的辅助函数
const generateSheetData = (data: any[], headers: string[], keys: string[]) => {
  return [
    headers,
    ...data.map(item => keys.map(key => {
      const value = key.split('.').reduce((obj, k) => obj?.[k], item);
      if (Array.isArray(value)) return value.join(';');
      return value ?? '';
    }))
  ];
};

// 下载所有设备数据为单个Excel文件（5个sheet）
const downloadAllEquipmentExcel = () => {
  // 准备各个sheet的数据
  const sheets: { name: string; data: (string | number)[][] }[] = [
    {
      name: '太阳能光伏组件',
      data: generateSheetData(SOLAR_PANELS,
        ['型号', '制造商', '类型', '功率(Wp)', '效率(%)', '长(mm)', '宽(mm)', '厚(mm)', '重量(kg)', 'Voc(V)', 'Isc(A)', 'Vmp(V)', 'Imp(A)', '功率温度系数(%/°C)', '电压温度系数(%/°C)', '电流温度系数(%/°C)', '最大系统电压(V)', '电池片数', '抗风压(Pa)', '抗雪压(Pa)', '质保(年)', '首年衰减(%)', '年衰减(%)', '价格(元)', '单瓦价格(元/W)'],
        ['model', 'manufacturer', 'type', 'power', 'efficiency', 'length', 'width', 'thickness', 'weight', 'Voc', 'Isc', 'Vmp', 'Imp', 'tempCoeffPmax', 'tempCoeffVoc', 'tempCoeffIsc', 'maxSystemVoltage', 'cellsPerModule', 'windLoad', 'snowLoad', 'warrantyYears', 'degradationYear1', 'degradationAnnual', 'price', 'pricePerWatt']
      )
    },
    {
      name: '风力发电机组',
      data: generateSheetData(WIND_TURBINES,
        ['型号', '制造商', '额定功率(kW)', '切入风速(m/s)', '额定风速(m/s)', '切出风速(m/s)', '生存风速(m/s)', '叶轮直径(m)', '扫风面积(m²)', '叶片数', '叶片材料', '轮毂高度(m)', '塔架类型', '发电机类型', '输出电压(V)', '频率(Hz)', '变桨方式', '偏航方式', '年发电量(MWh)', '容量因子(%)', '设计寿命(年)', '价格(万元)', '单位功率价格(万元/kW)'],
        ['model', 'manufacturer', 'ratedPower', 'cutInSpeed', 'ratedSpeed', 'cutOutSpeed', 'survivalSpeed', 'rotorDiameter', 'sweptArea', 'bladeCount', 'bladeMaterial', 'hubHeight', 'towerType', 'generatorType', 'outputVoltage', 'frequency', 'pitchControl', 'yawControl', 'annualOutput', 'capacityFactor', 'designLife', 'price', 'pricePerKW']
      )
    },
    {
      name: '生物质设备',
      data: (() => {
        // 合并所有生物质设备到一个sheet
        const biomassData: (string | number)[][] = [];
        
        // 添加表头
        biomassData.push([
          '设备类型', '型号', '制造商', '类型/燃料', 
          '额定功率/容量', '单位', '效率(%)', 
          '进汽压力(MPa)', '进汽温度(°C)', '蒸汽消耗(kg/kWh)',
          '处理能力(kg/h)', '产气量(Nm³/h)', '燃气热值(MJ/Nm³)', '气化温度(°C)',
          '有效容积(m³)', '日处理量(t/d)', '日产气量(Nm³/d)', '甲烷含量(%)', '发酵温度(°C)', '停留时间(天)',
          '燃气消耗(Nm³/h)', '发电效率(%)', '热效率(%)', '热电联产效率(%)',
          '输出电压', '频率(Hz)', '功率因数',
          '额定转速(rpm)', '冷却方式', '启动方式', '噪音(dB)',
          '长(mm/m)', '宽(mm/m)', '高(mm/m)', '重量(kg)',
          '适用燃料/原料', '最大含水率(%)', '最大粒径(mm)',
          '烟尘排放(mg/Nm³)', 'SO₂排放(mg/Nm³)', 'NOx排放(mg/Nm³)',
          '价格(万元)', '燃料处理成本(元/吨)'
        ]);
        
        // 添加直燃锅炉数据
        DIRECT_COMBUSTION_BOILERS.forEach(item => {
          biomassData.push([
            '直燃锅炉', item.model, item.manufacturer, item.type,
            item.steamCapacity, 't/h', item.efficiency,
            item.steamPressure, item.steamTemp, '',
            '', '', '', '',
            '', '', '', '', '', '',
            item.fuelConsumption * 1000, '', '', '',
            '', '', '',
            '', '', '', '',
            item.length, item.width, item.height, '',
            item.suitableFuels.join(';'), item.fuelMoistureMax, '',
            item.dustEmission, item.SO2Emission, item.NOxEmission,
            item.price, item.processingCost
          ]);
        });
        
        // 添加汽轮发电机组数据
        STEAM_TURBINES.forEach(item => {
          biomassData.push([
            '汽轮发电机组', item.model, item.manufacturer, '',
            item.ratedPower, 'MW', item.efficiency,
            item.inletPressure, item.inletTemp, item.steamConsumption,
            '', '', '', '',
            '', '', '', '', '', '',
            '', '', '', '',
            item.outputVoltage, item.frequency, item.powerFactor,
            item.ratedSpeed, item.coolingType, '', '',
            '', '', '', '',
            '', '', '',
            '', '', '',
            item.price, ''
          ]);
        });
        
        // 添加气化炉数据
        GASIFIERS.forEach(item => {
          biomassData.push([
            '气化炉', item.model, item.manufacturer, item.type,
            item.feedCapacity, 'kg/h', item.efficiency,
            '', '', '',
            item.feedCapacity, item.gasOutput, item.gasHeatValue, item.gasificationTemp,
            '', '', '', '', '', '',
            '', '', '', '',
            '', '', '',
            '', '', '', '',
            '', '', '', '',
            item.suitableFuels.join(';'), item.fuelMoistureMax, item.fuelSizeMax,
            '', '', '',
            item.price, ''
          ]);
        });
        
        // 添加燃气/沼气发电机组数据
        GAS_ENGINES.forEach(item => {
          biomassData.push([
            '燃气/沼气发电机', item.model, item.manufacturer, item.fuelType,
            item.ratedPower, 'kW', '',
            '', '', '',
            '', '', '', '',
            '', '', '', '', '', '',
            item.gasConsumption, item.electricalEfficiency, item.thermalEfficiency, item.CHPEfficiency,
            item.outputVoltage, item.frequency, item.powerFactor,
            item.ratedSpeed, item.coolingType, item.startupType, item.noiseLevel,
            item.length, item.width, item.height, item.weight,
            '', '', '',
            '', '', '',
            item.price, ''
          ]);
        });
        
        // 添加厌氧发酵罐数据
        ANAEROBIC_DIGESTERS.forEach(item => {
          biomassData.push([
            '厌氧发酵罐', item.model, item.manufacturer, item.fermentationType + '发酵',
            item.effectiveVolume, 'm³', '',
            '', '', '',
            '', '', '', '',
            item.effectiveVolume, item.dailyFeedCapacity, item.dailyGasOutput, item.methaneContent, item.fermentationTemp, item.retentionTime,
            '', '', '', '',
            '', '', '',
            '', '', '', '',
            item.diameter, '', item.height, '',
            item.suitableFeedstocks.join(';'), '', '',
            '', '', '',
            item.price, ''
          ]);
        });
        
        return biomassData;
      })()
    },
    {
      name: '储能电池',
      data: generateSheetData(BATTERIES,
        ['型号', '制造商', '类型', '标称容量(Ah)', '标称电压(V)', '能量容量(kWh)', '标准充电电流(A)', '标准放电电流(A)', '最大充电电流(A)', '最大放电电流(A)', '循环寿命(次)', 'DOD(%)', '效率(%)', '自放电率(%/月)', '最低工作温度(°C)', '最高工作温度(°C)', '长(mm)', '宽(mm)', '高(mm)', '重量(kg)', '质保(年)', '价格(万元)', '单位容量价格(元/kWh)'],
        ['model', 'manufacturer', 'type', 'nominalCapacity', 'nominalVoltage', 'energyCapacity', 'chargeCurrent', 'dischargeCurrent', 'maxChargeCurrent', 'maxDischargeCurrent', 'cycleLife', 'DOD', 'efficiency', 'selfDischarge', 'operatingTempMin', 'operatingTempMax', 'length', 'width', 'height', 'weight', 'warrantyYears', 'price', 'pricePerKWh']
      )
    },
    {
      name: '逆变器设备',
      data: generateSheetData(INVERTERS,
        ['型号', '制造商', '类型', '额定功率(kW)', '最大效率(%)', '欧洲效率(%)', '最大直流电压(V)', 'MPPT电压下限(V)', 'MPPT电压上限(V)', 'MPPT路数', '最大输入电流(A)', '输出电压(V)', '输出频率(Hz)', '功率因数', 'THD(%)', '最低工作温度(°C)', '最高工作温度(°C)', '防护等级', '长(mm)', '宽(mm)', '高(mm)', '重量(kg)', '价格(万元)'],
        ['model', 'manufacturer', 'type', 'ratedPower', 'maxEfficiency', 'euroEfficiency', 'maxDCVoltage', 'MPPTVoltageMin', 'MPPTVoltageMax', 'MPPTCount', 'maxInputCurrent', 'outputVoltage', 'outputFrequency', 'powerFactor', 'THD', 'operatingTempMin', 'operatingTempMax', 'IP', 'length', 'width', 'height', 'weight', 'price']
      )
    }
  ];

  // 使用简单的XML格式生成Excel文件（兼容性好，无需额外库）
  let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlContent += '<?mso-application progid="Excel.Sheet"?>\n';
  xmlContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xmlContent += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  
  sheets.forEach(sheet => {
    xmlContent += `  <Worksheet ss:Name="${sheet.name}">\n`;
    xmlContent += '    <Table>\n';
    sheet.data.forEach(row => {
      xmlContent += '      <Row>\n';
      row.forEach(cell => {
        const cellValue = String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cellType = typeof cell === 'number' ? 'Number' : 'String';
        xmlContent += `        <Cell><Data ss:Type="${cellType}">${cellValue}</Data></Cell>\n`;
      });
      xmlContent += '      </Row>\n';
    });
    xmlContent += '    </Table>\n';
    xmlContent += '  </Worksheet>\n';
  });
  
  xmlContent += '</Workbook>';
  
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '能源系统设备选型数据.xls';
  link.click();
};

export default function EquipmentPanel({ onClose, theme = 'dark' }: EquipmentPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('solar');
  const [biomassSubType, setBiomassSubType] = useState<BiomassSubType>('gasification');
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  
  const isDark = theme === 'dark';
  
  const categories = [
    { id: 'solar', name: '太阳能', icon: Sun, color: 'text-yellow-400' },
    { id: 'wind', name: '风机', icon: Wind, color: 'text-blue-400' },
    { id: 'biomass', name: '生物质', icon: Leaf, color: 'text-green-400' },
    { id: 'battery', name: '蓄电池', icon: Battery, color: 'text-purple-400' },
    { id: 'system', name: '系统设备', icon: Settings, color: 'text-gray-400' },
  ];

  const biomassSubTypes = [
    { id: 'direct', name: '直燃发电', icon: Flame, desc: '锅炉+汽轮机' },
    { id: 'gasification', name: '气化发电', icon: Zap, desc: '气化炉+燃气机' },
    { id: 'biogas', name: '沼气发电', icon: Droplets, desc: '发酵罐+沼气机' },
  ];

  // 渲染设备列表
  const renderEquipmentList = () => {
    let items: any[] = [];
    let type = '';

    switch (activeCategory) {
      case 'solar':
        items = SOLAR_PANELS;
        type = 'solar_panel';
        break;
      case 'wind':
        items = WIND_TURBINES;
        type = 'wind_turbine';
        break;
      case 'biomass':
        if (biomassSubType === 'direct') {
          return (
            <div className="space-y-4">
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>🔥 生物质锅炉</div>
                {DIRECT_COMBUSTION_BOILERS.map(item => (
                  <EquipmentCard key={item.id} item={item} type="boiler" 
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('boiler'); }} />
                ))}
              </div>
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>⚡ 汽轮发电机组</div>
                {STEAM_TURBINES.map(item => (
                  <EquipmentCard key={item.id} item={item} type="steam_turbine"
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('steam_turbine'); }} />
                ))}
              </div>
            </div>
          );
        } else if (biomassSubType === 'gasification') {
          return (
            <div className="space-y-4">
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>🌡️ 气化炉</div>
                {GASIFIERS.map(item => (
                  <EquipmentCard key={item.id} item={item} type="gasifier"
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('gasifier'); }} />
                ))}
              </div>
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>⚡ 燃气发电机组</div>
                {GAS_ENGINES.filter(e => e.fuelType === '燃气').map(item => (
                  <EquipmentCard key={item.id} item={item} type="gas_engine"
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('gas_engine'); }} />
                ))}
              </div>
            </div>
          );
        } else {
          return (
            <div className="space-y-4">
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>🧪 厌氧发酵罐</div>
                {ANAEROBIC_DIGESTERS.map(item => (
                  <EquipmentCard key={item.id} item={item} type="digester"
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('digester'); }} />
                ))}
              </div>
              <div>
                <div className={`text-xs mb-2 font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>⚡ 沼气发电机组</div>
                {GAS_ENGINES.filter(e => e.fuelType === '沼气').map(item => (
                  <EquipmentCard key={item.id} item={item} type="biogas_engine"
                    isSelected={selectedEquipment?.id === item.id}
                    isDark={isDark}
                    onClick={() => { setSelectedEquipment(item); setSelectedType('biogas_engine'); }} />
                ))}
              </div>
            </div>
          );
        }
      case 'battery':
        return (
          <div className="space-y-4">
            <div>
              <div className={`text-xs mb-2 font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>🔋 蓄电池组</div>
              {BATTERIES.map(item => (
                <EquipmentCard key={item.id} item={item} type="battery"
                  isSelected={selectedEquipment?.id === item.id}
                  isDark={isDark}
                  onClick={() => { setSelectedEquipment(item); setSelectedType('battery'); }} />
              ))}
            </div>
          </div>
        );
      case 'system':
        return (
          <div className="space-y-4">
            <div>
              <div className={`text-xs mb-2 font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>🔌 光伏逆变器</div>
              {INVERTERS.map(item => (
                <EquipmentCard key={item.id} item={item} type="inverter"
                  isSelected={selectedEquipment?.id === item.id}
                  isDark={isDark}
                  onClick={() => { setSelectedEquipment(item); setSelectedType('inverter'); }} />
              ))}
            </div>
            <div>
              <div className={`text-xs mb-2 font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>🔄 储能变流器(PCS)</div>
              {PCS_UNITS.map(item => (
                <EquipmentCard key={item.id} item={item} type="pcs"
                  isSelected={selectedEquipment?.id === item.id}
                  isDark={isDark}
                  onClick={() => { setSelectedEquipment(item); setSelectedType('pcs'); }} />
              ))}
            </div>
          </div>
        );
    }

    return (
      <div className="space-y-2">
        {items.map(item => (
          <EquipmentCard key={item.id} item={item} type={type}
            isSelected={selectedEquipment?.id === item.id}
            isDark={isDark}
            onClick={() => { setSelectedEquipment(item); setSelectedType(type); }} />
        ))}
      </div>
    );
  };

  const currentInfo = categoryInfo[activeCategory];

  return (
    <div className={`fixed inset-0 ${isDark ? 'bg-black/70' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center z-50 p-4`}>
      <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden`}>
        {/* 标题栏 */}
        <div className={`${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} px-6 py-4 flex justify-between items-center border-b`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-3`}>
            <Settings className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            设备选型库
            <span className={`text-xs font-normal ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>能源转化原理课程设计</span>
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧分类导航 */}
          <div className={`w-48 ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-200'} border-r p-3 flex flex-col`}>
            <div className="flex-1 flex flex-col gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id as CategoryType); setSelectedEquipment(null); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeCategory === cat.id 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <cat.icon className={`w-5 h-5 ${activeCategory === cat.id ? 'text-white' : cat.color}`} />
                  <span className="font-medium">{cat.name}</span>
                </button>
              ))}
            </div>
            
            {/* 下载数据按钮 */}
            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={downloadAllEquipmentExcel}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${isDark ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border-blue-600/30' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 border-blue-200'}`}
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">下载设备数据 (.xls)</span>
              </button>
              <div className={`text-xs text-center mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>包含5个工作表（光伏/风机/生物质/储能/逆变器）</div>
            </div>
          </div>

          {/* 中间设备列表 */}
          <div className={`w-80 border-r ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col`}>
            {/* 分类介绍卡片 */}
            <div className={`p-3 border-b ${isDark ? 'border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50' : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white'}`}>
              <div className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{currentInfo.title}</div>
              <div className={`text-xs italic mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>"{currentInfo.slogan}"</div>
              <div className={`text-xs leading-relaxed mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{currentInfo.description}</div>
              <div className="flex flex-wrap gap-1">
                {currentInfo.features.map((f, i) => (
                  <span key={i} className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>✓ {f}</span>
                ))}
              </div>
            </div>

            {/* 生物质子分类 */}
            {activeCategory === 'biomass' && (
              <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex gap-2`}>
                {biomassSubTypes.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => { setBiomassSubType(sub.id as BiomassSubType); setSelectedEquipment(null); }}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs transition-all ${
                      biomassSubType === sub.id
                        ? 'bg-green-600 text-white'
                        : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <sub.icon className="w-4 h-4 mx-auto mb-1" />
                    <div className="font-medium">{sub.name}</div>
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {renderEquipmentList()}
            </div>
          </div>

          {/* 右侧详情面板 */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedEquipment ? (
              <EquipmentDetail equipment={selectedEquipment} type={selectedType} isDark={isDark} />
            ) : (
              <div className={`h-full flex flex-col items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-6xl mb-4">🔍</div>
                <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>请从左侧选择设备</p>
                <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>点击设备卡片查看详细技术参数</p>
                <div className={`mt-8 p-4 rounded-xl max-w-md ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <div className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>💡 设计提示</div>
                  <ul className={`text-xs space-y-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    <li>• 根据区域资源条件选择合适的发电设备</li>
                    <li>• 考虑设备功率与负荷需求的匹配</li>
                    <li>• 储能系统容量应满足调峰需求</li>
                    <li>• 注意设备间的电气参数匹配</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// 设备卡片组件
function EquipmentCard({ item, type, isSelected, onClick, isDark = true }: { item: any; type: string; isSelected: boolean; onClick: () => void; isDark?: boolean }) {
  const getMainInfo = () => {
    switch (type) {
      case 'solar_panel':
        return { power: `${item.power}Wp`, efficiency: `${item.efficiency}%`, price: `¥${item.price}` };
      case 'wind_turbine':
        return { power: `${item.ratedPower}kW`, speed: `${item.cutInSpeed}-${item.ratedSpeed}m/s`, price: `¥${item.price}万` };
      case 'boiler':
        return { capacity: `${item.steamCapacity}t/h`, efficiency: `${item.efficiency}%`, price: `¥${item.price}万` };
      case 'steam_turbine':
        return { power: `${item.ratedPower}MW`, efficiency: `${item.efficiency}%`, price: `¥${item.price}万` };
      case 'gasifier':
        return { capacity: `${item.feedCapacity}kg/h`, gas: `${item.gasOutput}Nm³/h`, price: `¥${item.price}万` };
      case 'gas_engine':
      case 'biogas_engine':
        return { power: `${item.ratedPower}kW`, efficiency: `${item.electricalEfficiency}%`, price: `¥${item.price}万` };
      case 'digester':
        return { volume: `${item.effectiveVolume}m³`, gas: `${item.dailyGasOutput}Nm³/d`, price: `¥${item.price}万` };
      case 'battery':
        return { capacity: `${item.energyCapacity}kWh`, cycle: `${item.cycleLife}次`, price: `¥${item.price}万` };
      case 'pcs':
        return { power: `${item.ratedPower}kW`, efficiency: `${item.efficiency}%`, price: `¥${item.price}万` };
      case 'inverter':
        return { power: `${item.ratedPower}kW`, efficiency: `${item.maxEfficiency}%`, price: `¥${item.price}万` };
      default:
        return { power: '-', efficiency: '-', price: '-' };
    }
  };

  const info = getMainInfo();

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-all ${
        isSelected 
          ? 'bg-blue-600/30 border-2 border-blue-500' 
          : isDark ? 'bg-gray-800/50 border border-gray-700 hover:border-gray-600' : 'bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-gray-100'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.model}</div>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.manufacturer}</div>
        </div>
        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-400' : isDark ? 'text-gray-600' : 'text-gray-400'}`} />
      </div>
      <div className="flex gap-3 text-xs">
        <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>{Object.values(info)[0]}</span>
        <span className={isDark ? 'text-green-400' : 'text-green-600'}>{Object.values(info)[1]}</span>
        <span className={isDark ? 'text-yellow-400' : 'text-yellow-600'}>{Object.values(info)[2]}</span>
      </div>
    </div>
  );
}


// 设备详情组件
function EquipmentDetail({ equipment, type, isDark = true }: { equipment: any; type: string; isDark?: boolean }) {
  
  // 主题样式
  const titleColor = isDark ? 'text-white' : 'text-gray-900';
  const subtitleColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDark ? 'bg-gray-800/50' : 'bg-gray-50';
  const sloganDescColor = isDark ? 'text-gray-400' : 'text-gray-600';
  
  // 根据制造商生成独特的宣传语
  const getSolarSlogan = (item: SolarPanelSpec) => {
    const slogans: Record<string, { title: string; desc: string }> = {
      '隆基绿能': { 
        title: '🏆 全球光伏龙头，品质值得信赖', 
        desc: `Hi-MO系列旗舰产品，HPBC电池技术加持，${item.efficiency}%高效转换，稳居行业第一梯队` 
      },
      '天合光能': { 
        title: '🌍 210大尺寸先驱，降本增效领跑者', 
        desc: `Vertex系列明星产品，210mm大硅片技术，功率密度提升${Math.round((item.power/item.length/item.width)*1000000)}W/m²` 
      },
      '晶科能源': { 
        title: '🐯 Tiger Neo，N型时代的王者', 
        desc: `TOPCon N型技术，双面发电增益高达30%，首年衰减仅${item.degradationYear1}%，业界领先` 
      },
      '晶澳科技': { 
        title: '🌊 DeepBlue深蓝，探索效率新深度', 
        desc: `SMBB多主栅技术，${item.cellsPerModule}片半片设计，弱光响应优异，阴影损失更低` 
      },
      '通威太阳能': { 
        title: '🔗 硅料+电池垂直整合，成本优势明显', 
        desc: `全球最大硅料供应商出品，${item.power}W超高功率，单瓦成本行业最优` 
      },
      '协鑫集成': { 
        title: '💎 多晶硅鼻祖，性价比之选', 
        desc: `经典多晶工艺，成熟稳定可靠，${item.pricePerWatt}元/W超高性价比，预算优选` 
      }
    };
    return slogans[item.manufacturer] || { title: '☀️ 优质光伏组件', desc: `${item.power}W高效组件，${item.efficiency}%转换效率` };
  };

  const getWindSlogan = (item: WindTurbineSpec) => {
    const slogans: Record<string, { title: string; desc: string }> = {
      '通用小型风机': { 
        title: '🏠 分布式风电，家庭农场首选', 
        desc: `${item.ratedPower}kW紧凑设计，${item.cutInSpeed}m/s低风速启动，安装简便，维护成本低` 
      },
      '通用中型风机': { 
        title: '🏭 工商业分布式，稳定供电保障', 
        desc: `${item.ratedPower}kW中型机组，适合工厂、农场等场景，年发电${item.annualOutput}MWh` 
      },
      '金风科技': { 
        title: '🥇 国内风电NO.1，直驱技术领航者', 
        desc: `永磁直驱技术，无齿轮箱设计，故障率降低50%，运维成本更低，累计装机超100GW` 
      },
      '明阳智能': { 
        title: '🌊 海上风电专家，抗台风设计', 
        desc: `MySE系列半直驱平台，${item.rotorDiameter}m超大叶轮，适应复杂风况，海陆两用` 
      },
      '远景能源': { 
        title: '🧠 智慧风机，数字化运维先锋', 
        desc: `EnOS智能物联平台加持，AI预测性维护，发电量提升3-5%，全生命周期智能管理` 
      }
    };
    return slogans[item.manufacturer] || { title: '🌬️ 高效风力发电', desc: `${item.ratedPower}kW额定功率，年发电量${item.annualOutput}MWh` };
  };

  const getBatterySlogan = (item: BatterySpec) => {
    const slogans: Record<string, { title: string; desc: string }> = {
      '宁德时代': { 
        title: '👑 全球动力电池之王，安全可靠', 
        desc: `CTP技术加持，${item.cycleLife}次超长循环，热失控零扩散，为特斯拉、宝马供货` 
      },
      '比亚迪': { 
        title: '🔒 刀片电池技术，针刺不起火', 
        desc: `磷酸铁锂刀片电池，通过针刺测试，${item.efficiency}%充放电效率，安全性行业标杆` 
      },
      '亿纬锂能': { 
        title: '⚡ 储能电芯专家，大容量首选', 
        desc: `${item.nominalCapacity}Ah大容量电芯，${item.DOD}%深度放电，储能电站优选方案` 
      },
      '南都电源': { 
        title: '🔋 铅碳技术领先，经济实惠', 
        desc: `铅碳电池技术，${item.cycleLife}次循环寿命，初始投资低，适合预算有限项目` 
      },
      '双登集团': { 
        title: '🏛️ 通信储能老牌，稳定耐用', 
        desc: `30年通信电源经验，${item.warrantyYears}年质保，极端环境适应性强` 
      }
    };
    return slogans[item.manufacturer] || { title: '🔋 可靠储能电池', desc: `${item.energyCapacity}kWh容量，${item.cycleLife}次循环` };
  };

  const getInverterSlogan = (item: InverterSpec) => {
    const slogans: Record<string, { title: string; desc: string }> = {
      '华为': { 
        title: '📡 智能光伏，AI加持的逆变器', 
        desc: `FusionSolar智能管理，${item.MPPTCount}路MPPT独立优化，AI智能IV诊断，组件级监控` 
      },
      '阳光电源': { 
        title: '☀️ 逆变器出货量全球第一', 
        desc: `${item.maxEfficiency}%最大效率，${item.euroEfficiency}%欧洲效率，全球累计出货超400GW` 
      },
      '特变电工': { 
        title: '🏗️ 大型地面电站首选，稳如磐石', 
        desc: `${item.ratedPower}kW集中式方案，适合大型地面电站，单机容量大，系统成本低` 
      }
    };
    return slogans[item.manufacturer] || { title: '⚡ 高效逆变器', desc: `${item.ratedPower}kW功率，${item.maxEfficiency}%效率` };
  };

  const renderSolarPanel = (item: SolarPanelSpec) => {
    const slogan = getSolarSlogan(item);
    return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
          <Sun className={`w-8 h-8 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.type}</p>
        </div>
      </div>
      
      {/* 宣传语 */}
      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20' : 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>{slogan.title}</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>{slogan.desc}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>{item.power}</div>
          <div className={`text-xs ${subtitleColor}`}>标称功率 Wp</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.efficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>转换效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>¥{item.price}</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="STC标准测试条件 (1000W/m², 25°C, AM1.5)" isDark={isDark} />
        <ParamRow label="开路电压 Voc" value={item.Voc} unit="V" isDark={isDark} />
        <ParamRow label="短路电流 Isc" value={item.Isc} unit="A" isDark={isDark} />
        <ParamRow label="最大功率点电压 Vmp" value={item.Vmp} unit="V" isDark={isDark} />
        <ParamRow label="最大功率点电流 Imp" value={item.Imp} unit="A" isDark={isDark} />
        <ParamGroup title="温度系数" isDark={isDark} />
        <ParamRow label="功率温度系数 γPmax" value={item.tempCoeffPmax} unit="%/°C" isDark={isDark} />
        <ParamRow label="电压温度系数 βVoc" value={item.tempCoeffVoc} unit="%/°C" isDark={isDark} />
        <ParamRow label="电流温度系数 αIsc" value={item.tempCoeffIsc} unit="%/°C" isDark={isDark} />
        <ParamGroup title="电气参数" isDark={isDark} />
        <ParamRow label="最大系统电压" value={item.maxSystemVoltage} unit="V" isDark={isDark} />
        <ParamRow label="电池片数量" value={item.cellsPerModule} unit="片" isDark={isDark} />
        <ParamGroup title="机械参数" isDark={isDark} />
        <ParamRow label="尺寸 (长×宽×厚)" value={`${item.length}×${item.width}×${item.thickness}`} unit="mm" isDark={isDark} />
        <ParamRow label="重量" value={item.weight} unit="kg" isDark={isDark} />
        <ParamRow label="抗风压" value={item.windLoad} unit="Pa" isDark={isDark} />
        <ParamRow label="抗雪压" value={item.snowLoad} unit="Pa" isDark={isDark} />
        <ParamGroup title="质保与衰减" isDark={isDark} />
        <ParamRow label="质保年限" value={item.warrantyYears} unit="年" isDark={isDark} />
        <ParamRow label="首年衰减" value={item.degradationYear1} unit="%" isDark={isDark} />
        <ParamRow label="年衰减率" value={item.degradationAnnual} unit="%" isDark={isDark} />
        <ParamRow label="单瓦价格" value={item.pricePerWatt} unit="元/W" isDark={isDark} />
      </div>
    </>
  );
  };


  const renderWindTurbine = (item: WindTurbineSpec) => {
    const slogan = getWindSlogan(item);
    return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
          <Wind className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer}</p>
        </div>
      </div>

      {/* 宣传语 */}
      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20' : 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{slogan.title}</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>{slogan.desc}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{item.ratedPower}</div>
          <div className={`text-xs ${subtitleColor}`}>额定功率 kW</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{item.rotorDiameter}m</div>
          <div className={`text-xs ${subtitleColor}`}>叶轮直径</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="风速参数" isDark={isDark} />
        <ParamRow label="切入风速 (启动)" value={item.cutInSpeed} unit="m/s" isDark={isDark} />
        <ParamRow label="额定风速" value={item.ratedSpeed} unit="m/s" isDark={isDark} />
        <ParamRow label="切出风速 (停机)" value={item.cutOutSpeed} unit="m/s" isDark={isDark} />
        <ParamRow label="工作风速范围" value={`${item.cutInSpeed} ~ ${item.cutOutSpeed}`} unit="m/s" isDark={isDark} />
        <ParamRow label="极限生存风速" value={item.survivalSpeed} unit="m/s" isDark={isDark} />
        <ParamGroup title="叶轮参数" isDark={isDark} />
        <ParamRow label="叶轮直径" value={item.rotorDiameter} unit="m" isDark={isDark} />
        <ParamRow label="扫风面积" value={item.sweptArea} unit="m²" isDark={isDark} />
        <ParamRow label="叶片数量" value={item.bladeCount} unit="片" isDark={isDark} />
        <ParamRow label="叶片材料" value={item.bladeMaterial} isDark={isDark} />
        <ParamGroup title="塔架参数" isDark={isDark} />
        <ParamRow label="轮毂高度" value={item.hubHeight} unit="m" isDark={isDark} />
        <ParamRow label="塔架类型" value={item.towerType} isDark={isDark} />
        <ParamGroup title="发电机参数" isDark={isDark} />
        <ParamRow label="发电机类型" value={item.generatorType} isDark={isDark} />
        <ParamRow label="输出电压" value={item.outputVoltage} unit="V" isDark={isDark} />
        <ParamRow label="频率" value={item.frequency} unit="Hz" isDark={isDark} />
        <ParamGroup title="控制系统" isDark={isDark} />
        <ParamRow label="变桨方式" value={item.pitchControl} isDark={isDark} />
        <ParamRow label="偏航方式" value={item.yawControl} isDark={isDark} />
        <ParamGroup title="性能参数" isDark={isDark} />
        <ParamRow label="年发电量估算" value={item.annualOutput} unit="MWh" isDark={isDark} />
        <ParamRow label="容量因子" value={item.capacityFactor} unit="%" isDark={isDark} />
        <ParamRow label="设计寿命" value={item.designLife} unit="年" isDark={isDark} />
        <ParamRow label="单位功率价格" value={item.pricePerKW} unit="万元/kW" isDark={isDark} />
      </div>
    </>
  );
  };


  const renderBoiler = (item: DirectCombustionBoilerSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
          <Flame className={`w-8 h-8 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.type}</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20' : 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>🔥 高效燃烧，清洁排放</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>蒸发量{item.steamCapacity}t/h，锅炉效率{item.efficiency}%，适用多种生物质燃料</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{item.steamCapacity}</div>
          <div className={`text-xs ${subtitleColor}`}>蒸发量 t/h</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{item.efficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>锅炉效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="蒸汽参数" isDark={isDark} />
        <ParamRow label="蒸汽压力" value={item.steamPressure} unit="MPa" isDark={isDark} />
        <ParamRow label="蒸汽温度" value={item.steamTemp} unit="°C" isDark={isDark} />
        <ParamRow label="燃料消耗" value={item.fuelConsumption} unit="t/h" isDark={isDark} />
        <ParamGroup title="适用燃料" isDark={isDark} />
        <ParamRow label="燃料类型" value={item.suitableFuels.join('、')} isDark={isDark} />
        <ParamRow label="最大含水率" value={item.fuelMoistureMax} unit="%" isDark={isDark} />
        <ParamGroup title="尺寸参数" isDark={isDark} />
        <ParamRow label="长×宽×高" value={`${item.length}×${item.width}×${item.height}`} unit="m" isDark={isDark} />
        <ParamGroup title="环保参数" isDark={isDark} />
        <ParamRow label="烟尘排放" value={`≤${item.dustEmission}`} unit="mg/Nm³" isDark={isDark} />
        <ParamRow label="SO₂排放" value={`≤${item.SO2Emission}`} unit="mg/Nm³" isDark={isDark} />
        <ParamRow label="NOx排放" value={`≤${item.NOxEmission}`} unit="mg/Nm³" isDark={isDark} />
      </div>
    </>
  );

  const renderGasifier = (item: GasifierSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
          <Zap className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.type}</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>⚗️ 热解气化，高效转化</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>处理能力{item.feedCapacity}kg/h，产气量{item.gasOutput}Nm³/h，气化效率{item.efficiency}%</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.feedCapacity}</div>
          <div className={`text-xs ${subtitleColor}`}>处理能力 kg/h</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{item.gasOutput}</div>
          <div className={`text-xs ${subtitleColor}`}>产气量 Nm³/h</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="气化参数" isDark={isDark} />
        <ParamRow label="气化效率" value={item.efficiency} unit="%" isDark={isDark} />
        <ParamRow label="燃气热值" value={item.gasHeatValue} unit="MJ/Nm³" isDark={isDark} />
        <ParamRow label="气化温度" value={item.gasificationTemp} unit="°C" isDark={isDark} />
        <ParamRow label="焦油含量" value={`≤${item.tarContent}`} unit="mg/Nm³" isDark={isDark} />
        <ParamRow label="灰渣含碳量" value={`≤${item.ashCarbonContent}`} unit="%" isDark={isDark} />
        <ParamGroup title="燃料要求" isDark={isDark} />
        <ParamRow label="适用燃料" value={item.suitableFuels.join('、')} isDark={isDark} />
        <ParamRow label="最大粒径" value={item.fuelSizeMax} unit="mm" isDark={isDark} />
        <ParamRow label="最大含水率" value={item.fuelMoistureMax} unit="%" isDark={isDark} />
        <ParamGroup title="运行参数" isDark={isDark} />
        <ParamRow label="启动时间" value={item.startupTime} unit="min" isDark={isDark} />
        <ParamRow label="年运行小时" value={item.annualRunHours} unit="h" isDark={isDark} />
      </div>
    </>
  );


  const renderDigester = (item: AnaerobicDigesterSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
          <Droplets className={`w-8 h-8 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.fermentationType}发酵</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20' : 'bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>🧬 厌氧发酵，沼气产能</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>有效容积{item.effectiveVolume}m³，日产气量{item.dailyGasOutput}Nm³，甲烷含量{item.methaneContent}%</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{item.effectiveVolume}</div>
          <div className={`text-xs ${subtitleColor}`}>有效容积 m³</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.dailyGasOutput}</div>
          <div className={`text-xs ${subtitleColor}`}>日产气量 Nm³</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="发酵参数" isDark={isDark} />
        <ParamRow label="日处理量" value={item.dailyFeedCapacity} unit="t/d" isDark={isDark} />
        <ParamRow label="甲烷含量" value={item.methaneContent} unit="%" isDark={isDark} />
        <ParamRow label="发酵温度" value={item.fermentationTemp} unit="°C" isDark={isDark} />
        <ParamRow label="停留时间" value={item.retentionTime} unit="天" isDark={isDark} />
        <ParamGroup title="适用原料" isDark={isDark} />
        <ParamRow label="原料类型" value={item.suitableFeedstocks.join('、')} isDark={isDark} />
        <ParamGroup title="尺寸参数" isDark={isDark} />
        <ParamRow label="直径" value={item.diameter} unit="m" isDark={isDark} />
        <ParamRow label="高度" value={item.height} unit="m" isDark={isDark} />
      </div>
    </>
  );

  const renderGasEngine = (item: GasEngineSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
          <Zap className={`w-8 h-8 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.fuelType}发电机</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20' : 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>⚡ 热电联产，能效双收</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>额定功率{item.ratedPower}kW，热电联产效率高达{item.CHPEfficiency}%</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{item.ratedPower}</div>
          <div className={`text-xs ${subtitleColor}`}>额定功率 kW</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{item.CHPEfficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>热电联产效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="效率参数" isDark={isDark} />
        <ParamRow label="燃气消耗" value={item.gasConsumption} unit="Nm³/h" isDark={isDark} />
        <ParamRow label="发电效率" value={item.electricalEfficiency} unit="%" isDark={isDark} />
        <ParamRow label="热效率" value={item.thermalEfficiency} unit="%" isDark={isDark} />
        <ParamRow label="热电联产效率" value={item.CHPEfficiency} unit="%" isDark={isDark} />
        <ParamGroup title="发电机参数" isDark={isDark} />
        <ParamRow label="输出电压" value={item.outputVoltage} unit="V" isDark={isDark} />
        <ParamRow label="频率" value={item.frequency} unit="Hz" isDark={isDark} />
        <ParamRow label="功率因数" value={item.powerFactor} isDark={isDark} />
        <ParamGroup title="运行参数" isDark={isDark} />
        <ParamRow label="额定转速" value={item.ratedSpeed} unit="rpm" isDark={isDark} />
        <ParamRow label="冷却方式" value={item.coolingType} isDark={isDark} />
        <ParamRow label="启动方式" value={item.startupType} isDark={isDark} />
        <ParamRow label="噪音" value={`≤${item.noiseLevel}`} unit="dB(A)" isDark={isDark} />
        <ParamGroup title="尺寸参数" isDark={isDark} />
        <ParamRow label="长×宽×高" value={`${item.length}×${item.width}×${item.height}`} unit="mm" isDark={isDark} />
        <ParamRow label="重量" value={item.weight} unit="kg" isDark={isDark} />
      </div>
    </>
  );


  const renderSteamTurbine = (item: SteamTurbineSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
          <Zap className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · 汽轮发电机组</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20' : 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>🔄 蒸汽驱动，稳定输出</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>额定功率{item.ratedPower}MW，发电效率{item.efficiency}%，适配生物质锅炉</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{item.ratedPower}</div>
          <div className={`text-xs ${subtitleColor}`}>额定功率 MW</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{item.efficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>发电效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="进汽参数" isDark={isDark} />
        <ParamRow label="进汽压力" value={item.inletPressure} unit="MPa" isDark={isDark} />
        <ParamRow label="进汽温度" value={item.inletTemp} unit="°C" isDark={isDark} />
        <ParamRow label="汽耗率" value={item.steamConsumption} unit="kg/kWh" isDark={isDark} />
        <ParamGroup title="发电机参数" isDark={isDark} />
        <ParamRow label="输出电压" value={item.outputVoltage} unit="kV" isDark={isDark} />
        <ParamRow label="频率" value={item.frequency} unit="Hz" isDark={isDark} />
        <ParamRow label="功率因数" value={item.powerFactor} isDark={isDark} />
        <ParamGroup title="运行参数" isDark={isDark} />
        <ParamRow label="额定转速" value={item.ratedSpeed} unit="rpm" isDark={isDark} />
        <ParamRow label="冷却方式" value={item.coolingType} isDark={isDark} />
      </div>
    </>
  );

  const renderBattery = (item: BatterySpec) => {
    const slogan = getBatterySlogan(item);
    return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
          <Battery className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.type}</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20' : 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{slogan.title}</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>{slogan.desc}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{item.energyCapacity}</div>
          <div className={`text-xs ${subtitleColor}`}>能量容量 kWh</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.cycleLife}</div>
          <div className={`text-xs ${subtitleColor}`}>循环寿命 次</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="基本参数" isDark={isDark} />
        <ParamRow label="标称容量" value={item.nominalCapacity} unit="Ah" isDark={isDark} />
        <ParamRow label="标称电压" value={item.nominalVoltage} unit="V" isDark={isDark} />
        <ParamGroup title="充放电参数" isDark={isDark} />
        <ParamRow label="标准充电电流" value={item.chargeCurrent} unit="A" isDark={isDark} />
        <ParamRow label="标准放电电流" value={item.dischargeCurrent} unit="A" isDark={isDark} />
        <ParamRow label="最大充电电流" value={item.maxChargeCurrent} unit="A" isDark={isDark} />
        <ParamRow label="最大放电电流" value={item.maxDischargeCurrent} unit="A" isDark={isDark} />
        <ParamGroup title="性能参数" isDark={isDark} />
        <ParamRow label="放电深度 DOD" value={item.DOD} unit="%" isDark={isDark} />
        <ParamRow label="充放电效率" value={item.efficiency} unit="%" isDark={isDark} />
        <ParamRow label="自放电率" value={`≤${item.selfDischarge}`} unit="%/月" isDark={isDark} />
        <ParamGroup title="环境参数" isDark={isDark} />
        <ParamRow label="工作温度范围" value={`${item.operatingTempMin} ~ ${item.operatingTempMax}`} unit="°C" isDark={isDark} />
        <ParamGroup title="尺寸参数" isDark={isDark} />
        <ParamRow label="长×宽×高" value={`${item.length}×${item.width}×${item.height}`} unit="mm" isDark={isDark} />
        <ParamRow label="重量" value={item.weight} unit="kg" isDark={isDark} />
        <ParamGroup title="质保与价格" isDark={isDark} />
        <ParamRow label="质保年限" value={item.warrantyYears} unit="年" isDark={isDark} />
        <ParamRow label="单位容量价格" value={item.pricePerKWh} unit="元/kWh" isDark={isDark} />
      </div>
    </>
  );
  };


  const renderPCS = (item: PCSSpec) => (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
          <Zap className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · 储能变流器</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>🔄 双向变流，智能调度</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>额定功率{item.ratedPower}kW，转换效率{item.efficiency}%，支持并网/离网切换</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{item.ratedPower}</div>
          <div className={`text-xs ${subtitleColor}`}>额定功率 kW</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.efficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="电池侧参数" isDark={isDark} />
        <ParamRow label="电池电压范围" value={`${item.batteryVoltageMin} ~ ${item.batteryVoltageMax}`} unit="V" isDark={isDark} />
        <ParamRow label="最大充电电流" value={item.maxChargeCurrent} unit="A" isDark={isDark} />
        <ParamRow label="最大放电电流" value={item.maxDischargeCurrent} unit="A" isDark={isDark} />
        <ParamGroup title="电网侧参数" isDark={isDark} />
        <ParamRow label="电网电压" value={item.gridVoltage} unit="V" isDark={isDark} />
        <ParamRow label="电网频率" value={item.gridFrequency} unit="Hz" isDark={isDark} />
        <ParamGroup title="功能特性" isDark={isDark} />
        <div className="flex flex-wrap gap-2 mt-2">
          {item.functions.map((func, i) => (
            <span key={i} className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>{func}</span>
          ))}
        </div>
      </div>
    </>
  );

  const renderInverter = (item: InverterSpec) => {
    const slogan = getInverterSlogan(item);
    return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${isDark ? 'bg-gray-500/20' : 'bg-gray-100'}`}>
          <Settings className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
        </div>
        <div>
          <h3 className={`text-2xl font-bold ${titleColor}`}>{item.model}</h3>
          <p className={subtitleColor}>{item.manufacturer} · {item.type}逆变器</p>
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${isDark ? 'bg-gradient-to-r from-gray-500/10 to-blue-500/10 border border-gray-500/20' : 'bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200'}`}>
        <div className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{slogan.title}</div>
        <div className={`text-xs mt-1 ${sloganDescColor}`}>{slogan.desc}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{item.ratedPower}</div>
          <div className={`text-xs ${subtitleColor}`}>额定功率 kW</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.maxEfficiency}%</div>
          <div className={`text-xs ${subtitleColor}`}>最大效率</div>
        </div>
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>¥{item.price}万</div>
          <div className={`text-xs ${subtitleColor}`}>参考价格</div>
        </div>
      </div>

      <div className={`rounded-xl p-4 ${cardBg}`}>
        <ParamGroup title="输入参数" isDark={isDark} />
        <ParamRow label="最大直流电压" value={item.maxDCVoltage} unit="V" isDark={isDark} />
        <ParamRow label="MPPT电压范围" value={`${item.MPPTVoltageMin} ~ ${item.MPPTVoltageMax}`} unit="V" isDark={isDark} />
        <ParamRow label="MPPT路数" value={item.MPPTCount} unit="路" isDark={isDark} />
        <ParamRow label="最大输入电流" value={item.maxInputCurrent} unit="A" isDark={isDark} />
        <ParamGroup title="输出参数" isDark={isDark} />
        <ParamRow label="输出电压" value={item.outputVoltage} unit="V" isDark={isDark} />
        <ParamRow label="输出频率" value={item.outputFrequency} unit="Hz" isDark={isDark} />
        <ParamRow label="功率因数" value={item.powerFactor} isDark={isDark} />
        <ParamRow label="谐波畸变率" value={`≤${item.THD}`} unit="%" isDark={isDark} />
        <ParamGroup title="效率参数" isDark={isDark} />
        <ParamRow label="最大效率" value={item.maxEfficiency} unit="%" isDark={isDark} />
        <ParamRow label="欧洲效率" value={item.euroEfficiency} unit="%" isDark={isDark} />
        <ParamGroup title="环境参数" isDark={isDark} />
        <ParamRow label="工作温度范围" value={`${item.operatingTempMin} ~ ${item.operatingTempMax}`} unit="°C" isDark={isDark} />
        <ParamRow label="防护等级" value={item.IP} isDark={isDark} />
        <ParamGroup title="尺寸参数" isDark={isDark} />
        <ParamRow label="长×宽×高" value={`${item.length}×${item.width}×${item.height}`} unit="mm" isDark={isDark} />
        <ParamRow label="重量" value={item.weight} unit="kg" isDark={isDark} />
        <ParamGroup title="保护功能" isDark={isDark} />
        <div className="flex flex-wrap gap-2 mt-2">
          {item.protections.map((p, i) => (
            <span key={i} className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{p}</span>
          ))}
        </div>
      </div>
    </>
  );
  };

  // 根据类型渲染对应详情
  switch (type) {
    case 'solar_panel': return renderSolarPanel(equipment);
    case 'wind_turbine': return renderWindTurbine(equipment);
    case 'boiler': return renderBoiler(equipment);
    case 'gasifier': return renderGasifier(equipment);
    case 'digester': return renderDigester(equipment);
    case 'gas_engine':
    case 'biogas_engine': return renderGasEngine(equipment);
    case 'steam_turbine': return renderSteamTurbine(equipment);
    case 'battery': return renderBattery(equipment);
    case 'pcs': return renderPCS(equipment);
    case 'inverter': return renderInverter(equipment);
    default: return <div className="text-gray-500">未知设备类型</div>;
  }
}
