# Supply Form — операционная шпаргалка (CLAUDE.md проекта)

Сайт уведомлений о поставке материалов «Ситибэй»: поставщик заполняет форму, загружает
скан заявки, Claude Vision распознаёт позиции, данные пишутся в Google Таблицу.
Общие правила — в `../CLAUDE.md` (корень VS_hub); здесь только специфика проекта.
Подробное описание архитектуры и API — в `README.md` рядом.

## Подключения

| Что | Значение |
|---|---|
| Сайт (GitHub Pages) | https://nick3000ept.github.io/supply-form/ |
| Календарь поставок | тот же сайт + `?cal=КОД`; полная ссылка — в `ДОСТУПЫ.md` в корне VS_hub |
| GitHub репо | https://github.com/Nick3000ept/supply-form (аккаунт Nick3000ept) |
| scriptId | `1fNBsW2AvpzhHkFzGyTPRv6_L5to24Q1vKh1cFE8F2DpcJlS8Mh9k7I1t` |
| **Рабочий deploymentId** | `AKfycbxAcrSDH6xa65Wor3ZHpW3BcZ-yAwwN9PFTynCNDYUbpP7NOev6Ng0e0lH84ykz29nN` |
| Google Таблица | https://docs.google.com/spreadsheets/d/1LjL-azYiG3WqSH4BB5XgLmlrP2bT4WWbeNXYQmoAJJM |
| Аккаунт GAS/Drive/Таблицы | workcacc2025@gmail.com |

Script Properties GAS: `CLAUDE_API_KEY`, `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `CAL_TOKEN`
(код доступа к календарю; устанавливается один раз через action `setCalToken`).

## Деплой

1. Бэк (`Code.gs` / `appsscript.json`):
   `clasp push --force` → `clasp update-deployment <рабочий deploymentId> --description "vN: что изменилось"`.
   ⚠️ Только `update-deployment` — `clasp deploy` создаст новый URL и сломает фронт.
   В проекте болтаются старые деплойменты — не трогать и не удалять.
2. Фронт (`index.html`): git add → commit → push; GitHub Pages публикует сам ~1 мин.
3. `.clasp.json` в git не коммитить (есть в `.gitignore`).

## Правила безопасности проекта

- Разрешённые файлы: `index.html`, `Code.gs`, `appsscript.json`, `README.md`,
  `CLAUDE.md`, `ИНСТРУКЦИЯ.md`, `.gitignore`.
- **Репозиторий публичный** — секреты (ключи, код календаря `?cal=`) в него не писать
  ни в код, ни в доки. Все секреты — только в `ДОСТУПЫ.md` в корне VS_hub.
- Запись в таблицу — только лист «Заявки» через `saveToSheetGAS` (appendRow, новые
  строки). Существующие строки и лист «Объекты» из кода не менять (объекты правит
  пользователь руками).

## Нюансы

- POST к GAS — `Content-Type: text/plain` (обход CORS-preflight).
- Фронт повторяет запросы чтения (`isConfigured`, `getObjectsList`, `getCalendar`)
  до 3 раз — GAS изредка отвечает HTML вместо JSON. Запись (`saveToSheetGAS`,
  `recognizeImageGAS`) НЕ повторять — риск дублей строк и двойного расхода API.
- Режимы сайта: обычная ссылка → только форма; `?cal=КОД` → только календарь
  (без вкладок, решение пользователя 2026-08-21). Код проверяет бэкенд.
- Календарь открывается на сегодняшнем дне: прошедшие выше, будущие ниже; блок
  «Сегодня» есть всегда; прокрутка срабатывает дважды (на телефонах стили
  применяются с задержкой) + снизу добирается пустое место под высоту прокрутки.
- PDF в Claude API шлётся как `type: 'document'` + заголовок
  `anthropic-beta: pdfs-2024-09-25`, иначе 400.
- Заголовок формы: «Поставка материалов. Ситибэй.» (без «3», решение 2026-08-21).
