var elements = [];
var idCounter = 1;
var TS = Date.now();

function uid(prefix) { return prefix + "_" + (idCounter++); }
function nonce() { return Math.floor(Math.random() * 2000000000); }

var indexCounter = 0;
function nextIndex() {
  var n = indexCounter++;
  var s = "";
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  } while (n > 0);
  return "a" + s.padStart(1, "0");
}

function makeText(id, x, y, text, fontSize, color) {
  var lines = text.split("\n").length;
  var lineHeight = fontSize <= 14 ? 1.28 : fontSize <= 18 ? 1.22 : fontSize <= 22 ? 1.27 : 1.25;
  var height = Math.ceil(lines * fontSize * lineHeight);
  var width = Math.ceil(text.split("\n").reduce(function(max, l) { return Math.max(max, l.length); }, 0) * fontSize * 0.58);
  var el = {
    type: "text", version: 1, versionNonce: nonce(), isDeleted: false, id: id,
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100, angle: 0,
    x: x, y: y, strokeColor: color, backgroundColor: "transparent", width: width, height: height,
    seed: nonce(), groupIds: [], frameId: null, roundness: null, boundElements: [],
    updated: TS, link: null, locked: false, fontSize: fontSize, fontFamily: 1,
    text: text, textAlign: "left", verticalAlign: "top", containerId: null, originalText: text,
    lineHeight: lineHeight, baseline: height - 6, index: nextIndex(), autoResize: true
  };
  elements.push(el);
  return el;
}

function makeRect(id, x, y, w, h, strokeColor, bgColor, strokeWidth, opacity, boundElements) {
  var el = {
    type: "rectangle", version: 1, versionNonce: nonce(), isDeleted: false, id: id,
    fillStyle: "solid", strokeWidth: strokeWidth, strokeStyle: "solid", roughness: 1, opacity: opacity, angle: 0,
    x: x, y: y, strokeColor: strokeColor, backgroundColor: bgColor, width: w, height: h,
    seed: nonce(), groupIds: [], frameId: null, roundness: { type: 3 }, boundElements: boundElements || [],
    updated: TS, link: null, locked: false, index: nextIndex()
  };
  elements.push(el);
  return el;
}

function makeArrow(id, x1, y1, x2, y2, startId, endId) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var el = {
    type: "arrow", version: 1, versionNonce: nonce(), isDeleted: false, id: id,
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100, angle: 0,
    x: x1, y: y1, strokeColor: "#1e1e1e", backgroundColor: "transparent",
    width: Math.abs(dx), height: Math.abs(dy), seed: nonce(), groupIds: [], frameId: null,
    roundness: null, boundElements: [], updated: TS, link: null, locked: false,
    startBinding: startId ? { elementId: startId, focus: 0, gap: 5 } : null,
    endBinding: endId ? { elementId: endId, focus: 0, gap: 5 } : null,
    lastCommittedPoint: null, startArrowhead: null, endArrowhead: "arrow",
    points: [[0, 0], [dx, dy]], index: nextIndex()
  };
  elements.push(el);
  return el;
}

function makeTable(name, columns, zx, zy, tableStrokeColor) {
  var colText = columns.join("\n");
  var colLines = columns.length;
  var colHeight = Math.ceil(colLines * 14 * 1.28) + 10;
  var maxColLen = columns.reduce(function(m, c) { return Math.max(m, c.length); }, 0);
  var colWidth = Math.max(Math.ceil(maxColLen * 8.2), 180);
  var tableW = colWidth + 30;
  var tableH = colHeight + 15;
  var tableRectId = uid("tR");
  var colsId = uid("tC");
  var titleId = uid("tT");
  makeText(titleId, zx, zy, name, 20, "#1e1e1e");
  makeRect(tableRectId, zx, zy + 30, tableW, tableH, tableStrokeColor, "#ffffff", 2, 100, []);
  makeText(uid("tTi"), zx + 10, zy + 36, name + " (PK: id)", 14, "#1e1e1e");
  makeText(colsId, zx + 10, zy + 56, colText, 13, "#555555");
  return { tableRectId: tableRectId, colsId: colsId, titleId: titleId, x: zx, y: zy, w: tableW, h: tableH + 30, tableY: zy + 30, tableH: tableH };
}

// TITLE
makeText("title_main", 400, -300, "BD Pedidos - Schema Completo", 28, "#1e1e1e");
makeText("title_sub", 420, -265, "fayxzvov_reginas.* + referencias externas", 16, "#757575");

// ZONE BACKGROUNDS
makeRect("zone_core", -60, -220, 820, 780, "#4a9eed", "#dbe4ff", 1, 25, []);
makeText("zone_core_lbl", -50, -215, "CORE TABLES", 18, "#2563eb");

