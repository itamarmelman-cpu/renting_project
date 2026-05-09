const STORAGE_KEYS = {
    cart: 'agugo.cart',
    inventory: 'agugo.inventory',
    rentDays: 'agugo.rentDays',
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

// true after mountAppShell() has run; prevents duplicate DOM injection
let isShellMounted = false;
// setTimeout ID for the auto-hide timer on the notice banner
let noticeTimerId = null;
// Incremented on every dashboard fetch; used to discard stale async responses
let dashboardFetchId = 0;
// Cached result of the last successful dashboard data load
let dashboardSummary = null;
// Which dashboard section is currently displayed ('summary' | 'rentals' | 'inventory')
let activeDashboardSection = 'summary';

initializeApp();

// ===== Bootstrap =====

/**
 * Entry point. Mounts the static app shell, wires up global event listeners,
 * and renders the initial route derived from the current URL hash.
 * Runs once on page load.
 */
function initializeApp() {
    mountAppShell();
    attachGlobalEventHandlers();
    syncHeaderState();
    window.addEventListener('hashchange', () => renderCurrentRoute(getRouteFromHash()));

    const route = !location.hash ? 'catalog' : getRouteFromHash();
    renderCurrentRoute(route);
    renderFooterFaq(route);
}

/**
 * Injects the permanent app chrome (header, notice bar, main content slot,
 * and footer) into document.body. Skips execution after the first call so
 * the shell is never duplicated during re-renders.
 */
function mountAppShell() {
    if (isShellMounted) {
        return;
    }

    document.body.innerHTML = `
        <div class="app">
            <header class="app-header">
                <div class="app-logo logo-container" data-route-link="catalog" style="cursor:pointer">
                    <img src="catalog/logo-pics/AguGoLogo.png" alt="AguGo Logo" class="logo-image-agugo">
                    <img src="catalog/logo-pics/AgudaLogo.png" alt="AguGo Logo" class="logo-image">
                </div>
                <div style="display: flex; gap: 16px; align-items: center;">
                    <button class="return-button" type="button" data-route-link="return">
                        <span class="btn-icon">↺</span>
                        <span class="btn-text">החזרת מוצר</span>
                    </button>
                    <button class="cart-button" type="button" data-route-link="cart" id="cart-btn">
                        <div class="cart-icon-wrapper">
                            <img src="catalog/logo-pics/CartIcon.png" alt="עגלה" class="cart-icon-image">
                        </div>
                        <span class="cart-badge" id="cart-badge" style="display: none;">0</span>
                    </button>
                    <button class="association-login-button" type="button" data-route-link="inventory">
                       התחברות אגודה
                    </button>
                </div>
            </header>

            <div class="app-notice" id="app-notice" hidden></div>

            <main class="app-main" id="main-content"></main>

            <footer class="app-footer ecommerce-footer">
                <div class="footer-grid">
                    <div class="footer-brand">
                        <div class="app-logo logo-container" data-route-link="catalog" style="cursor:pointer; justify-content: flex-start;">
                            <img src="catalog/logo-pics/AguGoLogo.png" alt="AguGo Logo" class="logo-image-agugo">
                            <img src="catalog/logo-pics/AgudaLogo.png" alt="Student Union Logo" class="logo-image">
                        </div>
                        <p class="brand-description">מערכת חכמה להשכרה ורכישת ציוד אקדמי לסטודנטים. כל מה שצריך, מתי שצריך, במרחק לחיצת כפתור.</p>
                    </div>
                    <div class="footer-links">
                        <h3>ניווט מהיר</h3>
                        <nav class="footer-nav">
                            <a href="#catalog" data-route-link="catalog">קטלוג הציוד</a>
                            <a href="#cart" data-route-link="cart">עגלת הקניות שלך</a>
                            <a href="#return" data-route-link="return">החזרת מוצרים</a>
                            <a href="#inventory" data-route-link="inventory">ניהול מלאי</a>
                        </nav>
                    </div>
                    <div class="footer-info">
                        <h3>פרויקט אקדמי תשפ"ו</h3>
                        <p>מפותח על ידי צוות AguGo:</p>
                        <p class="team-names">איתמר מלמן | יונתן צור | עומר דורון | עמית קליינמן | שירה דניאל</p>
                    </div>
                </div>
                <div class="footer-grid footer-grid-qa">
                    <section class="footer-qa-section">
                        <div class="footer-qa-header">
                            <div>
                                <h3>שאלות נפוצות </h3>
                            </div>
                        </div>
                        <div class="footer-qa-list" id="footer-qa-list"></div>
                    </section>
                </div>
                <div class="footer-bottom">
                    <p class="copyright">© כל הזכויות שמורות - אב טיפוס לפרויקט מערכות מידע</p>
                </div>
            </footer>
        </div>
    `;

    isShellMounted = true;
}

// ===== Event Delegation =====

/**
 * Attaches a single set of delegated listeners to document and #main-content.
 * All dynamic page elements are handled here so individual render functions
 * never need to bind their own listeners.
 *
 * Handles:
 * - [data-route-link] clicks → navigation
 * - [data-action="add-to-cart"] → addProductToCart
 * - [data-action="select-rent-days"] → setRentDaysPreference
 * - [data-action="change-cart-quantity"] → updateCartItemQuantity
 * - [data-action="remove-cart-item"] → removeCartItem
 * - [data-action="process-payment"] → processMockPayment
 * - [data-action="locker-control"] → locker open/close
 * - [data-action="catalog-search"] → catalog search
 * - #add-product-btn, .edit-stock-btn, .remove-product-btn → inventory modals
 * - #inventory-section-select change → dashboard section switch
 * - [data-return-product-select] change → updateReturnPreview
 * - [data-return-file-input] change → file label update
 * - form submits for catalog search, return, checkout, edit-stock, add-product
 */
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
            const productId = rentDayButton.dataset.productId;
            const days = Number(rentDayButton.dataset.days);
            setRentDaysPreference(productId, days);
            // Update the selector in-place — no full page re-render needed
            const card = rentDayButton.closest('.product-card');
            if (card) {
                card.querySelectorAll('[data-action="select-rent-days"]').forEach((btn) => {
                    btn.classList.toggle('active', Number(btn.dataset.days) === days);
                });
                const totalValue = card.querySelector('.rent-total-value');
                const product = getProductById(productId);
                if (totalValue && product) {
                    totalValue.textContent = String(product.price * days);
                }
            }
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
            if (confirm(`להסיר את "${productName}" מהמלאי?`)) {
                removeProduct(productId);
            }
            return;
        }
    });

    appMain.addEventListener('change', (event) => {
        if (event.target.matches('#inventory-section-select')) {
            activeDashboardSection = event.target.value || 'summary';
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
                label.textContent = event.target.files && event.target.files.length ? event.target.files[0].name : 'לא נבחר קובץ';
            }
        }
    });
}

