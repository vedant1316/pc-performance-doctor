import { useEffect, useRef, useState, useCallback } from 'react';
import { ConnectionStatus, MetricsTick, DiagnosisResult } from '../types/telemetry';

const DEFAULT_WS_URL = 'ws://127.0.0.1:8765';
const MAX_HISTORY_LENGTH = 40;
const PING_INTERVAL_MS = 5000;

export interface UseAgentSocketReturn {
  status: ConnectionStatus;
  latestTick: MetricsTick | null;
  history: MetricsTick[];
  latencyMs: number | null;
  lastDiagnosis: DiagnosisResult | null;
  sendMessage: (data: unknown) => void;
  reconnect: () => void;
}

export function useAgentSocket(url: string = DEFAULT_WS_URL): UseAgentSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [latestTick, setLatestTick] = useState<MetricsTick | null>(null);
  const [history, setHistory] = useState<MetricsTick[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<DiagnosisResult | null>(null);

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
    sendMessage,
    reconnect,
  };
}
