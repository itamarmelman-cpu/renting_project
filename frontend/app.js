const STORAGE_KEYS = {
    cart: 'aguda2go.cart',
    inventory: 'aguda2go.inventory',
    rentDays: 'aguda2go.rentDays',
};

// For local development you can use the mock ESP32 server at http://localhost:5001
const ESP32_BASE_URL = 'http://localhost:5001';

const PRODUCTS = [
    {
        id: 'p001',
        name: 'מחשבון מדעי',
        description: 'Casio fx-991ES - מתאים לכל המבחנים האקדמיים',
        type: 'rent',
        price: 5,
        stock: 3,
        visual: '🧮',
        image: 'catalog/products-pics/scientific-calculator.png',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'michshovon calculator scientific casio',
    },
    {
        id: 'p002',
        name: 'מחשבון גרפי',
        description: 'TI-84 Plus - מצוין לסטטיסטיקה ומתמטיקה מתקדמת',
        type: 'rent',
        price: 5,
        stock: 2,
        visual: '📈',
        image: 'catalog/products-pics/graphing-calculator.png',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'graphing calculator ti-84 statistics',
    },
    {
        id: 'p003',
        name: 'מילונית עברית-אנגלית',
        description: 'Babylon Pocket - מילונית אלקטרונית מאושרת לבחינות',
        type: 'rent',
        price: 5,
        stock: 4,
        visual: '📘',
        image: 'catalog/products-pics/electronic-dictionary.png',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'dictionary hebrew english babylon',
    },
    {
        id: 'p004',
        name: 'סט עטים בסיסי',
        description: '3 עטים כחולים + עט אדום + עיפרון',
        type: 'buy',
        price: 15,
        stock: 12,
        visual: '✏️',
        categoryLabel: 'רכישה',
        rentLabel: '',
        searchTerms: 'pens stationery buy basic',
    },
    {
        id: 'p005',
        name: 'מחברת A4',
        description: 'מחברת ספירלה 80 דפים, חלוקה לנושאים',
        type: 'buy',
        price: 12,
        stock: 18,
        visual: '📓',
        categoryLabel: 'רכישה',
        rentLabel: '',
        searchTerms: 'notebook a4 spiral notes',
    },
    {
        id: 'p006',
        name: 'סט מרקרים',
        description: '5 מרקרי הדגשה בצבעים שונים',
        type: 'buy',
        price: 22,
        stock: 8,
        visual: '🖍️',
        categoryLabel: 'רכישה',
        rentLabel: '',
        searchTerms: 'markers highlighters colors',
    },
    {
        id: 'p007',
        name: 'סרגל גיאומטרי',
        description: 'סרגל 30 ס"מ + מד זווית',
        type: 'buy',
        price: 18,
        stock: 10,
        visual: '📐',
        categoryLabel: 'רכישה',
        rentLabel: '',
        searchTerms: 'geometry ruler protractor',
    },
    {
        id: 'p008',
        name: 'ספר תרגילים בקלקולוס',
        description: 'ספר תרגילים מסכם עם פתרונות - מתאים לסמסטר א\'',
        type: 'rent',
        price: 5,
        stock: 5,
        visual: '📚',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'calculus exercise book math',
    },
    {
        id: 'p009',
        name: 'מטען נייד',
        description: 'פאוורבנק 10000mAh - מתאים לימי לימודים ארוכים',
        type: 'rent',
        price: 5,
        stock: 6,
        visual: '🔋',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'power bank charger mobile battery',
    },
];

const ROUTES = new Set(['catalog', 'cart', 'checkout', 'locker', 'return', 'inventory']);

const appState = {
    cart: loadCartState(),
    inventory: loadInventoryState(),
    rentDaysByProductId: loadStoredJson(STORAGE_KEYS.rentDays, {}),
    catalogSearchQuery: '',
    lockerOpen: false,
};

let appShellInitialized = false;
let activeNoticeTimeoutId = null;
let inventoryDashboardRequestId = 0;
let inventoryDashboardSummary = null;
let inventoryDashboardSection = 'summary';

initializeApp();

function initializeApp() {
    mountAppShell();
    attachGlobalEventHandlers();
    syncHeaderState();
    window.addEventListener('hashchange', () => renderCurrentRoute(getRouteFromHash()));

    // On first load, default to catalog
    const route = !location.hash ? 'catalog' : getRouteFromHash();
    renderCurrentRoute(route);
    updateFooterQa(route);
}

function mountAppShell() {
    if (appShellInitialized) {
        return;
    }

    document.body.classList.add('aguda2go-body');
    document.body.innerHTML = `
        <div class="app-shell">
            <header class="app-header">
                <button class="brand-button" type="button" data-route-link="catalog" aria-label="עבור לקטלוג">
                    <span class="brand-mark brand-mark-image">
                        <img src="catalog/logo-pics/aguda-logo.svg" alt="AguGo logo" class="brand-logo-image" />
                    </span>
                    <span class="brand-copy">
                        <strong>AguGo</strong>
                        <span>השכרת לוקר חכמה</span>
                    </span>
                </button>

                <nav class="header-actions" aria-label="ניווט ראשוני">
                    <button class="nav-button" type="button" data-route-link="catalog">קטלוג</button>
                    <button class="nav-button" type="button" data-route-link="return">החזרת מוצר</button>
                    <button class="nav-button" type="button" data-route-link="cart">
                        <span>עגלה</span>
                        <span class="cart-badge" id="cart-badge" hidden>0</span>
                    </button>
                    <button class="nav-button nav-button-accent" type="button" data-route-link="inventory">כניסה אגודה</button>
                </nav>
            </header>

            <div class="app-notice" id="app-notice" hidden></div>

            <main class="app-main" id="main-content"></main>

            <footer class="app-footer">
                <div class="footer-grid">
                    <section>
                        <h2>AguGo</h2>
                        <p>מערכת חכמה להשכרה, החזרה ושליטה על לוקרים לציוד סטודנטיאלי.</p>
                    </section>
                    <section>
                        <h3>ניווט מהיר</h3>
                        <div class="footer-links">
                            <button type="button" class="footer-link" data-route-link="catalog">קטלוג</button>
                            <button type="button" class="footer-link" data-route-link="cart">עגלה</button>
                            <button type="button" class="footer-link" data-route-link="return">החזרת מוצר</button>
                            <button type="button" class="footer-link" data-route-link="inventory">ניהול מלאי</button>
                        </div>
                    </section>
                    <section>
                        <h3>הערת פרויקט</h3>
                        <p>ממשק משתמש מינימלי, מצב מלאי קבוע, וניסיונות חומרה מדומים ללוקר ESP32.</p>
                    </section>
                </div>

                <section class="footer-qa card" aria-label="שאלות ותשובות">
                    <div class="footer-qa-header">
                        <div>
                            <span class="eyebrow">Q&A</span>
                            <h3>שאלות ותשובות מהירות</h3>
                        </div>
                        <p>תמיד זמין בתחתית כל דף.</p>
                    </div>

                    <div class="footer-qa-list" id="footer-qa-list"></div>
                </section>
            </footer>
        </div>
    `;

    appShellInitialized = true;
}

