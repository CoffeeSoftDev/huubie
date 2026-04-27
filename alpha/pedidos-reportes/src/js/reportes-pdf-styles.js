class PdfStyles {
    static inject() {
        if ($('#pdf-corte-styles').length) return;

        $('head').append(`
            <style id="pdf-corte-styles">
                /* ===== DARK MODE (pantalla) ===== */
                .pdf-document {
                    background: #1a1f2e;
                    color: #d1d5db;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 50px;
                    border-radius: 3px;
                    box-shadow: 0 1px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
                    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 13px;
                }
                .pdf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    padding-bottom: 14px;
                    border-bottom: 3px double #4b5563;
                }
                .pdf-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #f3f4f6;
                    letter-spacing: 1.5px;
                }
                .pdf-header .meta {
                    font-size: 12px;
                    color: #9ca3af;
                }
                .pdf-header .meta span {
                    color: #e5e7eb;
                    font-weight: 600;
                }
                .pdf-totals-bar {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .pdf-totals-bar .total-item {
                    padding: 8px 10px;
                    background: #242937;
                    border: 1px solid #374151;
                    border-radius: 4px;
                    border-top: 3px solid #4b5563;
                }
                .pdf-totals-bar .total-item .label {
                    font-size: 9px;
                    color: #9ca3af;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    margin-bottom: 2px;
                    font-weight: 600;
                }
                .pdf-totals-bar .total-item .value {
                    font-size: 15px;
                    font-weight: 700;
                    color: #f3f4f6;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                .pdf-totals-bar .total-item.highlight {
                    background: #1e3a5f;
                    border-color: #1e3a5f;
                    border-top-color: #3b82f6;
                }
                .pdf-totals-bar .total-item.highlight .label { color: #93c5fd; }
                .pdf-totals-bar .total-item.highlight .value { color: #dbeafe; }
                .pdf-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 18px;
                }
                @media (max-width: 900px) { .pdf-grid { grid-template-columns: 1fr 1fr; } }
                @media (max-width: 600px) { .pdf-grid { grid-template-columns: 1fr; } }
                .pdf-section {
                    border: 1px solid #374151;
                    border-radius: 3px;
                    overflow: hidden;
                    background: #1f2937;
                }
                .pdf-section-title {
                    background: linear-gradient(180deg, #2d3748 0%, #252d3a 100%);
                    padding: 8px 14px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    color: #9ca3af;
                    border-bottom: 1px solid #374151;
                }
                .pdf-section-body { padding: 10px 12px; }
                .pdf-kv {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    border-bottom: 1px solid #2d3748;
                }
                .pdf-kv:last-child { border-bottom: none; }
                .pdf-kv .kv-label { color: #9ca3af; font-size: 12px; }
                .pdf-kv .kv-value {
                    font-weight: 600;
                    font-size: 13px;
                    color: #e5e7eb;
                    text-align: right;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                .pdf-kv.total-row {
                    border-top: 1px solid #4b5563;
                    border-bottom: none;
                    padding-top: 6px;
                    margin-top: 4px;
                    background: #242937;
                    margin-left: -12px;
                    margin-right: -12px;
                    padding-left: 12px;
                    padding-right: 12px;
                    padding-bottom: 5px;
                }
                .pdf-kv.total-row .kv-label { font-weight: 700; color: #e5e7eb; }
                .pdf-kv.total-row .kv-value { font-weight: 800; font-size: 14px; color: #f3f4f6; }
                .pdf-kv .kv-value.negative { color: #f87171; }
                .pdf-sub-title {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #6b7280;
                    letter-spacing: 1px;
                    margin: 8px 0 4px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #2d3748;
                }
                .pdf-pct-bar {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 5px;
                }
                .pdf-pct-bar .bar {
                    flex: 1;
                    height: 5px;
                    background: #2d3748;
                    border-radius: 2px;
                    overflow: hidden;
                }
                .pdf-pct-bar .bar .fill { height: 100%; border-radius: 2px; }
                .pdf-pct-bar .pct-text {
                    font-size: 9px;
                    color: #9ca3af;
                    min-width: 30px;
                    text-align: right;
                    font-family: 'Consolas', monospace;
                }
                .pdf-grid-bottom {
                    display: grid;
                    grid-template-columns: 1fr 2fr;
                    gap: 12px;
                    margin-bottom: 18px;
                }
                @media (max-width: 768px) { .pdf-grid-bottom { grid-template-columns: 1fr; } }
                table.pdf-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                table.pdf-table thead th {
                    background: linear-gradient(180deg, #2d3748 0%, #252d3a 100%);
                    color: #9ca3af;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    padding: 6px 10px;
                    text-align: left;
                    border-bottom: 1px solid #374151;
                }
                table.pdf-table tbody tr { border-bottom: 1px solid #2d3748; }
                table.pdf-table tbody tr:nth-child(even) { background: #242937; }
                table.pdf-table tbody td {
                    padding: 5px 10px;
                    color: #e5e7eb;
                    white-space: nowrap;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                table.pdf-table .text-right { text-align: right; }
                table.pdf-table .text-center { text-align: center; }
                table.pdf-table .col-importe { font-weight: 700; color: #f3f4f6; background: #242937; }
                table.pdf-table .col-efectivo { color: #e5e7eb; font-weight: 600; }
                table.pdf-table .col-tarjeta { color: #e5e7eb; font-weight: 600; }
                .btn-print {
                    background: #3b82f6;
                    color: #fff;
                    border: 1px solid #2563eb;
                    padding: 6px 16px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    transition: background 0.2s;
                }
                .btn-print:hover { background: #2563eb; }
                .pdf-footer {
                    margin-top: 24px;
                    padding-top: 12px;
                    border-top: 3px double #4b5563;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #6b7280;
                    letter-spacing: 0.5px;
                }
                .pdf-item-row td {
                    font-size: 11px;
                    color: #9ca3af;
                }
                .pdf-item-row {
                    border-bottom: none;
                }
                .pdf-totals-bar.cols-8 {
                    grid-template-columns: repeat(4, 1fr);
                }

                /* ===== PRINT: revierte a blanco ===== */
                @media print {
                    html, body {
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: #fff !important;
                    }
                    #menu-navbar, #menu-sidebar { display: none !important; }
                    #mainContainer {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        background: #fff !important;
                    }
                    #root, #Reportes, #singleLayout,
                    [id^="container"], [id^="content-"] {
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                    }
                    #filterBarReportes { display: none !important; }
                    #tabsReportes { display: none !important; }
                    .btn-print { display: none !important; }

                    .pdf-document {
                        background: #fff !important;
                        color: #2c3e50 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 15px !important;
                        max-width: 100% !important;
                    }
                    .pdf-header { border-bottom-color: #2c3e50 !important; }
                    .pdf-header h2 { color: #1a252f !important; }
                    .pdf-header .meta { color: #7f8c8d !important; }
                    .pdf-header .meta span { color: #2c3e50 !important; }

                    .pdf-totals-bar .total-item {
                        background: #f7f9fb !important;
                        border-color: #dce3ea !important;
                        border-top-color: #bdc3c7 !important;
                    }
                    .pdf-totals-bar .total-item .label { color: #7f8c8d !important; }
                    .pdf-totals-bar .total-item .value { color: #2c3e50 !important; }
                    .pdf-totals-bar .total-item.highlight {
                        background: #3d4f5f !important;
                        border-color: #3d4f5f !important;
                        border-top-color: #2c3e50 !important;
                    }
                    .pdf-totals-bar .total-item.highlight .label { color: #b0bec5 !important; }
                    .pdf-totals-bar .total-item.highlight .value { color: #eceff1 !important; }

                    .pdf-section {
                        background: #fff !important;
                        border-color: #dce3ea !important;
                    }
                    .pdf-section-title {
                        background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important;
                        color: #4a5568 !important;
                        border-bottom-color: #d1d9e0 !important;
                    }
                    .pdf-kv { border-bottom-color: #f0f2f5 !important; }
                    .pdf-kv .kv-label { color: #5a6a7a !important; }
                    .pdf-kv .kv-value { color: #2c3e50 !important; }
                    .pdf-kv.total-row {
                        background: #f7f9fb !important;
                        border-top-color: #95a5a6 !important;
                    }
                    .pdf-kv.total-row .kv-label { color: #2c3e50 !important; }
                    .pdf-kv.total-row .kv-value { color: #1a252f !important; }
                    .pdf-kv .kv-value.negative { color: #943030 !important; }
                    .pdf-sub-title { color: #95a5a6 !important; border-bottom-color: #e8ecf0 !important; }

                    .pdf-pct-bar .bar { background: #e8ecf0 !important; }
                    .pdf-pct-bar .pct-text { color: #7f8c8d !important; }

                    table.pdf-table thead th {
                        background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important;
                        color: #4a5568 !important;
                        border-bottom-color: #d1d9e0 !important;
                    }
                    table.pdf-table tbody tr { border-bottom-color: #f0f2f5 !important; }
                    table.pdf-table tbody tr:nth-child(even) { background: #fafbfc !important; }
                    table.pdf-table tbody td { color: #2c3e50 !important; }
                    table.pdf-table .col-importe { color: #1a252f !important; background: #f0f3f6 !important; }
                    table.pdf-table .col-efectivo { color: #2c3e50 !important; }
                    table.pdf-table .col-tarjeta { color: #2c3e50 !important; }

                    .pdf-footer { border-top-color: #bdc3c7 !important; color: #95a5a6 !important; }
                    .pdf-item-row td { color: #7f8c8d !important; font-size: 11px !important; }
                    .pdf-item-row { border-bottom: none !important; }
                }
            </style>
        `);
    }
}
