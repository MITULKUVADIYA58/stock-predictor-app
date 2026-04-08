/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { stockAPI, HistoricalDataPoint, TimeFrame } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StockChartProps {
  historicalData: { date: string; close: number }[];
  predictions?: { day: number; price: number }[];
  symbol: string;
}

const TIMEFRAMES: { label: string; value: TimeFrame }[] = [
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '5Y', value: '5Y' },
];

const StockChart: React.FC<StockChartProps> = ({
  historicalData: defaultData,
  predictions,
  symbol,
}) => {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeFrame>('1M');
  const [chartData, setChartData] = useState<{ date: string; close: number }[]>(
    defaultData
  );
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState(false);

  const handleTimeframeChange = useCallback(
    async (tf: TimeFrame) => {
      setActiveTimeframe(tf);
      if (tf === '1M') {
        // 1M is the default data from search
        setChartData(defaultData);
        return;
      }

      setIsLoadingTimeframe(true);
      try {
        const response = await stockAPI.chart(symbol, tf);
        const newData = response.data.historicalData.map((d: HistoricalDataPoint) => ({
          date: d.date,
          close: d.close,
        }));
        setChartData(newData);
      } catch {
        // On error, keep existing data
        console.error('Failed to fetch chart data for timeframe:', tf);
      } finally {
        setIsLoadingTimeframe(false);
      }
    },
    [symbol, defaultData]
  );

  // When default data changes (new search), reset to 1M
  React.useEffect(() => {
    setChartData(defaultData);
    setActiveTimeframe('1M');
  }, [defaultData]);

  const formatLabel = (dateStr: string, tf: TimeFrame) => {
    const date = new Date(dateStr);
    switch (tf) {
      case '1D':
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      case '1W':
        return date.toLocaleDateString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      case '1M':
      case '3M':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '6M':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '1Y':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case '5Y':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const historicalLabels = chartData.map((d) => formatLabel(d.date, activeTimeframe));

  const predictionLabels =
    activeTimeframe === '1M' && predictions
      ? predictions.map((p) => `Day +${p.day}`)
      : [];

  const allLabels = [...historicalLabels, ...predictionLabels];

  const historicalPrices = chartData.map((d) => d.close);
  const predictionPrices =
    activeTimeframe === '1M' && predictions
      ? predictions.map((p) => p.price)
      : [];

  // For the prediction line, connect it from the last historical point
  const predictionLine =
    predictionPrices.length > 0
      ? [
          ...new Array(historicalPrices.length - 1).fill(null),
          historicalPrices[historicalPrices.length - 1],
          ...predictionPrices,
        ]
      : [];

  // Determine color based on overall trend
  const isPositive =
    historicalPrices.length >= 2 &&
    historicalPrices[historicalPrices.length - 1] >= historicalPrices[0];

  const lineColor = isPositive ? '#10b981' : '#ef4444';
  const fillColor = isPositive
    ? 'rgba(16, 185, 129, 0.08)'
    : 'rgba(239, 68, 68, 0.08)';

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: `${symbol} Price`,
        data: [
          ...historicalPrices,
          ...new Array(predictionPrices.length).fill(null),
        ],
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        fill: true,
        tension: 0.4,
      },
      ...(predictionPrices.length > 0
        ? [
            {
              label: 'Predicted Price',
              data: predictionLine,
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168, 85, 247, 0.08)',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 4,
              pointBackgroundColor: '#a855f7',
              pointBorderColor: '#a855f7',
              fill: true,
              tension: 0.4,
            },
          ]
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#8b95b0',
          font: { family: 'Inter', size: 12 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: '#1a2035',
        titleColor: '#f0f4ff',
        bodyColor: '#8b95b0',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { family: 'Inter', weight: 'bold' as const },
        bodyFont: { family: 'Inter' },
        callbacks: {
          label: (context: any) => {
            if (context.parsed.y !== null) {
              return `${context.dataset.label || ''}: ₹${context.parsed.y.toFixed(2)}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#5a6480',
          font: { family: 'Inter', size: 10 },
          maxRotation: 45,
          maxTicksLimit: activeTimeframe === '1D' ? 12 : 15,
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        ticks: {
          color: '#5a6480',
          font: { family: 'Inter', size: 11 },
          callback: (value: string | number) => `₹${value}`,
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="chart-container-full">
      {/* TradingView-style Timeframe Selector */}
      <div className="timeframe-selector" id="timeframe-selector">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            className={`timeframe-btn ${activeTimeframe === tf.value ? 'active' : ''}`}
            onClick={() => handleTimeframeChange(tf.value)}
            disabled={isLoadingTimeframe}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Loading overlay */}
      {isLoadingTimeframe && (
        <div className="chart-loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      <Line data={data} options={options} />
    </div>
  );
};

export default StockChart;
