import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const chartStyles = ['line', 'area', 'candlestick', 'bar', 'baseline'];

export default function PriceChart({ prices, candles, style, currency, currencyRate, resetKey, showSeconds = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesStyleRef = useRef(null);
  const fittedDataKeyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 360,
      layout: { background: { color: 'transparent' }, textColor: '#9db5d1' },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(146, 179, 255, 0.18)' },
      timeScale: { borderColor: 'rgba(146, 179, 255, 0.18)', timeVisible: true, secondsVisible: showSeconds },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      crosshair: { vertLine: { labelBackgroundColor: '#1a3344' }, horzLine: { labelBackgroundColor: '#1a3344' } },
    });

    chartRef.current = chart;
    const resizeObserver = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width || 0);
      const height = Math.floor(entries[0]?.contentRect.height || 0);
      if (width > 0 && height > 0) chart.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesStyleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().applyOptions({ secondsVisible: showSeconds });

    const formatPrice = (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: currency === 'jpy' ? 0 : 2,
    }).format(value * currencyRate);
    const priceFormat = { type: 'custom', minMove: 0.000001, formatter: formatPrice };

    if (seriesStyleRef.current !== style) {
      if (seriesRef.current) chart.removeSeries(seriesRef.current);
      const seriesOptions = { priceFormat, lastValueVisible: true, priceLineVisible: true };

      if (style === 'candlestick') {
        seriesRef.current = chart.addCandlestickSeries({
          ...seriesOptions,
          upColor: '#36d399',
          downColor: '#ff647c',
          borderVisible: false,
          wickUpColor: '#36d399',
          wickDownColor: '#ff647c',
        });
      } else if (style === 'bar') {
        seriesRef.current = chart.addBarSeries({ ...seriesOptions, upColor: '#36d399', downColor: '#ff647c' });
      } else if (style === 'area') {
        seriesRef.current = chart.addAreaSeries({
          ...seriesOptions,
          lineColor: '#5ec4ff',
          topColor: 'rgba(94, 196, 255, 0.36)',
          bottomColor: 'rgba(94, 196, 255, 0.02)',
        });
      } else if (style === 'baseline') {
        seriesRef.current = chart.addBaselineSeries({
          ...seriesOptions,
          baseValue: { type: 'price', price: Number(prices.prices?.[0] || 0) },
          topLineColor: '#36d399',
          topFillColor1: 'rgba(54, 211, 153, 0.25)',
          topFillColor2: 'rgba(54, 211, 153, 0.02)',
          bottomLineColor: '#ff647c',
          bottomFillColor1: 'rgba(255, 100, 124, 0.02)',
          bottomFillColor2: 'rgba(255, 100, 124, 0.2)',
        });
      } else {
        seriesRef.current = chart.addLineSeries({ ...seriesOptions, color: '#5ec4ff', lineWidth: 2 });
      }

      seriesStyleRef.current = style;
    } else {
      seriesRef.current.applyOptions({ priceFormat });
    }

    let pointCount = 0;
    let firstPointTime = '';

    if (style === 'candlestick' || style === 'bar') {
      const candleData = (candles || [])
        .map((candle) => ({
          time: Math.floor(new Date(candle.time).getTime() / 1000),
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
        }))
        .filter((candle) => Number.isFinite(candle.time) && Number.isFinite(candle.open)
          && Number.isFinite(candle.high) && Number.isFinite(candle.low) && Number.isFinite(candle.close));
      seriesRef.current.setData(candleData);
      pointCount = candleData.length;
      firstPointTime = candleData[0]?.time || '';
    } else {
      const lineData = (prices.times || [])
        .map((time, index) => ({ time: Math.floor(Number(time)), value: Number(prices.prices?.[index]) }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
      seriesRef.current.setData(lineData);
      pointCount = lineData.length;
      firstPointTime = lineData[0]?.time || '';
    }

    const fittedDataKey = `${style}:${resetKey}`;
    if (pointCount && fittedDataKeyRef.current !== fittedDataKey) {
      chart.timeScale().fitContent();
      fittedDataKeyRef.current = fittedDataKey;
    }
  }, [candles, currency, currencyRate, prices, resetKey, showSeconds, style]);

  return <div className="interactive-price-chart" ref={containerRef} role="img" aria-label={`${chartStyles.includes(style) ? style : 'line'} price chart`} />;
}