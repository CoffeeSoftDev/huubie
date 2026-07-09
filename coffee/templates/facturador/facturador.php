<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Facturador · Soft</title>

<script src="https://cdn.tailwindcss.com"></script>
<script>
  // darkMode 'class': el modulo es light. Sin esto el Play CDN usa 'media' y las
  // variantes dark: de coffeeSoft (dark:bg-gray-700) se activan con el tema del SO.
  tailwind.config = { darkMode: 'class', theme: { extend: { colors: {
    terra: { DEFAULT:'#C05A40', hover:'#A84A33', dark:'#8F3D2A', tint:'#F7F0EB', salmon:'#E8A68F' },
    navy:  { DEFAULT:'#141d2b', hover:'#1e293b', light:'#334155' }
  }}}};
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<link rel="stylesheet" href="src/plugin/fontello/css/fontello.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
<link rel="stylesheet" href="src/plugin/datatables/datatables.min.css">

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="src/plugin/datatables/datatables.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',system-ui,sans-serif}
  body{background:#F3F4F6;color:#111827;padding-left:60px;padding-top:64px;height:100vh;overflow:hidden}

  .navbar-main{background:#FFFFFF;border-bottom:1px solid rgba(192,90,64,.22);position:fixed;top:0;left:0;right:0;height:64px;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
  .nav-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(192,90,64,.35)}
  .navbar-title{font-size:15px;font-weight:700;color:#111827;line-height:1.15}
  .navbar-subtitle{font-size:10px;color:#9CA3AF;letter-spacing:.12em;text-transform:uppercase}
  .nav-avatar{width:38px;height:38px;border-radius:9999px;background:#C05A40;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px}

  #menu-sidebar{width:60px;height:calc(100vh - 64px);position:fixed;left:0;top:64px;z-index:40;border-right:1px solid #E5E7EB;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;overflow-y:auto}
  .menu-rail-item{position:relative;width:48px;min-height:46px;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:7px 2px;color:#6B7280;background:transparent;border:1px solid transparent;cursor:pointer;text-align:center;transition:.15s}
  .menu-rail-item i{width:19px;height:19px}
  .menu-rail-label{font-size:8.5px;font-weight:600;line-height:1;white-space:nowrap}
  .menu-rail-item:hover{color:#111827;background:#F3F4F6;border-color:#E5E7EB}
  .menu-rail-item.is-active{color:#C05A40;background:rgba(192,90,64,.10);border-color:rgba(192,90,64,.12)}

  #main__content{height:calc(100vh - 64px);overflow:hidden;padding:16px}
  #root{height:100%;display:flex}

  .daterangepicker{font-family:'Inter',system-ui,sans-serif;border-color:#E5E7EB;font-size:11px}
  .daterangepicker td.active,.daterangepicker td.active:hover{background:#C05A40}
  .daterangepicker td.in-range{background:#F7F0EB}
  .daterangepicker td.available:hover,.daterangepicker th.available:hover{background:#F5E3DC}
  .daterangepicker .ranges li.active{background:#C05A40}
  .daterangepicker .drp-buttons .btn.btn-primary,.daterangepicker .applyBtn{background:#C05A40;border-color:#C05A40}
  .daterangepicker .drp-calendar{max-width:228px;padding:6px}
  .daterangepicker .calendar-table th,.daterangepicker .calendar-table td{width:24px;min-width:24px;height:22px;line-height:22px;font-size:10.5px;padding:0}
  .daterangepicker th.month{font-size:11px;font-weight:700}

  .badge-base{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:9999px;font-size:10px;font-weight:700;border:1px solid;white-space:nowrap}
  .b-terra{background:#F7F0EB;color:#A84A33;border-color:#F0C4B5}
  .b-green{background:#ECFDF5;color:#15803D;border-color:#A7F3D0}
  .b-red{background:#FEF2F2;color:#B91C1C;border-color:#FECACA}
  .b-yellow{background:#FEF9C3;color:#A16207;border-color:#FDE68A}
  .b-gray{background:#F3F4F6;color:#6B7280;border-color:#E5E7EB}

  .ct-print{background:none;border:none;color:#9CA3AF;cursor:pointer;padding:2px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
  .ct-print:hover{color:#C05A40;background:#F7F0EB}
  .ct-mini{background:none;border:1px solid #E5E7EB;color:#6B7280;cursor:pointer;padding:4px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
  .ct-mini:hover{color:#C05A40;border-color:#F0C4B5;background:#FBF1ED}
  .ct-mini.danger:hover{color:#B91C1C;border-color:#FECACA;background:#FEF2F2}
  .ct-add{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#fff;background:#C05A40;padding:6px 12px;border-radius:8px;border:none;cursor:pointer}
  .ct-add:hover{background:#A84A33}

  .cell-null{display:inline-block;padding:0 6px;border-radius:4px;background:#F3F4F6;color:#9CA3AF;font-size:9px;font-weight:700;letter-spacing:.04em}
</style>
</head>

<body class="bg-[#F3F4F6]">

<nav class="navbar-main">
  <div class="flex items-center gap-3">
    <div class="nav-logo"><i data-lucide="coffee" class="w-5 h-5"></i></div>
    <div class="flex flex-col leading-tight">
      <span class="navbar-title">Facturador</span>
      <span class="navbar-subtitle">Restaurant</span>
    </div>
  </div>
  <div class="flex items-center gap-2">
    <div class="nav-avatar">AP</div>
  </div>
</nav>

<aside id="menu-sidebar">
  <button class="menu-rail-item is-active" data-tab="folios" title="Generador de folios"><i data-lucide="printer"></i><span class="menu-rail-label">Folios</span></button>
  <button class="menu-rail-item" data-tab="resumen" title="Resumen"><i data-lucide="layout-dashboard"></i><span class="menu-rail-label">Resumen</span></button>
  <button class="menu-rail-item" data-tab="ventas" title="Venta por pago"><i data-lucide="credit-card"></i><span class="menu-rail-label">Ventas</span></button>
  <button class="menu-rail-item" data-tab="detallado" title="Detallado"><i data-lucide="list"></i><span class="menu-rail-label">Detallado</span></button>
  <button class="menu-rail-item" data-tab="facturas" title="Facturados"><i data-lucide="file-check-2"></i><span class="menu-rail-label">Facturas</span></button>
  <button class="menu-rail-item" data-tab="catalogos" title="Catalogos"><i data-lucide="book-open"></i><span class="menu-rail-label">Catalogo</span></button>
</aside>

<main id="main__content">
  <div id="root"></div>
</main>

<script src="src/js/core/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="src/js/core/plugins.js?t=<?php echo time(); ?>"></script>
<script src="src/js/core/complementos.js?t=<?php echo time(); ?>"></script>

<script src="src/js/sample_facturador.js?t=<?php echo time(); ?>"></script>
<script src="src/js/facturador-config.js?t=<?php echo time(); ?>"></script>
<script src="src/js/app.js?t=<?php echo time(); ?>"></script>
<script src="src/js/facturador.js?t=<?php echo time(); ?>"></script>
<script src="src/js/facturador-view.js?t=<?php echo time(); ?>"></script>

<script>
  if (window.lucide) lucide.createIcons();
</script>
</body>
</html>
