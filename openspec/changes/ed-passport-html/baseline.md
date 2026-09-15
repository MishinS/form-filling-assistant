## Snapshot

2026-09-15, ~11:07–11:09 местного времени, ветка `feat/ed-passport-html` от `main`, рабочее дерево без правок кода (`07-tree-clean.txt`). Файлы прогона — `runs/2026-09-15-ed-passport-html/`.

## Measurements

| Величина | Чем снята | Значение до | Файл |
|---|---|---|---|
| Форматы, которые принимает `template_format` | `grep -n 'templateFormat' lib/db/schema.ts` | 2: `["xlsx", "docx"]` (schema.ts:4); тип `TemplateRow["format"]` — `"xlsx" \| "docx"` (templates.ts:13) | `03-template-formats.txt` |
| Встроенные каталоги полей в `lib/extract/fields.ts` | `grep -n 'export const .*_FIELDS' lib/extract/fields.ts` | 1: `PT_FIELDS` (fields.ts:39) | `04-catalogs-and-render.txt` |
| Модуль рендера `lib/render` | `ls lib/render` | отсутствует: `No such file or directory` | `04-catalogs-and-render.txt` |
| Упоминание «Платёжного требования» в общем сборщике промта | `grep -rn 'Платёжного требования' lib --include='*.ts'` | есть: `lib/extract/llm/prompt.ts:19` (плюс строка интерфейса в `lib/seed/pt.ts:151`, к промту не относится) | `04-catalogs-and-render.txt` |
| Типы ответа, которые отдаёт `/api/fill` при успехе | `grep -n 'Content-Type\|NextResponse.json\|new Response' app/api/fill/route.ts` | 1: бинарный `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (route.ts:20); JSON-ответа при успехе нет | `05-fill-output-shape.txt` |
| Число тестов | `npm test` | 545 тестов в 78 файлах | `01-tests-before.txt` |

## Must Not Change

| Величина | Чем снята | Значение до | Файл |
|---|---|---|---|
| Текст промта ПТ, собранный для `PT_FIELDS` при фиксированном входе | временный зонд `lib/extract/llm/__baseline_probe.test.ts` → `buildExtractionPrompt(PT_FIELDS, "ОБРАЗЕЦ ТЕКСТА ДОКУМЕНТА", "JSONLINE", true)`, `npx vitest run` | 2582 байта, sha256 `7aaa84b4f4f06ee4935b5971301976be1d42785be55d7f400e814c56560d4ef7` | `06-pt-prompt-before.txt` |
| Книга встроенного шаблона ПТ | `sha256sum lib/fill/templates/pt.xlsx` | `e166942470f527888dd78b9679ee55429137c44596924d572edeacb4ab74834a` | `05-fill-output-shape.txt` |
| Результат всего набора тестов | `npm test` | 0 падений, код возврата 0 | `01-tests-before.txt` |
| Результат проверки типов | `npx tsc --noEmit` | пустой вывод, код возврата 0 | `02-tsc-before.txt` |

## Notes

- Текст промта ПТ нельзя снять готовой командой: он собирается в TypeScript с алиасом `@/`, который вне vitest не разрешается. Снят временным тест-зондом `lib/extract/llm/__baseline_probe.test.ts`, записавшим промт в файл прогона. Зонд удалён сразу после снятия; `git status --porcelain` после удаления показывает только новые `openspec/changes/ed-passport-html/` и `runs/`, то есть кода снимок не тронул (`07-tree-clean.txt`).
- Число тестов вынесено в Measurements, а не в Must Not Change: изменение обязано его увеличить. Неизменным обязано остаться отсутствие падений, и это отдельная строка.
- Точность извлечения на «Паспорте» в снимок не попала: сегодня шаблона нет, мерить нечего. Эталонный прогон на договорах владельца задан задачей 8.1 и появится в `verification.md` как величина «после» без пары «до».
