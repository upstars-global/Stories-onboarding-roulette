# Документація Verification Stories

## Загальний опис

Verification Stories - це інтерактивний компонент для демонстрації процесу верифікації користувача через історії (stories). Проект побудований на Vue 3 + Vite та використовує Swiper для навігації між сегментами.

## Архітектура проекту

### Основні компоненти

- **App.vue** - Головний компонент з Swiper слайдером
- **your_story.vue** - Основний компонент історій
- **scripts.js** - Логіка та анімації сторіз (GSAP)

### Структура папок

```
src/
├── components/
│   └── Stories/
│       ├── img/                    # Зображення та іконки
│       │   ├── icons/              # Іконки UI
│       │   └── video/              # Відео за мовами (en, de, fr, it)
│       ├── localization/           # Переклади
│       ├── storyBloks/            # Блоки контенту сторіз
│       ├── UI/                    # UI компоненти
│       ├── your_story.vue         # Головний компонент сторіз
│       ├── scripts.js             # Логіка та анімації
│       └── styles.scss            # Стилі
```

## Query параметри

Сторіз отримують параметри від батьківського сайту через URL:

```
?story=1&end_link=users%2Fverification&stories_total=4&user_language=en&user_currency=AUD
```

### Опис параметрів

| Параметр | Тип | Опис | Приклад |
|----------|-----|------|---------|
| `story` | Number | Номер початкової історії (1-4) | `story=1` |
| `end_link` | String | Посилання для переходу при закритті | `end_link=users%2Fverification` |
| `stories_total` | Number | Загальна кількість груп сторіз (не використовується) | `stories_total=4` |
| `user_language` | String | Мова користувача (en, de, fr, it) | `user_language=en` |
| `user_currency` | String | Валюта користувача | `user_currency=AUD` |

### Обробка параметрів

**App.vue (рядки 51-66):**
```javascript
const queryPart = fullURL.slice(queryStartIndex + 1);
const params = queryPart.split('&').reduce((acc, pair) => {
  const [key, value] = pair.split('=');
  acc[key] = decodeURIComponent(value);
  return acc;
}, {});

if (params.story) {
  INITIAL_SLIDE_INDEX = parseInt(params.story) - 1;
}
```

**scripts.js (рядки 754-769):**
```javascript
if (params.user_language) {
  texts.value = params.user_language;
  userLanguage.value = params.user_language;
}
if (params.user_currency) {
  currency.value = params.user_currency;
}
if (params.end_link) {
  const utmParameters = "utm_source=site&utm_medium=story&utm_campaign=verification_story";
  end_link.value = params.end_link + "?" + utmParameters;
}
```

## Події для батьківського сайту

Сторіз надсилають події батьківському сайту через `window.parent.postMessage`:

### Навігаційні події

| Подія | Коли відправляється | Код |
|-------|-------------------|-----|
| `click_forward` | При кліку вперед або автоматичному переході | `scripts.js:449, 449, App.vue:113` |
| `click_backward` | При кліку назад | `scripts.js:424, App.vue:116` |

### Контрольні події

| Подія | Коли відправляється | Код |
|-------|-------------------|-----|
| `click_pause` | При паузі сторіз (тримання > 300мс) | `scripts.js:571, 685` |
| `click_start` | При відновленні відтворення | `scripts.js:584, 692` |

### Події закриття та переходів

| Подія | Коли відправляється | Код |
|-------|-------------------|-----|
| `close` | При кліку на кнопку закриття | `scripts.js:461` |
| `reach_end` | При досягненні кінця історії | `scripts.js:435, 471, 1511` |
| `get_gift` | При кліку на кнопку отримання подарунка | `scripts.js:488` |
| `virification_btn` | При кліку на кнопку верифікації | `scripts.js:480` |

### Події переходів

| Подія | Коли відправляється | Код |
|-------|-------------------|-----|
| `go_to_link:[URL]` | Перехід за посиланням | `scripts.js:438, 464, 473, 484, 491, 1513` |

### Аналітичні події

| Подія | Коли відправляється | Код |
|-------|-------------------|-----|
| `opened_story:1` | Відкрито 1-у історію | `scripts.js:896` |
| `opened_story:2` | Відкрито 2-у історію | `scripts.js:965` |
| `opened_story:3` | Відкрито 3-ю історію | `scripts.js:1263` |
| `opened_story:4` | Відкрито 4-у історію | `scripts.js:1486` |

## Структура сторіз

### Сегменти сторіз

Проект містить 4 основні історії, кожна з яких складається з підсегментів:

1. **Story 1** - Процес депозиту та верифікації (3 підсегменти)
2. **Story 2** - Відеопрезентація (1 підсегмент)
3. **Story 3** - Детальний процес верифікації (4 підсегменти)
4. **Story 4** - Завершальна частина (4 підсегменти)

### Мультимовність

Підтримувані мови:
- **en** - Англійська (за замовчуванням)
- **de** - Німецька
- **fr** - Французька
- **it** - Італійська

Відео контент доступний для всіх мов у форматах:
- **WebM** - для андроід та сучасних браузерів
- **H.265 MP4** - для iOS та інших платформ

## Технічні деталі

### Анімації

Використовується **GSAP (GreenSock)** для:
- Плавних переходів між сегментами
- Анімації тексту (TextPlugin)
- Контролю відтворення відео
- Синхронізації з прогрес-баром

### Управління

- **Мобільні пристрої**: Тап та утримання для паузи/відтворення
- **Десктоп**: Кнопки навігації та пауза/відтворення
- **Автоматичне відтворення**: Сторіз відтворюються автоматично

### Адаптивність

- Респонсивний дизайн для мобільних та десктопних пристроїв
- Автоматичне визначення співвідношення сторін
- Оптимізація для портретної орієнтації

## Інтеграція

### Вбудовування в iframe

```html
<iframe 
  src="https://your-domain.com/stories?story=1&end_link=users%2Fverification&user_language=en&user_currency=EUR"
  width="100%" 
  height="100%">
</iframe>
```

### Обробка подій у батьківському додатку

```javascript
window.addEventListener('message', function(event) {
  if (event.data === 'click_forward') {
    // Обробка переходу вперед
  } else if (event.data === 'close') {
    // Обробка закриття
  } else if (event.data.startsWith('go_to_link:')) {
    const url = event.data.replace('go_to_link:', '');
    window.location.href = url;
  }
});
```

## Налаштування

### Зміна контенту

1. **Тексти**: Редагувати файли в `src/components/Stories/localization/`
2. **Відео**: Замінити файли в `src/components/Stories/img/video/`
3. **Зображення**: Замінити файли в `src/components/Stories/img/`

### Додавання нової мови

1. Створити файл переладу в `localization/`
2. Додати мову в `available-languages.json`
3. Додати відео файли для нової мови
4. Оновити логіку вибору мови в `scripts.js`

### Зміна анімацій

Анімації налаштовуються в `scripts.js` через GSAP timeline:
- Тривалість: `DURATION.value` (0.7s)
- Перехід: `EASE.value` ("power1.inOut")
- Затримки та ефекти в відповідних сегментах

## Збірка та розгортання

```bash
# Встановлення залежностей
npm install

# Режим розробки
npm run dev

# Збірка для продакшену
npm run build

# Попередній перегляд збірки
npm run preview
```

