export type Lang = "ru" | "en";
export type StatusKey = "done" | "review" | "processing" | "draft" | "error";
export type ConfLevel = "high" | "med" | "low";

export interface UiTemplate {
  id: string; code: string; name_ru: string; name_en: string;
  desc_ru: string; desc_en: string; format: string; sheets: string[];
  fields: number; updated: string; primary?: boolean;
}
export interface HistoryRow {
  id: string; file: string; tpl: string; counter: string;
  amount: string; cur: string; status: StatusKey; date: string; files: number;
}
export interface UiSourceFile { id: string; name: string; type: string; size: string; pages: number; }
export interface PtField {
  id: string; group: "req" | "pay" | "terms"; label_ru: string; label_en: string;
  value: string; cell: string; conf: ConfLevel; unit?: string; area?: boolean;
  src: { file: string; loc: string };
}
export interface Group { id: string; ru: string; en: string; }
export interface MappingRow {
  id: string; label_ru: string; label_en: string; cell: string;
  rule: string; required: boolean; kind: string;
}

export const STR: Record<string, { ru: string; en: string }> = {
  app_name:        { ru: "Form-Filling Assistant", en: "Form-Filling Assistant" },
  nav_fills:       { ru: "Заполнения",   en: "Fills" },
  nav_templates:   { ru: "Шаблоны",      en: "Templates" },
  nav_sources:     { ru: "Источники",    en: "Sources" },
  nav_settings:    { ru: "Настройки",    en: "Settings" },
  search:          { ru: "Поиск по заполнениям, контрагентам, файлам…", en: "Search fills, counterparties, files…" },
  new_fill:        { ru: "Новое заполнение", en: "New fill" },
  dash_eyebrow:    { ru: "Рабочая область", en: "Workspace" },
  dash_h1a:        { ru: "Заполняйте документы", en: "Fill documents" },
  dash_h1b:        { ru: "данными из ваших файлов — за секунды", en: "from your own files — in seconds" },
  dash_sub:        { ru: "Загрузите ваши документы. Ассистент извлечёт нужные поля и подставит их в выбранный шаблон.", en: "Drop in your documents. The assistant pulls the right fields and maps them into your chosen template." },
  stat_total:      { ru: "Всего заполнений", en: "Total fills" },
  stat_month:      { ru: "В этом месяце",   en: "This month" },
  stat_time:       { ru: "Сэкономлено времени", en: "Time saved" },
  stat_acc:        { ru: "Средняя точность", en: "Avg. accuracy" },
  recent:          { ru: "Недавние заполнения", en: "Recent fills" },
  col_doc:         { ru: "Документ",     en: "Document" },
  col_template:    { ru: "Шаблон",       en: "Template" },
  col_counter:     { ru: "Контрагент",   en: "Counterparty" },
  col_amount:      { ru: "Сумма",        en: "Amount" },
  col_status:      { ru: "Статус",       en: "Status" },
  col_date:        { ru: "Дата",         en: "Date" },
  st_done:         { ru: "Готово",       en: "Ready" },
  st_review:       { ru: "На проверке",  en: "Needs review" },
  st_processing:   { ru: "Обработка",    en: "Processing" },
  st_draft:        { ru: "Черновик",     en: "Draft" },
  st_error:        { ru: "Ошибка",       en: "Error" },
  step_upload:     { ru: "Загрузка",     en: "Upload" },
  step_process:    { ru: "Обработка",    en: "Processing" },
  step_review:     { ru: "Проверка",     en: "Review" },
  step_done:       { ru: "Готово",       en: "Done" },
  choose_template: { ru: "Выберите шаблон", en: "Choose a template" },
  drop_title:      { ru: "Перетащите файлы сюда", en: "Drop files here" },
  drop_sub:        { ru: "или нажмите, чтобы выбрать — PDF, Excel, Word", en: "or click to browse — PDF, Excel, Word" },
  drop_hint:       { ru: "Счета · Договоры · Коммерческие предложения · до 20 МБ", en: "Invoices · Contracts · Quotes · up to 20 MB" },
  files_added:     { ru: "Добавленные файлы", en: "Added files" },
  upload_failed:   { ru: "Ошибка", en: "Failed" },
  start_process:   { ru: "Начать обработку", en: "Start processing" },
  proc_parse:      { ru: "Парсинг документов", en: "Parsing documents" },
  proc_parse_d:    { ru: "Текст, таблицы и метаданные извлекаются локально", en: "Text, tables and metadata extracted locally" },
  proc_extract:    { ru: "Извлечение полей (LLM)", en: "Field extraction (LLM)" },
  proc_extract_d:  { ru: "Бесплатная модель сопоставляет данные с полями шаблона", en: "Free model matches data to template fields" },
  proc_fill:       { ru: "Заполнение шаблона", en: "Filling the template" },
  proc_fill_d:     { ru: "Значения подставляются в ячейки «Платёжного требования»", en: "Values mapped into the Payment Request cells" },
  review_h:        { ru: "Проверьте извлечённые поля", en: "Review extracted fields" },
  review_sub:      { ru: "Наведите на источник, чтобы увидеть откуда взято значение. Низкая уверенность — проверьте вручную.", en: "Hover a source to see where a value came from. Low confidence — verify manually." },
  field:           { ru: "Поле",   en: "Field" },
  value:           { ru: "Значение", en: "Value" },
  source:          { ru: "Источник", en: "Source" },
  confidence:      { ru: "Увер.",  en: "Conf." },
  conf_high:       { ru: "Высокая", en: "High" },
  conf_med:        { ru: "Средняя", en: "Medium" },
  conf_low:        { ru: "Низкая",  en: "Low" },
  needs_check:     { ru: "Требует проверки", en: "Needs a look" },
  review_warn:     { ru: "Часть данных не извлечена автоматически — заполните эти поля вручную:", en: "Some data wasn't extracted automatically — fill these fields manually:" },
  back:            { ru: "Назад",   en: "Back" },
  confirm_fill:    { ru: "Подтвердить и заполнить", en: "Confirm & fill" },
  done_h:          { ru: "Документ готов", en: "Your document is ready" },
  done_sub:        { ru: "«Платёжное требование» заполнено и проверено. Скачайте в нужном формате.", en: "The Payment Request is filled and checked. Download in your preferred format." },
  dl_excel:        { ru: "Скачать Excel", en: "Download Excel" },
  dl_pdf:          { ru: "Скачать PDF",   en: "Download PDF" },
  open_dash:       { ru: "В рабочую область", en: "Back to workspace" },
  tpl_h:           { ru: "Шаблоны", en: "Templates" },
  tpl_sub:         { ru: "Создавайте, редактируйте и настраивайте маппинг полей на ячейки.", en: "Create, edit and configure how fields map to cells." },
  new_template:    { ru: "Новый шаблон", en: "New template" },
  fields_n:        { ru: "полей", en: "fields" },
  edit_mapping:    { ru: "Маппинг полей", en: "Field mapping" },
  mapping_h:       { ru: "Маппинг полей на ячейки", en: "Field-to-cell mapping" },
  rule:            { ru: "Правило извлечения", en: "Extraction rule" },
  cell:            { ru: "Ячейка", en: "Cell" },
  required:        { ru: "Обяз.", en: "Req." },
  add_field:       { ru: "Добавить поле", en: "Add field" },
  preview:         { ru: "Предпросмотр документа", en: "Document preview" },
  save:            { ru: "Сохранить", en: "Save" },
  parse_empty:     { ru: "Не удалось извлечь текст ни из одного файла", en: "No text could be extracted from any file" },
  parse_failed:    { ru: "Обработка не удалась", en: "Processing failed" },
  processing_title:{ ru: "Обрабатываем документы", en: "Processing documents" },
  processing_sub:  { ru: "Извлекаем текст из файлов", en: "Extracting text from files" },
};