function attachGlobalEventHandlers() {
    const appMain = document.getElementById('main-content');

    document.addEventListener('click', (event) => {
        const routeButton = event.target.closest('[data-route-link]');
        if (routeButton) {
            event.preventDefault();
            navigateToRoute(routeButton.dataset.routeLink);
            return;
        }

        const addToCartButton = event.target.closest('[data-action="add-to-cart"]');
        if (addToCartButton) {
            addProductToCart(addToCartButton.dataset.productId);
            return;
        }

        const rentDayButton = event.target.closest('[data-action="select-rent-days"]');
        if (rentDayButton) {
            setRentDaysPreference(rentDayButton.dataset.productId, Number(rentDayButton.dataset.days));
            renderCurrentRoute('catalog');
            return;
        }

        const cartQuantityButton = event.target.closest('[data-action="change-cart-quantity"]');
        if (cartQuantityButton) {
            updateCartItemQuantity(cartQuantityButton.dataset.productId, Number(cartQuantityButton.dataset.delta));
            return;
        }

        const removeCartButton = event.target.closest('[data-action="remove-cart-item"]');
        if (removeCartButton) {
            removeCartItem(removeCartButton.dataset.productId);
            return;
        }

        const paymentButton = event.target.closest('[data-action="process-payment"]');
        if (paymentButton) {
            processMockPayment(paymentButton.dataset.provider);
            return;
        }

        const lockerButton = event.target.closest('[data-action="locker-control"]');
        if (lockerButton) {
            if (getRouteFromHash() === 'return') {
                operateLockerFromReturnPage(lockerButton.dataset.command);
            } else {
                operateLockerFromCurrentPage(lockerButton.dataset.command);
            }
            return;
        }

        const searchButton = event.target.closest('[data-action="catalog-search"]');
        if (searchButton) {
            const searchInput = document.querySelector('[data-catalog-search-input]');
            appState.catalogSearchQuery = searchInput ? searchInput.value.trim() : '';
            renderCurrentRoute('catalog');
        }

        // Inventory management handlers
        const addProductBtn = event.target.closest('#add-product-btn');
        if (addProductBtn) {
            openAddModal();
            return;
        }

        const editStockBtn = event.target.closest('.edit-stock-btn');
        if (editStockBtn) {
            const productId = editStockBtn.dataset.productId;
            const productName = editStockBtn.dataset.productName;
            openEditModal(productId, productName);
            return;
        }

        const removeProductBtn = event.target.closest('.remove-product-btn');
        if (removeProductBtn) {
            const productId = removeProductBtn.dataset.productId;
            const productName = removeProductBtn.dataset.productName;
            if (confirm(`Remove "${productName}" from inventory?`)) {
                removeProduct(productId);
            }
            return;
        }
    });

    appMain.addEventListener('change', (event) => {
        if (event.target.matches('#inventory-section-select')) {
            inventoryDashboardSection = event.target.value || 'summary';
            renderInventoryDashboardView();
            return;
        }
    });

    appMain.addEventListener('submit', (event) => {
        const catalogSearchForm = event.target.closest('[data-catalog-search-form]');
        if (catalogSearchForm) {
            event.preventDefault();
            const searchInput = catalogSearchForm.querySelector('[data-catalog-search-input]');
            appState.catalogSearchQuery = searchInput ? searchInput.value.trim() : '';
            renderCurrentRoute('catalog');
            return;
        }

        const returnForm = event.target.closest('[data-return-form]');
        if (returnForm) {
            event.preventDefault();
            return;
        }

        const checkoutForm = event.target.closest('[data-checkout-form]');
        if (checkoutForm) {
            event.preventDefault();
        }

        const editStockForm = event.target.closest('#edit-stock-form');
        if (editStockForm) {
            event.preventDefault();
            handleEditStockSubmit();
            return;
        }

        const addProductForm = event.target.closest('#add-product-form');
        if (addProductForm) {
            event.preventDefault();
            handleAddProductSubmit();
            return;
        }
    });

    appMain.addEventListener('change', (event) => {
        if (event.target.matches('[data-return-product-select]')) {
            updateReturnPreview();
        }

        if (event.target.matches('[data-return-file-input]')) {
            const label = document.querySelector('[data-return-file-label]');
            if (label) {
                label.textContent = event.target.files && event.target.files.length ? event.target.files[0].name : 'No file selected';
            }
        }
    });
}

function getDefaultRoute() {
    const defaultRoute = document.body.dataset.defaultRoute || 'catalog';
    return ROUTES.has(defaultRoute) ? defaultRoute : 'catalog';
}

function getRouteFromHash() {
    const route = location.hash.replace('#', '').split('?')[0];
    return ROUTES.has(route) ? route : getDefaultRoute();
}

function navigateToRoute(route) {
    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    if (location.hash === `#${safeRoute}`) {
        renderCurrentRoute(safeRoute);
        return;
    }

    location.hash = safeRoute;
}

function renderCurrentRoute(route) {
    const main = document.getElementById('main-content');
    if (!main) {
        return;
    }

    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    updateActiveNavigation(safeRoute);

    if (safeRoute === 'catalog') {
        main.innerHTML = renderCatalogPage();
    } else if (safeRoute === 'cart') {
        main.innerHTML = renderCartPage();
    } else if (safeRoute === 'checkout') {
        main.innerHTML = renderCheckoutPage();
    } else if (safeRoute === 'locker') {
        main.innerHTML = renderLockerControlPage();
    } else if (safeRoute === 'return') {
        main.innerHTML = renderReturnProductPage();
    } else if (safeRoute === 'inventory') {
        main.innerHTML = renderInventoryManagementPage();
        void loadInventoryDashboardData();
    }

    syncHeaderState();
    updateFooterQa(safeRoute);
}

function updateFooterQa(route) {
    const footerQaList = document.getElementById('footer-qa-list');
    if (!footerQaList) {
        return;
    }

    if (route === 'inventory') {
        footerQaList.innerHTML = `
            <details class="footer-qa-item">
                <summary>איך רואים מה במלאי?</summary>
                <p>בכניסת אגודה בוחרים "ניהול מלאי" ומקבלים טבלה מלאה של כל המוצרים, הכמות והסטטוס שלהם.</p>
            </details>
            <details class="footer-qa-item">
                <summary>איך בודקים השכרות פעילות?</summary>
                <p>בכניסת אגודה בוחרים "השכרה כרגע" ורואים אילו פריטים מושכרים, לכמה זמן ולכמה ימים נשארו.</p>
            </details>
            <details class="footer-qa-item">
                <summary>איך מעדכנים מלאי?</summary>
                <p>בכניסת אגודה בוחרים "ניהול מלאי" ואז אפשר לערוך מלאי, להוסיף מוצר חדש או להסיר מוצר קיים.</p>
            </details>
        `;
        return;
    }

    footerQaList.innerHTML = `
        <details class="footer-qa-item">
            <summary>איך שוכרים מוצר?</summary>
            <p>נכנסים לקטלוג, בוחרים פריט, מוסיפים לסל וממשיכים לתשלום.</p>
        </details>
        <details class="footer-qa-item">
            <summary>איך מחזירים מוצר?</summary>
            <p>נכנסים לעמוד "החזרת מוצר", בוחרים את הפריט, מעלים תמונה ומסיימים את ההחזרה בלוקר.</p>
        </details>
        <details class="footer-qa-item">
            <summary>איך משלמים?</summary>
            <p>מגיעים לעמוד התשלום, ממלאים שם פרטי ומשפחה ובוחרים אמצעי תשלום מדומה.</p>
        </details>
    `;
}

