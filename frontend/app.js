import { CatalogPage } from './pages/CatalogPage.js';
import { CartPage } from './pages/CartPage.js';
import { CheckoutPage } from './pages/CheckoutPage.js';
import { LockerPage } from './pages/LockerPage.js';
import { ReturnPage } from './pages/ReturnPage.js';
import { InventoryPage } from './pages/InventoryPage.js';

// ===== Constants =====

const STORAGE_KEYS = {
    cart:      'agugo.cart',
    inventory: 'agugo.inventory',
    rentDays:  'agugo.rentDays',
    orders:    'agugo.orders',
};

const ESP32_BASE_URL = 'http://localhost:5001';

const ROUTES = new Set(['catalog', 'cart', 'checkout', 'locker', 'return', 'inventory']);

const PRODUCTS = [
    {
        id: 'p001',
        name: 'מחשבון מדעי',
        description: 'Casio fx-991ES - מתאים לכל המבחנים האקדמיים',
        type: 'rent',
        price: 5,
        stock: 20,
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
        stock: 20,
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
        stock: 20,
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
        stock: 20,
        visual: '✏️',
        image: 'catalog/logo-pics/pen.png',
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
        stock: 20,
        visual: '📓',
        image: 'catalog/logo-pics/notebook.png',
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
        stock: 20,
        visual: '🖍️',
        image: 'catalog/logo-pics/marker.png',
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
        stock: 20,
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
        stock: 20,
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
        stock: 20,
        visual: '🔋',
        categoryLabel: 'השכרה',
        rentLabel: 'ליום',
        searchTerms: 'power bank charger mobile battery',
    },
];

// ===== Shared Runtime State =====

/** Mutable runtime state shared across all pages. */
const state = {
    cart: [],
    inventory: {},
    rentDaysByProductId: {},
    lockerOpen: false,
};

/** Master product catalogue; may be extended at runtime via the Inventory page. */
const products = [...PRODUCTS];

// ===== Internal Shell / Routing State =====

let _isShellMounted = false;
let _noticeHideTimerId = null;
let _currentRoute = 'catalog';

/**
 * The currently active page POM instance. Updated on every navigation.
 * All delegated events (click, change, submit) are forwarded to this instance.
 */
let _currentPage = null;

const selectors = {
    main: '#main-content',
    notice: '#app-notice',
    cartBadge: '#cart-badge',
    footerFaq: '#footer-qa-list',
    routeLink: '[data-route-link]',
};

// ===== Initialisation =====

/**
 * Bootstraps the application.
 *
 * Implementation: Loads persisted data from localStorage, renders the
 * application shell, attaches global event listeners, and navigates to the
 * route indicated by the current URL hash (defaulting to 'catalog').
 * The Product Catalog is the designated primary entry point — when no hash
 * is present, a CatalogPage instance is created directly.
 *
 * @returns {void}
 */
function init() {
    state.cart = loadCartState();
    state.inventory = loadInventoryState();
    state.rentDaysByProductId = loadStoredJson(STORAGE_KEYS.rentDays, {});
    state.inventory = normalizeInventory(state.inventory);

    renderAppShell();
    attachGlobalEventListeners();
    updateCartBadge();

    // Browser back/forward navigation: recreate the appropriate page from the URL.
    window.addEventListener('hashchange', () => {
        navigateTo(_createPageByRoute(_getRouteFromHash()));
    });

    // Primary entry point: CatalogPage. Fall back to the hash route if one is present.
    const initialPage = !location.hash
        ? new CatalogPage(appContext)
        : _createPageByRoute(_getRouteFromHash());
    navigateTo(initialPage);
}

// ===== Shell Rendering =====

/**
 * Injects the persistent application shell (header, notice bar, main placeholder, footer)
 * into document.body.
 *
 * Implementation: Builds the full shell HTML as a single string and assigns it to
 * document.body.innerHTML. Idempotent — subsequent calls return immediately if the
 * shell is already mounted.
 *
 * @returns {void}
 */