makeRect("zone_products", 810, -220, 1100, 950, "#22c55e", "#d3f9d8", 1, 25, []);
makeText("zone_products_lbl", 820, -215, "PRODUCTS", 18, "#15803d");

makeRect("zone_cierre", -60, 610, 820, 700, "#f59e0b", "#fff3bf", 1, 25, []);
makeText("zone_cierre_lbl", -50, 615, "CIERRE / TURNOS", 18, "#b45309");

makeRect("zone_audit", 810, 780, 480, 380, "#868e96", "#e9ecef", 1, 25, []);
makeText("zone_audit_lbl", 820, 785, "AUDIT", 18, "#495057");

makeRect("zone_ext", 1340, 780, 560, 380, "#9775c7", "#e8d5f5", 1, 25, []);
makeText("zone_ext_lbl", 1350, 785, "EXTERNAL TABLES", 18, "#7048a0");

// ============== CORE TABLES ==============

var tOrder = makeTable("order", [
  "id int PRI",
  "folio varchar(50)",
  "client_id int FK",
  "date_creation datetime",
  "date_order date",
  "time_order time",
  "date_birthday datetime",
  "status int FK",
  "location varchar(255)",
  "total_pay double",
  "discount double",
  "info_discount text",
  "is_delivered int",
  "delivery_type int",
  "note text",
  "subsidiaries_id int FK",
  "daily_closure_id int FK",
  "cash_shift_id int FK",
  "is_legacy int",
  "active int"
], -10, -180, "#4a9eed");

var tClients = makeTable("order_clients", [
  "id int PRI",
  "name varchar(255)",
  "phone varchar(50)",
  "email varchar(255)",
  "active int",
  "subsidiaries_id int FK"
], 400, -180, "#4a9eed");

var tPayments = makeTable("order_payments", [
  "id int PRI",
  "order_id int FK",
  "method_pay_id int FK",
  "pay double",
  "date_pay datetime",
  "type varchar(50)",
  "description text"
], 400, 30, "#4a9eed");

var tMethodPay = makeTable("method_pay", [
  "id int PRI",
  "method_pay varchar(100)",
  "-- 1=Efectivo 2=Tarjeta 3=Transf"
], 400, 280, "#4a9eed");

var tStatus = makeTable("status_process", [
  "id int PRI",
  "status varchar(100)",
  "-- 1=Cotizacion 2=Pendiente",
  "-- 3=Entregado 4=Cancelado"
], 400, 410, "#4a9eed");

// ============== PRODUCT TABLES ==============

var tPackage = makeTable("order_package", [
  "id int PRI",
  "pedidos_id int FK",
  "product_id int FK",
  "custom_id int FK",
  "quantity int",
  "order_details text",
  "dedication text",
  "price double"
], 860, -180, "#22c55e");

var tProducts = makeTable("order_products", [
  "id int PRI",
  "name varchar(255)",
  "price double",
  "description text",
  "image varchar(255)",
  "category_id int FK",
  "active int",
  "subsidiaries_id int FK"
], 1180, -180, "#22c55e");

var tCategory = makeTable("order_category", [
  "id int PRI",
  "classification varchar(255)",
  "description text",
  "active int"
], 1530, -180, "#22c55e");

var tCustom = makeTable("order_custom", [
  "id int PRI",
  "name varchar(255)",
  "price double",
  "price_real double",
  "description text",
  "image varchar(255)",
  "portion_qty int"
], 860, 120, "#22c55e");

var tCustomProducts = makeTable("order_custom_products", [
  "id int PRI",
  "custom_id int FK",
  "modifier_id int FK",
  "price double",
  "quantity int",
  "details text"
], 1180, 120, "#22c55e");

var tModifierProducts = makeTable("order_modifier_products", [
  "id int PRI",
  "name varchar(255)",
  "price double",
  "description text",
  "modifier_id int FK",
  "active int"
], 1530, 120, "#22c55e");

var tModifier = makeTable("order_modifier", [
  "id int PRI",
  "name varchar(255)",
  "isExtra int",
  "active int"
], 1530, 370, "#22c55e");

var tImages = makeTable("order_images", [
  "id int PRI",
  "package_id int FK",
  "path varchar(255)",
  "name varchar(255)",
  "original_name varchar(255)"
], 860, 420, "#22c55e");

// ============== CIERRE / TURNOS ==============

var tClosure = makeTable("daily_closure", [
  "id int PRI",
  "closure_date date",
  "subsidiary_id int FK",
  "employee_id int FK",
  "total double",
  "tax double",
  "subtotal double",
  "total_orders int",
  "total_shifts int",
  "total_cash double",
  "total_card double",
  "total_transfer double",
  "total_discount double",
  "status int",
  "reopened_by int",
  "reopened_at datetime",
  "reopen_reason text",
  "is_legacy int",
  "active int",
  "created_at datetime"
], -10, 650, "#f59e0b");

