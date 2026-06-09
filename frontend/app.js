import { CatalogPage }      from './pages/CatalogPage.js';
import { CartPage }          from './pages/CartPage.js';
import { CheckoutPage }      from './pages/CheckoutPage.js';
import { LockerPage }        from './pages/LockerPage.js';
import { ReturnPage }        from './pages/ReturnPage.js';
import { InventoryPage }     from './pages/InventoryPage.js';
import { ReservationPage }         from './pages/ReservationPage.js';
import { CollectReservationPage }  from './pages/CollectReservationPage.js';
import { LoginModal }              from './pages/LoginModal.js';

import {
    STORAGE_KEYS,
    state, products,
    loadCartState,
    refreshFromBackend,
    getProductById, getCartItemByProductId, getCartItemCount,
    getInventoryStock, getAvailableStock, getCartQuantity,
    addProductToCart, updateCartItemQuantity, updateCartItemRentDays,
    removeCartItem, clearCart,
    calculateCartItemTotal, calculateCartTotal,
    setRentDaysPreference, getRentDaysPreference,
    saveOrder, incrementInventoryForReturn,
    validateReturn, saveReturnToLocal, getActiveRentedProductIds,
} from './store.js';

import { sendLockerServoCommand } from './services/lockerService.js';
import { loadStoredJson, saveStoredJson, escapeHtml, formatDate } from './utils.js';

// =============================================================================
// Constants
// =============================================================================

const ROUTES = new Set(['catalog', 'cart', 'checkout', 'locker', 'return', 'inventory', 'reserve', 'collect']);

/** Fallback FAQ shown on all non-inventory pages. */
const DEFAULT_FAQ = [
    { q: 'איך שוכרים מוצר?',  a: 'נכנסים לקטלוג, בוחרים פריט, מוסיפים לסל וממשיכים לתשלום.' },
    { q: 'איך מחזירים מוצר?', a: 'נכנסים לעמוד "החזרת מוצר", ממלאים שם ובוחרים פריט, פותחים את הלוקר, מניחים את הפריטים, מצלמים ונועלים.' },
    { q: 'איך משלמים?',        a: 'מגיעים לעמוד התשלום, ממלאים שם פרטי ומשפחה ובוחרים אמצעי תשלום דמה.' },
];

// =============================================================================
// Shell / Routing State
// =============================================================================

let _isShellMounted = false;
let _currentRoute = 'catalog';
let _currentPage = null;
let _isAdminAuthenticated = false;

const selectors = {
    main:      '#main-content',
    cartBadge: '#cart-badge',
    footerFaq: '#footer-qa-list',
    routeLink: '[data-route-link]',
};

// =============================================================================
// Initialisation
// =============================================================================

/**
 * Bootstraps the application: loads persisted state, mounts the shell,
 * wires global event listeners, and navigates to the initial route.
 * Must run after the module finishes loading (called at the bottom of this file).
 */
async function init() {
    state.cart = loadCartState();
    state.rentDaysByProductId = loadStoredJson(STORAGE_KEYS.rentDays, {});

    // Load products and inventory from the Python backend (authoritative source).
    // Reservation expiry is also handled server-side.
    await refreshFromBackend();

    renderAppShell();
    attachGlobalEventListeners();
    updateCartBadge();

    // Protect the inventory route on browser back/forward navigation.
    window.addEventListener('hashchange', () => {
        const route = _getRouteFromHash();
        if (route === 'inventory' && !_isAdminAuthenticated) {
            history.replaceState(null, '', '#catalog');
            loginModal.show();
            return;
        }
        navigateTo(_createPageByRoute(route));
    });

    const initialPage = !location.hash
        ? new CatalogPage(appContext)
        : _createPageByRoute(_getRouteFromHash());
    navigateTo(initialPage);
}

// =============================================================================
// Shell Rendering
// =============================================================================

/**
 * Injects the persistent shell (header, main placeholder, footer, FABs) into
 * document.body and mounts the login modal. Idempotent — no-ops after first call.
 */
