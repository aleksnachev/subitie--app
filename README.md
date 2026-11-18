# съБИТИЕ+

Всички спортни и културни събития в Пловдив на едно място. Уеб приложение (PWA), което се отваря от линк и се добавя на началния екран на телефона.

## Как работи

```
GitHub (този repo) ──push──► Netlify ──► приложението на телефоните
       ▲
       └── GitHub Actions всеки ден в 06:00: събира събитията → data/events.json → commit
```

- **Без база данни.** Профилът и любимите се пазят само на телефона на потребителя (localStorage).
- **Без build стъпка.** Чист HTML/CSS/JS, Netlify публикува файловете директно.
- **Автоматични ъпдейти.** Всяка промяна в `main` се публикува от Netlify за ~30 сек. и потребителите я получават при следващото отваряне на приложението (виж `sw.js`).

## Структура

| Път | Какво е |
|---|---|
| `index.html`, `css/`, `js/app.js` | Самото приложение |
| `js/config.js` | Категории, възрастови групи и преводи (BG/EN) |
| `sw.js` | Service worker: офлайн режим и автоматични ъпдейти |
| `data/manual.json` | Ръчно въведени събития (може да се редактира директно в GitHub) |
| `data/events.json` | **Генериран файл** — това чете приложението. Не го редактирайте на ръка. |
| `scripts/build-events.mjs` | Събира всички източници → `events.json` |
| `scripts/sources/` | Един файл = един източник: `20-visitplovdiv.mjs` (работи), `21-eventim.mjs` (изключен — чака разрешение от Eventim), `10-example-site.mjs` (шаблон за нов). |
| `.github/workflows/update-events.yml` | Дневното автоматично обновяване |

## Правила за събитията

- Приключилите събития остават видими **7 дни** със знак „Приключило“, после изчезват (`ENDED_VISIBLE_DAYS` в `js/app.js`).
- Ако събитието има начален час, но няма краен — приема се 3 часа. Ако няма никакъв час — до 23:59 същия ден.
- Любимите остават завинаги в профила, като приключилите отиват в „Минали“.

## Локално пускане

```bash
npx http-server -p 5173 -c-1
```
и отворете http://localhost:5173. За да обновите данните: `node scripts/build-events.mjs`.

## Netlify (еднократно)

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → изберете `subitie--app`.
2. Build command: празно. Publish directory: `.` (всичко е в `netlify.toml`).
3. Deploy. След това всеки push в `main` се публикува автоматично.

## Добавяне на събитие на ръка

Отворете `data/manual.json` в GitHub → ✏️ → добавете ред по примера → Commit. GitHub Action-ът ще обнови `events.json` за минута.

## Формата за организатори (Google Sheet)

Виж инструкциите в `scripts/sources/02-google-sheet.mjs`. Линкът към публикувания CSV се слага в GitHub → Settings → Secrets and variables → Actions → **Variables** → `SHEET_CSV_URL`.
