/* eslint-disable @typescript-eslint/no-explicit-any */
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

const StockChart: React.FC<StockChartProps> = ({
  historicalData,
  predictions,
  symbol,
}) => {
  const historicalLabels = historicalData.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const predictionLabels = predictions
    ? predictions.map((p) => `Day +${p.day}`)
    : [];

  const allLabels = [...historicalLabels, ...predictionLabels];

  const historicalPrices = historicalData.map((d) => d.close);
  const predictionPrices = predictions ? predictions.map((p) => p.price) : [];

  // For the prediction line, connect it from the last historical point
  const predictionLine = [
    ...new Array(historicalPrices.length - 1).fill(null),
    historicalPrices[historicalPrices.length - 1],
    ...predictionPrices,
  ];

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: `${symbol} Historical Price`,
        data: [...historicalPrices, ...new Array(predictionPrices.length).fill(null)],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#6366f1',
        fill: true,
        tension: 0.4,
      },
      ...(predictions && predictions.length > 0
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
              return `${context.dataset.label || ''}: $${context.parsed.y.toFixed(2)}`;
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
          maxTicksLimit: 15,
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        ticks: {
          color: '#5a6480',
          font: { family: 'Inter', size: 11 },
          callback: (value: string | number) => `$${value}`,
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return <Line data={data} options={options} />;
};

export default StockChart;