// ===== Routing =====

/**
 * Returns the fallback route string. Reads data-default-route from <body>
 * so the server can override the default without changing JS.
 *
 * @returns {string}
 */
function getDefaultRoute() {
    const defaultRoute = document.body.dataset.defaultRoute || 'catalog';
    return ROUTES.has(defaultRoute) ? defaultRoute : 'catalog';
}

/**
 * Parses the URL hash (e.g. '#cart') into a route key ('cart').
 * Returns the default route for hashes that don't match ROUTES.
 *
 * @returns {string}
 */
function getRouteFromHash() {
    const route = location.hash.replace('#', '').split('?')[0];
    return ROUTES.has(route) ? route : getDefaultRoute();
}

/**
 * Navigates to the given route by updating location.hash. If the target
 * hash is already active, forces an immediate re-render without adding a
 * new history entry.
 *
 * @param {string} route - A value from the ROUTES set
 */
function navigateToRoute(route) {
    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    if (location.hash === `#${safeRoute}`) {
        renderCurrentRoute(safeRoute);
        return;
    }

    location.hash = safeRoute;
}

/**
 * Renders the page for the given route into #main-content, then refreshes
 * the cart badge and footer FAQ. For the inventory route it also triggers
 * an async data load.
 *
 * @param {string} route
 */
