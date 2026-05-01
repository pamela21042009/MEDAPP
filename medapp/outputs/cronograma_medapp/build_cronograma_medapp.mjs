import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const outFile = path.join(outDir, "CRONOGRAMA_PROYECTO_MEDAPP.xlsx");

const workbook = Workbook.create();
const resumen = workbook.worksheets.add("Resumen");
const cronograma = workbook.worksheets.add("Cronograma");
const gantt = workbook.worksheets.add("Gantt Semanal");

const colors = {
  navy: "#1F4E79",
  blue: "#2E86C1",
  paleBlue: "#EAF2F8",
  text: "#1F2933",
  muted: "#52606D",
  border: "#CBD2D9",
  green: "#1E8449",
  amber: "#B9770E",
  red: "#C0392B",
  gray: "#F3F6F9",
  white: "#FFFFFF",
};

const tasks = [
  ["Inicio y analisis", "Levantamiento de alcance y objetivos del sistema", "27/02/2026", "02/03/2026", "Analista / Equipo", "Completado", 100, "Definicion del alcance general de MedApp."],
  ["Inicio y analisis", "Revision de necesidades de usuarios: administradores, staff, medicos y pacientes", "03/03/2026", "05/03/2026", "Analista / Equipo", "Completado", 100, "Identificacion de roles y procesos principales."],
  ["Inicio y analisis", "Definicion de modulos funcionales y alcance del producto", "06/03/2026", "09/03/2026", "Equipo de desarrollo", "Completado", 100, "Agenda, pacientes, medicos, recetas, pagos, reportes y auditoria."],
  ["Inicio y analisis", "Planificacion inicial del repositorio y tecnologia base", "10/03/2026", "12/03/2026", "Equipo tecnico", "Completado", 100, "Flask, React, Vite, Tailwind CSS y Supabase."],

  ["Diseno tecnico", "Diseno de arquitectura backend Flask con Blueprints", "13/03/2026", "16/03/2026", "Backend", "Completado", 100, "Factory create_app, rutas, controladores y servicios."],
  ["Diseno tecnico", "Diseno de frontend React, rutas y layout protegido", "17/03/2026", "20/03/2026", "Frontend", "Completado", 100, "SPA con React Router, AuthContext y AppShell."],
  ["Diseno tecnico", "Modelado de entidades y estructura de datos Supabase", "21/03/2026", "25/03/2026", "Backend / Datos", "Completado", 100, "Usuarios, doctores, pacientes, citas, pagos, recetas, notificaciones y auditoria."],
  ["Diseno tecnico", "Definicion de seguridad, sesiones y control de acceso", "26/03/2026", "28/03/2026", "Backend", "Completado", 100, "Cookies HTTPOnly, guardas de autenticacion y roles."],

  ["Implementacion backend", "Configuracion de aplicacion, entorno y conexion a Supabase", "29/03/2026", "01/04/2026", "Backend", "Completado", 100, "AppConfig, DatabaseService y variables de entorno."],
  ["Implementacion backend", "Modulo de autenticacion y recuperacion de contrasena", "02/04/2026", "05/04/2026", "Backend", "Completado", 100, "Login, registro, sesion, codigo de verificacion y nueva contrasena."],
  ["Implementacion backend", "Modulo de medicos, pacientes y expediente clinico", "06/04/2026", "10/04/2026", "Backend", "Completado", 100, "CRUD, busqueda, historia clinica, signos vitales y documentos."],
  ["Implementacion backend", "Modulo de agenda, horarios y disponibilidad", "11/04/2026", "15/04/2026", "Backend", "Completado", 100, "Citas, slots, bloqueos, recesos, cancelacion y reagendamiento."],
  ["Implementacion backend", "Modulo de recetas medicas", "16/04/2026", "18/04/2026", "Backend", "Completado", 100, "Creacion, consulta, detalle de medicamentos e instrucciones."],
  ["Implementacion backend", "Modulo de pagos, recibos, reembolsos y pago online", "19/04/2026", "22/04/2026", "Backend", "Completado", 100, "Pagos manuales, Stripe Checkout opcional y estados financieros."],
  ["Implementacion backend", "Reportes, notificaciones, auditoria y configuracion", "23/04/2026", "26/04/2026", "Backend", "Completado", 100, "KPIs, exportaciones, recordatorios, bitacora y ajustes del sistema."],

  ["Implementacion frontend", "Estructura React, rutas protegidas y contexto de autenticacion", "02/04/2026", "06/04/2026", "Frontend", "Completado", 100, "App.jsx, AuthContext y ProtectedRoute."],
  ["Implementacion frontend", "Pantallas de login, registro y recuperacion de contrasena", "07/04/2026", "10/04/2026", "Frontend", "Completado", 100, "Flujos de acceso y restablecimiento."],
  ["Implementacion frontend", "Dashboard, agenda y gestion de horarios", "11/04/2026", "16/04/2026", "Frontend", "Completado", 100, "Metricas, calendario, disponibilidad y slots."],
  ["Implementacion frontend", "Pantallas de medicos y pacientes", "17/04/2026", "20/04/2026", "Frontend", "Completado", 100, "Listados, formularios, detalle y expediente."],
  ["Implementacion frontend", "Pagos, recetas, reportes, notificaciones y configuracion", "21/04/2026", "25/04/2026", "Frontend", "Completado", 100, "Modulos operativos y administrativos restantes."],

  ["Integracion y pruebas", "Integracion frontend-backend mediante clientes API", "17/04/2026", "22/04/2026", "Full stack", "Completado", 100, "fetch con credentials include y endpoints JSON."],
  ["Integracion y pruebas", "Validacion de flujos criticos de agenda y pacientes", "23/04/2026", "25/04/2026", "QA / Equipo", "Completado", 100, "Registro, consulta, edicion y disponibilidad."],
  ["Integracion y pruebas", "Validacion de pagos, reportes y notificaciones", "26/04/2026", "28/04/2026", "QA / Equipo", "Completado", 100, "Recibos, exportaciones, alertas y auditoria."],
  ["Integracion y pruebas", "Ajustes finales de seguridad, sesiones y configuracion", "29/04/2026", "30/04/2026", "Backend", "Completado", 100, "CORS, cookies, entorno y worker de recordatorios."],

  ["Documentacion y entrega", "Elaboracion de acta general del proyecto", "27/04/2026", "27/04/2026", "Documentacion", "Completado", 100, "Acta del proyecto MedApp."],
  ["Documentacion y entrega", "Elaboracion de manual tecnico", "30/04/2026", "30/04/2026", "Documentacion", "Completado", 100, "Arquitectura, instalacion, configuracion y mantenimiento."],
  ["Documentacion y entrega", "Construccion de cronograma profesional del proyecto", "30/04/2026", "30/04/2026", "Documentacion", "Completado", 100, "Cronograma basado en fases reales del sistema."],
  ["Documentacion y entrega", "Revision final y preparacion de entrega academica", "01/05/2026", "03/05/2026", "Equipo completo", "Pendiente", 0, "Completar datos institucionales, firmas y entrega final."],
];

