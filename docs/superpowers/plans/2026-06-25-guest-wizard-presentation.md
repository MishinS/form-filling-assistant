# Презентабельный гостевой мастер — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать гостевой мастер на `/` презентабельным: убрать нерабочие модальные кнопки (× и «Назад» на шаге 0), добавить hero, заменить финальную кнопку на «Заполнить ещё».

**Architecture:** Поведение гейтится на существующих флагах `embedded` (визуальный режим `WizardModal`, используется только `GuestShell`) и `GuestContext.guest`. Кабинетная (overlay) модалка не затрагивается. Презентационные правки в трёх компонентах + новые i18n-ключи.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Vitest (логика/i18n), Playwright (ad-hoc headless смоук). Рабочая директория: `form_filling_assistent/web/`.

## Global Constraints

- Все команды и пути — относительно `form_filling_assistent/web/`.
- i18n: строки живут в `STR` (`lib/seed/pt.ts`), форма `key: { ru, en }`; доступ через `t(key)` / `translate(key, lang)`.
- Акцент `#0b5394` синий + белый текст (locked-решение проекта). Hero не вводит новых цветов — только существующие CSS-переменные/классы (`muted`, `mono dim`).
- Не вводить jsdom/testing-library: компоненты в этом репо не покрываются юнит-тестами (паттерн проекта). UI верифицируется `tsc`+`eslint`+`build`+Playwright-смоук.
- Кабинетную (полно-юзерскую) модалку (`embedded=false`) не менять.
- Git: ветка `ffa-guest-wizard-ux` (уже создана). Коммитить из корня `/home/sergei/Work/dev`, пути с префиксом `claude/form_filling_assistent/web/`. Сообщения коммитов заканчивать `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: i18n-ключи гостевого мастера

**Files:**
- Modify: `lib/seed/pt.ts` (добавить 4 ключа в объект `STR`)
- Test: `lib/i18n.test.ts` (добавить кейс)

**Interfaces:**
- Consumes: `translate(key, lang)` из `lib/i18n.ts`; объект `STR` из `lib/seed/pt.ts`.
- Produces: ключи `guest_hero_h`, `guest_hero_sub`, `guest_hero_note`, `guest_again` (ru/en), используемые в Task 3 и Task 4.

- [ ] **Step 1: Написать падающий тест**

В `lib/i18n.test.ts` внутри `describe("translate", …)` добавить:

```ts
  it("has guest wizard presentation keys (ru + en)", () => {
    expect(translate("guest_hero_h", "ru")).toBe("Заполните документ за минуту");
    expect(translate("guest_hero_h", "en")).toBe("Fill a document in a minute");
    expect(translate("guest_again", "ru")).toBe("Заполнить ещё документ");
    expect(translate("guest_again", "en")).toBe("Fill another document");
    expect(translate("guest_hero_sub", "en")).not.toBe("guest_hero_sub");
    expect(translate("guest_hero_note", "en")).not.toBe("guest_hero_note");
  });
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run lib/i18n.test.ts`
Expected: FAIL — `translate("guest_hero_h","ru")` возвращает `"guest_hero_h"` (ключ ещё не добавлен), assert не проходит.

- [ ] **Step 3: Добавить ключи**

В `lib/seed/pt.ts`, рядом с другими `guest_*` ключами (после `guest_loading`), добавить в `STR`:

```ts
  guest_hero_h:    { ru: "Заполните документ за минуту", en: "Fill a document in a minute" },
  guest_hero_sub:  { ru: "Загрузите счёт или договор — AI извлечёт данные и заполнит бланк", en: "Upload an invoice or contract — AI extracts the data and fills the form" },
  guest_hero_note: { ru: "без регистрации · бесплатные модели", en: "no signup · free models" },
  guest_again:     { ru: "Заполнить ещё документ", en: "Fill another document" },
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run lib/i18n.test.ts`
Expected: PASS (все кейсы зелёные).

- [ ] **Step 5: Коммит**

```bash
cd /home/sergei/Work/dev
git add claude/form_filling_assistent/web/lib/seed/pt.ts claude/form_filling_assistent/web/lib/i18n.test.ts
git commit -m "feat(i18n): ключи гостевого hero + «заполнить ещё»

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `WizardModal` — убрать модальные артефакты в `embedded`