function renderCurrentRoute(route) {
    const main = document.getElementById('main-content');
    if (!main) {
        return;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    highlightActiveRoute(safeRoute);

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
    renderFooterFaq(safeRoute);
}

/**
 * Populates the footer FAQ list with contextual Q&A items for the current route.
 * Inventory route gets admin-oriented questions; all other routes get
 * student-oriented questions.
 *
 * @param {string} route
 */
function renderFooterFaq(route) {
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
            <p>מגיעים לעמוד התשלום, ממלאים שם פרטי ומשפחה ובוחרים אמצעי תשלום דמה.</p>
        </details>
    `;
}

/**
 * Adds the 'is-active' CSS class to every [data-route-link] whose value
 * matches the given route, and removes it from all others.
 *
 * @param {string} route
 */
function highlightActiveRoute(route) {
    document.querySelectorAll('[data-route-link]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.routeLink === route);
    });
}

/**
 * Reads the current cart item count and updates the #cart-badge element.
 * Hides the badge when the cart is empty; shows it as a flex element otherwise.
 */
function syncHeaderState() {
    const cartBadge = document.getElementById('cart-badge');
    const cartCount = getCartItemCount();

    if (cartBadge) {
        cartBadge.textContent = String(cartCount);
        cartBadge.style.display = cartCount === 0 ? 'none' : 'flex';
    }
}

// ===== Notice Banner =====

/**
 * Displays a dismissible notice banner above the main content area.
 * The banner auto-hides after 3.2 seconds. Calling this while a notice is
 * already visible resets the timer.
 *
 * @param {string} message - Text to display in the banner
 * @param {'info'|'success'|'error'} [tone='info'] - Controls colour via data-tone attribute
 */
function showNotice(message, tone = 'info') {
    const notice = document.getElementById('app-notice');
    if (!notice) {
        return;
    }

    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;

    window.clearTimeout(noticeTimerId);
    noticeTimerId = window.setTimeout(() => {
        notice.hidden = true;
    }, 3200);
}

// ===== localStorage Helpers =====

/**
 * Reads a value from localStorage and JSON-parses it.
 * Returns fallbackValue when the key is missing or the stored data is invalid.
 *
 * @param {string} storageKey
 * @param {*} fallbackValue - Returned when the key is absent or unparseable
 * @returns {*}
 */
function loadStoredJson(storageKey, fallbackValue) {
    try {
        const rawValue = localStorage.getItem(storageKey);
        return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch {
        return fallbackValue;
    }
}

/**
 * Serialises value to JSON and writes it to localStorage under storageKey.
 *
 * @param {string} storageKey
 * @param {*} value
 */
function saveStoredJson(storageKey, value) {
    localStorage.setItem(storageKey, JSON.stringify(value));
}

// ===== State Loaders =====

/**
 * Loads the cart array from localStorage.
 * Returns an empty array if the stored value is absent or not an array.
 *
 * @returns {Array<{productId: string, quantity: number, rentDays: number}>}
 */
function loadCartState() {
    const cartItems = loadStoredJson(STORAGE_KEYS.cart, []);
    return Array.isArray(cartItems) ? cartItems : [];
}

/**
 * Loads the inventory map from localStorage. If no stored inventory exists,
 * builds a default map from PRODUCTS default stock values and persists it.
 *
 * @returns {Object.<string, number>} productId → stock count
 */
function loadInventoryState() {
    const storedInventory = loadStoredJson(STORAGE_KEYS.inventory, null);
    if (storedInventory && typeof storedInventory === 'object') {
        return ensureInventoryShape(storedInventory);
    }

    const defaultInventory = Object.fromEntries(PRODUCTS.map((product) => [product.id, product.stock]));
    saveStoredJson(STORAGE_KEYS.inventory, defaultInventory);
    return defaultInventory;
}

/**
 * Attempts to synchronise the local inventory with the /api/inventory server
 * endpoint. Silently ignores network failures so the app continues working
 * offline or when the dev server is not running.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Builds a normalised inventory map that contains exactly one entry per
 * known product. Values from the supplied object are carried over; any
 * product not present in the object falls back to its PRODUCTS default stock.
 * The result is persisted to localStorage.
 *
 * @param {Object.<string, number>} inventory - Raw inventory object to normalise
 * @returns {Object.<string, number>}
 */
function ensureInventoryShape(inventory) {
    const normalizedInventory = {};

    PRODUCTS.forEach((product) => {
        const currentValue = Number(inventory[product.id]);
        normalizedInventory[product.id] = Number.isFinite(currentValue) ? currentValue : product.stock;
    });

    saveStoredJson(STORAGE_KEYS.inventory, normalizedInventory);
    return normalizedInventory;
}

// ===== Lookup Helpers =====

/**
 * Finds and returns a product definition by its ID.
 *
 * @param {string} productId
 * @returns {Object|null} Product object, or null if not found
 */
function getProductById(productId) {
    return PRODUCTS.find((product) => product.id === productId) || null;
}

/**
 * Finds and returns the cart entry for the given product ID.
 *
 * @param {string} productId
 * @returns {Object|null} Cart item object, or null if the product is not in the cart
 */
function getCartItemByProductId(productId) {
    return appState.cart.find((item) => item.productId === productId) || null;
}

/**
 * Sums the quantity field across all cart entries.
 *
 * @returns {number} Total number of individual items in the cart
 */
function getCartItemCount() {
    return appState.cart.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Returns the current stock level for a product from the local inventory state.
 *
 * @param {string} productId
 * @returns {number}
 */
function getInventoryStock(productId) {
    return Number(appState.inventory[productId] || 0);
}

/**
 * Returns the stock available for adding to the cart, subtracting units
 * already reserved in the cart to prevent over-ordering.
 *
 * @param {string} productId
 * @returns {number}
 */
function getAvailableStock(productId) {
    const cartQuantity = getCartQuantity(productId);
    return Math.max(0, getInventoryStock(productId) - cartQuantity);
}

/**
 * Returns how many units of the given product are currently in the cart, or 0.
 *
 * @param {string} productId
 * @returns {number}
 */
function getCartQuantity(productId) {
    const cartItem = getCartItemByProductId(productId);
    return cartItem ? cartItem.quantity : 0;
}

// ===== State Persistence =====

/**
 * Persists the current cart array to localStorage and refreshes the cart badge.
 */
function saveCartState() {
    saveStoredJson(STORAGE_KEYS.cart, appState.cart);
    syncHeaderState();
}

/**
 * Persists the current inventory map to localStorage, refreshes the cart badge,
 * and fires a non-blocking POST to the dev API when it is available.
 */
function saveInventoryState() {
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);
    syncHeaderState();
    try {
        fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appState.inventory),
        }).catch(() => {});
    } catch {}
}

// ===== Rent-Day Preferences =====

/**
 * Stores the user's chosen rental duration for a product in localStorage.
 *
 * @param {string} productId
 * @param {1|2|3} days - Number of rental days selected
 */
function setRentDaysPreference(productId, days) {
    appState.rentDaysByProductId[productId] = days;
    saveStoredJson(STORAGE_KEYS.rentDays, appState.rentDaysByProductId);
}

/**
 * Returns the stored rental-day preference for a product.
 * Defaults to 1 if no valid preference (1, 2, or 3) is found.
 *
 * @param {string} productId
 * @returns {1|2|3}
 */
function getRentDaysPreference(productId) {
    const selectedDays = Number(appState.rentDaysByProductId[productId]);
    return [1, 2, 3].includes(selectedDays) ? selectedDays : 1;
}

// ===== Cart Operations =====

/**
 * Adds a product to the cart, or increments its quantity if already present.
 * Applies the current rent-day preference for rental items. Shows an error
 * notice when the product is out of stock, and a success notice on add.
 * Re-renders the catalog or cart depending on the current route.
 *
 * @param {string} productId
 */
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
        cartItem.rentDays = getRentDaysPreference(productId);
    } else {
        appState.cart.push({
            productId: product.id,
            quantity: 1,
            rentDays: getRentDaysPreference(productId),
        });
    }

    saveCartState();
    showNotice(`${product.name} נוסף לעגלה.`, 'success');
    // Only re-render if the user is already viewing the cart; the badge
    // is already updated by saveCartState() → syncHeaderState()
    if (getRouteFromHash() === 'cart') {
        renderCurrentRoute('cart');
    }
}

/**
 * Adjusts the quantity of an existing cart item by delta. Removes the item
 * when the result would be 0 or below. Shows an error when the requested
 * quantity exceeds available stock.
 *
 * @param {string} productId
 * @param {number} delta - Positive to increase, negative to decrease
 */
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

/**
 * Removes the cart entry for the given product and re-renders the cart page.
 *
 * @param {string} productId
 */
function removeCartItem(productId) {
    appState.cart = appState.cart.filter((item) => item.productId !== productId);
    saveCartState();
    renderCurrentRoute('cart');
}

/**
 * Empties all items from the cart and persists the empty state.
 */
function clearCart() {
    appState.cart = [];
    saveCartState();
}

// ===== Price Calculations =====

/**
 * Calculates the line-item total for a cart entry:
 * price × quantity × rentDays (rentDays is always 1 for purchase-type products).
 *
 * @param {{productId: string, quantity: number, rentDays: number}} cartItem
 * @returns {number}
 */
function calculateCartItemTotal(cartItem) {
    const product = getProductById(cartItem.productId);
    if (!product) {
        return 0;
    }

    return product.price * cartItem.quantity * (cartItem.rentDays || 1);
}

/**
 * Returns the grand total of all cart item totals.
 *
 * @returns {number}
 */
function calculateCartTotal() {
    return appState.cart.reduce((total, cartItem) => total + calculateCartItemTotal(cartItem), 0);
}

// ===== Page Renderers =====

/**
 * Builds and returns the full catalog page HTML. Filters PRODUCTS by the
 * current catalogSearchQuery before rendering.
 *
 * @returns {string} HTML string
 */
function renderCatalogPage() {
    const filteredProducts = PRODUCTS.filter((product) => {
        const searchableText = `${product.name} ${product.description} ${product.searchTerms}`.toLowerCase();
        return searchableText.includes(appState.catalogSearchQuery.toLowerCase());
    });

    return `
        <div class="fade-in">
            <div class="catalog-header-wrapper">
                <div class="catalog-header">
                    <div class="catalog-title">
                        <h2 class="catalog-main-title">קטלוג ציוד אקדמי</h2>
                        <p class="catalog-subtitle">${PRODUCTS.length} מוצרים זמינים להשכרה ולרכישה</p>
                    </div>
                    <div class="catalog-actions">
                        <input
                            type="text"
                            class="catalog-search-input"
                            placeholder="חיפוש ציוד..."
                            value="${escapeHtml(appState.catalogSearchQuery)}"
                            data-catalog-search-input
                        >
                        <button class="btn btn-primary" type="button" data-action="catalog-search">חפש</button>
                    </div>
                </div>
            </div>
            <div class="catalog-grid">
                ${filteredProducts.map(renderProductCard).join('') || renderEmptyCatalogState()}
            </div>
        </div>
    `;
}

/**
 * Renders a single product card, including media, name, description, badges,
 * price, an optional rent-day selector, and an add-to-cart button.
 *
 * @param {Object} product - A product definition from PRODUCTS
 * @returns {string} HTML string for one <article> card
 */
function renderProductCard(product) {
    const selectedDays = getRentDaysPreference(product.id);
    const stock = getInventoryStock(product.id);
    const isLowStock = stock <= 2;
    const stockLabel = isLowStock ? `נותרו ${stock} בלבד` : `${stock} במלאי`;
    const typeLabel = product.type === 'rent' ? 'השכרה' : 'רכישה';

    const mediaHtml = product.image
        ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image">`
        : `<div class="product-icon">${escapeHtml(product.visual)}</div>`;

    const priceHtml = `${product.price}<span class="product-currency">₪</span><span class="price-per-day"> ליום</span>`;

    return `
        <article class="product-card">
            ${mediaHtml}
            <h3 class="product-name">${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <div class="product-meta">
                <div class="badges-row">
                    <span class="type-badge ${product.type}">${escapeHtml(typeLabel)}</span>
                    <span class="stock-info${isLowStock ? ' low' : ''}">${escapeHtml(stockLabel)}</span>
                </div>
                <div class="product-price">${priceHtml}</div>
            </div>
            ${renderRentDaySelector(product.id, selectedDays)}
            <button type="button" class="btn btn-primary btn-block add-to-cart-btn"
                data-action="add-to-cart"
                data-product-id="${escapeHtml(product.id)}">
                הוסף לסל
            </button>
        </article>
    `;
}

/**
 * Renders the rental-day selector widget (1 / 2 / 3 day buttons + running
 * total) for a rentable product. The currently selected day count receives
 * the 'active' CSS class.
 *
 * @param {string} productId
 * @param {1|2|3} selectedDays - Currently active day count
 * @returns {string} HTML string
 */
function renderRentDaySelector(productId, selectedDays) {
    const product = getProductById(productId);
    const total = product ? product.price * selectedDays : 0;
    return `
        <div class="rent-days-selector">
            <label>מספר ימים:</label>
            <div class="days-buttons">
                ${[1, 2, 3].map((days) => `
                    <button
                        type="button"
                        class="day-btn${days === selectedDays ? ' active' : ''}"
                        data-action="select-rent-days"
                        data-product-id="${escapeHtml(productId)}"
                        data-days="${days}"
                    >${days}</button>
                `).join('')}
            </div>
            <span class="rent-total-label">סה"כ: <span class="rent-total-value">${total}</span> ₪</span>
        </div>
    `;
}

/**
 * Returns the empty-state markup shown inside the catalog grid when no
 * products match the current search query.
 *
 * @returns {string} HTML string
 */
function renderEmptyCatalogState() {
    return `
        <div class="empty-state" style="grid-column: 1/-1;">
            <h2>לא נמצאו מוצרים</h2>
            <p>נסה מונח חיפוש אחר.</p>
        </div>
    `;
}

/**
 * Renders the cart page. Shows an empty-state section when the cart has no
 * items, otherwise renders item cards alongside an order summary panel.
 *
 * @returns {string} HTML string
 */
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

/**
 * Renders a single cart item card with quantity controls and a remove button.
 * Returns an empty string if the referenced product no longer exists.
 *
 * @param {{productId: string, quantity: number, rentDays: number}} cartItem
 * @returns {string} HTML string
 */
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
                    <span>${cartItem.rentDays} ימים</span>
                    <span>${product.price} ₪ / ליום</span>
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

/**
 * Renders the checkout page with a customer details form, mock payment
 * buttons, and an order preview panel. Returns an empty-state page when
 * the cart is empty.
 *
 * @returns {string} HTML string
 */
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
                <p>מלא את שמך ובחר בשיטת תשלום דמה. תשלום מוצלח יהיה לך לשליטה על לוקר.</p>
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

/**
 * Validates the checkout form, checks stock availability, deducts inventory,
 * clears the cart, saves checkout context to localStorage, and navigates to
 * the locker page. Shows appropriate error notices on validation failure.
 * Called when a payment button is clicked on the checkout page.
 *
 * @param {string} provider - Payment provider label displayed to the user (e.g. 'Apple Pay')
 */
function processMockPayment(provider) {
    const checkoutForm = document.querySelector('[data-checkout-form]');
    if (!checkoutForm) {
        return;
    }

    const firstName = checkoutForm.querySelector('input[name="firstName"]').value.trim();
    const lastName = checkoutForm.querySelector('input[name="lastName"]').value.trim();

    if (!firstName || !lastName) {
        showNotice('שם פרטי ושם משפחה הם שדות חובה.', 'error');
        return;
    }

    if (appState.cart.length === 0) {
        showNotice('העגלה שלך ריקה.', 'error');
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
    saveStoredJson('agugo.checkoutContext', {
        customerName: `${firstName} ${lastName}`,
        provider,
        purchasedItems,
        createdAt: new Date().toISOString(),
    });

    showNotice(`תשלום ${provider} אושר. הפנייה לשליטה על לוקר.`, 'success');
    navigateToRoute('locker');
}

/**
 * Renders the locker control page with open/close action buttons and a
 * status chip that reflects the current appState.lockerOpen value.
 *
 * @returns {string} HTML string
 */
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

/**
 * Handles open/close locker commands issued from the locker control page.
 * Sends the servo command, updates appState.lockerOpen, updates the status
 * text in the DOM, shows a notice, and re-renders the page.
 *
 * @param {'open'|'close'} command
 */
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

/**
 * Sends an HTTP POST to the ESP32 servo endpoint at ESP32_BASE_URL.
 * Returns a mocked response object when the endpoint is unreachable so
 * that the UI can continue functioning without hardware.
 *
 * @param {'open'|'close'} command
 * @returns {Promise<Object>}
 */
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

/**
 * Renders the product return page, including a form for customer details,
 * a product selector, a file upload field, locker control buttons, and a
 * sidebar showing the stock impact of the pending return.
 *
 * @returns {string} HTML string
 */
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

/**
 * Triggered when the product select changes on the return page. Updates the
 * return status text and the stock impact summary to reflect the newly
 * chosen product.
 */
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
        status.textContent = `${product.name} נבחר להחזרה.`;
    }

    if (summaryStrong) {
        summaryStrong.textContent = String(getInventoryStock(product.id));
    }

    if (summaryProductName) {
        summaryProductName.textContent = product.name;
    }
}