function renderAppShell() {
    if (_isShellMounted) return;

    document.body.innerHTML = `
        <div class="app">
            <header class="app-header">
                <div class="app-logo logo-link" data-route-link="catalog">
                    <img src="catalog/logo-pics/GrabIt-Logo.png" alt="GrabIt Logo" class="logo-image-grabit">
                </div>
                <button class="hamburger-btn" id="hamburger-btn" aria-label="תפריט">&#9776;</button>
                <div class="header-actions">
                    <button class="reservation-button" type="button" data-route-link="reserve">
                        הזמנה מוקדמת
                    </button>
                    <button class="reservation-button collect-button" type="button" data-route-link="collect">
                        איסוף הזמנה
                    </button>
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
                    <button class="association-login-button" type="button" id="assoc-login-btn">
                        התחברות ארגון
                    </button>
                </div>
            </header>

            <main class="app-main" id="main-content"></main>

            <footer class="app-footer ecommerce-footer">
                <div class="footer-grid">
                    <div class="footer-brand">
                        <div class="app-logo logo-container logo-link footer-brand-logo" data-route-link="catalog">
                            <img src="catalog/logo-pics/GrabIt-Logo.png" alt="GrabIt Logo" class="logo-image-grabit">
                        </div>
                    </div>
                    <div class="footer-links">
                        <h3>ניווט מהיר</h3>
                        <nav class="footer-nav">
                            <a href="#catalog"   data-route-link="catalog">קטלוג הציוד</a>
                            <a href="#cart"      data-route-link="cart">עגלת הקניות שלך</a>
                            <a href="#reserve"   data-route-link="reserve">הזמנה מוקדמת</a>
                            <a href="#return"    data-route-link="return">החזרת מוצרים</a>
                            <a href="#inventory" data-route-link="inventory">ניהול מלאי</a>
                        </nav>
                    </div>
                    <div class="footer-info">
                        <h3>פרויקט אקדמי תשפ"ו</h3>
                        <p>מפותח על ידי צוות GrabIt:</p>
                        <p class="team-names">איתמר מלמן | יונתן צור | עומר דורון | עמית קליינמן | שירה דניאל</p>
                    </div>
                </div>
                <div class="footer-grid footer-grid-qa">
                    <section class="footer-qa-section">
                        <div class="footer-qa-header">
                            <h3>שאלות נפוצות</h3>
                        </div>
                        <div class="footer-qa-list" id="footer-qa-list"></div>
                    </section>
                </div>
                <div class="footer-bottom">
                    <p class="copyright">© כל הזכויות שמורות - אב טיפוס לפרויקט מערכות מידע</p>
                </div>
            </footer>

            <div class="fab-group" aria-label="תמיכה טכנית">
                <a href="https://wa.me/972000000000"
                   class="fab fab-whatsapp"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="פנה אלינו בוואטסאפ">
                    <img src="catalog/logo-pics/whatsapp.png" alt="" aria-hidden="true">
                </a>
                <a href="https://mail.google.com/mail/?view=cm&to=agugoofficial@gmail.com"
                   class="fab fab-email"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="שלח לנו אימייל">
                    <img src="catalog/logo-pics/email.png" alt="" aria-hidden="true">
                </a>
            </div>
        </div>
    `;

    _isShellMounted = true;
    loginModal.mount();
}

/**
 * Renders FAQ items into the footer for the active page.
 * Each page class may define a static FAQ array; falls back to DEFAULT_FAQ.
 * This keeps all page-specific copy out of app.js.
 * @param {Object} page - The currently active page POM instance.
 */
function renderFooterFaq(page) {
    const list = document.getElementById('footer-qa-list');
    if (!list) return;
    const items = page.constructor.FAQ ?? DEFAULT_FAQ;
    list.innerHTML = items.map(({ q, a }) => `
        <details class="footer-qa-item">
            <summary>${q}</summary>
            <p>${a}</p>
        </details>
    `).join('');
}

// =============================================================================
// Event Delegation
// =============================================================================

/**
 * Attaches a single delegated click listener on document for shell navigation,
 * and change/submit listeners on #main-content forwarded to the active page POM.
 * Centralising delegation here means POMs never need to manage their own global listeners.
 */
function attachGlobalEventListeners() {
    document.addEventListener('click', (event) => {
        // Hamburger toggle — opens/closes the mobile nav dropdown.
        if (event.target.closest('#hamburger-btn')) {
            document.querySelector('.header-actions')?.classList.toggle('is-open');
            return;
        }

        // Association login button — guarded; shows modal when not authenticated.
        if (event.target.closest('#assoc-login-btn')) {
            event.preventDefault();
            if (_isAdminAuthenticated) {
                navigateTo(new InventoryPage(appContext));
            } else {
                loginModal.show();
            }
            return;
        }

        // Shell navigation links — inventory is auth-guarded here too.
        const routeEl = event.target.closest(selectors.routeLink);
        if (routeEl) {
            event.preventDefault();
            const route = routeEl.dataset.routeLink;
            if (route === 'inventory' && !_isAdminAuthenticated) {
                loginModal.show();
                return;
            }
            navigateTo(_createPageByRoute(route));
            return;
        }

        _currentPage?.handleClick(event);
    });

    const main = document.getElementById('main-content');
    main.addEventListener('change', (event) => { _currentPage?.handleChange(event); });
    main.addEventListener('submit', (event) => { _currentPage?.handleSubmit(event); });
}