function updateActiveNavigation(route) {
    document.querySelectorAll('[data-route-link]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.routeLink === route);
    });
}

function syncHeaderState() {
    const cartBadge = document.getElementById('cart-badge');
    const cartCount = getCartItemCount();

    if (cartBadge) {
        cartBadge.textContent = String(cartCount);
        cartBadge.hidden = cartCount === 0;
    }
}

function showNotice(message, tone = 'info') {
    const notice = document.getElementById('app-notice');
    if (!notice) {
        return;
    }

    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;

    window.clearTimeout(activeNoticeTimeoutId);
    activeNoticeTimeoutId = window.setTimeout(() => {
        notice.hidden = true;
    }, 3200);
}

function loadStoredJson(storageKey, fallbackValue) {
    try {
        const rawValue = localStorage.getItem(storageKey);
        return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch {
        return fallbackValue;
    }
}

function saveStoredJson(storageKey, value) {
    localStorage.setItem(storageKey, JSON.stringify(value));
}

function loadCartState() {
    const cartItems = loadStoredJson(STORAGE_KEYS.cart, []);
    return Array.isArray(cartItems) ? cartItems : [];
}

function loadInventoryState() {
    const storedInventory = loadStoredJson(STORAGE_KEYS.inventory, null);
    if (storedInventory && typeof storedInventory === 'object') {
        return ensureInventoryShape(storedInventory);
    }

    const defaultInventory = Object.fromEntries(PRODUCTS.map((product) => [product.id, product.stock]));
    saveStoredJson(STORAGE_KEYS.inventory, defaultInventory);
    return defaultInventory;
}

// Attempt to sync inventory from server API (non-blocking)
async function syncFromServerInventory() {
    try {
        const resp = await fetch('/api/inventory');
        if (!resp.ok) return;
        const serverInventory = await resp.json();
        appState.inventory = ensureInventoryShape(serverInventory);
        saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);
        syncHeaderState();
    } catch (e) {
        // server not available; continue using local storage
    }
}

function ensureInventoryShape(inventory) {
    const normalizedInventory = {};

    PRODUCTS.forEach((product) => {
        const currentValue = Number(inventory[product.id]);
        normalizedInventory[product.id] = Number.isFinite(currentValue) ? currentValue : product.stock;
    });

    saveStoredJson(STORAGE_KEYS.inventory, normalizedInventory);
    return normalizedInventory;
}

function getProductById(productId) {
    return PRODUCTS.find((product) => product.id === productId) || null;
}

function getCartItemByProductId(productId) {
    return appState.cart.find((item) => item.productId === productId) || null;
}

function getCartItemCount() {
    return appState.cart.reduce((total, item) => total + item.quantity, 0);
}

function getInventoryStock(productId) {
    return Number(appState.inventory[productId] || 0);
}

function getAvailableStock(productId) {
    const cartQuantity = getCartQuantity(productId);
    return Math.max(0, getInventoryStock(productId) - cartQuantity);
}

function getCartQuantity(productId) {
    const cartItem = getCartItemByProductId(productId);
    return cartItem ? cartItem.quantity : 0;
}

function saveCartState() {
    saveStoredJson(STORAGE_KEYS.cart, appState.cart);
    syncHeaderState();
}

function saveInventoryState() {
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);
    syncHeaderState();
    // try to persist to dev API if available
    try {
        fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appState.inventory),
        }).catch(() => {});
    } catch {}
}

function setRentDaysPreference(productId, days) {
    appState.rentDaysByProductId[productId] = days;
    saveStoredJson(STORAGE_KEYS.rentDays, appState.rentDaysByProductId);
}

function getRentDaysPreference(productId) {
    const selectedDays = Number(appState.rentDaysByProductId[productId]);
    return [1, 2, 3].includes(selectedDays) ? selectedDays : 1;
}

function addProductToCart(productId) {
    const product = getProductById(productId);
    if (!product) {
        showNotice('מוצר לא נמצא.', 'error');
        return;
    }

    const availableStock = getAvailableStock(productId);
    if (availableStock <= 0) {
        showNotice('מוצר זה אינו זמין כרגע.', 'error');
        return;
    }

    const cartItem = getCartItemByProductId(productId);
    if (cartItem) {
        cartItem.quantity += 1;
        if (product.type === 'rent') {
            cartItem.rentDays = getRentDaysPreference(productId);
        }
    } else {
        appState.cart.push({
            productId: product.id,
            quantity: 1,
            rentDays: product.type === 'rent' ? getRentDaysPreference(productId) : 1,
        });
    }

    saveCartState();
    showNotice(`${product.name} נוסף לעגלה.`, 'success');
    renderCurrentRoute(getRouteFromHash() === 'cart' ? 'cart' : 'catalog');
}

function updateCartItemQuantity(productId, delta) {
    const cartItem = getCartItemByProductId(productId);
    if (!cartItem) {
        return;
    }

    const updatedQuantity = cartItem.quantity + delta;
    if (updatedQuantity <= 0) {
        removeCartItem(productId);
        return;
    }

    const availableStock = getInventoryStock(productId);
    if (updatedQuantity > availableStock) {
        showNotice('אין מספיק מלאי לכמות זו.', 'error');
        return;
    }

    cartItem.quantity = updatedQuantity;
    saveCartState();
    renderCurrentRoute('cart');
}

function removeCartItem(productId) {
    appState.cart = appState.cart.filter((item) => item.productId !== productId);
    saveCartState();
    renderCurrentRoute('cart');
}

function clearCart() {
    appState.cart = [];
    saveCartState();
}

function calculateCartItemTotal(cartItem) {
    const product = getProductById(cartItem.productId);
    if (!product) {
        return 0;
    }

    const rentDays = product.type === 'rent' ? cartItem.rentDays : 1;
    return product.price * cartItem.quantity * rentDays;
}

function calculateCartTotal() {
    return appState.cart.reduce((total, cartItem) => total + calculateCartItemTotal(cartItem), 0);
}