/**
 * Increments the local inventory count for a returned product by 1 and
 * saves the updated state.
 *
 * @param {string} productId
 */
function incrementInventoryForReturn(productId) {
    appState.inventory[productId] = getInventoryStock(productId) + 1;
    saveInventoryState();
}

// ===== Inventory Management Page =====

/**
 * Renders the inventory management page shell, which contains a section
 * selector dropdown and an empty panel placeholder populated asynchronously
 * by loadInventoryDashboardData().
 *
 * @returns {string} HTML string
 */
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

    `;
}

/**
 * Fetches all orders from /api/orders, computes a dashboard summary via
 * buildInventoryDashboardSummary(), and triggers a panel re-render. Uses a
 * monotonically increasing dashboardFetchId to discard responses from
 * superseded fetches.
 *
 * @returns {Promise<void>}
 */
async function loadInventoryDashboardData() {
    const requestId = ++dashboardFetchId;

    try {
        const response = await fetch('/api/orders');
        if (!response.ok) {
            throw new Error(`Failed to load orders (${response.status})`);
        }

        const orders = await response.json();
        if (requestId !== dashboardFetchId) {
            return;
        }

        const summary = buildInventoryDashboardSummary(orders);
        dashboardSummary = summary;
        renderInventoryDashboardView();
    } catch (error) {
        if (requestId !== dashboardFetchId) {
            return;
        }

        dashboardSummary = null;
        renderInventoryDashboardView(true);
    }
}

/**
 * Processes a raw orders array into aggregate statistics used by the dashboard:
 * active rentals (items whose rental period has not yet expired), total rented
 * units, total sold units, and total sales revenue.
 *
 * @param {Array<Object>} orders - Order objects returned by /api/orders
 * @returns {{ activeRentals: Array, rentedUnits: number, soldUnits: number, salesRevenue: number }}
 */
function buildInventoryDashboardSummary(orders) {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
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
                const dueAt = startedAt + (rentDays * msPerDay);
                const remainingMs = dueAt - now;

                if (remainingMs > 0) {
                    const remainingDays = Math.max(1, Math.ceil(remainingMs / msPerDay));
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

/**
 * Writes the latest summary values into the stat card elements already in
 * the DOM. Each element is addressed by ID. No-ops gracefully when elements
 * are not present (e.g. when a different section is active).
 *
 * @param {{ activeRentals: Array, rentedUnits: number, soldUnits: number, salesRevenue: number }} summary
 */
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

/**
 * Re-renders the #inventory-dashboard-panel div using the current values of
 * activeDashboardSection and dashboardSummary. Also syncs the section select
 * dropdown to match activeDashboardSection.
 *
 * @param {boolean} [isError=false] - When true, renders error states in the panel
 */
function renderInventoryDashboardView(isError = false) {
    const panel = document.getElementById('inventory-dashboard-panel');
    const select = document.getElementById('inventory-section-select');

    if (!panel || !select) {
        return;
    }

    select.value = activeDashboardSection;
    const section = activeDashboardSection || 'summary';
    panel.innerHTML = renderInventoryDashboardPanel(section, dashboardSummary, isError);
}

/**
 * Returns the HTML for one of three dashboard sections:
 * - 'rentals': table of currently active rental orders
 * - 'inventory': editable product table with edit/remove buttons and add modal
 * - 'summary' (default): four aggregate stat cards
 *
 * @param {'summary'|'rentals'|'inventory'} section
 * @param {Object|null} summary - Output of buildInventoryDashboardSummary, or null on error
 * @param {boolean} [isError=false]
 * @returns {string} HTML string
 */
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
            const statusText = stock <= 2 ? 'נמוך' : 'תקין';
            return `
                <tr data-product-id="${product.id}">
                    <td>${escapeHtml(product.name)}</td>
                    <td>${escapeHtml(product.categoryLabel)}</td>
                    <td>${stock}</td>
                    <td><span class="stock-pill ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="action-button edit-stock-btn" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}">✏️ עריכה</button>
                        <button class="action-button remove-product-btn" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}">❌ הסרה</button>
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
                <button class="primary-button" id="add-product-btn">➕ הוסף מוצר חדש</button>
            </div>

            <div class="table-wrap">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>מוצר</th>
                            <th>סוג</th>
                            <th>מלאי</th>
                            <th>סטטוס</th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventoryRows}
                    </tbody>
                </table>
            </div>

            <div id="edit-stock-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <h2>עדכון מלאי</h2>
                    <form id="edit-stock-form">
                        <div>
                            <label>שם המוצר</label>
                            <input type="text" id="edit-product-name" readonly style="background: #f0f0f0;">
                        </div>
                        <div>
                            <label>כמות במלאי</label>
                            <input type="number" id="edit-stock-input" min="0" required>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="primary-button">שמירה</button>
                            <button type="button" class="secondary-button" onclick="closeEditModal()">ביטול</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="add-product-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <h2>הוספת מוצר חדש</h2>
                    <form id="add-product-form">
                        <div>
                            <label>שם המוצר</label>
                            <input type="text" id="new-product-name" required>
                        </div>
                        <div>
                            <label>סוג</label>
                            <select id="new-product-type" required>
                                <option value="">בחר...</option>
                                <option value="rent">השכרה</option>
                                <option value="buy">רכישה</option>
                            </select>
                        </div>
                        <div>
                            <label>מלאי התחלתי</label>
                            <input type="number" id="new-product-stock" min="0" value="0" required>
                        </div>
                        <div>
                            <label>מחיר (₪)</label>
                            <input type="number" id="new-product-price" min="0" step="0.01" value="0" required>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="primary-button">הוסף מוצר</button>
                            <button type="button" class="secondary-button" onclick="closeAddModal()">ביטול</button>
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