var tClosurePayment = makeTable("closure_payment", [
  "id int PRI",
  "daily_closure_id int FK",
  "payment_method_id int FK",
  "amount double"
], 400, 650, "#f59e0b");

var tClosureStatus = makeTable("closure_status_proccess", [
  "id int PRI",
  "daily_closure_id int FK",
  "status_process_id int FK",
  "amount double"
], 400, 830, "#f59e0b");

var tCashShift = makeTable("cash_shift", [
  "id int PRI",
  "employee_id int FK",
  "subsidiary_id int FK",
  "opened_at datetime",
  "closed_at datetime",
  "shift_name varchar(100)",
  "status int",
  "total_sales double",
  "total_orders int",
  "total_cash double",
  "total_card double",
  "total_transfer double",
  "active int"
], -10, 1020, "#f59e0b");

// ============== AUDIT ==============

var tHistories = makeTable("order_histories", [
  "id int PRI",
  "order_id int FK",
  "usr_users_id int FK",
  "title varchar(255)",
  "action varchar(100)",
  "message text",
  "date_action datetime",
  "comment text",
  "type varchar(50)"
], 860, 820, "#868e96");

// ============== EXTERNAL TABLES ==============

var tSubs = makeTable("fayxzvov_alpha.subsidiaries", [
  "id int PRI",
  "name varchar(255)",
  "companies_id int FK",
  "active int"
], 1390, 820, "#9775c7");

var tCompanies = makeTable("fayxzvov_admin.companies", [
  "id int PRI",
  "social_name varchar(255)"
], 1390, 990, "#9775c7");

var tUsers = makeTable("fayxzvov_alpha.usr_users", [
  "id int PRI",
  "fullname varchar(255)"
], 1660, 820, "#9775c7");

// ============== ARROWS (RELATIONSHIPS) ==============

function rightOf(t) { return { x: t.x + t.w, y: t.tableY + t.tableH / 2 }; }
function leftOf(t) { return { x: t.x, y: t.tableY + t.tableH / 2 }; }
function bottomOf(t) { return { x: t.x + t.w / 2, y: t.y + t.h }; }
function topOf(t) { return { x: t.x + t.w / 2, y: t.tableY }; }

var r, l, b, t2;

// 1. order.client_id -> order_clients.id
r = rightOf(tOrder); l = leftOf(tClients);
makeArrow(uid("arr"), r.x, r.y - 100, l.x, l.y, tOrder.tableRectId, tClients.tableRectId);

// 2. order.status -> status_process.id
r = rightOf(tOrder); l = leftOf(tStatus);
makeArrow(uid("arr"), r.x, r.y + 50, l.x, l.y, tOrder.tableRectId, tStatus.tableRectId);

// 3. order.subsidiaries_id -> subsidiaries.id
b = bottomOf(tOrder); t2 = topOf(tSubs);
makeArrow(uid("arr"), b.x + 50, tOrder.y + tOrder.h, t2.x, t2.y, tOrder.tableRectId, tSubs.tableRectId);

// 4. order.daily_closure_id -> daily_closure.id
b = bottomOf(tOrder); t2 = topOf(tClosure);
makeArrow(uid("arr"), b.x, tOrder.y + tOrder.h, t2.x, t2.y, tOrder.tableRectId, tClosure.tableRectId);

// 5. order.cash_shift_id -> cash_shift.id
b = bottomOf(tOrder); t2 = topOf(tCashShift);
makeArrow(uid("arr"), b.x - 50, tOrder.y + tOrder.h, t2.x, t2.y, tOrder.tableRectId, tCashShift.tableRectId);

// 6. order_payments.order_id -> order.id
l = leftOf(tPayments); r = rightOf(tOrder);
makeArrow(uid("arr"), l.x, l.y, r.x, r.y, tPayments.tableRectId, tOrder.tableRectId);

// 7. order_payments.method_pay_id -> method_pay.id
b = bottomOf(tPayments); t2 = topOf(tMethodPay);
makeArrow(uid("arr"), b.x, tPayments.y + tPayments.h, t2.x, t2.y, tPayments.tableRectId, tMethodPay.tableRectId);

// 8. order_package.pedidos_id -> order.id
l = leftOf(tPackage); r = rightOf(tOrder);
makeArrow(uid("arr"), l.x, l.y, r.x, r.y - 50, tPackage.tableRectId, tOrder.tableRectId);