function renderCatalogPage() {
    const filteredProducts = PRODUCTS.filter((product) => {
        const searchableText = `${product.name} ${product.description} ${product.searchTerms}`.toLowerCase();
        return searchableText.includes(appState.catalogSearchQuery.toLowerCase());
    });

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">קטלוג</span>
                <h1>קטלוג הציוד האקדמי</h1>
                <p>בחרו מוצר, הגדירו ימים למוצרים להשכרה, והוסיפו לסל בקצב עבודה פשוט ונקי.</p>
            </div>
            <form class="catalog-search" data-catalog-search-form>
                <input
                    type="text"
                    class="text-input"
                    placeholder="חיפוש מוצרים"
                    value="${escapeHtml(appState.catalogSearchQuery)}"
                    data-catalog-search-input
                />
                <button type="submit" class="primary-button" data-action="catalog-search">חפש</button>
            </form>
        </section>

        <section class="catalog-grid">
            ${filteredProducts.map(renderProductCard).join('') || renderEmptyCatalogState()}
        </section>
    `;
}

function renderProductCard(product) {
    const selectedDays = getRentDaysPreference(product.id);
    const stockLabel = getInventoryStock(product.id) <= 2 ? `Low stock: ${getInventoryStock(product.id)}` : `${getInventoryStock(product.id)} in stock`;

    return `
        <article class="product-card card">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image"/>` : `<div class="product-visual">${escapeHtml(product.visual)}</div>`}
            <div class="product-content">
                <div class="product-header">
                    <h2>${escapeHtml(product.name)}</h2>
                    <span class="product-type type-${product.type}">${escapeHtml(product.categoryLabel)}</span>
                </div>
                <p>${escapeHtml(product.description)}</p>
                <div class="product-meta">
                    <span class="stock-pill">${escapeHtml(stockLabel.replace('Low stock:', 'מלאי נמוך:').replace('in stock', 'במלאי'))}</span>
                    <span class="price-pill">${product.price} ₪${product.type === 'rent' ? ` / ${escapeHtml(product.rentLabel)}` : ''}</span>
                </div>
                ${product.type === 'rent' ? renderRentDaySelector(product.id, selectedDays) : ''}
                <button type="button" class="primary-button block-button" data-action="add-to-cart" data-product-id="${product.id}">
                    הוסף לסל
                </button>
            </div>
        </article>
    `;
}

function renderRentDaySelector(productId, selectedDays) {
    return `
        <div class="rent-selector">
            <span>מספר ימים:</span>
            <div class="rent-selector-buttons">
                ${[1, 2, 3].map((days) => `
                    <button
                        type="button"
                        class="rent-day-button ${days === selectedDays ? 'is-selected' : ''}"
                        data-action="select-rent-days"
                        data-product-id="${productId}"
                        data-days="${days}"
                    >
                        ${days}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderEmptyCatalogState() {
    return `
        <div class="card empty-state">
            <h2>לא נמצאו מוצרים</h2>
            <p>נסה מונח חיפוש אחר.</p>
        </div>
    `;
}

function renderCartPage() {
    if (appState.cart.length === 0) {
        return `
            <section class="card empty-state empty-state-large">
                <span class="eyebrow">עגלה</span>
                <h1>העגלה שלך ריקה</h1>
                <p>הוסף מוצרים מהקטלוג כדי להמשיך לתשלום.</p>
                <div class="empty-state-actions">
                    <button type="button" class="primary-button" data-route-link="catalog">חזור לקטלוג</button>
                </div>
            </section>
        `;
    }

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">עגלה</span>
                <h1>עגלת הקניות שלך</h1>
                <p>בדקו את הפריטים לפני המעבר לתשלום הדמה ולשלב פתיחת הלוקר.</p>
            </div>
            <button type="button" class="primary-button" data-route-link="checkout">עבור לתשלום</button>
        </section>

        <section class="cart-layout">
            <div class="cart-items">
                ${appState.cart.map(renderCartItem).join('')}
            </div>
            <aside class="cart-summary card">
                <h2>סיכום הזמנה</h2>
                <div class="summary-row">
                    <span>פריטים</span>
                    <strong>${getCartItemCount()}</strong>
                </div>
                <div class="summary-row">
                    <span>סך הכל</span>
                    <strong>${calculateCartTotal()} ₪</strong>
                </div>
                <button type="button" class="primary-button block-button" data-route-link="checkout">עבור לתשלום</button>
            </aside>
        </section>
    `;
}

function renderCartItem(cartItem) {
    const product = getProductById(cartItem.productId);
    if (!product) {
        return '';
    }

    const itemTotal = calculateCartItemTotal(cartItem);

    return `
        <article class="card cart-item-card">
            <div class="cart-item-visual">${escapeHtml(product.visual)}</div>
            <div class="cart-item-content">
                <div class="cart-item-header">
                    <div>
                        <h2>${escapeHtml(product.name)}</h2>
                        <p>${escapeHtml(product.description)}</p>
                    </div>
                    <button type="button" class="icon-button" data-action="remove-cart-item" data-product-id="${product.id}">×</button>
                </div>
                <div class="cart-item-meta">
                    <span>${product.type === 'rent' ? `${cartItem.rentDays} ימים` : 'פריט רכישה'}</span>
                    <span>${product.price} ₪${product.type === 'rent' ? ` / ${escapeHtml(product.rentLabel)}` : ''}</span>
                </div>
                <div class="cart-quantity-controls">
                    <button type="button" class="quantity-button" data-action="change-cart-quantity" data-product-id="${product.id}" data-delta="-1">-</button>
                    <strong>${cartItem.quantity}</strong>
                    <button type="button" class="quantity-button" data-action="change-cart-quantity" data-product-id="${product.id}" data-delta="1">+</button>
                    <span class="cart-item-total">${itemTotal} ₪</span>
                </div>
            </div>
        </article>
    `;
}

function renderCheckoutPage() {
    if (appState.cart.length === 0) {
        return `
            <section class="card empty-state empty-state-large">
                <span class="eyebrow">תשלום</span>
                <h1>אין פריטים לתשלום</h1>
                <p>העגלה שלך ריקה, אז אין מה לשלם.</p>
                <div class="empty-state-actions">
                    <button type="button" class="primary-button" data-route-link="catalog">חזור לקטלוג</button>
                </div>
            </section>
        `;
    }

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">תשלום</span>
                <h1>תשלום דמה</h1>
                <p>מלא את שמך ובחר בשיטת תשלום דמה. תשלום מוצלח יהיה לך לשليטה על לוקר.</p>
            </div>
            <div class="checkout-total">
                <span>סך הכל</span>
                <strong>${calculateCartTotal()} ₪</strong>
            </div>
        </section>

        <section class="checkout-grid">
            <form class="card form-card" data-checkout-form>
                <h2>פרטי הלקוח</h2>
                <label class="field-group">
                    <span>שם פרטי</span>
                    <input type="text" class="text-input" name="firstName" required />
                </label>
                <label class="field-group">
                    <span>שם משפחה</span>
                    <input type="text" class="text-input" name="lastName" required />
                </label>
                <div class="payment-actions">
                    <button type="button" class="payment-button apple-pay" data-action="process-payment" data-provider="Apple Pay">Apple Pay</button>
                    <button type="button" class="payment-button google-pay" data-action="process-payment" data-provider="Google Pay">Google Pay</button>
                </div>
            </form>

            <aside class="card order-panel">
                <h2>תצוגה מקדימה של הסל</h2>
                <div class="order-preview-list">
                    ${appState.cart.map((item) => {
                        const product = getProductById(item.productId);
                        if (!product) {
                            return '';
                        }

                        return `<div class="summary-row"><span>${escapeHtml(product.name)} × ${item.quantity}</span><strong>${calculateCartItemTotal(item)} ₪</strong></div>`;
                    }).join('')}
                </div>
            </aside>
        </section>
    `;
}

function processMockPayment(provider) {
    const checkoutForm = document.querySelector('[data-checkout-form]');
    if (!checkoutForm) {
        return;
    }

    const firstName = checkoutForm.querySelector('input[name="firstName"]').value.trim();
    const lastName = checkoutForm.querySelector('input[name="lastName"]').value.trim();

    if (!firstName || !lastName) {
        showNotice('First Name and Last Name are required.', 'error');
        return;
    }

    if (appState.cart.length === 0) {
        showNotice('Your cart is empty.', 'error');
        navigateToRoute('cart');
        return;
    }

    const inventorySnapshot = { ...appState.inventory };
    for (const cartItem of appState.cart) {
        const currentStock = Number(inventorySnapshot[cartItem.productId] || 0);
        if (currentStock < cartItem.quantity) {
            showNotice('המלאי השתנה והעגלה לא יכולה להשלים עוד.', 'error');
            renderCurrentRoute('cart');
            return;
        }
        inventorySnapshot[cartItem.productId] = currentStock - cartItem.quantity;
    }

    appState.inventory = inventorySnapshot;
    saveInventoryState();

    const purchasedItems = appState.cart.map((item) => ({ ...item }));
    clearCart();
    appState.lockerOpen = false;
    saveStoredJson('aguda2go.checkoutContext', {
        customerName: `${firstName} ${lastName}`,
        provider,
        purchasedItems,
        createdAt: new Date().toISOString(),
    });

    showNotice(`תשלום ${provider} אושר. הפנייה לשליטה על לוקר.`, 'success');
    navigateToRoute('locker');
}

function renderLockerControlPage() {
    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">שליטה על לוקר</span>
                <h1>הפעלת לוקר לאחר תשלום</h1>
                <p>השתמש בבקרות ה-ESP32 servo למטה כדי לפתוח ולסגור את דלת הלוקר לאחר התשלום.</p>
            </div>
            <div class="status-chip ${appState.lockerOpen ? 'status-open' : 'status-closed'}">
                ${appState.lockerOpen ? 'לוקר פתוח' : 'לוקר סגור'}
            </div>
        </section>

        <section class="card locker-card">
            <p class="locker-description">נקודת קצה של API: ${escapeHtml(ESP32_BASE_URL)}/api/locker</p>
            <div class="locker-actions">
                <button type="button" class="primary-button" data-action="locker-control" data-command="open">פתח לוקר</button>
                <button type="button" class="secondary-button" data-action="locker-control" data-command="close">סגור לוקר</button>
            </div>
            <div class="locker-status" id="locker-status">${appState.lockerOpen ? 'הלוקר פתוח כרגע.' : 'הלוקר סגור כרגע.'}</div>
        </section>
    `;
}

function operateLockerFromCurrentPage(command) {
    const lockerStatus = document.getElementById('locker-status');

    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        if (lockerStatus) {
            lockerStatus.textContent = 'הלוקר פתוח. הנח את הפריט בתוכו וסגור כשתסיים.';
        }
        showNotice('פקודת פתיחת הלוקר נשלחה.', 'success');
        renderCurrentRoute('locker');
        return;
    }

    if (command === 'close') {
        sendLockerServoCommand('close');
        appState.lockerOpen = false;
        if (lockerStatus) {
            lockerStatus.textContent = 'הלוקר סגור וחזוק.';
        }
        showNotice('פקודת סגירת הלוקר נשלחה.', 'success');
        renderCurrentRoute('locker');
    }
}

async function sendLockerServoCommand(command) {
    const endpoint = `${ESP32_BASE_URL}/api/locker/${command}`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ command }),
        });

        if (!response.ok) {
            throw new Error(`Locker API returned ${response.status}`);
        }

        return await response.json();
    } catch {
        return { mocked: true, command };
    }
}