function renderAppShell() {
    if (_isShellMounted) return;

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

            <div class="fab-group" aria-label="תמיכה טכנית">
                <a href="https://wa.me/972000000000"
                   class="fab fab-whatsapp"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="פנה אלינו בוואטסאפ">
                    <img src="catalog/logo-pics/whatsapp.png" alt="" aria-hidden="true">
                </a>
                <a href="mailto:support@agugo.placeholder"
                   class="fab fab-email"
                   aria-label="שלח לנו אימייל">
                    <img src="catalog/logo-pics/email.png" alt="" aria-hidden="true">
                </a>
            </div>

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
                <div class="footer-grid footer-grid-support">
                    <section class="footer-support-section">
                        <h3>תמיכה טכנית</h3>
                        <p>נתקלת בבעיה טכנית? אנחנו כאן לעזור:</p>
                        <div class="support-actions">
                            <a href="mailto:support@agugo.placeholder" class="support-btn support-btn-email">✉️ שלח אימייל</a>
                            <a href="https://wa.me/972000000000" class="support-btn support-btn-whatsapp">💬 WhatsApp</a>
                        </div>
                    </section>
                </div>
                <div class="footer-bottom">
                    <p class="copyright">© כל הזכויות שמורות - אב טיפוס לפרויקט מערכות מידע</p>
                </div>
            </footer>
        </div>
    `;

    _isShellMounted = true;
}

// ===== Event Delegation =====

/**
 * Attaches delegated event listeners for click, change, and submit events.
 *
 * Implementation: A single document-level click listener intercepts all
 * data-route-link clicks (shell navigation: header, footer) and resolves
 * them through _createPageByRoute + navigateTo. All other events are forwarded
 * to the active page instance (_currentPage) so each POM handles only its own
 * interactions. In-page navigation (e.g. "Proceed to Checkout") is handled by
 * the POM's own semantic navigation methods, not by data-route-link.
 *
 * @returns {void}
 */
function attachGlobalEventListeners() {
    document.addEventListener('click', (event) => {
        const routeEl = event.target.closest(selectors.routeLink);
        if (routeEl) {
            event.preventDefault();
            navigateTo(_createPageByRoute(routeEl.dataset.routeLink));
            return;
        }
        _currentPage?.handleClick(event);
    });

    const main = document.getElementById('main-content');

    main.addEventListener('change', (event) => {
        _currentPage?.handleChange(event);
    });

    main.addEventListener('submit', (event) => {
        _currentPage?.handleSubmit(event);
    });
}

// ===== Navigation =====

/**
 * Navigates to a page POM instance, updating the URL and re-rendering content.
 *
 * Implementation: Sets _currentPage and _currentRoute from the instance, pushes
 * the page's route to the browser history (without triggering the hashchange
 * event), then calls _renderPageContent() to update the DOM. This is the single
 * canonical navigation function — all in-page POM navigation methods call this.
 *
 * @param {Object} pageInstance - An instantiated page POM to navigate to.
 * @returns {void}
 */
function navigateTo(pageInstance) {
    const route = pageInstance.constructor.ROUTE;
    _currentPage = pageInstance;
    _currentRoute = route;
    history.pushState(null, '', `#${route}`);
    _renderPageContent();
}

/**
 * Re-renders the currently active page without changing the URL or page instance.
 *
 * Implementation: Calls _renderPageContent() directly. Used by page POMs after
 * in-place state mutations (e.g. adjusting cart quantity, updating stock) where
 * the page identity does not change but the DOM needs refreshing.
 *
 * @returns {void}
 */
function rerender() {
    _renderPageContent();
}

/**
 * Performs the actual DOM update for the current page.
 *
 * Implementation: Scrolls to top, highlights the active nav link, injects the
 * page's render() output into #main-content, calls the optional afterRender()
 * hook, and refreshes the cart badge and footer FAQ.
 *
 * @returns {void}
 */
function _renderPageContent() {
    const main = document.getElementById('main-content');
    if (!main) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    _highlightActiveRoute(_currentRoute);
    main.innerHTML = _currentPage.render();
    _currentPage.afterRender?.();
    updateCartBadge();
    renderFooterFaq(_currentRoute);
}

/**
 * Creates a fresh page POM instance for the given route string.
 *
 * Implementation: Used by the hashchange handler (browser back/forward) and by
 * shell-level data-route-link clicks (header/footer) where no specific page
 * instance is available. Normal forward navigation goes through each POM's own
 * navigation methods instead.
 *
 * @param {string} route - A route key from ROUTES (e.g. 'cart', 'catalog').
 * @returns {Object} A new page POM instance for the requested route.
 */