const phaseColors = {
  "Inicio y analisis": "#D9EAF7",
  "Diseno tecnico": "#E6F4EA",
  "Implementacion backend": "#EAF2F8",
  "Implementacion frontend": "#F3EAF8",
  "Integracion y pruebas": "#FFF2CC",
  "Documentacion y entrega": "#E8EEF7",
};

function excelDate(serialText) {
  const [d, m, y] = serialText.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysInclusive(start, end) {
  const ms = excelDate(end) - excelDate(start);
  return Math.round(ms / 86400000) + 1;
}

function fmt(range, config) {
  range.format = config;
}

function setWidths(sheet, widths) {
  widths.forEach((width, i) => {
    sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidthPx = width;
  });
}

function title(sheet, text, subtitle = "") {
  sheet.showGridLines = false;
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[text]];
  fmt(sheet.getRange("A1"), {
    fill: colors.navy,
    font: { bold: true, color: colors.white, size: 18 },
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
  });
  sheet.getRange("A1").format.rowHeightPx = 38;
  if (subtitle) {
    sheet.getRange("A2:H2").merge();
    sheet.getRange("A2").values = [[subtitle]];
    fmt(sheet.getRange("A2"), {
      fill: colors.paleBlue,
      font: { color: colors.muted, size: 10 },
      horizontalAlignment: "Center",
      verticalAlignment: "Center",
      wrapText: true,
    });
    sheet.getRange("A2").format.rowHeightPx = 30;
  }
}

// Cronograma sheet
cronograma.showGridLines = false;
title(
  cronograma,
  "Cronograma general del proyecto MedApp",
  "Inicio del proyecto: 27 de febrero de 2026 | Sistema web de gestion de citas medicas"
);
const headers = ["No.", "Fase", "Actividad", "Inicio", "Fin", "Duracion", "Responsable", "Estado", "% Avance", "Observaciones"];
cronograma.getRange("A4:J4").values = [headers];
fmt(cronograma.getRange("A4:J4"), {
  fill: colors.navy,
  font: { bold: true, color: colors.white },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
  wrapText: true,
});

