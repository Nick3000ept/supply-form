# Supply Form — Уведомление о поставке материалов

Веб-приложение для фиксации поставок товаров и материалов. Поставщик загружает фото или скан заявки, Claude Vision извлекает позиции автоматически, данные сохраняются в Google Таблицу.

---

## Ссылки проекта

| Что | Где |
|-----|-----|
| **Форма для поставщиков** | https://nick3000ept.github.io/supply-form/ |
| **GitHub репо (фронтенд)** | https://github.com/Nick3000ept/supply-form |
| **GAS-проект (бэкенд)** | https://script.google.com/home/projects/1fNBsW2AvpzhHkFzGyTPRv6_L5to24Q1vKh1cFE8F2DpcJlS8Mh9k7I1t |
| **GAS API endpoint** | https://script.google.com/macros/s/AKfycbxAcrSDH6xa65Wor3ZHpW3BcZ-yAwwN9PFTynCNDYUbpP7NOev6Ng0e0lH84ykz29nN/exec |
| **Google Таблица** | Найти в Google Drive: "Поставки материалов" (аккаунт workcacc2025@gmail.com) |
| **Папка с файлами на Drive** | "Заявки поставщиков" (аккаунт workcacc2025@gmail.com) |

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
├── .clasp.json       — привязка clasp к GAS-проекту
├── README.md         — эта документация
└── ИНСТРУКЦИЯ.md     — инструкция для поставщиков
```

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
clasp deploy --deploymentId AKfycbxAcrSDH6xa65Wor3ZHpW3BcZ-yAwwN9PFTynCNDYUbpP7NOev6Ng0e0lH84ykz29nN --description "что изменили"
```

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

Посмотреть/изменить: GAS-проект → Настройки проекта → Свойства скрипта.

---

## Структура Google Таблицы

**Лист "Заявки"** — каждая позиция отдельной строкой:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Дата записи | Поставщик | Объект | Номер заявки | Плановая дата поставки | Номенклатура | Ед. изм. | Количество | Ссылка на заявку |

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
