# Supply Form — Уведомление о поставке материалов

Веб-приложение для фиксации поставок товаров и материалов. Поставщик загружает фото или скан заявки, Claude Vision извлекает позиции автоматически, данные сохраняются в Google Таблицу.

Есть скрытый режим **«Календарь поставок»** — поставки по дням (кто везёт, кому, на какой объект, материалы с количеством и ссылкой на заявку). Открывается только по секретной ссылке вида `...?cal=КОД`; код проверяется бэкендом (Script Property `CAL_TOKEN`), сама ссылка — в `ДОСТУПЫ.md` в корне VS_hub. По этой ссылке сайт показывает ТОЛЬКО календарь (без формы подачи); обычная ссылка показывает только форму. Календарь отдаёт все поставки из таблицы и открывается на сегодняшнем дне (прошедшие выше, будущие ниже). Запросы на чтение (isConfigured, getObjectsList, getCalendar) фронт повторяет до 3 раз — GAS изредка отвечает HTML вместо JSON; запись не повторяется.

---

## Ссылки проекта

| Что | Где |
|-----|-----|
| **Форма для поставщиков** | https://nick3000ept.github.io/supply-form/ |
| **Календарь поставок** | https://nick3000ept.github.io/supply-form/?cal=27abe3a9cfb14596 (решение пользователя 2026-08-21: ссылка не считается секретом) |
| **Google Таблица с данными** | https://docs.google.com/spreadsheets/d/1LjL-azYiG3WqSH4BB5XgLmlrP2bT4WWbeNXYQmoAJJM (доступ по правам Google, владелец workcacc2025@gmail.com) |
| **GitHub репо (фронтенд)** | https://github.com/Nick3000ept/supply-form |
| **GAS-проект (бэкенд)** | https://script.google.com/home/projects/1fNBsW2AvpzhHkFzGyTPRv6_L5to24Q1vKh1cFE8F2DpcJlS8Mh9k7I1t |
| **GAS API endpoint** | https://script.google.com/macros/s/AKfycbxAcrSDH6xa65Wor3ZHpW3BcZ-yAwwN9PFTynCNDYUbpP7NOev6Ng0e0lH84ykz29nN/exec |
| **Папка с файлами заявок на Drive** | "Заявки поставщиков" (аккаунт workcacc2025@gmail.com) |

---

## Архитектура

```
Поставщик (браузер)
    │
    ▼
GitHub Pages — index.html
    │  fetch() POST запросы
    ▼
Google Apps Script — Code.gs (API)
    ├── Google Sheets  — сохранение заявок
    ├── Google Drive   — хранение файлов заявок
    └── Anthropic API  — распознавание через Claude Vision
```

**Почему два компонента:**
GAS web apps требуют Google-аккаунт для открытия в браузере даже при настройке ANYONE_ANONYMOUS. Поэтому фронтенд вынесен на GitHub Pages (открывается без авторизации), а GAS работает только как API-бэкенд через `fetch()`.

---

## Структура файлов

```
supply-form/
├── index.html        — весь фронтенд (GitHub Pages)
├── Code.gs           — бэкенд API (Google Apps Script)
├── appsscript.json   — манифест GAS (права, настройки)
├── .clasp.json       — привязка clasp к GAS-проекту (в git не коммитится)
├── .gitignore        — исключает .clasp.json из git
├── CLAUDE.md         — операционная шпаргалка для Claude Code
├── README.md         — эта документация
└── ИНСТРУКЦИЯ.md     — инструкция для поставщиков
```

---

## API бэкенда (действия doPost)

| Action | Что делает |
|--------|-----------|
| `isConfigured` | Проверка настройки (ключ, таблица) + ссылка на таблицу; вызывает автосоздание таблицы |
| `saveApiKey` | Одноразовая установка ключа Anthropic (повторно — ошибка) |
| `getObjectsList` | Список объектов из листа «Объекты» |
| `recognizeImageGAS` | Файл → Google Drive + Claude Vision → массив позиций |
| `saveToSheetGAS` | Запись строк поставки в лист «Заявки» |
| `setCalToken` | Одноразовая установка кода доступа к календарю (повторно — ошибка) |
| `getCalendar` | Поставки, сгруппированные по дням; требует код доступа (`CAL_TOKEN`) |

---

## Настройка с нового компьютера

### 1. Установить инструменты

```bash
npm install -g @google/clasp
```

Git и Node.js должны быть установлены.

### 2. Авторизовать clasp

```bash
clasp login
```

