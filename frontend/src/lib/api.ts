/**
 * Request payload helper functions for PC Performance Doctor WebSocket communication.
 */

export function createDiagnoseRequest() {
  return { type: 'diagnose_request' };
}

export function createTimelineQuery(startTime: string, endTime: string) {
  return {
    type: 'timeline_query',
    start: startTime,
    end: endTime,
  };
}

export function createBenchmarkRequest() {
  return { type: 'benchmark_request' };
}

export function createPingRequest() {
  return { type: 'ping' };
}