export const STATUS: Record<StatusKey, { key: string; tone: "ok" | "warn" | "info" | "muted" | "bad" }> = {
  done:       { key: "st_done",       tone: "ok" },
  review:     { key: "st_review",     tone: "warn" },
  processing: { key: "st_processing", tone: "info" },
  draft:      { key: "st_draft",      tone: "muted" },
  error:      { key: "st_error",      tone: "bad" },
};

export const TEMPLATES: UiTemplate[] = [
  {
    id: "pt", code: "ПТ-Ф15", name_ru: "Платёжное требование", name_en: "Payment Request",
    desc_ru: "Внутренняя заявка на оплату по счёту / договору", desc_en: "Internal request to pay against an invoice / contract",
    format: "XLSX", sheets: ["ПТ", "Счёт", "График оплат"], fields: 18, updated: "20.05.2026", primary: true,
  },
  {
    id: "inv", code: "СЧ-01", name_ru: "Счёт на оплату", name_en: "Invoice for payment",
    desc_ru: "Счёт с реквизитами, позициями и итогами", desc_en: "Invoice with details, line items and totals",
    format: "XLSX", sheets: ["Счёт"], fields: 12, updated: "08.05.2026",
  },
  {
    id: "act", code: "АКТ-02", name_ru: "Акт выполненных работ", name_en: "Acceptance act",
    desc_ru: "Акт сдачи-приёмки по договору", desc_en: "Work acceptance act under a contract",
    format: "DOCX", sheets: [], fields: 9, updated: "29.04.2026",
  },
  {
    id: "rec", code: "СВ-03", name_ru: "Сверка взаиморасчётов", name_en: "Reconciliation report",
    desc_ru: "Акт сверки за период", desc_en: "Settlement reconciliation for a period",
    format: "XLSX", sheets: ["Сверка"], fields: 7, updated: "12.04.2026",
  },
];