// 9. order_package.product_id -> order_products.id
r = rightOf(tPackage); l = leftOf(tProducts);
makeArrow(uid("arr"), r.x, r.y - 20, l.x, l.y, tPackage.tableRectId, tProducts.tableRectId);

// 10. order_package.custom_id -> order_custom.id
b = bottomOf(tPackage); t2 = topOf(tCustom);
makeArrow(uid("arr"), b.x, tPackage.y + tPackage.h, t2.x, t2.y, tPackage.tableRectId, tCustom.tableRectId);

// 11. order_products.category_id -> order_category.id
r = rightOf(tProducts); l = leftOf(tCategory);
makeArrow(uid("arr"), r.x, r.y, l.x, l.y, tProducts.tableRectId, tCategory.tableRectId);

// 12. order_custom_products.custom_id -> order_custom.id
l = leftOf(tCustomProducts); r = rightOf(tCustom);
makeArrow(uid("arr"), l.x, l.y, r.x, r.y, tCustomProducts.tableRectId, tCustom.tableRectId);

// 13. order_custom_products.modifier_id -> order_modifier_products.id
r = rightOf(tCustomProducts); l = leftOf(tModifierProducts);
makeArrow(uid("arr"), r.x, r.y, l.x, l.y, tCustomProducts.tableRectId, tModifierProducts.tableRectId);

// 14. order_modifier_products.modifier_id -> order_modifier.id
b = bottomOf(tModifierProducts); t2 = topOf(tModifier);
makeArrow(uid("arr"), b.x, tModifierProducts.y + tModifierProducts.h, t2.x, t2.y, tModifierProducts.tableRectId, tModifier.tableRectId);

// 15. order_images.package_id -> order_package.id
t2 = bottomOf(tPackage); var top2 = topOf(tImages);
makeArrow(uid("arr"), top2.x, top2.y, t2.x, tPackage.y + tPackage.h, tImages.tableRectId, tPackage.tableRectId);

// 16. order_histories.order_id -> order.id
l = leftOf(tHistories);
makeArrow(uid("arr"), l.x, l.y - 20, tOrder.x + tOrder.w, tOrder.y + tOrder.h, tHistories.tableRectId, tOrder.tableRectId);

// 17. order_histories.usr_users_id -> usr_users.id
r = rightOf(tHistories); l = leftOf(tUsers);
makeArrow(uid("arr"), r.x, r.y, l.x, l.y, tHistories.tableRectId, tUsers.tableRectId);

// 18. daily_closure.subsidiary_id -> subsidiaries.id
r = rightOf(tClosure);
makeArrow(uid("arr"), r.x, r.y - 50, tSubs.x, tSubs.tableY + tSubs.tableH / 2, tClosure.tableRectId, tSubs.tableRectId);

// 19. daily_closure.employee_id -> usr_users.id
makeArrow(uid("arr"), tClosure.x + tClosure.w, tClosure.tableY + tClosure.tableH * 0.3, tUsers.x, tUsers.tableY + tUsers.tableH * 0.7, tClosure.tableRectId, tUsers.tableRectId);

// 20. closure_payment.daily_closure_id -> daily_closure.id
l = leftOf(tClosurePayment); r = rightOf(tClosure);
makeArrow(uid("arr"), l.x, l.y, r.x, r.y - 30, tClosurePayment.tableRectId, tClosure.tableRectId);

// 21. closure_status_proccess.daily_closure_id -> daily_closure.id
l = leftOf(tClosureStatus); r = rightOf(tClosure);
makeArrow(uid("arr"), l.x, l.y, r.x, r.y + 30, tClosureStatus.tableRectId, tClosure.tableRectId);

// 22. cash_shift.employee_id -> usr_users.id
r = rightOf(tCashShift);
makeArrow(uid("arr"), r.x, r.y - 20, tUsers.x, tUsers.tableY + tUsers.tableH, tCashShift.tableRectId, tUsers.tableRectId);

// 23. cash_shift.subsidiary_id -> subsidiaries.id
makeArrow(uid("arr"), tCashShift.x + tCashShift.w, tCashShift.tableY + tCashShift.tableH * 0.4, tSubs.x, tSubs.tableY + tSubs.tableH, tCashShift.tableRectId, tSubs.tableRectId);

// 24. subsidiaries.companies_id -> companies.id
b = bottomOf(tSubs); t2 = topOf(tCompanies);
makeArrow(uid("arr"), b.x, tSubs.y + tSubs.h, t2.x, t2.y, tSubs.tableRectId, tCompanies.tableRectId);

// OUTPUT
var output = {
  type: "excalidraw",
  version: 2,
  source: "https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor",
  elements: elements,
  appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
  files: {}
};

process.stdout.write(JSON.stringify(output, null, 2));
