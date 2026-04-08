/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
} from 'lightweight-charts';
import { stockAPI, HistoricalDataPoint, TimeFrame, Prediction } from '../services/api';

interface StockChartProps {
  historicalData: HistoricalDataPoint[];
  symbol: string;
  livePrice?: number;
  liveVolume?: number;
  predictions?: Prediction[];
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

function formatVol(vol: number): string {
  if (vol >= 10000000) return (vol / 10000000).toFixed(2) + ' Cr';
  if (vol >= 100000) return (vol / 100000).toFixed(2) + ' L';
  if (vol >= 1000) return (vol / 1000).toFixed(1) + ' K';
  return vol.toFixed(0);
}

const StockChart: React.FC<StockChartProps> = ({
  historicalData: defaultData,
  symbol,
  livePrice,
  liveVolume,
  predictions,
}) => {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeFrame>('1M');
  const [chartData, setChartData] = useState<HistoricalDataPoint[]>(defaultData);
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const predictionSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Reset on new search
  useEffect(() => {
    setChartData(defaultData);
    setActiveTimeframe('1M');
  }, [defaultData, symbol]);

  // Build chart
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b95b0',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(99, 102, 241, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true, // Fixed the issue of trailing empty space
        rightOffset: 5,     // Slight breathe room on the right
        barSpacing: 8,      // Better spacing for candles
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const predSeries = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      lineStyle: 2,
      title: 'Prediction',
      priceScaleId: 'right',
    });
    predictionSeriesRef.current = predSeries;

    // Prepare data
    const sortedData = [...chartData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const seen = new Set<string>();
    const uniqueData = sortedData.filter((d) => {
      const key = (activeTimeframe === '1D' || activeTimeframe === '1W') ? d.date : d.date.split('T')[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const useTimestamp = activeTimeframe === '1D' || activeTimeframe === '1W';

    const candleData: CandlestickData<Time>[] = uniqueData.map((d) => ({
      time: (useTimestamp
        ? Math.floor(new Date(d.date).getTime() / 1000)
        : d.date.split('T')[0]) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData<Time>[] = uniqueData.map((d) => ({
      time: (useTimestamp
        ? Math.floor(new Date(d.date).getTime() / 1000)
        : d.date.split('T')[0]) as Time,
      value: d.volume,
      color:
        d.close >= d.open
          ? 'rgba(16, 185, 129, 0.22)'
          : 'rgba(239, 68, 68, 0.22)',
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // AI Predictions
    if (predictions && predictions.length > 0 && activeTimeframe === '1M') {
      const lastPoint = uniqueData[uniqueData.length - 1];
      const lastDate = new Date(lastPoint.date);
      
      const predLineData: LineData<Time>[] = [
        { time: lastPoint.date.split('T')[0] as Time, value: lastPoint.close }
      ];

      predictions.forEach((p) => {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + p.day);
        
        const day = nextDate.getDay();
        if (day === 0) nextDate.setDate(nextDate.getDate() + 1);
        if (day === 6) nextDate.setDate(nextDate.getDate() + 2);

        predLineData.push({
          time: nextDate.toISOString().split('T')[0] as Time,
          value: p.price,
        });
      });

      predSeries.setData(predLineData);
    } else {
      predSeries.setData([]);
    }

    // Force fitting content and then set visible range to the end
    chart.timeScale().fitContent();
    
    // Crosshair tooltip
    chart.subscribeCrosshairMove((param: any) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;

      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = 'none';
        return;
      }

      const candleInfo = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const volInfo = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;
      const predInfo = param.seriesData.get(predSeries) as LineData<Time> | undefined;

      if (!candleInfo && !predInfo) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.display = 'block';

      if (candleInfo) {
        const change = candleInfo.close - candleInfo.open;
        const changePct = ((change / candleInfo.open) * 100).toFixed(2);
        const isUp = change >= 0;

        tooltip.innerHTML = `
          <div class="ohlc-tooltip-row">
            <span class="ohlc-label">O</span>
            <span class="ohlc-val">₹${candleInfo.open.toFixed(2)}</span>
            <span class="ohlc-label">H</span>
            <span class="ohlc-val">₹${candleInfo.high.toFixed(2)}</span>
          </div>
          <div class="ohlc-tooltip-row">
            <span class="ohlc-label">L</span>
            <span class="ohlc-val">₹${candleInfo.low.toFixed(2)}</span>
            <span class="ohlc-label">C</span>
            <span class="ohlc-val ${isUp ? 'ohlc-up' : 'ohlc-down'}">₹${candleInfo.close.toFixed(2)}</span>
          </div>
          <div class="ohlc-tooltip-row">
            <span class="ohlc-label">Chg</span>
            <span class="ohlc-val ${isUp ? 'ohlc-up' : 'ohlc-down'}">${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct}%)</span>
            ${volInfo ? `<span class="ohlc-label">Vol</span><span class="ohlc-val">${formatVol(volInfo.value)}</span>` : ''}
          </div>
        `;
      } else if (predInfo) {
        tooltip.innerHTML = `
          <div class="ohlc-tooltip-row">
            <span class="ohlc-label" style="color: #a855f7">PRED</span>
            <span class="ohlc-val" style="color: #a855f7">₹${predInfo.value.toFixed(2)}</span>
          </div>
          <div class="ohlc-tooltip-row">
            <span class="ohlc-label">Date</span>
            <span class="ohlc-val">${param.time}</span>
          </div>
        `;
      }

      const containerRect = container.getBoundingClientRect();
      let left = param.point.x + 16;
      const top = Math.max(param.point.y - 10, 10);
      if (left + 230 > containerRect.width) left = param.point.x - 230;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, activeTimeframe, predictions]);

  // Real-time updates
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !livePrice) return;
    if (chartData.length === 0) return;

    const lastPoint = chartData[chartData.length - 1];
    const useTimestamp = activeTimeframe === '1D' || activeTimeframe === '1W';
    const time = (useTimestamp
      ? Math.floor(new Date(lastPoint.date).getTime() / 1000)
      : lastPoint.date.split('T')[0]) as Time;

    candlestickSeriesRef.current.update({
      time,
      open: lastPoint.open,
      high: Math.max(lastPoint.high, livePrice),
      low: Math.min(lastPoint.low, livePrice),
      close: livePrice,
    });

    if (liveVolume) {
      volumeSeriesRef.current.update({
        time,
        value: liveVolume,
        color:
          livePrice >= lastPoint.open
            ? 'rgba(16, 185, 129, 0.22)'
            : 'rgba(239, 68, 68, 0.22)',
      });
    }
  }, [livePrice, liveVolume, activeTimeframe, chartData]);

  const handleTimeframeChange = useCallback(
    async (tf: TimeFrame) => {
      setActiveTimeframe(tf);
      if (tf === '1M') {
        setChartData(defaultData);
        return;
      }

      setIsLoadingTimeframe(true);
      try {
        const response = await stockAPI.chart(symbol, tf);
        setChartData(response.data.historicalData);
      } catch {
        console.error('Failed to fetch chart data for timeframe:', tf);
      } finally {
        setIsLoadingTimeframe(false);
      }
    },
    [symbol, defaultData]
  );

  return (
    <div className="chart-container-full">
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

      {isLoadingTimeframe && (
        <div className="chart-loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      <div
        ref={chartContainerRef}
        className="candlestick-chart-area"
        style={{ width: '100%', height: 420 }}
      >
        <div
          ref={tooltipRef}
          className="ohlc-tooltip"
          style={{ display: 'none' }}
        ></div>
      </div>
    </div>
  );
};

export default StockChart;