**Files:**
- Modify: `components/wizard/WizardModal.tsx` (шапка `:100`, футер `:127-133`, тень `:89`)

**Interfaces:**
- Consumes: проп `embedded: boolean` (уже в сигнатуре), `onClose`, `step`, `t`.
- Produces: тот же публичный API (`{ start, onClose, embedded? }`) — внешнего контракта не меняем.

- [ ] **Step 1: Спрятать крестик в шапке (с сохранением баланса)**

Заменить кнопку × в шапке (строка ~100):

```tsx
          <button onClick={onClose} className="muted" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="x" size={15} /></button>
```

на условный рендер (для `embedded` — невидимый спейсер, чтобы `space-between` держал Stepper по центру):

```tsx
          {embedded
            ? <span aria-hidden style={{ width: 34, height: 34 }} />
            : <button onClick={onClose} className="muted" style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", border: "1px solid var(--line-2)" }}><Icon name="x" size={15} /></button>}
```

- [ ] **Step 2: Спрятать «Назад» на шаге 0 в `embedded`**

В футере (строка ~129) заменить безусловную кнопку «Назад»:

```tsx
            <Btn variant="quiet" size="md" icon="arrowL" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{t("back")}</Btn>
```

на:

```tsx
            {embedded && step === 0
              ? <span aria-hidden />
              : <Btn variant="quiet" size="md" icon="arrowL" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{t("back")}</Btn>}
```

(спейсер `<span aria-hidden />` сохраняет `justify-content: space-between` — «Начать обработку» остаётся прижатой вправо.)

- [ ] **Step 3: Смягчить тень карточки в `embedded`**

В стиле `card` (строка ~89) заменить:

```tsx
      display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: embedded ? "0 24px 80px rgba(0,0,0,.35)" : "0 40px 120px rgba(0,0,0,.6)" }}>
```

на:

```tsx
      display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: embedded ? "0 8px 32px rgba(0,0,0,.18)" : "0 40px 120px rgba(0,0,0,.6)" }}>
```

- [ ] **Step 4: Проверка типов и линта**

Run: `npx tsc --noEmit && npx eslint components/wizard/WizardModal.tsx`
Expected: tsc — без ошибок; eslint — без новых ошибок (допустимы 2 пред-существующих `<img>`-warning в других файлах, в этом файле — чисто).

- [ ] **Step 5: Коммит**

```bash
cd /home/sergei/Work/dev
git add claude/form_filling_assistent/web/components/wizard/WizardModal.tsx
git commit -m "feat(wizard): embedded без × и без «назад» на шаге 0, мягче тень

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `DoneStep` — финальная кнопка для гостя

**Files:**
- Modify: `components/wizard/DoneStep.tsx` (нижняя кнопка `open_dash`, последняя строка JSX)

**Interfaces:**
- Consumes: `guest` из `useContext(GuestContext)` (уже импортирован и используется в файле); ключ `guest_again` из Task 1.
- Produces: нет нового внешнего API.

- [ ] **Step 1: Сделать метку зависящей от гостя**

Заменить нижнюю кнопку:

```tsx
      <button onClick={onClose} className="muted" style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>{t("open_dash")}</button>
```

на:

```tsx
      <button onClick={onClose} className="muted" style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>{guest ? t("guest_again") : t("open_dash")}</button>
```

(`onClose` для гостя уже = перемонтирование свежего мастера, т.е. «заполнить ещё»; для полного юзера поведение и текст не меняются.)

- [ ] **Step 2: Проверка типов и линта**

Run: `npx tsc --noEmit && npx eslint components/wizard/DoneStep.tsx`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
cd /home/sergei/Work/dev
git add claude/form_filling_assistent/web/components/wizard/DoneStep.tsx
git commit -m "feat(wizard): финальная кнопка гостя — «Заполнить ещё документ»

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `GuestShell` — hero над мастером + финальный смоук

**Files:**
- Modify: `components/guest/GuestShell.tsx` (функция `GuestWizard`, блок рендера мастера `:37-39`)

**Interfaces:**
- Consumes: `t` из `useI18n()` (уже в `GuestWizard`); ключи `guest_hero_h/sub/note` из Task 1.
- Produces: нет нового внешнего API.

- [ ] **Step 1: Добавить hero над `WizardModal`**

Заменить блок (строки ~37-39):

```tsx
            <div style={{ padding: "24px 16px 64px" }}>
              <WizardModal key={key} start={0} embedded onClose={() => setKey((k) => k + 1)} />
            </div>
