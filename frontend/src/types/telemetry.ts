export interface ProcessTickItem {
  pid: number;
  name: string;
  cpu_percent: number;
  ram_mb: number;
  io_percent?: number;
  is_elevated?: number;
}

export interface MetricsTick {
  type: 'metrics_tick';
  timestamp: string;
  cpu_percent: number;
  ram_percent: number;
  ram_available_mb: number;
  disk_percent_busy: number;
  gpu_percent: number | null;
  net_sent_bps: number;
  net_recv_bps: number;
  top_processes: ProcessTickItem[];

  // Enriched hardware telemetry
  cpu_temp_c?: number | null;
  per_core_percent?: number[];
  cpu_freq_mhz?: number | null;
  ram_total_mb?: number;
  ram_used_mb?: number;
  pagefile_percent?: number | null;
  disk_read_bps?: number;
  disk_write_bps?: number;
  gpu_temp_c?: number | null;
  gpu_vram_percent?: number | null;
  gpu_name?: string | null;
  top_process_cpu_percent?: number;
  top_process_io_percent?: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export interface ServerStatusMessage {
  type: 'status';
  status: string;
  message: string;
  phase: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export interface DiagnosisFix {
  action: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  impact: 'low' | 'medium' | 'high';
}

export interface DiagnosisResult {
  type: 'diagnosis_result';
  diagnosis: {
    label: string;
    rule_id: string;
    severity: 'none' | 'low' | 'medium' | 'high';
    health_score: number;
    contributing_processes: string[];
  };
  explanation?: {
    summary: string;
    root_cause: string;
    fixes: DiagnosisFix[];
    expected_improvement: string;
  };
  llm_call_succeeded: boolean;
}