const rows = tasks.map((t, i) => [
  i + 1,
  t[0],
  t[1],
  excelDate(t[2]),
  excelDate(t[3]),
  `=E${i + 5}-D${i + 5}+1`,
  t[4],
  t[5],
  t[6] / 100,
  t[7],
]);
cronograma.getRangeByIndexes(4, 0, rows.length, headers.length).values = rows;
cronograma.getRange(`D5:E${rows.length + 4}`).format.numberFormat = "dd/mm/yyyy";
cronograma.getRange(`F5:F${rows.length + 4}`).format.numberFormat = "0";
cronograma.getRange(`I5:I${rows.length + 4}`).format.numberFormat = "0%";
fmt(cronograma.getRange(`A5:J${rows.length + 4}`), {
  font: { color: colors.text, size: 9 },
  verticalAlignment: "Top",
  wrapText: true,
  borders: { color: colors.border, style: "Continuous" },
});
cronograma.getRange(`A5:J${rows.length + 4}`).format.rowHeightPx = 34;
cronograma.freezePanes.freezeRows(4);
setWidths(cronograma, [46, 145, 305, 86, 86, 75, 120, 92, 76, 270]);

const table = cronograma.tables.add(`A4:J${rows.length + 4}`, true, "CronogramaMedApp");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

cronograma.getRange(`H5:H${rows.length + 4}`).conditionalFormats.add("containsText", {
  text: "Completado",
  format: { fill: "#E6F4EA", font: { color: colors.green, bold: true } },
});
cronograma.getRange(`H5:H${rows.length + 4}`).conditionalFormats.add("containsText", {
  text: "Pendiente",
  format: { fill: "#FFF2CC", font: { color: colors.amber, bold: true } },
});
cronograma.getRange(`I5:I${rows.length + 4}`).conditionalFormats.add("dataBar", {
  color: "#2E86C1",
  thresholds: ["min", "max"],
});

// Resumen sheet
resumen.showGridLines = false;
title(resumen, "Resumen del cronograma MedApp", "Vista ejecutiva de fases, duracion y avance del proyecto");
setWidths(resumen, [160, 130, 110, 110, 115, 100, 120, 120, 120]);

resumen.getRange("A4:B8").values = [
  ["Fecha de inicio", excelDate("27/02/2026")],
  ["Fecha final planificada", excelDate("03/05/2026")],
  ["Duracion calendario", "=B5-B4+1"],
  ["Actividades totales", tasks.length],
  ["Avance promedio", `=AVERAGE(Cronograma!I5:I${rows.length + 4})`],
];
fmt(resumen.getRange("A4:A8"), { fill: colors.paleBlue, font: { bold: true, color: colors.navy }, borders: { color: colors.border, style: "Continuous" } });
fmt(resumen.getRange("B4:B8"), { fill: colors.white, font: { color: colors.text }, borders: { color: colors.border, style: "Continuous" } });
resumen.getRange("B4:B5").format.numberFormat = "dd/mm/yyyy";
resumen.getRange("B6:B7").format.numberFormat = "0";
resumen.getRange("B8").format.numberFormat = "0%";

const phases = [...new Set(tasks.map((t) => t[0]))];
const phaseSummary = phases.map((phase) => {
  const items = tasks.filter((t) => t[0] === phase);
  const minStart = new Date(Math.min(...items.map((t) => excelDate(t[2]).getTime())));
  const maxEnd = new Date(Math.max(...items.map((t) => excelDate(t[3]).getTime())));
  const totalDays = items.reduce((sum, t) => sum + daysInclusive(t[2], t[3]), 0);
  const avg = items.reduce((sum, t) => sum + t[6], 0) / items.length;
  return [phase, items.length, minStart, maxEnd, totalDays, avg / 100];
});
resumen.getRange("A11:F11").values = [["Fase", "Actividades", "Inicio", "Fin", "Dias planificados", "Avance"]];
resumen.getRangeByIndexes(11, 0, phaseSummary.length, 6).values = phaseSummary;
fmt(resumen.getRange("A11:F11"), { fill: colors.navy, font: { bold: true, color: colors.white }, horizontalAlignment: "Center" });
fmt(resumen.getRange(`A12:F${phaseSummary.length + 11}`), { borders: { color: colors.border, style: "Continuous" }, wrapText: true, font: { size: 9, color: colors.text } });
resumen.getRange(`C12:D${phaseSummary.length + 11}`).format.numberFormat = "dd/mm/yyyy";
resumen.getRange(`E12:E${phaseSummary.length + 11}`).format.numberFormat = "0";
resumen.getRange(`F12:F${phaseSummary.length + 11}`).format.numberFormat = "0%";
resumen.tables.add(`A11:F${phaseSummary.length + 11}`, true, "ResumenFases").style = "TableStyleMedium2";

