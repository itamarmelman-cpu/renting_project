const STORAGE_KEYS = {
    cart: 'aguda2go.cart',
    inventory: 'aguda2go.inventory',
    rentDays: 'aguda2go.rentDays',
};

const ESP32_BASE_URL = 'http://esp32.local';

const PRODUCTS = [
    {
        id: 'p001',
        name: 'מחשבון מדעי',
        description: 'Casio fx-991ES - מתאים לכל המבחנים האקדמיים',
        type: 'rent',
        price: 5,
        stock: 3,
        visual: '🧮',
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

initializeApp();

function initializeApp() {
    mountAppShell();
    attachGlobalEventHandlers();
    syncHeaderState();
    window.addEventListener('hashchange', () => renderCurrentRoute(getRouteFromHash()));

    if (!location.hash) {
        renderCurrentRoute(getDefaultRoute());
        return;
    }

    renderCurrentRoute(getRouteFromHash());
}

function mountAppShell() {
    if (appShellInitialized) {
        return;
    }

    document.body.classList.add('aguda2go-body');
    document.body.innerHTML = `
        <div class="app-shell">
            <header class="app-header">
                <button class="brand-button" type="button" data-route-link="catalog" aria-label="Go to catalog">
                    <span class="brand-mark">A2G</span>
                    <span class="brand-copy">
                        <strong>Aguda2Go</strong>
                        <span>Smart locker rentals</span>
                    </span>
                </button>

                <nav class="header-actions" aria-label="Primary navigation">
                    <button class="nav-button" type="button" data-route-link="catalog">Catalog</button>
                    <button class="nav-button" type="button" data-route-link="return">Return Product</button>
                    <button class="nav-button" type="button" data-route-link="cart">
                        <span>Cart</span>
                        <span class="cart-badge" id="cart-badge" hidden>0</span>
                    </button>
                    <button class="nav-button nav-button-accent" type="button" data-route-link="inventory">Aguda Login</button>
                </nav>
            </header>

            <div class="app-notice" id="app-notice" hidden></div>

            <main class="app-main" id="main-content"></main>

            <footer class="app-footer">
                <div class="footer-grid">
                    <section>
                        <h2>Aguda2Go</h2>
                        <p>מערכת חכמה להשכרה, החזרה ושליטה על לוקרים לציוד סטודנטיאלי.</p>
                    </section>
                    <section>
                        <h3>ניווט מהיר</h3>
                        <div class="footer-links">
                            <button type="button" class="footer-link" data-route-link="catalog">Catalog</button>
                            <button type="button" class="footer-link" data-route-link="cart">Cart</button>
                            <button type="button" class="footer-link" data-route-link="return">Return Product</button>
                            <button type="button" class="footer-link" data-route-link="inventory">Inventory Management</button>
                        </div>
                    </section>
                    <section>
                        <h3>Project Note</h3>
                        <p>Minimal UI, persistent inventory state, and mocked hardware operations for the ESP32 locker.</p>
                    </section>
                </div>
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
    }

    syncHeaderState();
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
        showNotice('Product not found.', 'error');
        return;
    }

    const availableStock = getAvailableStock(productId);
    if (availableStock <= 0) {
        showNotice('This product is currently out of stock.', 'error');
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
    showNotice(`${product.name} added to cart.`, 'success');
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
        showNotice('Not enough stock for that quantity.', 'error');
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
                <span class="eyebrow">Catalog</span>
                <h1>קטלוג הציוד האקדמי</h1>
                <p>בחרו מוצר, הגדירו ימים למוצרים להשכרה, והוסיפו לסל בקצב עבודה פשוט ונקי.</p>
            </div>
            <form class="catalog-search" data-catalog-search-form>
                <input
                    type="text"
                    class="text-input"
                    placeholder="Search products"
                    value="${escapeHtml(appState.catalogSearchQuery)}"
                    data-catalog-search-input
                />
                <button type="submit" class="primary-button" data-action="catalog-search">Search</button>
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
            <div class="product-visual">${escapeHtml(product.visual)}</div>
            <div class="product-content">
                <div class="product-header">
                    <h2>${escapeHtml(product.name)}</h2>
                    <span class="product-type type-${product.type}">${escapeHtml(product.categoryLabel)}</span>
                </div>
                <p>${escapeHtml(product.description)}</p>
                <div class="product-meta">
                    <span class="stock-pill">${escapeHtml(stockLabel)}</span>
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
            <h2>No products found</h2>
            <p>Try a different search term.</p>
        </div>
    `;
}

function renderCartPage() {
    if (appState.cart.length === 0) {
        return `
            <section class="card empty-state empty-state-large">
                <span class="eyebrow">Cart</span>
                <h1>Your cart is empty</h1>
                <p>Add products from the catalog to continue to checkout.</p>
                <div class="empty-state-actions">
                    <button type="button" class="primary-button" data-route-link="catalog">Back to Catalog</button>
                </div>
            </section>
        `;
    }

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">Cart</span>
                <h1>עגלת הקניות שלך</h1>
                <p>בדקו את הפריטים לפני המעבר לתשלום הדמה ולשלב פתיחת הלוקר.</p>
            </div>
            <button type="button" class="primary-button" data-route-link="checkout">Proceed to Checkout</button>
        </section>

        <section class="cart-layout">
            <div class="cart-items">
                ${appState.cart.map(renderCartItem).join('')}
            </div>
            <aside class="cart-summary card">
                <h2>Order Summary</h2>
                <div class="summary-row">
                    <span>Items</span>
                    <strong>${getCartItemCount()}</strong>
                </div>
                <div class="summary-row">
                    <span>Total</span>
                    <strong>${calculateCartTotal()} ₪</strong>
                </div>
                <button type="button" class="primary-button block-button" data-route-link="checkout">Proceed to Checkout</button>
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
                    <span>${product.type === 'rent' ? `${cartItem.rentDays} days` : 'Purchase item'}</span>
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
                <span class="eyebrow">Checkout</span>
                <h1>No items to checkout</h1>
                <p>Your cart is empty, so there is nothing to pay for.</p>
                <div class="empty-state-actions">
                    <button type="button" class="primary-button" data-route-link="catalog">Back to Catalog</button>
                </div>
            </section>
        `;
    }

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">Checkout</span>
                <h1>Dummy Checkout</h1>
                <p>Fill in your name and choose a mock payment method. Successful payment will send you to locker control.</p>
            </div>
            <div class="checkout-total">
                <span>Total</span>
                <strong>${calculateCartTotal()} ₪</strong>
            </div>
        </section>

        <section class="checkout-grid">
            <form class="card form-card" data-checkout-form>
                <h2>Customer Details</h2>
                <label class="field-group">
                    <span>First Name</span>
                    <input type="text" class="text-input" name="firstName" required />
                </label>
                <label class="field-group">
                    <span>Last Name</span>
                    <input type="text" class="text-input" name="lastName" required />
                </label>
                <div class="payment-actions">
                    <button type="button" class="payment-button apple-pay" data-action="process-payment" data-provider="Apple Pay">Apple Pay</button>
                    <button type="button" class="payment-button google-pay" data-action="process-payment" data-provider="Google Pay">Google Pay</button>
                </div>
            </form>

            <aside class="card order-panel">
                <h2>Cart Preview</h2>
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
            showNotice('Inventory changed and the cart can no longer be fulfilled.', 'error');
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

    showNotice(`${provider} payment approved. Redirecting to locker control.`, 'success');
    navigateToRoute('locker');
}

function renderLockerControlPage() {
    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">Locker Control</span>
                <h1>Post-payment locker operation</h1>
                <p>Use the ESP32 servo controls below to open and close the locker door after payment.</p>
            </div>
            <div class="status-chip ${appState.lockerOpen ? 'status-open' : 'status-closed'}">
                ${appState.lockerOpen ? 'Locker Open' : 'Locker Closed'}
            </div>
        </section>

        <section class="card locker-card">
            <p class="locker-description">API endpoint: ${escapeHtml(ESP32_BASE_URL)}/api/locker</p>
            <div class="locker-actions">
                <button type="button" class="primary-button" data-action="locker-control" data-command="open">Open Locker</button>
                <button type="button" class="secondary-button" data-action="locker-control" data-command="close">Close Locker</button>
            </div>
            <div class="locker-status" id="locker-status">${appState.lockerOpen ? 'Locker is currently open.' : 'Locker is currently closed.'}</div>
        </section>
    `;
}

function operateLockerFromCurrentPage(command) {
    const lockerStatus = document.getElementById('locker-status');

    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        if (lockerStatus) {
            lockerStatus.textContent = 'Locker is open. Place the item inside and close it when finished.';
        }
        showNotice('Locker opening command sent.', 'success');
        renderCurrentRoute('locker');
        return;
    }

    if (command === 'close') {
        sendLockerServoCommand('close');
        appState.lockerOpen = false;
        if (lockerStatus) {
            lockerStatus.textContent = 'Locker is closed and secured.';
        }
        showNotice('Locker closing command sent.', 'success');
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
                <span class="eyebrow">Return Product</span>
                <h1>החזרת מוצר</h1>
                <p>Fill in the borrower details, select the item, upload a mock image, and use the locker buttons to complete the return.</p>
            </div>
        </section>

        <section class="checkout-grid return-grid">
            <form class="card form-card" data-return-form>
                <h2>Return Details</h2>
                <label class="field-group">
                    <span>First Name</span>
                    <input type="text" class="text-input" name="returnFirstName" required />
                </label>
                <label class="field-group">
                    <span>Last Name</span>
                    <input type="text" class="text-input" name="returnLastName" required />
                </label>
                <label class="field-group">
                    <span>Returned Product</span>
                    <select class="text-input" data-return-product-select>
                        ${PRODUCTS.map((product, index) => `<option value="${product.id}" ${index === 0 ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('')}
                    </select>
                </label>
                <label class="field-group">
                    <span>Upload Product Image</span>
                    <input type="file" class="text-input file-input" accept="image/*" data-return-file-input />
                    <small class="file-name" data-return-file-label>No file selected</small>
                </label>
                <div class="payment-actions">
                    <button type="button" class="primary-button" data-action="locker-control" data-command="open">Open Locker</button>
                    <button type="button" class="secondary-button" data-action="locker-control" data-command="close">Close Locker</button>
                </div>
                <div class="return-status" id="return-status">${escapeHtml(firstProduct.name)} is selected for return.</div>
            </form>

            <aside class="card order-panel">
                <h2>Return Impact</h2>
                <p>Closing the locker will increment the selected product back into inventory stock.</p>
                <div class="summary-row">
                    <span>Current stock for ${escapeHtml(firstProduct.name)}</span>
                    <strong data-return-stock-value>${getInventoryStock(firstProduct.id)}</strong>
                </div>
                <div class="summary-row">
                    <span>Selected product</span>
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
    const inventoryRows = PRODUCTS.map((product) => `
        <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.categoryLabel)}</td>
            <td>${getInventoryStock(product.id)}</td>
            <td>${getInventoryStock(product.id) <= 2 ? '<span class="stock-pill stock-low">Low</span>' : '<span class="stock-pill stock-ok">Healthy</span>'}</td>
        </tr>
    `).join('');

    return `
        <section class="page-hero card">
            <div>
                <span class="eyebrow">Inventory Management</span>
                <h1>Aguda Login</h1>
                <p>This page is ready for future administration features and currently exposes the live stock state.</p>
            </div>
        </section>

        <section class="card inventory-card">
            <div class="inventory-tabs-placeholder">
                <div class="tab-pill is-selected">Statistics Dashboard</div>
                <div class="tab-pill">Inventory Management</div>
                <div class="tab-pill">Order Tracking</div>
            </div>

            <pre class="todo-code-block"><code>TODO: Build the three-tab inventory UI.
- Statistics Dashboard
- Inventory Management
- Order Tracking</code></pre>

            <div class="table-wrap">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Type</th>
                            <th>Stock</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryRows}
                    </tbody>
                </table>
            </div>
        </section>
    `;
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
        showNotice('First Name and Last Name are required for a return.', 'error');
        return null;
    }

    if (!selectedFile) {
        showNotice('Please upload an image of the returned product.', 'error');
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
    showNotice(`${product.name} was returned and added back to stock.`, 'success');
    renderCurrentRoute('return');
}

function maybeHandleReturnLockerCommand(command) {
    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        const returnStatus = document.getElementById('return-status');
        if (returnStatus) {
            returnStatus.textContent = 'Locker is open. Place the returned item inside and close the locker when ready.';
        }
        showNotice('Return locker opened.', 'success');
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
            showNotice('One or more cart items are no longer available.', 'error');
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
    showNotice(`${provider} payment completed successfully.`, 'success');
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
    showNotice(`${returnData.product.name} was returned successfully.`, 'success');
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

function finalizeInventorySeed() {
    appState.inventory = ensureInventoryShape(appState.inventory);
}

finalizeInventorySeed();
attachSupplementalHandlers();