```

на:

```tsx
            <div style={{ padding: "24px 16px 64px" }}>
              <div style={{ maxWidth: "min(1080px, 100%)", margin: "0 auto 24px", textAlign: "center" }}>
                <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15 }}>{t("guest_hero_h")}</h1>
                <p className="muted" style={{ fontSize: 15, marginTop: 10, maxWidth: 560, marginInline: "auto" }}>{t("guest_hero_sub")}</p>
                <p className="mono dim" style={{ fontSize: 11.5, marginTop: 12 }}>{t("guest_hero_note")}</p>
              </div>
              <WizardModal key={key} start={0} embedded onClose={() => setKey((k) => k + 1)} />
            </div>
```

- [ ] **Step 2: Проверка типов, линта и сборки**

Run: `npx tsc --noEmit && npx eslint components/guest/GuestShell.tsx && AUTH_SECRET=build-only npm run build`
Expected: tsc/eslint без ошибок; `next build` зелёный, маршрут `ƒ /` присутствует.

- [ ] **Step 3: Headless Playwright-смоук гостевой страницы**

Создать throwaway-скрипт в scratchpad (НЕ коммитить) — гостевая сессия эфемерна (role:guest), Neon не дёргается. Запускать из `form_filling_assistent/web/` при поднятом `npm run dev` (порт 3000):

```js
// /tmp/.../scratchpad/guest-smoke.mjs  — require playwright по абсолютному пути из web/node_modules
const { chromium } = require("/home/sergei/Work/dev/claude/form_filling_assistent/web/node_modules/playwright");
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
// дождаться, пока гостевой signIn завершится и мастер отрендерится
await p.waitForSelector("text=Заполните документ за минуту", { timeout: 15000 });
const startBtn = await p.locator("text=Начать обработку").count();
const backBtn  = await p.locator("button:has-text('Назад')").count();
const xBtn      = await p.locator("header ~ * button svg").count(); // грубо
console.log(JSON.stringify({ heroVisible: true, startBtn, backBtn }));
await b.close();
```

Run (в одном терминале `npm run dev`, в другом `node <script>`).
Expected: `heroVisible: true`, `startBtn: 1`, `backBtn: 0` (на шаге 0 «Назад» отсутствует). Если dev-сервер недоступен/флапает — задокументировать ручной смоук вместо этого (открыть `/`, глазами проверить: нет ×, нет «Назад» на шаге 0, есть hero и «Начать обработку»).

- [ ] **Step 4: Коммит**

```bash
cd /home/sergei/Work/dev
git add claude/form_filling_assistent/web/components/guest/GuestShell.tsx
git commit -m "feat(guest): hero над встроенным мастером на /

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Финальная верификация (после всех задач)

- [ ] `npx vitest run` — все тесты зелёные (включая новый i18n-кейс).
- [ ] `npx tsc --noEmit` — без ошибок.
- [ ] `npx eslint .` — без новых ошибок (только 2 пред-существующих `<img>`-warning).
- [ ] `AUTH_SECRET=build-only npm run build` — зелёный.
- [ ] Смоук `/`: шаг 0 — без ×, без «Назад», только «Начать обработку»; hero виден; финал гостя — кнопка «Заполнить ещё документ» перезапускает мастер.

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** §1 WizardModal → Task 2; §2 DoneStep → Task 3; §3 GuestShell hero → Task 4; §4 i18n-ключи → Task 1. Все секции покрыты.
- **Плейсхолдеры:** нет — весь код приведён дословно.
- **Согласованность типов:** ключи `guest_hero_h/sub/note/guest_again` определены в Task 1 и используются в Task 3/4 под теми же именами; флаги `embedded`/`guest` — существующие.