resumen.getRange("H4:I10").values = [
  ["Indicador", "Valor"],
  ["Analisis", tasks.filter((t) => t[0] === "Inicio y analisis").length],
  ["Diseno", tasks.filter((t) => t[0] === "Diseno tecnico").length],
  ["Backend", tasks.filter((t) => t[0] === "Implementacion backend").length],
  ["Frontend", tasks.filter((t) => t[0] === "Implementacion frontend").length],
  ["Pruebas", tasks.filter((t) => t[0] === "Integracion y pruebas").length],
  ["Docs", tasks.filter((t) => t[0] === "Documentacion y entrega").length],
];
fmt(resumen.getRange("H4:I4"), { fill: colors.navy, font: { bold: true, color: colors.white }, horizontalAlignment: "Center" });
fmt(resumen.getRange("H5:I10"), { borders: { color: colors.border, style: "Continuous" }, font: { color: colors.text } });
const chart = resumen.charts.add("bar", resumen.getRange("H4:I10"));
chart.title = "Actividades por fase";
chart.hasLegend = false;
chart.xAxis = { axisType: "textAxis" };
chart.yAxis = { numberFormatCode: "0" };
chart.setPosition("H11", "N27");

// Gantt sheet
gantt.showGridLines = false;
gantt.getRange("A1:P1").merge();
gantt.getRange("A1").values = [["Vista Gantt semanal - Proyecto MedApp"]];
fmt(gantt.getRange("A1"), {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 16 },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
});
gantt.getRange("A1").format.rowHeightPx = 36;
const ganttHeaders = ["No.", "Fase", "Actividad", "Inicio", "Fin", "Responsable"];
const weekStarts = [
  "27/02/2026", "06/03/2026", "13/03/2026", "20/03/2026", "27/03/2026",
  "03/04/2026", "10/04/2026", "17/04/2026", "24/04/2026", "01/05/2026",
];
const weekLabels = weekStarts.map((d, idx) => `S${idx + 1}\n${d}`);
gantt.getRangeByIndexes(2, 0, 1, ganttHeaders.length + weekLabels.length).values = [[...ganttHeaders, ...weekLabels]];
fmt(gantt.getRangeByIndexes(2, 0, 1, ganttHeaders.length + weekLabels.length), {
  fill: colors.navy,
  font: { bold: true, color: colors.white, size: 9 },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
  wrapText: true,
});
const ganttRows = tasks.map((t, i) => {
  const start = excelDate(t[2]);
  const end = excelDate(t[3]);
  const weekMarks = weekStarts.map((w) => {
    const ws = excelDate(w);
    const we = new Date(ws.getTime() + 6 * 86400000);
    return start <= we && end >= ws ? "■" : "";
  });
  return [i + 1, t[0], t[1], start, end, t[4], ...weekMarks];
});
gantt.getRangeByIndexes(3, 0, ganttRows.length, ganttHeaders.length + weekLabels.length).values = ganttRows;
fmt(gantt.getRangeByIndexes(3, 0, ganttRows.length, ganttHeaders.length + weekLabels.length), {
  borders: { color: colors.border, style: "Continuous" },
  font: { size: 9, color: colors.text },
  verticalAlignment: "Center",
  wrapText: true,
});
gantt.getRange(`D4:E${ganttRows.length + 3}`).format.numberFormat = "dd/mm/yyyy";
setWidths(gantt, [42, 130, 285, 76, 76, 115, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44]);
gantt.freezePanes.freezeRows(3);
gantt.freezePanes.freezeColumns(3);

for (let i = 0; i < tasks.length; i++) {
  const phase = tasks[i][0];
  const row = i + 4;
  const fill = phaseColors[phase] || colors.gray;
  fmt(gantt.getRange(`B${row}:C${row}`), { fill, font: { color: colors.text, size: 9 }, borders: { color: colors.border, style: "Continuous" }, wrapText: true });
  fmt(gantt.getRange(`G${row}:P${row}`), { font: { color: colors.blue, bold: true, size: 12 }, horizontalAlignment: "Center", verticalAlignment: "Center", borders: { color: colors.border, style: "Continuous" } });
}

gantt.getRange("A35:P37").merge();
gantt.getRange("A35").values = [["Leyenda: cada marca indica que la actividad tiene trabajo planificado durante esa semana calendario. El cronograma inicia el 27/02/2026 y cubre analisis, diseno, implementacion, integracion, documentacion y entrega."]];
fmt(gantt.getRange("A35"), { fill: colors.paleBlue, font: { color: colors.muted, size: 9 }, wrapText: true, verticalAlignment: "Center" });

// General polish
for (const sheet of [resumen, cronograma, gantt]) {
  const used = sheet.getUsedRange();
  used.format.font = { name: "Segoe UI" };
}

// Verify ranges and render
const inspectSummary = await workbook.inspect({
  kind: "table",
  range: "Cronograma!A4:J12",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 10,
  maxChars: 2500,
});
console.log(inspectSummary.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
  maxChars: 1000,
});
console.log(errors.ndjson);

for (const sheetName of ["Resumen", "Cronograma", "Gantt Semanal"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outDir, `${sheetName.replace(/\s+/g, "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outFile);
console.log(`saved:${outFile}`);