function renderReturnProductPage() {
    const firstProduct = PRODUCTS[0];
    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">החזרת מוצר</span>
                <h1>החזרת מוצר</h1>
                <p>מלא את פרטי ההשאלה, בחר את הפריט, העלה תמונה דמה, והשתמש בלחצני הלוקר כדי להשלים את ההחזרה.</p>
            </div>
        </section>

        <section class="checkout-grid return-grid">
            <form class="card form-card" data-return-form>
                <h2>פרטי ההחזרה</h2>
                <label class="field-group">
                    <span>שם פרטי</span>
                    <input type="text" class="text-input" name="returnFirstName" required />
                </label>
                <label class="field-group">
                    <span>שם משפחה</span>
                    <input type="text" class="text-input" name="returnLastName" required />
                </label>
                <label class="field-group">
                    <span>מוצר הוחזר</span>
                    <select class="text-input" data-return-product-select>
                        ${PRODUCTS.map((product, index) => `<option value="${product.id}" ${index === 0 ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('')}
                    </select>
                </label>
                <label class="field-group">
                    <span>העלה תמונת מוצר</span>
                    <input type="file" class="text-input file-input" accept="image/*" data-return-file-input />
                    <small class="file-name" data-return-file-label>לא נבחר קובץ</small>
                </label>
                <div class="payment-actions">
                    <button type="button" class="primary-button" data-action="locker-control" data-command="open">פתח לוקר</button>
                    <button type="button" class="secondary-button" data-action="locker-control" data-command="close">סגור לוקר</button>
                </div>
                <div class="return-status" id="return-status">${escapeHtml(firstProduct.name)} נבחר להחזרה.</div>
            </form>

            <aside class="card order-panel">
                <h2>השפעת ההחזרה</h2>
                <p>סגירת הלוקר תגדיל את המוצר שנבחר חזרה למלאי.</p>
                <div class="summary-row">
                    <span>מלאי נוכחי עבור ${escapeHtml(firstProduct.name)}</span>
                    <strong data-return-stock-value>${getInventoryStock(firstProduct.id)}</strong>
                </div>
                <div class="summary-row">
                    <span>מוצר שנבחר</span>
                    <strong data-return-product-name>${escapeHtml(firstProduct.name)}</strong>
                </div>
            </aside>
        </section>
    `;
}

function updateReturnPreview() {
    const select = document.querySelector('[data-return-product-select]');
    const status = document.getElementById('return-status');
    const summaryStrong = document.querySelector('[data-return-stock-value]');
    const summaryProductName = document.querySelector('[data-return-product-name]');

    if (!select) {
        return;
    }

    const product = getProductById(select.value);
    if (!product) {
        return;
    }

    if (status) {
        status.textContent = `${product.name} is selected for return.`;
    }

    if (summaryStrong) {
        summaryStrong.textContent = String(getInventoryStock(product.id));
    }

    if (summaryProductName) {
        summaryProductName.textContent = product.name;
    }
}

function incrementInventoryForReturn(productId) {
    appState.inventory[productId] = getInventoryStock(productId) + 1;
    saveInventoryState();
}

function renderInventoryManagementPage() {
    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">ניהול מלאי</span>
                <h1>כניסה אגודה</h1>
                <p>סטטיסטיקות השכרה ומכירה, יחד עם ניהול המלאי והפריטים המושכרים כרגע.</p>
            </div>
        </section>

        <section class="card inventory-dashboard-shell">
            <div class="inventory-section-header">
                <div>
                    <span class="eyebrow">בחר קטגוריה</span>
                    <h2>תצוגה אחת בכל פעם</h2>
                </div>
                <label class="inventory-section-selector">
                    <span class="inventory-section-note">קטגוריה</span>
                    <select id="inventory-section-select" class="text-input inventory-view-select">
                        <option value="summary">סטטיסטיקות</option>
                        <option value="rentals">השכרה כרגע</option>
                        <option value="inventory">ניהול מלאי</option>
                    </select>
                </label>
            </div>

            <div id="inventory-dashboard-panel" class="inventory-dashboard-panel"></div>
        </section>

        <style>
            .action-button {
                padding: 6px 12px;
                font-size: 0.9rem;
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                margin-right: 5px;
            }
            .action-button:hover {
                background: #f5f5f5;
            }
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .modal-content {
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
            }
            .modal-content h2 {
                margin-top: 0;
            }
            .modal-content input,
            .modal-content select {
                width: 100%;
                padding: 10px;
                margin: 10px 0;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 1rem;
            }
        </style>
    `;
}

async function loadInventoryDashboardData() {
    const requestId = ++inventoryDashboardRequestId;
    const rentalsList = document.getElementById('inventory-active-rentals-list');
    const rentalsNote = document.getElementById('inventory-rentals-note');

    try {
        const response = await fetch('/api/orders');
        if (!response.ok) {
            throw new Error(`Failed to load orders (${response.status})`);
        }

        const orders = await response.json();
        if (requestId !== inventoryDashboardRequestId) {
            return;
        }

        const summary = buildInventoryDashboardSummary(orders);
        inventoryDashboardSummary = summary;
        renderInventoryDashboardView();
    } catch (error) {
        if (requestId !== inventoryDashboardRequestId) {
            return;
        }

        inventoryDashboardSummary = null;
        renderInventoryDashboardView(true);
    }
}

function buildInventoryDashboardSummary(orders) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const activeRentals = [];
    let soldUnits = 0;
    let salesRevenue = 0;
    let rentedUnits = 0;

    orders.forEach((order) => {
        (order.items || []).forEach((item) => {
            const product = getProductById(item.productId);
            if (!product) {
                return;
            }

            const quantity = Number(item.quantity || 1);
            const rentDays = Number(item.rentDays || 1);

            if (product.type === 'rent') {
                const startedAt = new Date(order.createdAt || Date.now()).getTime();
                const dueAt = startedAt + (rentDays * dayMs);
                const remainingMs = dueAt - now;

                if (remainingMs > 0) {
                    const remainingDays = Math.max(1, Math.ceil(remainingMs / dayMs));
                    rentedUnits += quantity;
                    activeRentals.push({
                        orderId: order.id,
                        productId: item.productId,
                        productName: product.name,
                        quantity,
                        rentDays,
                        customerName: order.customerName || 'לא צוין',
                        startedAt: order.createdAt || null,
                        dueAt: new Date(dueAt).toISOString(),
                        remainingDays,
                    });
                }
                return;
            }

            soldUnits += quantity;
            salesRevenue += product.price * quantity;
        });
    });

    return {
        activeRentals,
        rentedUnits,
        soldUnits,
        salesRevenue,
    };
}

function updateInventoryDashboard(summary) {
    const activeRentalsValue = document.getElementById('inventory-active-rentals');
    const rentedUnitsValue = document.getElementById('inventory-rented-units');
    const soldUnitsValue = document.getElementById('inventory-sold-units');
    const salesRevenueValue = document.getElementById('inventory-sales-revenue');

    if (activeRentalsValue) {
        activeRentalsValue.textContent = String(summary.activeRentals.length);
    }

    if (rentedUnitsValue) {
        rentedUnitsValue.textContent = String(summary.rentedUnits);
    }

    if (soldUnitsValue) {
        soldUnitsValue.textContent = String(summary.soldUnits);
    }

    if (salesRevenueValue) {
        salesRevenueValue.textContent = `${summary.salesRevenue} ₪`;
    }
}

function renderInventoryDashboardView(isError = false) {
    const panel = document.getElementById('inventory-dashboard-panel');
    const select = document.getElementById('inventory-section-select');

    if (!panel || !select) {
        return;
    }

    select.value = inventoryDashboardSection;
    const section = inventoryDashboardSection || 'summary';
    panel.innerHTML = renderInventoryDashboardPanel(section, inventoryDashboardSummary, isError);
}

function renderInventoryDashboardPanel(section, summary, isError = false) {
    if (section === 'rentals') {
        const rentals = summary?.activeRentals || [];
        return `
            <div class="inventory-section-header inventory-panel-header">
                <div>
                    <span class="eyebrow">השכרה כרגע</span>
                    <h3>אילו פריטים מושכרים ולאיזו תקופה</h3>
                </div>
                <span class="inventory-section-note">${isError ? 'שגיאה בטעינת נתונים' : rentals.length ? `נמצאו ${rentals.length} פריטי השכרה פעילים` : 'אין כרגע פריטים מושכרים'}</span>
            </div>
            <div class="inventory-rentals-list">
                ${rentals.length ? rentals.map((rental) => `
                    <article class="inventory-rental-row">
                        <div class="inventory-rental-main">
                            <strong>${escapeHtml(rental.productName)}</strong>
                            <span>כמות: ${rental.quantity} · לקוח: ${escapeHtml(rental.customerName)}</span>
                        </div>
                        <div class="inventory-rental-meta">
                            <span>תקופה: ${rental.rentDays} ימים</span>
                            <span>נותרו: ${rental.remainingDays} ימים</span>
                            <span>מועד סיום: ${formatDate(rental.dueAt)}</span>
                        </div>
                    </article>
                `).join('') : `<div class="inventory-empty-state">${isError ? 'לא ניתן לטעון את נתוני ההשכרה כרגע.' : 'אין כרגע פריטים מושכרים.'}</div>`}
            </div>
        `;
    }

    if (section === 'inventory') {
        const inventoryRows = PRODUCTS.map((product) => {
            const stock = getInventoryStock(product.id);
            const statusClass = stock <= 2 ? 'stock-low' : 'stock-ok';
            const statusText = stock <= 2 ? 'Low' : 'Healthy';
            return `
                <tr data-product-id="${product.id}">
                    <td>${escapeHtml(product.name)}</td>
                    <td>${escapeHtml(product.categoryLabel)}</td>
                    <td>${stock}</td>
                    <td><span class="stock-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="action-button edit-stock-btn" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}">✏️ Edit</button>
                        <button class="action-button remove-product-btn" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}">❌ Remove</button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="inventory-section-header inventory-panel-header">
                <div>
                    <span class="eyebrow">ניהול מלאי</span>
                    <h3>עריכה, הוספה והסרה</h3>
                </div>
                <button class="primary-button" id="add-product-btn">➕ Add New Product</button>
            </div>

            <div class="table-wrap">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>מוצר</th>
                            <th>סוג</th>
                            <th>מלאי</th>
                            <th>סטטוס</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryRows}
                    </tbody>
                </table>
            </div>

            <div id="edit-stock-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <h2>Edit Stock Level</h2>
                    <form id="edit-stock-form">
                        <div>
                            <label>Product Name</label>
                            <input type="text" id="edit-product-name" readonly style="background: #f0f0f0;">
                        </div>
                        <div>
                            <label>Stock Quantity</label>
                            <input type="number" id="edit-stock-input" min="0" required>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="primary-button">Save</button>
                            <button type="button" class="secondary-button" onclick="closeEditModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="add-product-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <h2>Add New Product</h2>
                    <form id="add-product-form">
                        <div>
                            <label>Product Name</label>
                            <input type="text" id="new-product-name" required>
                        </div>
                        <div>
                            <label>Type</label>
                            <select id="new-product-type" required>
                                <option value="">Select...</option>
                                <option value="rent">Rental (השכרה)</option>
                                <option value="buy">Purchase (רכישה)</option>
                            </select>
                        </div>
                        <div>
                            <label>Initial Stock</label>
                            <input type="number" id="new-product-stock" min="0" value="0" required>
                        </div>
                        <div>
                            <label>Price (₪)</label>
                            <input type="number" id="new-product-price" min="0" step="0.01" value="0" required>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="primary-button">Add Product</button>
                            <button type="button" class="secondary-button" onclick="closeAddModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    const activeRentals = summary?.activeRentals || [];
    const rentedUnits = summary?.rentedUnits ?? 0;
    const soldUnits = summary?.soldUnits ?? 0;
    const salesRevenue = summary?.salesRevenue ?? 0;

    return `
        <section class="inventory-stats-grid" aria-live="polite">
            <article class="card inventory-stat-card">
                <span class="inventory-stat-label">השכרות פעילות</span>
                <strong>${activeRentals.length}</strong>
                <small>פריטי השכרה שעדיין לא הסתיימו</small>
            </article>
            <article class="card inventory-stat-card">
                <span class="inventory-stat-label">יחידות מושכרות כרגע</span>
                <strong>${rentedUnits}</strong>
                <small>כמות כוללת של מוצרים בהשכרה</small>
            </article>
            <article class="card inventory-stat-card">
                <span class="inventory-stat-label">פריטי מכירה שנמכרו</span>
                <strong>${soldUnits}</strong>
                <small>מוצרים מסוג רכישה שכבר נמכרו</small>
            </article>
            <article class="card inventory-stat-card">
                <span class="inventory-stat-label">הכנסות ממכירה</span>
                <strong>${salesRevenue} ₪</strong>
                <small>על בסיס פריטי הרכישה שהוזמנו</small>
            </article>
        </section>
    `;
}

