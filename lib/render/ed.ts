import path from "node:path";
import type { ExtractField } from "@/lib/extract/fields";

/** «Паспорт Заказа и договора (фонды и проекты)» — встроенный шаблон формата html.
 *  Разметка лежит рядом файлом, чтобы её можно было открыть в браузере и сличить с
 *  документом, скопированным из редактора navi. */
export const ED_SKELETON_PATH = path.join(process.cwd(), "lib/render/templates/ed.html");

export const ED_GROUPS = [
  { id: "order", ru: "Заказ", en: "Order" },
  { id: "terms", ru: "Условия", en: "Terms" },
  { id: "sign", ru: "Подписи", en: "Signatures" },
] as const;

/** Разделитель строки документов: её пустые места владелец потом заполняет
 *  ссылками navi вручную, поэтому висящий разделитель в конце обязателен. */
const DOC_SEPARATOR = "&nbsp;|";

/** Абзац суммы и условий оплаты: 18px полужирным, как в исходной форме. */
const AMOUNT_PARAGRAPH =
  '<p><span style="font-size: 18px; color: #1f364d;"><strong>{}</strong></span></p>';

export const ED_FIELDS: ExtractField[] = [
  {
    id: "e1", group: "order", cell: "d0",
    label_ru: "Документы заказа", label_en: "Order documents",
    kind: "text", required: true, strategy: "llm",
    slotMode: "list", listSeparator: DOC_SEPARATOR,
    hint_ru: "названия загруженных документов, каждое с новой строки, например: Договор №07_26 от 11.08.26",
  },
  {
    id: "e2", group: "order", cell: "subject",
    label_ru: "Предмет заказа/договора, описание, страна производитель",
    label_en: "Subject, description, country of manufacture",
    kind: "text", required: true, strategy: "llm", area: true,
    slotMode: "text",
    hint_ru: "что закупается, законченной фразой, с указанием проекта, если он назван",
  },
  {
    id: "e3", group: "order", cell: "expenseClass",
    label_ru: "Класс расхода", label_en: "Expense class",
    kind: "string", required: true, strategy: "llm", fromNote: true,
    slotMode: "text",
    hint_ru: 'берётся ТОЛЬКО из контекста пользователя, например: ПРОЕКТЫ/1905/Мебель; в документах контрагента этого нет — если в контексте не сказано, верни пустую строку',
  },
  {
    id: "e4", group: "order", cell: "counterparty",
    label_ru: "Контрагент с обоснованием выбора", label_en: "Counterparty and why",
    kind: "text", required: true, strategy: "llm", area: true, isCounterparty: true,
    slotMode: "breaks",
    hint_ru: "форма и название, затем с новой строки — чем обоснован выбор (производство, сроки, прошлый опыт)",
  },
  {
    id: "e5", group: "terms", cell: "amountTerms",
    label_ru: "Сумма заказа и договора в валюте/руб., условия оплаты",
    label_en: "Amount and payment terms",
    kind: "text", required: true, strategy: "llm", area: true,
    slotMode: "paragraphs", paragraphHtml: AMOUNT_PARAGRAPH,
    hint_ru: "первой строкой общая сумма, далее каждый платёж отдельной строкой с процентом и суммой",
  },
  {
    id: "e6", group: "terms", cell: "rationale",
    label_ru: "Обоснование и разъяснения", label_en: "Rationale",
    kind: "text", required: true, strategy: "llm", area: true,
    slotMode: "breaks",
    hint_ru: "зачем закупка нужна, законченной фразой",
  },
  {
    id: "e7", group: "terms", cell: "penalties",
    label_ru: "Штрафы, пени по договору", label_en: "Penalties",
    kind: "text", required: false, strategy: "llm",
    slotMode: "text", defaultValue: "стандартные условия",
    hint_ru: "кратко; если в договоре ничего особенного — верни пустую строку",
  },
  {
    id: "e8", group: "terms", cell: "warranty",
    label_ru: "Гарантии и другие существенные условия по договору",
    label_en: "Warranty and other material terms",
    kind: "text", required: false, strategy: "llm",
    slotMode: "breaks",
    hint_ru: "срок гарантии, кто везёт и монтирует",
  },
  {
    id: "e9", group: "terms", cell: "contact",
    label_ru: "Контактное лицо от контрагента", label_en: "Counterparty contact",
    kind: "string", required: false, strategy: "llm",
    slotMode: "contact",
    hint_ru: "имя, телефон и почта одной строкой",
  },
  {
    id: "e10", group: "sign", cell: "startedBy",
    label_ru: "Запустил", label_en: "Started by",
    kind: "string", required: true, strategy: "manual",
    slotMode: "text", fillMode: "constant", constantValue: "Мишин С. С.",
  },
  {
    id: "e11", group: "sign", cell: "cfo",
    label_ru: "ЦФО", label_en: "Responsible officer",
    kind: "string", required: true, strategy: "manual",
    slotMode: "text",
    options: [
      { value: "Суровцев", label_ru: "Развитие", label_en: "Development" },
      { value: "Вознесенская", label_ru: "Мед. департамент", label_en: "Medical department" },
      { value: "Субханкулова", label_ru: "Фин. департамент", label_en: "Finance department" },
    ],
  },
];

/** Инструкция шаблона — шапка собственного файла владельца, переведённая в данные.
 *  Правила цвета из неё убраны: цвета держит разметка, не модель. */
export const ED_INSTRUCTION = [
  "Заполни «Паспорт Заказа и договора» по документам контрагента: счёт, договор, счёт-договор, счёт-оферта, коммерческое предложение, смета.",
  "Обязательные разделы: предмет заказа/договора с описанием и страной производителя; класс расхода; контрагент с обоснованием выбора; сумма заказа и договора в валюте или рублях с условиями оплаты; обоснование и разъяснения; штрафы и пени по договору; гарантии и другие существенные условия; контактное лицо от контрагента.",
  "Если раздела в документах нет — верни по нему пустую строку, значение по умолчанию подставится само. Ничего не выдумывай.",
].join("\n");
