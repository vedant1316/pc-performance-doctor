"""Verification script demonstrating real data collection from the host Windows PC."""

import json
import time
from collectors import collect_snapshot

print("=================================================================")
print("   PC PERFORMANCE DOCTOR - PHASE 1 METRICS COLLECTORS VERIFICATION")
print("=================================================================\n")

for tick in range(1, 4):
    print(f"--- [Tick {tick}/3] Collecting real hardware metrics ---")
    time.sleep(1.0)
    snapshot = collect_snapshot()
    
    print(f"Timestamp:       {snapshot.timestamp}")
    print(f"CPU Utilization: {snapshot.cpu_percent}% (Freq: {snapshot.cpu_freq_mhz} MHz, Cores: {snapshot.per_core_percent})")
    print(f"CPU Temperature: {snapshot.cpu_temp_c if snapshot.cpu_temp_c is not None else 'N/A (Unavailable on this hardware/privilege)'}")
    print(f"RAM Usage:       {snapshot.ram_percent}% ({snapshot.ram_used_mb} MB used / {snapshot.ram_total_mb} MB total, {snapshot.ram_available_mb} MB available)")
    print(f"Pagefile:        {snapshot.pagefile_percent}% ({snapshot.pagefile_used_mb} MB / {snapshot.pagefile_total_mb} MB)")
    print(f"Disk Busy:       {snapshot.disk_percent_busy}% (Read: {snapshot.disk_read_bps} B/s, Write: {snapshot.disk_write_bps} B/s)")
    print(f"GPU:             {snapshot.gpu_name or 'None'} | Load: {snapshot.gpu_percent}% | Temp: {snapshot.gpu_temp_c}°C | VRAM: {snapshot.gpu_vram_percent}%")
    print(f"Network:         Sent: {snapshot.net_sent_bps} B/s | Recv: {snapshot.net_recv_bps} B/s")
    
    print("\nTop Active Processes:")
    for proc in snapshot.top_processes[:5]:
        elevated_str = "Elevated" if proc["is_elevated"] else "Standard"
        print(f"  - PID {proc['pid']:<6} | {proc['name']:<25} | CPU: {proc['cpu_percent']:>5.1f}% | RAM: {proc['ram_mb']:>7.1f} MB | IO: {proc['io_percent']:>5.1f}% | [{elevated_str}]")
    
    print("\nWebSocket `metrics_tick` payload format:")
    print(json.dumps(snapshot.to_metrics_tick(), indent=2))
    print("\n" + "=" * 65 + "\n")