function renderInventoryRentalsList(activeRentals) {
    const rentalsList = document.getElementById('inventory-active-rentals-list');
    if (!rentalsList) {
        return;
    }

    if (!activeRentals.length) {
        rentalsList.innerHTML = '<div class="inventory-empty-state">אין כרגע פריטים מושכרים.</div>';
        return;
    }

    rentalsList.innerHTML = `
        <div class="inventory-rentals-table">
            ${activeRentals.map((rental) => `
                <article class="inventory-rental-row">
                    <div class="inventory-rental-main">
                        <strong>${escapeHtml(rental.productName)}</strong>
                        <span>כמות: ${rental.quantity} · לקוח: ${escapeHtml(rental.customerName)}</span>
                    </div>
                    <div class="inventory-rental-meta">
                        <span>תקופה: ${rental.rentDays} ימים</span>
                        <span>נותרו: ${rental.remainingDays} ימים</span>
                        <span>מועד סיום: ${formatDate(rental.dueAt)}</span>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function formatDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('he-IL');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function processReturnCompletionIfPossible() {
    const select = document.querySelector('[data-return-product-select]');
    const fileInput = document.querySelector('[data-return-file-input]');
    const firstNameInput = document.querySelector('input[name="returnFirstName"]');
    const lastNameInput = document.querySelector('input[name="returnLastName"]');

    if (!select || !fileInput || !firstNameInput || !lastNameInput) {
        return null;
    }

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    if (!firstName || !lastName) {
        showNotice('שם פרטי ושם משפחה נדרשים להחזרה.', 'error');
        return null;
    }

    if (!selectedFile) {
        showNotice('אנא העלה תמונה של המוצר המוחזר.', 'error');
        return null;
    }

    return {
        firstName,
        lastName,
        product: getProductById(select.value),
        selectedFile,
    };
}

function finalizeReturn(product) {
    if (!product) {
        return;
    }

    incrementInventoryForReturn(product.id);
    showNotice(`${product.name} הוחזר והוסף חזרה למלאי.`, 'success');
    renderCurrentRoute('return');
}

function maybeHandleReturnLockerCommand(command) {
    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        const returnStatus = document.getElementById('return-status');
        if (returnStatus) {
            returnStatus.textContent = 'הלוקר פתוח. הנח את הפריט המוחזר בתוכו וסגור את הלוקר כשתהיה מוכן.';
        }
        showNotice('לוקר ההחזרה נפתח.', 'success');
        return true;
    }

    if (command === 'close') {
        const returnData = processReturnCompletionIfPossible();
        if (!returnData) {
            return true;
        }

        sendLockerServoCommand('close');
        appState.lockerOpen = false;
        finalizeReturn(returnData.product);
        return true;
    }

    return false;
}

