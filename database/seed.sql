-- AguGo Campus Locker — Seed Data
-- Assumes schema.sql has already been applied to a clean database.
-- Run: sqlite3 app.db < database/seed.sql

PRAGMA foreign_keys = ON;

-- ── products ──────────────────────────────────────────────────────────────────
-- Names, descriptions, prices, and stock from app.js PRODUCTS array.
-- Stock values reflect a realistic mid-semester demo state.

INSERT INTO products (id, name, description, type, price, stock, visual, image, search_terms) VALUES
    ('p001', 'מחשבון מדעי',
             'Casio fx-991ES - מתאים לכל המבחנים האקדמיים',
             'rent', 5, 2, '🧮',
             'catalog/products-pics/scientific-calculator.png',
             'michshovon calculator scientific casio'),

    ('p002', 'מחשבון גרפי',
             'TI-84 Plus - מצוין לסטטיסטיקה ומתמטיקה מתקדמת',
             'rent', 5, 2, '📈',
             'catalog/products-pics/graphing-calculator.png',
             'graphing calculator ti-84 statistics'),

    ('p003', 'מילונית עברית-אנגלית',
             'Babylon Pocket - מילונית אלקטרונית מאושרת לבחינות',
             'rent', 5, 4, '📘',
             'catalog/products-pics/electronic-dictionary.png',
             'dictionary hebrew english babylon'),

    ('p004', 'סט עטים בסיסי',
             '3 עטים כחולים + עט אדום + עיפרון',
             'buy', 15, 12, '✏️',
             'catalog/logo-pics/pen.png',
             'pens stationery buy basic'),

    ('p005', 'מחברת A4',
             'מחברת ספירלה 80 דפים, חלוקה לנושאים',
             'buy', 12, 18, '📓',
             'catalog/logo-pics/notebook.png',
             'notebook a4 spiral notes'),

    ('p006', 'סט מרקרים',
             '5 מרקרי הדגשה בצבעים שונים',
             'buy', 22, 8, '🖍️',
             'catalog/logo-pics/marker.png',
             'markers highlighters colors'),

    ('p007', 'סרגל גיאומטרי',
             'סרגל 30 ס"מ + מד זווית',
             'buy', 18, 10, '📐',
             '',
             'geometry ruler protractor'),

    ('p008', 'ספר תרגילים בקלקולוס',
             'ספר תרגילים מסכם עם פתרונות - מתאים לסמסטר א''',
             'rent', 5, 5, '📚',
             '',
             'calculus exercise book math'),

    ('p009', 'מטען נייד',
             'פאוורבנק 10000mAh - מתאים לימי לימודים ארוכים',
             'rent', 5, 6, '🔋',
             '',
             'power bank charger mobile battery');

-- ── orders ────────────────────────────────────────────────────────────────────
-- Five representative orders across different days and hours.
-- Totals are pre-verified: sum(unit_price * quantity * rent_days) per order.

INSERT INTO orders (id, customer_name, payment_provider, total, status, created_at, updated_at) VALUES
    -- p001×1×3days(15) + p005×2×1day(24) = 39
    ('ord_0001', 'דוגמה לקוח',  'Apple Pay',  39, 'completed',
                 '2026-05-08T10:00:00.000Z', '2026-05-08T10:00:00.000Z'),

    -- p003×1×3days(15) = 15
    ('ord_0002', 'רונית כהן',   'Google Pay', 15, 'completed',
                 '2026-05-09T09:15:00.000Z', '2026-05-09T09:15:00.000Z'),

    -- p009×1×2days(10) + p004×1×1day(15) = 25
    ('ord_0003', 'יוסי לוי',    'Apple Pay',  25, 'completed',
                 '2026-05-10T14:30:00.000Z', '2026-05-10T14:30:00.000Z'),

    -- p002×2×2days(20) + p006×1×1day(22) = 42
    ('ord_0004', 'מיכל ברק',    'Google Pay', 42, 'completed',
                 '2026-05-11T11:00:00.000Z', '2026-05-11T11:00:00.000Z'),

    -- p008×1×2days(10) + p004×1×1day(15) = 25
    ('ord_0005', 'אבי שפירא',   'Apple Pay',  25, 'completed',
                 '2026-05-12T16:45:00.000Z', '2026-05-12T16:45:00.000Z');

-- ── order_items ───────────────────────────────────────────────────────────────

INSERT INTO order_items (order_id, product_id, quantity, rent_days, unit_price) VALUES
    ('ord_0001', 'p001', 1, 3,  5),
    ('ord_0001', 'p005', 2, 1, 12),

    ('ord_0002', 'p003', 1, 3,  5),

    ('ord_0003', 'p009', 1, 2,  5),
    ('ord_0003', 'p004', 1, 1, 15),

    ('ord_0004', 'p002', 2, 2,  5),
    ('ord_0004', 'p006', 1, 1, 22),

    ('ord_0005', 'p008', 1, 2,  5),
    ('ord_0005', 'p004', 1, 1, 15);

-- ── returns ───────────────────────────────────────────────────────────────────
-- Two sample returns: the power bank and the electronic dictionary.

INSERT INTO returns (id, first_name, last_name, product_id, product_name, returned_at) VALUES
    ('ret_1747044000000', 'יוסי',  'לוי',  'p009', 'מטען נייד',          '2026-05-12T10:00:00.000Z'),
    ('ret_1747044060000', 'רונית', 'כהן',  'p003', 'מילונית עברית-אנגלית', '2026-05-11T13:00:00.000Z');