export const HISTORY: HistoryRow[] = [
  { id: "F-2041", file: "Счёт-оферта №201.pdf",  tpl: "pt",  counter: 'ООО «МК Клевер»',     amount: "418 600,00", cur: "₽", status: "review",     date: "Сегодня, 11:24",  files: 3 },
  { id: "F-2039", file: "Договор №КЛ-118.pdf",    tpl: "pt",  counter: 'ООО «Орбита-Тех»',     amount: "1 240 000,00", cur: "₽", status: "done",     date: "Сегодня, 09:50",  files: 2 },
  { id: "F-2034", file: "КП_Светотехника.xlsx",   tpl: "inv", counter: 'ИП Гордеев А. В.',      amount: "96 400,00",  cur: "₽", status: "done",       date: "Вчера, 18:02",    files: 1 },
  { id: "F-2031", file: "Счёт №77 от 28.05.pdf",  tpl: "pt",  counter: 'АО «Медтех-Сервис»',    amount: "532 100,00", cur: "₽", status: "processing", date: "Вчера, 15:41",    files: 2 },
  { id: "F-2028", file: "Акт_СТ-440.docx",        tpl: "act", counter: 'ООО «СтройКомплект»',   amount: "—",          cur: "",  status: "draft",      date: "29.05.2026",      files: 1 },
  { id: "F-2025", file: "Счёт №54.pdf",           tpl: "pt",  counter: 'ООО «Аква-Лайн»',       amount: "74 900,00",  cur: "₽", status: "error",       date: "28.05.2026",      files: 1 },
  { id: "F-2019", file: "Договор поставки.pdf",    tpl: "rec", counter: 'ООО «ТД Вектор»',       amount: "2 015 300,00", cur: "₽", status: "done",     date: "27.05.2026",      files: 4 },
];

export const SOURCE_FILES: UiSourceFile[] = [
  { id: "s1", name: "Счёт-оферта №201 от 16.04.2026.pdf", type: "pdf",  size: "284 КБ", pages: 2 },
  { id: "s2", name: "Договор поставки УОРЛ-1.pdf",         type: "pdf",  size: "1,1 МБ", pages: 7 },
  { id: "s3", name: "КП_Клевер_УОРЛ.xlsx",                 type: "xlsx", size: "46 КБ",  pages: 1 },
];