function operateLockerFromReturnPage(command) {
    if (maybeHandleReturnLockerCommand(command)) {
        return;
    }

    operateLockerFromCurrentPage(command);
}

function createLockerContextSummary() {
    const checkoutContext = loadStoredJson('aguda2go.checkoutContext', null);
    if (!checkoutContext) {
        return 'No recent checkout session found.';
    }

    return `Last payment: ${checkoutContext.customerName} via ${checkoutContext.provider}`;
}

function renderLockerContextMessage() {
    return escapeHtml(createLockerContextSummary());
}

function renderInventoryStatusBadge(stock) {
    return stock <= 2 ? '<span class="stock-pill stock-low">Low</span>' : '<span class="stock-pill stock-ok">Healthy</span>';
}

function processPageSpecificCommands(command) {
    const currentRoute = getRouteFromHash();

    if (currentRoute === 'return') {
        const handled = maybeHandleReturnLockerCommand(command);
        if (handled) {
            return;
        }
    }

    operateLockerFromCurrentPage(command);
}

function renderInitialRouteIfNeeded() {
    const route = getRouteFromHash();
    renderCurrentRoute(route);
}

function updateReturnProductStockAfterClose(productId) {
    incrementInventoryForReturn(productId);
    saveInventoryState();
}

function processCheckoutPayment(provider) {
    const checkoutForm = document.querySelector('[data-checkout-form]');
    if (!checkoutForm) {
        return;
    }

    const firstName = checkoutForm.querySelector('input[name="firstName"]').value.trim();
    const lastName = checkoutForm.querySelector('input[name="lastName"]').value.trim();

    if (!firstName || !lastName) {
        showNotice('First Name and Last Name are required.', 'error');
        return;
    }

    if (appState.cart.length === 0) {
        showNotice('Your cart is empty.', 'error');
        navigateToRoute('cart');
        return;
    }

    const inventorySnapshot = { ...appState.inventory };
    for (const cartItem of appState.cart) {
        if ((inventorySnapshot[cartItem.productId] || 0) < cartItem.quantity) {
            showNotice('פריט אחד או יותר מפריטי העגלה אינו זמין עוד.', 'error');
            renderCurrentRoute('cart');
            return;
        }
        inventorySnapshot[cartItem.productId] -= cartItem.quantity;
    }

    appState.inventory = inventorySnapshot;
    saveInventoryState();
    saveStoredJson('aguda2go.checkoutContext', {
        firstName,
        lastName,
        paymentProvider: provider,
        cartSnapshot: appState.cart,
        completedAt: new Date().toISOString(),
    });

    clearCart();
    showNotice(`תשלום ${provider} הושלם בהצלחה.`, 'success');
    navigateToRoute('locker');
}