function _createPageByRoute(route) {
    switch (route) {
        case 'cart':      return new CartPage(appContext);
        case 'checkout':  return new CheckoutPage(appContext);
        case 'locker':    return new LockerPage(appContext);
        case 'return':    return new ReturnPage(appContext);
        case 'inventory': return new InventoryPage(appContext);
        default:          return new CatalogPage(appContext);
    }
}

// ===== Cart Badge =====

/**
 * Updates the cart badge element to reflect the current total item count.
 *
 * Implementation: Reads the live cart count, sets the badge text, and toggles
 * its visibility — hidden when the cart is empty, visible (flex) otherwise.
 *
 * @returns {void}
 */
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const count = getCartItemCount();
    if (badge) {
        badge.textContent = String(count);
        badge.style.display = count === 0 ? 'none' : 'flex';
    }
}

// ===== Notice Banner =====

/**
 * Displays a temporary auto-dismissing notice message at the top of the page.
 *
 * Implementation: Sets the notice element's text and data-tone attribute, makes
 * it visible, and schedules it to hide after 3.2 seconds. Any pending hide timer
 * is cancelled first so rapid consecutive calls each get a fresh timeout.
 *
 * @param {string} message - The message text to display.
 * @param {'info'|'success'|'error'} [tone='info'] - Visual style applied via data-tone.
 * @returns {void}
 */
function showNotice(message, tone = 'info') {
    const notice = document.getElementById('app-notice');
    if (!notice) return;
    notice.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;
    window.clearTimeout(_noticeHideTimerId);
    _noticeHideTimerId = window.setTimeout(() => { notice.hidden = true; }, 3200);
}

// ===== Footer FAQ =====

/**
 * Renders contextual FAQ accordion items inside the footer's FAQ container.
 *
 * Implementation: The inventory route receives admin-oriented FAQs; every other
 * route receives the standard student-facing FAQs.
 *
 * @param {string} route - The currently active route key.
 * @returns {void}
 */
