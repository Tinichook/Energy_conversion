// 测试逆变器选型功能
import { selectInverters } from './src/OptimizationEngine';

// 测试1：工业区5MW光伏系统
console.log('测试1：工业区5MW光伏系统');
const result1 = selectInverters(5, '工业区', { Vmp: 41.58, Voc: 49.62, Isc: 13.98 });
console.log('逆变器配置：', result1);
console.log('总容量：', result1.reduce((sum, inv) => sum + inv.totalCapacity, 0), 'kW');
console.log('总成本：', result1.reduce((sum, inv) => sum + inv.totalPrice, 0), '万元');
console.log('');

// 测试2：农业区2MW光伏系统
console.log('测试2：农业区2MW光伏系统');
const result2 = selectInverters(2, '农业区', { Vmp: 31.0, Voc: 37.2, Isc: 13.96 });
console.log('逆变器配置：', result2);
console.log('总容量：', result2.reduce((sum, inv) => sum + inv.totalCapacity, 0), 'kW');
console.log('总成本：', result2.reduce((sum, inv) => sum + inv.totalPrice, 0), '万元');
console.log('');

// 测试3：林业区500kW光伏系统
console.log('测试3：林业区500kW光伏系统');
const result3 = selectInverters(0.5, '林业区', { Vmp: 31.0, Voc: 37.2, Isc: 13.96 });
console.log('逆变器配置：', result3);
console.log('总容量：', result3.reduce((sum, inv) => sum + inv.totalCapacity, 0), 'kW');
console.log('总成本：', result3.reduce((sum, inv) => sum + inv.totalPrice, 0), '万元');
