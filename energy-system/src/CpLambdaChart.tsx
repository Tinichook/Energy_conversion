/**
 * Cp-λ 曲线绘制组件
 * 风能利用系数与叶尖速比关系图
 * 
 * 两种计算方法：
 * 1. 简化线性公式：Cp = λ/k (k=44)，叶尖速比与功率系数近似线性关系
 * 2. Matlab经验公式：Cp = c1*(c2/λi - c3*β - c4)*exp(-c5/λi) + c6*λ
 */

import React, { useEffect, useRef, useState } from 'react';

// ============================================
// 方法1: 简化线性公式 Cp = λ/k
// ============================================

const K_CONSTANT = 44; // 常数k，根据参考文档取44

/**
 * 简化线性公式计算Cp
 * Cp = λ/k (k=44)
 * 
 * @param lambda 叶尖速比
 * @returns 风能利用系数 Cp
 */
function calculateCpLinear(lambda: number): number {
  const Cp = lambda / K_CONSTANT;
  // Cp最大不超过贝茨极限 0.593
  return Math.min(Cp, 0.593);
}

// ============================================
// 方法2: Matlab经验公式
// ============================================

// Cp-λ 计算参数（Matlab风机模型）
const CP_PARAMS = {
  c1: 0.5176,
  c2: 116,
  c3: 0.4,
  c4: 5,
  c5: 21,
  c6: 0.0068
};

/**
 * Matlab经验公式计算Cp
 * Cp = c1*(c2/λi - c3*β - c4)*exp(-c5/λi) + c6*λ
 * 
 * @param lambda 叶尖速比
 * @param beta 桨距角 (度)
 * @returns 风能利用系数 Cp
 */
function calculateCp(lambda: number, beta: number): number {
  const { c1, c2, c3, c4, c5, c6 } = CP_PARAMS;
  
  // 计算 λi
  const lambdaI = 1 / (1 / (lambda + 0.08 * beta) - 0.035 / (Math.pow(beta, 3) + 1));
  
  // 计算 Cp
  const Cp = c1 * ((c2 / lambdaI) - c3 * beta - c4) * Math.exp(-c5 / lambdaI) + c6 * lambda;
  
  return Cp;
}

// 生成Cp-λ数据（Matlab公式）
function generateCpLambdaData(beta: number, lambdaRange: number[] = [0.1, 18], step: number = 0.1): { lambda: number; cp: number }[] {
  const data: { lambda: number; cp: number }[] = [];
  
  for (let lambda = lambdaRange[0]; lambda <= lambdaRange[1]; lambda += step) {
    const cp = calculateCp(lambda, beta);
    data.push({ lambda, cp });
  }
  
  return data;
}

// 生成Cp-λ数据（线性公式）
function generateCpLambdaDataLinear(lambdaRange: number[] = [0.1, 18], step: number = 0.1): { lambda: number; cp: number }[] {
  const data: { lambda: number; cp: number }[] = [];
  
  for (let lambda = lambdaRange[0]; lambda <= lambdaRange[1]; lambda += step) {
    const cp = calculateCpLinear(lambda);
    data.push({ lambda, cp });
  }
  
  return data;
}

// 找到最大Cp点
function findOptimalPoint(beta: number): { lambda: number; cp: number } {
  let maxCp = -Infinity;
  let optLambda = 0;
  
  for (let lambda = 0.1; lambda <= 18; lambda += 0.01) {
    const cp = calculateCp(lambda, beta);
    if (cp > maxCp) {
      maxCp = cp;
      optLambda = lambda;
    }
  }
  
  return { lambda: optLambda, cp: maxCp };
}

// 颜色数组
const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8'
];

interface CpLambdaChartProps {
  width?: number;
  height?: number;
  showOptimalPoint?: boolean;
}