/**
 * Populates the #inventory-active-rentals-list element with rental row cards.
 * Renders an empty-state div when the list is empty.
 *
 * @param {Array} activeRentals
 */
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

// ===== Utilities =====

/**
 * Formats an ISO date string into a Hebrew locale short date (he-IL).
 * Returns '-' for null, undefined, or unparseable input.
 *
 * @param {string|null} value - ISO 8601 date string
 * @returns {string}
 */
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

/**
 * Escapes HTML special characters in value to prevent XSS when inserting
 * dynamic content into innerHTML.
 *
 * @param {*} value - Any value; coerced to string
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// ===== Return Flow =====

/**
 * Reads and validates all fields on the return form. Returns a data object
 * when every required field (first name, last name, product selection, and
 * an uploaded image file) is present; shows an appropriate error notice and
 * returns null when any field is missing.
 *
 * @returns {{ firstName: string, lastName: string, product: Object, selectedFile: File }|null}
 */
function collectReturnFormData() {
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

/**
 * Increments the returned product's inventory and shows a success notice.
 * No-ops silently when product is null.
 *
 * @param {Object|null} product
 */
function finalizeReturn(product) {
    if (!product) {
        return;
    }

    incrementInventoryForReturn(product.id);
    showNotice(`${product.name} הוחזר והוסף חזרה למלאי.`, 'success');
    renderCurrentRoute('return');
}

/**
 * Handles a locker button command ('open' or 'close') from the return page.
 * 'open' sends the servo command and updates the status message.
 * 'close' first validates the return form via collectReturnFormData(); if
 * valid, sends the servo command and finalises the return.
 *
 * @param {'open'|'close'} command
 * @returns {boolean} Always true — the command is fully handled by this function
 */
function handleReturnLockerCommand(command) {
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
        const returnData = collectReturnFormData();
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

/**
 * Dispatches a locker command when the active route is the return page.
 * Delegates to handleReturnLockerCommand; falls back to
 * operateLockerFromCurrentPage for any unrecognised command.
 *
 * @param {'open'|'close'} command
 */
function operateLockerFromReturnPage(command) {
    if (handleReturnLockerCommand(command)) {
        return;
    }

    operateLockerFromCurrentPage(command);
}

/**
 * Reads the last checkout session from localStorage and returns a one-line
 * Hebrew summary string for display in the locker context area.
 *
 * @returns {string}
 */
function createLockerContextSummary() {
    const checkoutContext = loadStoredJson('agugo.checkoutContext', null);
    if (!checkoutContext) {
        return 'לא נמצאה הזמנה אחרונה.';
    }

    return `תשלום אחרון: ${checkoutContext.customerName} באמצעות ${checkoutContext.provider}`;
}

/**
 * Returns an HTML-escaped version of the locker context summary string.
 *
 * @returns {string}
 */
function renderLockerContextMessage() {
    return escapeHtml(createLockerContextSummary());
}

/**
 * Returns a stock status badge HTML snippet. Stock ≤ 2 yields a 'נמוך'
 * (low) badge; higher stock yields a 'תקין' (ok) badge.
 *
 * @param {number} stock
 * @returns {string} HTML string
 */
function renderInventoryStatusBadge(stock) {
    return stock <= 2 ? '<span class="stock-pill stock-low">נמוך</span>' : '<span class="stock-pill stock-ok">תקין</span>';
}

// ===== Legacy / Unused Stubs =====

/**
 * Processes a locker command for the currently active route. Delegates to
 * the return-page handler when on the return route, otherwise to the default
 * locker handler.
 *
 * @param {'open'|'close'} command
 */
function processPageSpecificCommands(command) {
    const currentRoute = getRouteFromHash();

    if (currentRoute === 'return') {
        const handled = handleReturnLockerCommand(command);
        if (handled) {
            return;
        }
    }

    operateLockerFromCurrentPage(command);
}

/** Triggers a re-render of the current route without changing the hash. */
function renderInitialRouteIfNeeded() {
    const route = getRouteFromHash();
    renderCurrentRoute(route);
}

/**
 * Increments inventory for the product currently selected in the return form.
 * Convenience wrapper used by supplemental handlers.
 */
function updateReturnProductStockAfterClose(productId) {
    incrementInventoryForReturn(productId);
    saveInventoryState();
}

/**
 * Alternative checkout payment processor. Validates the form, checks stock,
 * deducts inventory, saves context, clears the cart, and navigates to the
 * locker page. Mirrors processMockPayment but saves a slightly different
 * context shape.
 *
 * @param {string} provider
 */
function processCheckoutPayment(provider) {
    const checkoutForm = document.querySelector('[data-checkout-form]');
    if (!checkoutForm) {
        return;
    }

    const firstName = checkoutForm.querySelector('input[name="firstName"]').value.trim();
    const lastName = checkoutForm.querySelector('input[name="lastName"]').value.trim();

    if (!firstName || !lastName) {
        showNotice('שם פרטי ושם משפחה הם שדות חובה.', 'error');
        return;
    }

    if (appState.cart.length === 0) {
        showNotice('העגלה שלך ריקה.', 'error');
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
    saveStoredJson('agugo.checkoutContext', {
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

/**
 * Handles a data-action click by routing it to the correct handler.
 * Returns true when the action was handled, false otherwise.
 *
 * @param {string} action - Value of data-action on the clicked element
 * @param {DOMStringMap} dataset - The element's dataset
 * @returns {boolean}
 */
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

/** Attaches a supplemental delegated click listener for route actions. */
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

/**
 * Renders the given route into the main content slot, preserving any
 * existing app state.
 *
 * @param {string} route
 */
function renderRouteAndKeepState(route) {
    const safeRoute = ROUTES.has(route) ? route : getDefaultRoute();
    renderCurrentRoute(safeRoute);
}

/**
 * Builds a simple delta descriptor object used when updating a single
 * product's inventory count.
 *
 * @param {string} productId
 * @param {number} delta
 * @returns {{ productId: string, delta: number }}
 */
function buildInventoryUpdateMap(productId, delta) {
    return {
        productId,
        delta,
    };
}

/**
 * Reads the currently selected product from the return form and increments
 * its inventory. Used as a convenience wrapper by supplemental handlers.
 */
function updateReturnInventoryFromSelection() {
    const select = document.querySelector('[data-return-product-select]');
    if (!select) {
        return;
    }

    const productId = select.value;
    updateReturnProductStockAfterClose(productId);
}

/**
 * Finalises a return triggered by the locker-close command: validates the
 * form, sends the servo command, increments inventory, saves state, and
 * shows a success notice.
 */
function handleReturnCloseCommand() {
    const returnData = collectReturnFormData();
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

/**
 * Routes a locker command on the return page to the appropriate sub-handler.
 * 'close' triggers handleReturnCloseCommand; 'open' sends the open command
 * and shows a notice.
 *
 * @param {'open'|'close'} command
 * @returns {boolean} true when the command was handled
 */
function maybeUpdateReturnStatusFromCommand(command) {
    if (command === 'close') {
        handleReturnCloseCommand();
        return true;
    }

    if (command === 'open') {
        sendLockerServoCommand('open');
        appState.lockerOpen = true;
        showNotice('לוקר ההחזרה נפתח.', 'success');
        return true;
    }

    return false;
}

/** Placeholder for future shared behaviour wired up at startup. */
function attachSupplementalHandlers() {
    // Intentionally left blank for future shared behavior.
}

// ===== Inventory Management Modal Functions =====

/**
 * Opens the edit-stock modal and pre-fills it with the given product's name
 * and current stock level. Stores the productId on the stock input via
 * dataset for use by handleEditStockSubmit().
 *
 * @param {string} productId
 * @param {string} productName
 */
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

/**
 * Closes the edit-stock modal by setting its display style to 'none'.
 * Exposed on window so it can be called from the inline onclick attribute.
 */
function closeEditModal() {
    const modal = document.getElementById('edit-stock-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Opens the add-product modal and resets its form fields to their defaults.
 */
function openAddModal() {
    const modal = document.getElementById('add-product-modal');
    const form = document.getElementById('add-product-form');
    if (modal && form) {
        form.reset();
        modal.style.display = 'flex';
    }
}

/**
 * Closes the add-product modal. Exposed on window so it can be called from
 * the inline onclick attribute.
 */
function closeAddModal() {
    const modal = document.getElementById('add-product-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Reads the edit-stock modal fields, validates the new stock value, updates
 * appState.inventory, persists to localStorage, shows a notice, closes the
 * modal, and re-renders the inventory page.
 * Triggered by the edit-stock form submit event.
 */
function handleEditStockSubmit() {
    const stockField = document.getElementById('edit-stock-input');
    if (!stockField || !stockField.dataset.productId) {
        showNotice('שגיאה: מזהה מוצר לא נמצא', 'error');
        return;
    }

    const productId = stockField.dataset.productId;
    const newStock = parseInt(stockField.value, 10);

    if (isNaN(newStock) || newStock < 0) {
        showNotice('אנא הזן כמות מלאי חוקית', 'error');
        return;
    }

    appState.inventory[productId] = newStock;
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);

    showNotice(`המלאי עודכן! ${PRODUCTS.find(p => p.id === productId)?.name || productId} כעת: ${newStock} יחידות.`, 'success');
    closeEditModal();
    renderCurrentRoute('inventory');
}

/**
 * Reads the add-product modal fields, validates all inputs, creates a new
 * product entry in PRODUCTS, adds it to appState.inventory, persists state,
 * shows a notice, closes the modal, and re-renders the inventory page.
 * Triggered by the add-product form submit event.
 */
function handleAddProductSubmit() {
    const nameField = document.getElementById('new-product-name');
    const typeField = document.getElementById('new-product-type');
    const stockField = document.getElementById('new-product-stock');
    const priceField = document.getElementById('new-product-price');

    if (!nameField || !typeField || !stockField || !priceField) {
        showNotice('שגיאה: שדות הטופס לא נמצאו', 'error');
        return;
    }

    const name = nameField.value.trim();
    const type = typeField.value;
    const stock = parseInt(stockField.value, 10);
    const price = parseFloat(priceField.value);

    if (!name) {
        showNotice('אנא הזן שם מוצר', 'error');
        return;
    }
    if (!type) {
        showNotice('אנא בחר סוג מוצר', 'error');
        return;
    }
    if (isNaN(stock) || stock < 0) {
        showNotice('אנא הזן כמות מלאי חוקית', 'error');
        return;
    }
    if (isNaN(price) || price < 0) {
        showNotice('אנא הזן מחיר חוקי', 'error');
        return;
    }

    const newId = `p${String(PRODUCTS.length + 1).padStart(3, '0')}`;

    const newProduct = {
        id: newId,
        name: name,
        description: `${name} - נוסף ${new Date().toLocaleDateString('he-IL')}`,
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

    showNotice(`✅ המוצר "${name}" נוסף בהצלחה!`, 'success');
    closeAddModal();
    renderCurrentRoute('inventory');
}

/**
 * Removes a product from the PRODUCTS array and from appState.inventory,
 * persists the updated inventory, shows a notice, and re-renders the
 * inventory page.
 *
 * @param {string} productId
 */
function removeProduct(productId) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
        showNotice('מוצר לא נמצא', 'error');
        return;
    }

    const index = PRODUCTS.indexOf(product);
    if (index > -1) {
        PRODUCTS.splice(index, 1);
    }

    delete appState.inventory[productId];
    saveStoredJson(STORAGE_KEYS.inventory, appState.inventory);

    showNotice(`🗑️ המוצר "${product.name}" הוסר מהמלאי`, 'success');
    renderCurrentRoute('inventory');
}

/**
 * Re-normalises appState.inventory to ensure it contains exactly the entries
 * defined in PRODUCTS. Called once at startup after PRODUCTS is defined.
 */
function finalizeInventorySeed() {
    appState.inventory = ensureInventoryShape(appState.inventory);
}

finalizeInventorySeed();
attachSupplementalHandlers();

// Expose modal closers globally for inline onclick attributes in rendered HTML
window.closeEditModal = closeEditModal;
window.closeAddModal = closeAddModal;