// =============================================================================
// Navigation
// =============================================================================

/**
 * Navigates to a page POM, pushing a history entry and re-rendering the content area.
 * This is the single canonical navigation entry point — all in-app navigation must
 * go through here; never push to history directly.
 * @param {Object} pageInstance - The instantiated page POM to navigate to.
 */
function navigateTo(pageInstance) {
    const route = pageInstance.constructor.ROUTE;
    _currentPage = pageInstance;
    _currentRoute = route;
    history.pushState(null, '', `#${route}`);
    document.querySelector('.header-actions')?.classList.remove('is-open');
    _renderPageContent();
}

/**
 * Re-renders the current page without changing the URL or page instance.
 * Called by page POMs after in-place state mutations (e.g. adding to cart, editing stock).
 */
function rerender() {
    _renderPageContent();
}

/**
 * Performs the actual DOM update: scrolls to top, marks the active route link,
 * injects the page's HTML into #main-content, calls its afterRender hook,
 * then refreshes the cart badge and footer FAQ.
 */
function _renderPageContent() {
    const main = document.getElementById('main-content');
    if (!main) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    _highlightActiveRoute(_currentRoute);
    main.innerHTML = _currentPage.render();
    _currentPage.afterRender?.();
    updateCartBadge();
    renderFooterFaq(_currentPage);
}

/**
 * Creates a fresh page POM for a given route string.
 * Used by the hashchange handler and shell data-route-link clicks.
 * @param {string} route - A valid key from ROUTES.
 * @returns {Object} A new page POM instance.
 */
function _createPageByRoute(route) {
    switch (route) {
        case 'cart':      return new CartPage(appContext);
        case 'checkout':  return new CheckoutPage(appContext);
        case 'locker':    return new LockerPage(appContext);
        case 'return':    return new ReturnPage(appContext);
        case 'inventory': return new InventoryPage(appContext);
        case 'reserve':   return new ReservationPage(appContext);
        case 'collect':   return new CollectReservationPage(appContext);
        default:          return new CatalogPage(appContext);
    }
}

/**
 * Reads the URL hash and returns a valid ROUTES key, falling back to the default route.
 * @returns {string} A valid route key from ROUTES.
 */
function _getRouteFromHash() {
    const route = location.hash.replace('#', '').split('?')[0];
    return ROUTES.has(route) ? route : _getDefaultRoute();
}

/**
 * Returns the application's default route, read from data-default-route on <body>.
 * Falls back to 'catalog' if absent or unrecognised.
 * @returns {string} A valid route key from ROUTES.
 */
function _getDefaultRoute() {
    const def = document.body.dataset.defaultRoute || 'catalog';
    return ROUTES.has(def) ? def : 'catalog';
}

/**
 * Toggles the 'is-active' CSS class on all route-link elements to match the active route.
 * @param {string} route - The currently active route key.
 */
function _highlightActiveRoute(route) {
    document.querySelectorAll(selectors.routeLink).forEach((el) => {
        el.classList.toggle('is-active', el.dataset.routeLink === route);
    });
}

// =============================================================================
// Cart Badge
// =============================================================================

/**
 * Updates the cart badge count and visibility to reflect the current cart state.
 * Called after every navigation and cart mutation.
 */
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const count = getCartItemCount();
    badge.textContent = String(count);
    badge.style.display = count === 0 ? 'none' : 'flex';
}

// =============================================================================
// Application Context
// =============================================================================

/**
 * Shared context object injected into every page POM constructor.
 * Bundles state, store operations, navigation helpers, and utilities so pages
 * have a single stable dependency rather than importing app internals directly.
 * Only members actively used by at least one POM are exposed here.
 */
const appContext = {
    state,
    products,
    // Navigation
    navigateTo,
    rerender,
    updateCartBadge,
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
    // Inventory & backend sync
    refreshFromBackend,
    saveOrder,
    incrementInventoryForReturn,
    validateReturn,
    saveReturnToLocal,
    getActiveRentedProductIds,
    // Locker
    sendLockerServoCommand,
    // Persistence
    loadStoredJson,
    saveStoredJson,
    // Utilities
    escapeHtml,
    formatDate,
};

/**
 * Application-level login modal instance.
 * Defined after appContext so the onSuccess callback can reference appContext
 * without a temporal ordering issue. On successful login, sets the admin flag
 * and navigates directly to the inventory page.
 */
const loginModal = new LoginModal(() => {
    _isAdminAuthenticated = true;
    navigateTo(new InventoryPage(appContext));
});

// =============================================================================
// Entry Point
// =============================================================================

void init();