function processRouteAction(action, dataset) {
    if (action === 'locker-control') {
        if (getRouteFromHash() === 'return') {
            operateLockerFromReturnPage(dataset.command);
            return true;
        }

        operateLockerFromCurrentPage(dataset.command);
        return true;
    }

    if (action === 'process-payment') {
        processCheckoutPayment(dataset.provider);
        return true;
    }

    return false;
}

function attachRouteActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) {
            return;
        }

        event.preventDefault();
        const handled = processRouteAction(actionButton.dataset.action, actionButton.dataset);
        if (handled) {
            return;
        }
    });
}

function renderRouteAndKeepState(route) {
    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    renderCurrentRoute(safeRoute);
}

function buildInventoryUpdateMap(productId, delta) {
    return {
        productId,
        delta,
    };
}

function updateReturnInventoryFromSelection() {
    const select = document.querySelector('[data-return-product-select]');
    if (!select) {
        return;
    }

    const productId = select.value;
    updateReturnProductStockAfterClose(productId);
}

function handleReturnCloseCommand() {
    const returnData = processReturnCompletionIfPossible();
    if (!returnData) {
        return;
    }

    sendLockerServoCommand('close');
    appState.lockerOpen = false;
    incrementInventoryForReturn(returnData.product.id);
    saveInventoryState();
    showNotice(`${returnData.product.name} הוחזר בהצלחה.`, 'success');
    renderCurrentRoute('return');
}

function maybeUpdateReturnStatusFromCommand(command) {
    if (command === 'close') {
        handleReturnCloseCommand();
        return true;
    }

    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        showNotice('Return locker opened.', 'success');
        return true;
    }

    return false;
}

function attachSupplementalHandlers() {
    // Intentionally left blank for future shared behavior.
}

// ===== Inventory Management Functions =====

function openEditModal(productId, productName) {
    const modal = document.getElementById('edit-stock-modal');
    const nameField = document.getElementById('edit-product-name');
    const stockField = document.getElementById('edit-stock-input');
    
    if (modal && nameField && stockField) {
        nameField.value = productName;
        stockField.value = getInventoryStock(productId);
        stockField.dataset.productId = productId;
        modal.style.display = 'flex';
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-stock-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openAddModal() {
    const modal = document.getElementById('add-product-modal');
    const form = document.getElementById('add-product-form');
    if (modal && form) {
        form.reset();
        modal.style.display = 'flex';
    }
}

function closeAddModal() {
    const modal = document.getElementById('add-product-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleEditStockSubmit() {
    const stockField = document.getElementById('edit-stock-input');
    if (!stockField || !stockField.dataset.productId) {
        showNotice('Error: Product ID not found', 'error');
        return;
    }

    const productId = stockField.dataset.productId;
    const newStock = parseInt(stockField.value, 10);

    if (isNaN(newStock) || newStock < 0) {
        showNotice('Please enter a valid stock number', 'error');
        return;
    }

    appState.inventory[productId] = newStock;
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);
    
    showNotice(`Stock updated! ${PRODUCTS.find(p => p.id === productId)?.name || productId} now has ${newStock} units.`, 'success');
    closeEditModal();
    renderCurrentRoute('inventory');
}

function handleAddProductSubmit() {
    const nameField = document.getElementById('new-product-name');
    const typeField = document.getElementById('new-product-type');
    const stockField = document.getElementById('new-product-stock');
    const priceField = document.getElementById('new-product-price');

    if (!nameField || !typeField || !stockField || !priceField) {
        showNotice('Form fields not found', 'error');
        return;
    }

    const name = nameField.value.trim();
    const type = typeField.value;
    const stock = parseInt(stockField.value, 10);
    const price = parseFloat(priceField.value);

    if (!name) {
        showNotice('Please enter a product name', 'error');
        return;
    }
    if (!type) {
        showNotice('Please select a product type', 'error');
        return;
    }
    if (isNaN(stock) || stock < 0) {
        showNotice('Please enter a valid stock quantity', 'error');
        return;
    }
    if (isNaN(price) || price < 0) {
        showNotice('Please enter a valid price', 'error');
        return;
    }

    // Generate new product ID
    const newId = `p${String(PRODUCTS.length + 1).padStart(3, '0')}`;
    
    const newProduct = {
        id: newId,
        name: name,
        description: `${name} - Added ${new Date().toLocaleDateString()}`,
        type: type === 'rent' ? 'rent' : 'buy',
        price: price,
        stock: stock,
        visual: '📦',
        image: '',
        categoryLabel: type === 'rent' ? 'השכרה' : 'רכישה',
        rentLabel: type === 'rent' ? 'ליום' : '',
        searchTerms: name.toLowerCase(),
    };

    PRODUCTS.push(newProduct);
    appState.inventory[newId] = stock;
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);

    showNotice(`✅ New product "${name}" added successfully!`, 'success');
    closeAddModal();
    renderCurrentRoute('inventory');
}

function removeProduct(productId) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
        showNotice('Product not found', 'error');
        return;
    }

    // Remove from PRODUCTS array
    const index = PRODUCTS.indexOf(product);
    if (index > -1) {
        PRODUCTS.splice(index, 1);
    }

    // Remove from inventory
    delete appState.inventory[productId];
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);

    showNotice(`🗑️ Product "${product.name}" removed from inventory`, 'success');
    renderCurrentRoute('inventory');
}

function finalizeInventorySeed() {
    appState.inventory = ensureInventoryShape(appState.inventory);
}

finalizeInventorySeed();
attachSupplementalHandlers();

window.closeEditModal = closeEditModal;
window.closeAddModal = closeAddModal;
