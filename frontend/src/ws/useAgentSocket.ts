import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ConnectionStatus,
  MetricsTick,
  DiagnosisResult,
  TimelineResult,
  BenchmarkResult,
  ExportPdfResult,
} from '../types/telemetry';

const DEFAULT_WS_URL = 'ws://127.0.0.1:8765';
const MAX_HISTORY_LENGTH = 40;
const PING_INTERVAL_MS = 5000;

export interface UseAgentSocketReturn {
  status: ConnectionStatus;
  latestTick: MetricsTick | null;
  history: MetricsTick[];
  latencyMs: number | null;
  lastDiagnosis: DiagnosisResult | null;
  lastTimelineResult: TimelineResult | null;
  lastBenchmarkResult: BenchmarkResult | null;
  isBenchmarking: boolean;
  lastPdfResult: ExportPdfResult | null;
  isExportingPdf: boolean;
  sendMessage: (data: unknown) => void;
  queryTimeline: (start?: string, end?: string) => void;
  runBenchmark: () => void;
  exportPdf: () => void;
  reconnect: () => void;
}

export function useAgentSocket(url: string = DEFAULT_WS_URL): UseAgentSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [latestTick, setLatestTick] = useState<MetricsTick | null>(null);
  const [history, setHistory] = useState<MetricsTick[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<DiagnosisResult | null>(null);
  const [lastTimelineResult, setLastTimelineResult] = useState<TimelineResult | null>(null);
  const [lastBenchmarkResult, setLastBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [lastPdfResult, setLastPdfResult] = useState<ExportPdfResult | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const pingSentTimeRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
    isManuallyClosedRef.current = false;

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Start ping heartbeat
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingSentTimeRef.current = performance.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'metrics_tick') {
            const tick = data as MetricsTick;
            setLatestTick(tick);
            setHistory((prev) => {
              const updated = [...prev, tick];
              if (updated.length > MAX_HISTORY_LENGTH) {
                return updated.slice(updated.length - MAX_HISTORY_LENGTH);
              }
              return updated;
            });
          } else if (data.type === 'pong') {
            if (pingSentTimeRef.current !== null) {
              const rtt = Math.round(performance.now() - pingSentTimeRef.current);
              setLatencyMs(rtt);
              pingSentTimeRef.current = null;
            }
          } else if (data.type === 'diagnosis_result') {
            setLastDiagnosis(data as DiagnosisResult);
          } else if (data.type === 'timeline_result') {
            setLastTimelineResult(data as TimelineResult);
          } else if (data.type === 'benchmark_result') {
            setLastBenchmarkResult(data as BenchmarkResult);
            setIsBenchmarking(false);
          } else if (data.type === 'export_pdf_result') {
            const pdfRes = data as ExportPdfResult;
            setLastPdfResult(pdfRes);
            setIsExportingPdf(false);

            if (pdfRes.success && pdfRes.pdf_base64) {
              try {
                const byteCharacters = atob(pdfRes.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const downloadUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = pdfRes.filename || 'health_report.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(downloadUrl);
              } catch (err) {
                console.error('Failed to trigger PDF download:', err);
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse incoming WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (!isManuallyClosedRef.current) {
          setStatus('reconnecting');
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 8000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      setStatus('disconnected');
    }
  }, [url]);

  const sendMessage = useCallback((data: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message: WebSocket is not connected.');
    }
  }, []);

  const queryTimeline = useCallback((start?: string, end?: string) => {
    sendMessage({
      type: 'timeline_query',
      start: start || '',
      end: end || '',
    });
  }, [sendMessage]);

  const runBenchmark = useCallback(() => {
    setIsBenchmarking(true);
    sendMessage({ type: 'benchmark_request' });
  }, [sendMessage]);

  const exportPdf = useCallback(() => {
    setIsExportingPdf(true);
    sendMessage({ type: 'export_pdf_request' });
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  return {
    status,
    latestTick,
    history,
    latencyMs,
    lastDiagnosis,
    lastTimelineResult,
    lastBenchmarkResult,
    isBenchmarking,
    lastPdfResult,
    isExportingPdf,
    sendMessage,
    queryTimeline,
    runBenchmark,
    exportPdf,
    reconnect,
  };
}


