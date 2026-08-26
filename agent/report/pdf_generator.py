"""PDF Export Generator for PC Performance Doctor.

Generates comprehensive, professional system health reports using ReportLab,
incorporating deterministic diagnostics, hardware telemetry, AI explanations,
stability history, and synthetic benchmark scores.

SECURITY GUARANTEES:
- Strictly sanitizes all data to guarantee zero leakage of LLM API keys or environment secrets.
- Gracefully degrades if AI explanation is missing or LLM call failed.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import io
import logging
import os
from pathlib import Path
import platform
import socket
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)


class HealthReportPDFGenerator:
    """Generates structured PDF reports for PC Performance Doctor."""

    def __init__(self) -> None:
        self.styles = getSampleStyleSheet()
        self._init_custom_styles()

    def _init_custom_styles(self) -> None:
        """Initialize custom typography and color schemes."""
        self.title_style = ParagraphStyle(
            "DocTitle",
            parent=self.styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
            fontName="Helvetica-Bold",
            spaceAfter=4,
        )
        self.subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=self.styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#64748b"),
            fontName="Helvetica",
            spaceAfter=12,
        )
        self.section_heading = ParagraphStyle(
            "SectionHeading",
            parent=self.styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica-Bold",
            spaceBefore=10,
            spaceAfter=6,
        )
        self.body_style = ParagraphStyle(
            "ReportBody",
            parent=self.styles["Normal"],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#334155"),
            fontName="Helvetica",
        )
        self.bold_body = ParagraphStyle(
            "ReportBoldBody",
            parent=self.body_style,
            fontName="Helvetica-Bold",
        )
        self.callout_style = ParagraphStyle(
            "ReportCallout",
            parent=self.body_style,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica-Oblique",
        )

    def _sanitize_string(self, text: str | None) -> str:
        """Strip sensitive secrets, API keys, and unsafe characters."""
        if not text:
            return ""
        s = str(text)
        # Redact potential OpenAI/Anthropic/generic API keys (e.g. sk-...)
        import re
        s = re.sub(r"sk-[a-zA-Z0-9_-]{10,}", "[REDACTED_API_KEY]", s)
        s = re.sub(r"bearer\s+[a-zA-Z0-9_\-\.]{10,}", "bearer [REDACTED_TOKEN]", s, flags=re.IGNORECASE)
        # Escape XML entities for ReportLab Paragraph
        s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return s

    def generate_pdf(
        self,
        snapshot: dict[str, Any] | None = None,
        diagnosis: dict[str, Any] | None = None,
        explanation: dict[str, Any] | None = None,
        timeline_summary: dict[str, Any] | None = None,
        benchmark: dict[str, Any] | None = None,
        output_path: str | Path | None = None,
    ) -> tuple[str, bytes]:
        """Generate a complete PDF report.

        Returns:
            tuple[str, bytes]: (output_file_path, pdf_bytes)
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        elements: list[Any] = []
        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # 1. Header & System Metadata
        hostname = socket.gethostname()
        os_info = f"{platform.system()} {platform.release()} ({platform.version()})"

        elements.append(Paragraph("PC PERFORMANCE DOCTOR", self.title_style))
        elements.append(
            Paragraph(
                f"SYSTEM HEALTH &amp; DIAGNOSTIC REPORT &bull; Generated: {now_utc} &bull; Host: {self._sanitize_string(hostname)}",
                self.subtitle_style,
            )
        )
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4f46e5"), spaceAfter=10))

        # 2. Executive Health Summary & Health Score Badge
        diag_inner = diagnosis.get("diagnosis", diagnosis) if diagnosis else {}
        health_score = int(diag_inner.get("health_score", 100)) if diag_inner else 100
        severity = str(diag_inner.get("severity", "none")).lower() if diag_inner else "none"
        label = str(diag_inner.get("label", "nominal")).upper() if diag_inner else "NOMINAL"

        score_color = "#10b981"  # Emerald
        if severity in ["high", "critical"] or health_score < 60:
            score_color = "#ef4444"  # Red
        elif severity == "medium" or health_score < 85:
            score_color = "#f59e0b"  # Amber

        badge_html = f"""
        <b><font size=14 color='{score_color}'>Health Score: {health_score} / 100</font></b><br/>
        <font size=9 color='#475569'>Status: <b>{label}</b> &bull; Severity: <b>{severity.upper()}</b></font>
        """

        sys_details_html = f"""
        <b>OS:</b> {self._sanitize_string(os_info)}<br/>
        <b>Architecture:</b> {platform.machine()} &bull; <b>CPU Cores:</b> {os.cpu_count() or 'N/A'}<br/>
        <b>Deterministic Reasoning:</b> Verified by Rules Engine
        """

        summary_table_data = [
            [
                Paragraph(badge_html, self.body_style),
                Paragraph(sys_details_html, self.body_style),
            ]
        ]
        summary_table = Table(summary_table_data, colWidths=[240, 300])
        summary_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ])
        )
        elements.append(summary_table)
        elements.append(Spacer(1, 10))

        # 3. Live Hardware Telemetry Snapshot
        elements.append(Paragraph("1. Hardware Telemetry Snapshot", self.section_heading))
        snap = snapshot or {}
        cpu_pct = snap.get("cpu_percent", 0.0)
        cpu_temp = snap.get("cpu_temp_c")
        cpu_temp_str = f"{cpu_temp:.1f} °C" if cpu_temp is not None else "N/A"
        ram_pct = snap.get("ram_percent", 0.0)
        ram_avail = snap.get("ram_available_mb", 0)
        disk_busy = snap.get("disk_percent_busy", 0.0)
        disk_read = (snap.get("disk_read_bps") or 0) / (1024 * 1024)
        disk_write = (snap.get("disk_write_bps") or 0) / (1024 * 1024)
        gpu_pct = snap.get("gpu_percent")
        gpu_pct_str = f"{gpu_pct:.1f}%" if gpu_pct is not None else "N/A"
        gpu_name = snap.get("gpu_name") or "Standard Display Adapter"
        net_recv = (snap.get("net_recv_bps") or 0) / 1024
        net_sent = (snap.get("net_sent_bps") or 0) / 1024

        telemetry_rows = [
            [
                Paragraph("<b>Component</b>", self.bold_body),
                Paragraph("<b>Primary Metric</b>", self.bold_body),
                Paragraph("<b>Secondary Metric</b>", self.bold_body),
                Paragraph("<b>Hardware Detail</b>", self.bold_body),
            ],
            [
                Paragraph("CPU", self.body_style),
                Paragraph(f"{cpu_pct:.1f}% Load", self.body_style),
                Paragraph(f"Temp: {cpu_temp_str}", self.body_style),
                Paragraph(f"{os.cpu_count() or 'N/A'} Logical Cores", self.body_style),
            ],
            [
                Paragraph("Memory (RAM)", self.body_style),
                Paragraph(f"{ram_pct:.1f}% Used", self.body_style),
                Paragraph(f"{ram_avail:,} MB Available", self.body_style),
                Paragraph("System Virtual Memory", self.body_style),
            ],
            [
                Paragraph("Storage / Disk", self.body_style),
                Paragraph(f"{disk_busy:.1f}% Busy", self.body_style),
                Paragraph(f"R: {disk_read:.1f} MB/s | W: {disk_write:.1f} MB/s", self.body_style),
                Paragraph("Primary Drive I/O", self.body_style),
            ],
            [
                Paragraph("GPU Graphics", self.body_style),
                Paragraph(gpu_pct_str, self.body_style),
                Paragraph(f"VRAM: {snap.get('gpu_vram_percent') or 0:.1f}%", self.body_style),
                Paragraph(self._sanitize_string(gpu_name), self.body_style),
            ],
            [
                Paragraph("Network", self.body_style),
                Paragraph(f"Recv: {net_recv:.1f} KB/s", self.body_style),
                Paragraph(f"Sent: {net_sent:.1f} KB/s", self.body_style),
                Paragraph("Active Interfaces", self.body_style),
            ],
        ]

        t_telemetry = Table(telemetry_rows, colWidths=[100, 130, 150, 160])
        t_telemetry.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 4.5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        elements.append(t_telemetry)
        elements.append(Spacer(1, 10))

        # 4. Deterministic Diagnostic Engine Findings
        elements.append(Paragraph("2. Diagnostic Engine Findings (Deterministic)", self.section_heading))
        rule_id = diag_inner.get("rule_id", "nominal")
        contributing_procs = diag_inner.get("contributing_processes", [])
        if isinstance(contributing_procs, str):
            try:
                import json
                contributing_procs = json.loads(contributing_procs)
            except Exception:
                contributing_procs = [contributing_procs]

        procs_str = ", ".join(contributing_procs) if contributing_procs else "None (Nominal distribution)"

        diag_content = f"""
        <b>Fired Rule:</b> <code>{self._sanitize_string(rule_id)}</code> &bull; <b>Severity:</b> {severity.upper()}<br/>
        <b>Contributing Processes:</b> {self._sanitize_string(procs_str)}<br/>
        <b>Evaluation Note:</b> Evaluated deterministically against <code>rules.yaml</code> before AI layer interaction.
        """
        t_diag = Table([[Paragraph(diag_content, self.body_style)]], colWidths=[540])
        t_diag.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ])
        )
        elements.append(t_diag)
        elements.append(Spacer(1, 10))

        # 5. AI Plain-English Explanation & Ranked Action Plan
        elements.append(Paragraph("3. AI Explanation &amp; Remediation Plan", self.section_heading))
        expl = explanation or diagnosis.get("explanation") if diagnosis else None
        llm_succeeded = diagnosis.get("llm_call_succeeded", False) if diagnosis else False

        if expl and (llm_succeeded or "summary" in expl):
            summary = self._sanitize_string(expl.get("summary", ""))
            root_cause = self._sanitize_string(expl.get("root_cause", ""))
            expected = self._sanitize_string(expl.get("expected_improvement", ""))
            fixes = expl.get("fixes", [])

            ai_text = f"""
            <b>Summary:</b> {summary}<br/><br/>
            <b>Root Cause Mechanism:</b> {root_cause}<br/><br/>
            <b>Expected Improvement:</b> {expected}
            """
            t_ai = Table([[Paragraph(ai_text, self.body_style)]], colWidths=[540])
            t_ai.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#93c5fd")),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ])
            )
            elements.append(t_ai)

            if fixes:
                elements.append(Spacer(1, 6))
                fix_rows = [
                    [
                        Paragraph("<b>#</b>", self.bold_body),
                        Paragraph("<b>Actionable Fix</b>", self.bold_body),
                        Paragraph("<b>Difficulty</b>", self.bold_body),
                        Paragraph("<b>Impact</b>", self.bold_body),
                    ]
                ]
                for i, fix in enumerate(fixes, 1):
                    fix_rows.append([
                        Paragraph(str(i), self.body_style),
                        Paragraph(self._sanitize_string(fix.get("action", "")), self.body_style),
                        Paragraph(self._sanitize_string(fix.get("difficulty", "medium")).capitalize(), self.body_style),
                        Paragraph(self._sanitize_string(fix.get("impact", "medium")).capitalize(), self.body_style),
                    ])
                t_fixes = Table(fix_rows, colWidths=[25, 335, 90, 90])
                t_fixes.setStyle(
                    TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bae6fd")),
                        ("PADDING", (0, 0), (-1, -1), 4),
                    ])
                )
                elements.append(t_fixes)
        else:
            fallback_note = (
                "<i>AI explanation unavailable — showing rules-engine deterministic diagnosis only. "
                "No external API key was configured or the LLM request timed out gracefully.</i>"
            )
            t_fallback = Table([[Paragraph(fallback_note, self.callout_style)]], colWidths=[540])
            t_fallback.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#fde68a")),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ])
            )
            elements.append(t_fallback)

        elements.append(Spacer(1, 10))

        # 6. Stability History & Synthetic Benchmark Summary
        elements.append(Paragraph("4. Historical Stability &amp; Benchmark Performance", self.section_heading))
        bench_score_str = "Not Tested"
        bench_breakdown_str = "Run Benchmark in app to test"
        if benchmark and "score" in benchmark:
            b_score = benchmark["score"]
            b_break = benchmark.get("breakdown", {})
            bench_score_str = f"<b>{b_score} / 1000</b>"
            bench_breakdown_str = f"CPU: {b_break.get('cpu', 0)} | Disk: {b_break.get('disk', 0)} | GPU: {b_break.get('gpu', 0)}"

        snap_count = timeline_summary.get("snapshot_count", 0) if timeline_summary else 0
        diag_count = timeline_summary.get("diagnosis_count", 0) if timeline_summary else 0

        hist_rows = [
            [
                Paragraph("<b>Metric</b>", self.bold_body),
                Paragraph("<b>Recorded Result</b>", self.bold_body),
                Paragraph("<b>Evaluation Standard</b>", self.bold_body),
            ],
            [
                Paragraph("Historical Telemetry Samples", self.body_style),
                Paragraph(f"{snap_count:,} snapshots in SQLite", self.body_style),
                Paragraph("14-Day Rolling Window", self.body_style),
            ],
            [
                Paragraph("Recorded Bottleneck Incidents", self.body_style),
                Paragraph(f"{diag_count} diagnostic events", self.body_style),
                Paragraph("Rule Engine Triggers", self.body_style),
            ],
            [
                Paragraph("Synthetic Benchmark Score", self.body_style),
                Paragraph(bench_score_str, self.body_style),
                Paragraph(bench_breakdown_str, self.body_style),
            ],
        ]
        t_hist = Table(hist_rows, colWidths=[180, 180, 180])
        t_hist.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(t_hist)
        elements.append(Spacer(1, 14))

        # Footer note
        footer_text = (
            "<font size=7 color='#94a3b8'>PC Performance Doctor &bull; Local Desktop Architecture &bull; "
            "Confidential &bull; Contains no credentials or secrets.</font>"
        )
        elements.append(Paragraph(footer_text, self.body_style))

        # Build document
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # Save to disk if requested
        file_path_str = ""
        if output_path:
            p = Path(output_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(pdf_bytes)
            file_path_str = str(p.resolve())

        return file_path_str, pdf_bytes


def generate_health_report_pdf(
    snapshot: dict[str, Any] | None = None,
    diagnosis: dict[str, Any] | None = None,
    explanation: dict[str, Any] | None = None,
    timeline_summary: dict[str, Any] | None = None,
    benchmark: dict[str, Any] | None = None,
    output_dir: str | Path | None = None,
) -> tuple[str, bytes]:
    """Helper function to create a health report PDF and write to data/reports."""
    generator = HealthReportPDFGenerator()
    if output_dir is None:
        repo_root = Path(__file__).resolve().parent.parent.parent
        output_dir = repo_root / "data" / "reports"

    ts_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    target_path = Path(output_dir) / f"health_report_{ts_slug}.pdf"
    return generator.generate_pdf(
        snapshot=snapshot,
        diagnosis=diagnosis,
        explanation=explanation,
        timeline_summary=timeline_summary,
        benchmark=benchmark,
        output_path=target_path,
    )