export const CpLambdaChart: React.FC<CpLambdaChartProps> = ({
  width = 800,
  height = 500,
  showOptimalPoint = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [optimalPoint, setOptimalPoint] = useState<{ lambda: number; cp: number } | null>(null);
  const [selectedBeta, setSelectedBeta] = useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 绘图区域
    const margin = { top: 40, right: 120, bottom: 60, left: 70 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // 坐标轴范围
    const xMin = 0, xMax = 18;
    const yMin = -1.2, yMax = 0.6;

    // 坐标转换函数
    const toCanvasX = (x: number) => margin.left + (x - xMin) / (xMax - xMin) * plotWidth;
    const toCanvasY = (y: number) => margin.top + (yMax - y) / (yMax - yMin) * plotHeight;

    // 绘制网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    
    // 垂直网格线
    for (let x = 0; x <= 18; x += 2) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), margin.top);
      ctx.lineTo(toCanvasX(x), height - margin.bottom);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let y = -1.2; y <= 0.6; y += 0.2) {
      ctx.beginPath();
      ctx.moveTo(margin.left, toCanvasY(y));
      ctx.lineTo(width - margin.right, toCanvasY(y));
      ctx.stroke();
    }

    // 绘制坐标轴
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    
    // X轴
    ctx.beginPath();
    ctx.moveTo(margin.left, toCanvasY(0));
    ctx.lineTo(width - margin.right, toCanvasY(0));
    ctx.stroke();
    
    // Y轴
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();

    // 绘制刻度和标签
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    for (let x = 0; x <= 18; x += 2) {
      ctx.fillText(x.toString(), toCanvasX(x), height - margin.bottom + 20);
    }
    
    // Y轴刻度
    ctx.textAlign = 'right';
    for (let y = -1.2; y <= 0.6; y += 0.2) {
      ctx.fillText(y.toFixed(1), margin.left - 10, toCanvasY(y) + 4);
    }

    // 轴标签
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('λ', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Cp', 0, 0);
    ctx.restore();

    // 标题
    ctx.font = '16px Arial';
    ctx.fillText('Cp-λ 关系图', width / 2, 25);

    // 绘制不同桨距角的曲线
    const betaValues = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    
    betaValues.forEach((beta, index) => {
      const data = generateCpLambdaData(beta);
      
      ctx.strokeStyle = COLORS[index % COLORS.length];
      ctx.lineWidth = beta === selectedBeta ? 3 : 1.5;
      ctx.beginPath();
      
      let started = false;
      data.forEach(point => {
        const x = toCanvasX(point.lambda);
        const y = toCanvasY(point.cp);
        
        // 只绘制在可见范围内的点
        if (point.cp >= yMin && point.cp <= yMax) {
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      ctx.stroke();
    });

    // 绘制图例
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    const legendX = width - margin.right + 10;
    let legendY = margin.top + 10;
    
    betaValues.forEach((beta, index) => {
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.fillRect(legendX, legendY - 8, 20, 3);
      ctx.fillStyle = '#000000';
      ctx.fillText(`${beta}°`, legendX + 25, legendY);
      legendY += 18;
    });

    // 标记最优点（β=0时）
    if (showOptimalPoint) {
      const optimal = findOptimalPoint(0);
      setOptimalPoint(optimal);
      
      const optX = toCanvasX(optimal.lambda);
      const optY = toCanvasY(optimal.cp);
      
      // 绘制标记点
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(optX, optY, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // 标注文字
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`λ=${optimal.lambda.toFixed(2)}`, optX + 10, optY - 10);
      ctx.fillText(`Cp=${optimal.cp.toFixed(4)}`, optX + 10, optY + 5);
    }

  }, [width, height, showOptimalPoint, selectedBeta]);

  return (
    <div className="cp-lambda-chart">
      <canvas ref={canvasRef} width={width} height={height} />
      
      {optimalPoint && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-bold text-blue-800 mb-2">最优工作点（β=0°）</h4>
          <p>最佳叶尖速比 λ_opt = <strong>{optimalPoint.lambda.toFixed(2)}</strong></p>
          <p>最大风能利用系数 Cp_max = <strong>{optimalPoint.cp.toFixed(4)}</strong></p>
        </div>
      )}
      
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择桨距角 β 查看详情：
        </label>
        <select 
          value={selectedBeta}
          onChange={(e) => setSelectedBeta(Number(e.target.value))}
          className="border rounded px-3 py-2"
        >
          {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(beta => (
            <option key={beta} value={beta}>{beta}°</option>
          ))}
        </select>
        
        {selectedBeta !== undefined && (
          <div className="mt-2 text-sm text-gray-600">
            β={selectedBeta}° 时的最优点：
            λ = {findOptimalPoint(selectedBeta).lambda.toFixed(2)}, 
            Cp = {findOptimalPoint(selectedBeta).cp.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
};

// 导出计算函数供其他模块使用
export { 
  calculateCp, 
  calculateCpLinear,
  generateCpLambdaData, 
  generateCpLambdaDataLinear,
  findOptimalPoint, 
  CP_PARAMS,
  K_CONSTANT
};