Войти через аккаунт **workcacc2025@gmail.com** (владелец GAS-проекта).

### 3. Клонировать репо

```bash
git clone https://github.com/Nick3000ept/supply-form.git
cd supply-form
```

Файл `.clasp.json` уже содержит scriptId — дополнительная настройка не нужна.

### 4. Настроить git push (GitHub)

```bash
git remote set-url origin https://Nick3000ept:<TOKEN>@github.com/Nick3000ept/supply-form.git
```

Токен создаётся на: github.com/settings/tokens → scope: `repo`

---

## Рабочий процесс (деплой изменений)

### Изменения в бэкенде (Code.gs)

```bash
cd supply-form
clasp push --force
clasp update-deployment AKfycbxAcrSDH6xa65Wor3ZHpW3BcZ-yAwwN9PFTynCNDYUbpP7NOev6Ng0e0lH84ykz29nN --description "vN: что изменилось"
```

⚠️ Только `update-deployment` с этим ID — `clasp deploy` без ID создаст НОВЫЙ деплоймент с новым URL, и фронт перестанет работать. В проекте есть старые неиспользуемые деплойменты — не трогать.

### Изменения во фронтенде (index.html)

```bash
git add index.html
git commit -m "что изменили"
git push
```

GitHub Pages обновится автоматически через 1-2 минуты.

---

## GAS Script Properties (хранятся в облаке, не в коде)

| Ключ | Что хранит |
|------|-----------|
| `CLAUDE_API_KEY` | Anthropic API Key (вводится через форму при первом запуске) |
| `SPREADSHEET_ID` | ID Google Таблицы (создаётся автоматически при первом запросе) |
| `DRIVE_FOLDER_ID` | ID папки "Заявки поставщиков" на Google Drive |
| `CAL_TOKEN` | Код доступа к вкладке «Календарь поставок» (устанавливается один раз через action `setCalToken`) |

Посмотреть/изменить: GAS-проект → Настройки проекта → Свойства скрипта.

---

## Структура Google Таблицы

**Лист "Заявки"** — каждая позиция отдельной строкой:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Дата записи | Поставщик | Подрядчик | Объект | Плановая дата поставки | Номенклатура | Ед. изм. | Количество | Ссылка на заявку |

**Лист "Объекты"** — справочник объектов (редактируется вручную, отображается в форме).

---

## Как добавить/изменить объекты в форме

1. Открыть Google Таблицу "Поставки материалов"
2. Перейти на лист **"Объекты"**
3. Отредактировать список в колонке A
4. Изменения появятся в форме сразу (список грузится при каждом открытии)

---

## Принятые архитектурные решения

1. **GitHub Pages для фронтенда** — GAS требует Google-аккаунт в браузере, GitHub Pages открывается без авторизации
2. **fetch() вместо google.script.run** — google.script.run работает только внутри GAS iframe, несовместим с GitHub Pages
3. **GAS URL хардкодится в index.html** — константа `GAS_URL` в начале `<script>` блока, при смене деплоя обновлять там
4. **Промпт универсальный** — принимает любые товары, не только стройматериалы
5. **Файлы в Drive с доступом ANYONE** — ссылки открываются без Google-аккаунта через `uc?export=view&id=`
6. **API-ключ Claude хранится в Script Properties** — не в коде, вводится через форму один раз
7. **Таблица создаётся автоматически** — при первом POST-запросе `isConfigured` вызывается `tryAutoSetup_()`
8. **Изображения сжимаются** — до 2400px, JPEG 88% перед отправкой в Claude API

---

## Если что-то сломалось

**Форма не открывается** → проверить GitHub Pages: github.com/Nick3000ept/supply-form → Settings → Pages

**Ошибка "Ошибка соединения"** → проверить GAS деплой: убедиться что deploymentId в `GAS_URL` актуален

**Не распознаёт файлы** → проверить CLAUDE_API_KEY в Script Properties GAS-проекта

**Файлы не сохраняются на Drive** → запустить функцию `initDriveFolder` в GAS-редакторе для повторной авторизации Drive

**Календарь пишет «Нет доступа»** → в ссылке нет или неверный `?cal=КОД`; правильная ссылка — в `ДОСТУПЫ.md` в корне VS_hub, эталон кода — Script Property `CAL_TOKEN`

**Разовая ошибка «Сервер временно недоступен»** → GAS вернул HTML вместо JSON; фронт сам повторяет запросы чтения до 3 раз, при повторении — проверить деплоймент