export const FIELDS: PtField[] = [
  { id: "f1",  group: "req", label_ru: "Контрагент", label_en: "Counterparty",
    value: 'ООО «МК Клевер»', cell: "ПТ!D9", conf: "high",
    src: { file: "Счёт-оферта №201.pdf", loc: "стр. 1 · шапка" } },
  { id: "f2",  group: "req", label_ru: "Основание платежа", label_en: "Payment basis",
    value: "Оплата за установку отоларингологическую УОРЛ-1 (блок автономной подачи тёплой воды) согласно Счёту №41 от 16.04.2026",
    cell: "ПТ!D11", conf: "med", src: { file: "Счёт-оферта №201.pdf", loc: "стр. 1 · назначение" }, area: true },
  { id: "f3",  group: "req", label_ru: "Договор / Счёт №, дата", label_en: "Contract / Invoice no., date",
    value: "Счёт-оферта №201 от 16.04.2026", cell: "ПТ!D12", conf: "high",
    src: { file: "Счёт-оферта №201.pdf", loc: "стр. 1" } },
  { id: "f4",  group: "pay", label_ru: "Сумма по договору", label_en: "Contract amount",
    value: "418 600,00", unit: "руб.", cell: "ПТ!D13", conf: "high",
    src: { file: "Счёт-оферта №201.pdf", loc: "Итого к оплате" } },
  { id: "f5",  group: "pay", label_ru: "Валюта", label_en: "Currency",
    value: "руб.", cell: "ПТ!F13", conf: "high", src: { file: "Счёт-оферта №201.pdf", loc: "позиции" } },
  { id: "f6",  group: "pay", label_ru: "Уже оплачено", label_en: "Already paid",
    value: "0,00", unit: "руб.", cell: "ПТ!D14", conf: "low",
    src: { file: "—", loc: "не найдено в источниках" } },
  { id: "f7",  group: "pay", label_ru: "Сумма текущей оплаты", label_en: "Current payment",
    value: "418 600,00", unit: "руб.", cell: "ПТ!D15", conf: "high",
    src: { file: "Счёт-оферта №201.pdf", loc: "Итого к оплате" } },
  { id: "f8",  group: "pay", label_ru: "Вид платежа", label_en: "Payment type",
    value: "Аванс", cell: "ПТ!H15", conf: "med", src: { file: "Договор поставки УОРЛ-1.pdf", loc: "п. 4.2" } },
  { id: "f9",  group: "terms", label_ru: "Условия оплаты по договору", label_en: "Payment terms",
    value: "Предоплата 100% в течение 3 рабочих дней", cell: "ПТ!D16", conf: "high",
    src: { file: "Договор поставки УОРЛ-1.pdf", loc: "п. 4.1" }, area: true },
  { id: "f10", group: "terms", label_ru: "Срок оплаты", label_en: "Payment due",
    value: "30.04.2026", cell: "ПТ!H16", conf: "med", src: { file: "Договор поставки УОРЛ-1.pdf", loc: "п. 4.1" } },
  { id: "f11", group: "terms", label_ru: "Условия поставки по договору", label_en: "Delivery terms",
    value: "Срок поставки 14 рабочих дней с даты поступления оплаты. Доставка за счёт поставщика.",
    cell: "ПТ!D19", conf: "med", src: { file: "Договор поставки УОРЛ-1.pdf", loc: "п. 5.1–5.3" }, area: true },
  { id: "f12", group: "terms", label_ru: "Дата получения документов", label_en: "Documents received",
    value: "16.04.2026", cell: "ПТ!D21", conf: "low", src: { file: "—", loc: "проставьте вручную" } },
];

export const GROUPS: Group[] = [
  { id: "req",   ru: "Реквизиты",       en: "Details" },
  { id: "pay",   ru: "Платёж",          en: "Payment" },
  { id: "terms", ru: "Условия",         en: "Terms" },
];

// MAPPING is derived from FIELDS exactly as in data.jsx:175-181:
export const MAPPING: MappingRow[] = FIELDS.map((f) => ({
  id: f.id, label_ru: f.label_ru, label_en: f.label_en, cell: f.cell,
  rule: f.id === "f6" || f.id === "f12" ? "Ручной ввод"
      : f.area ? "LLM · извлечение по контексту" : "Парсер · регулярное выражение",
  required: !["f6", "f10", "f12"].includes(f.id),
  kind: f.area ? "Текст" : f.unit ? "Сумма" : "Строка",
}));