function renderFooterFaq(route) {
    const list = document.getElementById('footer-qa-list');
    if (!list) return;

    if (route === 'inventory') {
        list.innerHTML = `
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

    list.innerHTML = `
        <details class="footer-qa-item">
            <summary>איך שוכרים מוצר?</summary>
            <p>נכנסים לקטלוג, בוחרים פריט, מוסיפים לסל וממשיכים לתשלום.</p>
        </details>
        <details class="footer-qa-item">
            <summary>איך מחזירים מוצר?</summary>
            <p>נכנסים לעמוד "החזרת מוצר", ממלאים שם ובוחרים פריט, פותחים את הלוקר, מניחים את הפריטים, מצלמים ונועלים.</p>
        </details>
        <details class="footer-qa-item">
            <summary>איך משלמים?</summary>
            <p>מגיעים לעמוד התשלום, ממלאים שם פרטי ומשפחה ובוחרים אמצעי תשלום דמה.</p>
        </details>
    `;
}

// ===== Private Routing Helpers =====

/**
 * Reads the current URL hash and returns the matching route key.
 *
 * Implementation: Strips the leading '#' and any query string, then validates
 * against ROUTES. Falls back to _getDefaultRoute() if unrecognised.
 *
 * @returns {string} A valid route key from ROUTES.
 */
function _getRouteFromHash() {
    const route = location.hash.replace('#', '').split('?')[0];
    return ROUTES.has(route) ? route : _getDefaultRoute();
}

/**
 * Returns the application's default route.
 *
 * Implementation: Reads an optional override from document.body's
 * data-default-route attribute, validated against ROUTES, with 'catalog' as
 * the ultimate fallback.
 *
 * @returns {string} A valid route key from ROUTES.
 */
function _getDefaultRoute() {
    const def = document.body.dataset.defaultRoute || 'catalog';
    return ROUTES.has(def) ? def : 'catalog';
}

/**
 * Toggles the 'is-active' CSS class on navigation link elements.
 *
 * @param {string} route - The currently active route key.
 * @returns {void}
 */
function _highlightActiveRoute(route) {
    document.querySelectorAll(selectors.routeLink).forEach((el) => {
        el.classList.toggle('is-active', el.dataset.routeLink === route);
    });
}

// ===== localStorage Helpers =====

/**
 * Reads and JSON-parses a value from localStorage.
 *
 * Implementation: Returns fallback when the key is absent or JSON.parse throws.
 *
 * @param {string} key - The localStorage key to read.
 * @param {*} fallback - The value to return on failure.
 * @returns {*} The parsed stored value, or fallback.
 */
function loadStoredJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Serialises a value to JSON and writes it to localStorage.
 *
 * @param {string} key - The localStorage key to write.
 * @param {*} value - The value to serialise and store.
 * @returns {void}
 */
function saveStoredJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ===== State Loaders =====

/**
 * Loads the persisted cart array from localStorage.
 *
 * Implementation: Parses stored JSON and validates the type. Returns an empty
 * array when nothing is stored or the stored value is not an array.
 *
 * @returns {Array} The persisted cart items, or an empty array.
 */
function loadCartState() {
    const items = loadStoredJson(STORAGE_KEYS.cart, []);
    return Array.isArray(items) ? items : [];
}

/**
 * Loads the persisted inventory map from localStorage, initialising defaults
 * when no stored data is found.
 *
 * Implementation: When stored inventory exists it is passed through
 * normalizeInventory(). When absent, a defaults map built from catalogue stock
 * values is created and persisted.
 *
 * @returns {Object.<string, number>} Map of product ID → stock count.
 */
function loadInventoryState() {
    const stored = loadStoredJson(STORAGE_KEYS.inventory, null);
    if (stored && typeof stored === 'object') {
        return normalizeInventory(stored);
    }
    const defaults = Object.fromEntries(products.map((p) => [p.id, p.stock]));
    saveStoredJson(STORAGE_KEYS.inventory, defaults);
    return defaults;
}

/**
 * Persists the current cart to localStorage and refreshes the cart badge.
 *
 * @returns {void}
 */
function saveCartState() {
    saveStoredJson(STORAGE_KEYS.cart, state.cart);
    updateCartBadge();
}

/**
 * Persists the current inventory to localStorage, refreshes the cart badge,
 * and fires a best-effort POST to /api/inventory to sync the backend.
 *
 * Implementation: Network failure is intentionally swallowed — localStorage
 * is the authoritative source of truth for this prototype.
 *
 * @returns {void}
 */
function saveInventoryState() {
    saveStoredJson(STORAGE_KEYS.inventory, state.inventory);
    updateCartBadge();
    try {
        fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.inventory),
        }).catch(() => {});
    } catch {}
}

/**
 * Ensures every known product has a valid numeric stock entry in the inventory map.
 *
 * Implementation: Iterates all products; non-finite values fall back to the
 * catalogue default. The normalised result is saved to localStorage.
 *
 * @param {Object.<string, number>} inventory - The raw inventory map to normalise.
 * @returns {Object.<string, number>} A new map with all known products present.
 */
function normalizeInventory(inventory) {
    const normalized = {};
    products.forEach((product) => {
        const val = Number(inventory[product.id]);
        normalized[product.id] = Number.isFinite(val) ? val : product.stock;
    });
    saveStoredJson(STORAGE_KEYS.inventory, normalized);
    return normalized;
}

// ===== Lookup Helpers =====

/**
 * Finds a product by its unique ID.
 *
 * @param {string} id - The product ID to look up.
 * @returns {Object|null} The matching product object, or null if not found.
 */
function getProductById(id) {
    return products.find((p) => p.id === id) || null;
}

/**
 * Finds the cart entry that corresponds to a given product ID.
 *
 * @param {string} id - The product ID to search for in the cart.
 * @returns {Object|null} The matching cart item, or null if not in the cart.
 */
function getCartItemByProductId(id) {
    return state.cart.find((item) => item.productId === id) || null;
}

/**
 * Calculates the total number of individual units across all cart entries.
 *
 * @returns {number} The sum of all cart item quantities.
 */
function getCartItemCount() {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Returns the raw inventory stock count for a product.
 *
 * @param {string} id - The product ID.
 * @returns {number} Stock count, or 0 if not tracked.
 */
function getInventoryStock(id) {
    return Number(state.inventory[id] || 0);
}

/**
 * Returns the stock available for a product after subtracting cart reservations.
 *
 * Implementation: Available = inventory stock − cart quantity, clamped to 0.
 *
 * @param {string} id - The product ID.
 * @returns {number} Units still available to add to the cart.
 */
function getAvailableStock(id) {
    return Math.max(0, getInventoryStock(id) - getCartQuantity(id));
}

/**
 * Returns the quantity of a product currently held in the cart.
 *
 * @param {string} id - The product ID.
 * @returns {number} Quantity in cart, or 0 if absent.
 */
function getCartQuantity(id) {
    const item = getCartItemByProductId(id);
    return item ? item.quantity : 0;
}

// ===== Cart Operations =====

/**
 * Adds one unit of the specified product to the cart (state only — no re-render).
 *
 * Implementation: Validates product existence and available stock. Increments
 * quantity and updates rentDays if the product is already in the cart; otherwise
 * pushes a new entry. Shows a success or error notice. The calling page POM is
 * responsible for any re-render it needs after this call.
 *
 * @param {string} productId - The ID of the product to add.
 * @returns {void}
 */
function addProductToCart(productId) {
    const product = getProductById(productId);
    if (!product) {
        showNotice('מוצר לא נמצא.', 'error');
        return;
    }

    if (getAvailableStock(productId) <= 0) {
        showNotice('מוצר זה אינו זמין כרגע.', 'error');
        return;
    }

    const cartItem = getCartItemByProductId(productId);
    if (cartItem) {
        cartItem.quantity += 1;
        cartItem.rentDays = getRentDaysPreference(productId);
    } else {
        state.cart.push({
            productId: product.id,
            quantity: 1,
            rentDays: getRentDaysPreference(productId),
        });
    }

    saveCartState();
    showNotice(`${product.name} נוסף לעגלה.`, 'success');
}

/**
 * Adjusts the quantity of a cart item by a signed delta (state only — no re-render).
 *
 * Implementation: Delegates to removeCartItem() when the resulting quantity
 * drops to zero or below. Prevents exceeding the inventory ceiling. The calling
 * page POM is responsible for triggering a re-render after this call.
 *
 * @param {string} productId - The ID of the product to adjust.
 * @param {number} delta - Positive to increase, negative to decrease.
 * @returns {void}
 */
function updateCartItemQuantity(productId, delta) {
    const cartItem = getCartItemByProductId(productId);
    if (!cartItem) return;

    const updatedQty = cartItem.quantity + delta;
    if (updatedQty <= 0) {
        removeCartItem(productId);
        return;
    }

    if (updatedQty > getInventoryStock(productId)) {
        showNotice('אין מספיק מלאי לכמות זו.', 'error');
        return;
    }

    cartItem.quantity = updatedQty;
    saveCartState();
}

/**
 * Removes a product from the cart (state only — no re-render).
 *
 * Implementation: Filters state.cart and saves. The calling page POM is
 * responsible for triggering a re-render after this call.
 *
 * @param {string} productId - The ID of the product to remove.
 * @returns {void}
 */
function updateCartItemRentDays(productId, delta) {
    const cartItem = getCartItemByProductId(productId);
    if (!cartItem) return;
    const updated = (cartItem.rentDays || 1) + delta;
    if (updated < 1) return;
    cartItem.rentDays = updated;
    saveCartState();
}

function removeCartItem(productId) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
    saveCartState();
}

/**
 * Empties the cart and persists the change.
 *
 * @returns {void}
 */
function clearCart() {
    state.cart = [];
    saveCartState();
}

// ===== Price Calculations =====

/**
 * Calculates the total price for a single cart line item.
 *
 * Implementation: unit price × quantity × rentDays. Returns 0 if the product
 * is not found. Uses rentDays fallback of 1 for purchase-type items.
 *
 * @param {{ productId: string, quantity: number, rentDays: number }} cartItem
 * @returns {number} The line total in NIS.
 */
function calculateCartItemTotal(cartItem) {
    const product = getProductById(cartItem.productId);
    if (!product) return 0;
    return product.price * cartItem.quantity * (cartItem.rentDays || 1);
}

/**
 * Calculates the grand total for all items currently in the cart.
 *
 * @returns {number} The cart grand total in NIS.
 */
function calculateCartTotal() {
    return state.cart.reduce((total, item) => total + calculateCartItemTotal(item), 0);
}

// ===== Rent-Day Preferences =====

/**
 * Stores the user's preferred rental duration for a product and persists it.
 *
 * @param {string} id - The product ID.
 * @param {number} days - The selected rental duration.
 * @returns {void}
 */
function setRentDaysPreference(id, days) {
    state.rentDaysByProductId[id] = days;
    saveStoredJson(STORAGE_KEYS.rentDays, state.rentDaysByProductId);
}

/**
 * Retrieves the stored rental duration preference for a product.
 *
 * Implementation: Only values of 1, 2, or 3 are accepted; anything else defaults to 1.
 *
 * @param {string} id - The product ID.
 * @returns {1|2|3} The preferred number of rental days.
 */
function getRentDaysPreference(id) {
    const days = Number(state.rentDaysByProductId[id]);
    return [1, 2, 3].includes(days) ? days : 1;
}

// ===== Return =====

/**
 * Increments the inventory stock for a returned product by one unit and saves state.
 *
 * @param {string} productId - The ID of the returned product.
 * @returns {void}
 */
function saveOrder(order) {
    const orders = loadStoredJson(STORAGE_KEYS.orders, []);
    orders.push(order);
    saveStoredJson(STORAGE_KEYS.orders, orders);
}

function incrementInventoryForReturn(productId) {
    state.inventory[productId] = getInventoryStock(productId) + 1;
    saveInventoryState();
}


// ===== Locker =====

/**
 * Sends an open or close command to the ESP32 locker servo via HTTP POST.
 *
 * Implementation: On network failure or non-OK response, returns a mocked
 * success object so the UI flow is not blocked during development.
 *
 * @param {'open'|'close'} command - The servo command to send.
 * @returns {Promise<Object>} JSON response, or { mocked: true, command } on failure.
 */
async function sendLockerServoCommand(command) {
    const endpoint = `${ESP32_BASE_URL}/api/locker/${command}`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
        });
        if (!response.ok) throw new Error(`Locker API returned ${response.status}`);
        return await response.json();
    } catch {
        return { mocked: true, command };
    }
}

// ===== Utilities =====

/**
 * Escapes special HTML characters to prevent XSS when interpolating into HTML strings.
 *
 * @param {*} value - The value to escape (coerced to string).
 * @returns {string} The HTML-safe escaped string.
 */
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Formats a date value as a localised Hebrew (he-IL) date string.
 *
 * Implementation: Returns '-' for falsy or invalid date inputs.
 *
 * @param {string|Date|null|undefined} value - The date value to format.
 * @returns {string} Localised date string, or '-' if absent/invalid.
 */
function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('he-IL');
}

// ===== Application Context =====

/**
 * Plain-object context that bundles shared state and all utility functions.
 *
 * Every page POM receives this object as its constructor argument. The two
 * primary navigation helpers pages use are:
 *   - navigateTo(pageInstance): transition to a new page POM.
 *   - rerender(): re-render the current page after an in-place state mutation.
 */
const appContext = {
    state,
    products,
    selectors,
    // Navigation
    navigateTo,
    rerender,
    // Lookups
    getProductById,
    getCartItemByProductId,
    getCartItemCount,
    getInventoryStock,
    getAvailableStock,
    getCartQuantity,
    // Cart
    addProductToCart,
    updateCartItemQuantity,
    updateCartItemRentDays,
    removeCartItem,
    clearCart,
    // Prices
    calculateCartItemTotal,
    calculateCartTotal,
    // Rent days
    setRentDaysPreference,
    getRentDaysPreference,
    // Inventory
    saveOrder,
    incrementInventoryForReturn,
    saveInventoryState,
    normalizeInventory,
    // Locker
    sendLockerServoCommand,
    // Persistence
    loadStoredJson,
    saveStoredJson,
    saveCartState,
    // UI
    showNotice,
    updateCartBadge,
    renderFooterFaq,
    // Utilities
    escapeHtml,
    formatDate,
};

// ===== Entry Point =====
// app.js is solely responsible for initialising the Product Catalog as the
// primary entry point. All other page objects are created by POM navigation
// methods or by the hashchange handler for browser back/forward support.

init();
