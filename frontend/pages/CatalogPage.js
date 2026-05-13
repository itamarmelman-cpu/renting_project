import { CartPage } from './CartPage.js';
import { ReturnPage } from './ReturnPage.js';
import { InventoryPage } from './InventoryPage.js';

export class CatalogPage {
    static ROUTE = 'catalog';
    static URL = '#catalog';

    /**
     * Creates a CatalogPage instance.
     *
     * Implementation: Stores the shared appContext reference, initialises the
     * search query to empty, and declares all CSS/data-attribute selectors used
     * by the page's handler and rendering methods.
     *
     * @param {Object} app - The shared application context (appContext from app.js).
     */
    constructor(app) {
        this.app = app;
        this.searchQuery = '';

        this.selectors = {
            searchInput:   '[data-catalog-search-input]',
            searchBtn:     '[data-action="catalog-search"]',
            clearSearchBtn:'[data-action="catalog-clear-search"]',
            addToCartBtn:  '[data-action="add-to-cart"]',
            rentDayBtn:    '[data-action="select-rent-days"]',
            productCard:   '.product-card',
            rentTotal:     '.rent-total-value',
        };
    }

    // ===== Navigation Methods =====

    /**
     * Navigates to the Cart page.
     *
     * Implementation: Instantiates CartPage with the shared appContext, calls
     * app.navigateTo() to update the URL and render the new page, then returns
     * the instance for programmatic chaining (e.g. in tests).
     *
     * @returns {CartPage} The newly created CartPage instance.
     */
    goToCart() {
        const page = new CartPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    /**
     * Navigates to the Return page.
     *
     * Implementation: Instantiates ReturnPage with the shared appContext, calls
     * app.navigateTo() to update the URL and render the new page, then returns
     * the instance for programmatic chaining.
     *
     * @returns {ReturnPage} The newly created ReturnPage instance.
     */
    goToReturn() {
        const page = new ReturnPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    /**
     * Navigates to the Inventory (admin) page.
     *
     * Implementation: Instantiates InventoryPage with the shared appContext,
     * calls app.navigateTo() to update the URL and render, then returns the
     * instance for programmatic chaining.
     *
     * @returns {InventoryPage} The newly created InventoryPage instance.
     */
    goToInventory() {
        const page = new InventoryPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== In-Page Action Methods =====

    /**
     * Adds one unit of the given product to the cart.
     *
     * Implementation: Delegates entirely to app.addProductToCart(), which handles
     * validation, state mutation, persistence, and the success/error notice.
     * No re-render is required — the catalog view does not change when an item
     * is added; only the badge (updated automatically inside saveCartState) changes.
     *
     * @param {string} productId - The ID of the product to add.
     * @returns {void}
     */
    addToCart(productId) {
        this.app.addProductToCart(productId);
    }

    /**
     * Sets the user's preferred rental duration for a product and updates the card UI.
     *
     * Implementation: Persists the new preference via app.setRentDaysPreference(),
     * then updates the DOM in-place: toggles the active class on the day buttons
     * and recalculates the displayed total price — without a full page re-render.
     * The product card is located by its data-product-id attribute.
     *
     * @param {string} productId - The ID of the product whose duration is being set.
     * @param {number} days - The selected number of rental days (1, 2, or 3).
     * @returns {void}
     */
    selectRentalDuration(productId, days) {
        this.app.setRentDaysPreference(productId, days);
        const card = document.querySelector(`${this.selectors.productCard}[data-product-id="${productId}"]`);
        if (!card) return;
        card.querySelectorAll(this.selectors.rentDayBtn).forEach((btn) => {
            btn.classList.toggle('active', Number(btn.dataset.days) === days);
        });
        const totalEl = card.querySelector(this.selectors.rentTotal);
        const product = this.app.getProductById(productId);
        if (totalEl && product) totalEl.textContent = String(product.price * days);
    }

    /**
     * Filters the product list by the given query and re-renders the catalog grid.
     *
     * Implementation: Stores the query on the instance then calls app.rerender(),
     * which re-invokes render() on this page — the updated searchQuery is picked
     * up automatically by the filter inside render().
     *
     * @param {string} query - The search string to filter products by.
     * @returns {void}
     */
    searchProducts(query) {
        this.searchQuery = query;
        this.app.rerender();
    }

    /**
     * Clears the active search query and re-renders the full product list.
     *
     * Implementation: Delegates to searchProducts() with an empty string, which
     * resets searchQuery and triggers a rerender showing all products.
     *
     * @returns {void}
     */
    clearSearch() {
        this.searchProducts('');
    }

    // ===== Event Handler Methods =====

    /**
     * Renders the full catalog page HTML string.
     *
     * Implementation: Filters the product list against searchQuery (case-insensitive
     * match on name, description, and searchTerms). Maps filtered products to card
     * HTML via _renderProductCard(). Shows an empty-state element when no products
     * match the query.
     *
     * @returns {string} HTML string for the catalog page.
     */
    render() {
        const { app, searchQuery } = this;
        const filtered = app.products.filter((product) => {
            const text = `${product.name} ${product.description} ${product.searchTerms}`.toLowerCase();
            return text.includes(searchQuery.toLowerCase());
        });

        return `
            <div class="fade-in">
                <div class="catalog-header-wrapper">
                    <div class="catalog-header">
                        <div class="catalog-title">
                            <h2 class="catalog-main-title">קטלוג ציוד אקדמי</h2>
                            <p class="catalog-subtitle">${app.products.length} מוצרים זמינים להשכרה ולרכישה</p>
                        </div>
                        <div class="catalog-actions">
                            <input
                                type="text"
                                class="catalog-search-input"
                                placeholder="חיפוש ציוד..."
                                value="${app.escapeHtml(searchQuery)}"
                                data-catalog-search-input
                            >
                            <button class="btn btn-primary" type="button" data-action="catalog-search">חפש</button>
                            <button class="btn btn-mustard" type="button" data-action="catalog-clear-search">נקה חיפוש</button>
                        </div>
                    </div>
                </div>
                <div class="catalog-grid">
                    ${filtered.map((p) => this._renderProductCard(p)).join('') || this._renderEmptyState()}
                </div>
            </div>
        `;
    }

    /**
     * Handles click events delegated from the global listener.
     *
     * Implementation: Dispatches to the appropriate semantic method:
     *   - add-to-cart button      → addToCart()
     *   - rent-day selector button → selectRentalDuration()
     *   - search button            → searchProducts()
     *
     * @param {MouseEvent} event - The click event from the global delegated listener.
     * @returns {void}
     */
    handleClick(event) {
        const addBtn = event.target.closest(this.selectors.addToCartBtn);
        if (addBtn) {
            this.addToCart(addBtn.dataset.productId);
            return;
        }

        const rentDayBtn = event.target.closest(this.selectors.rentDayBtn);
        if (rentDayBtn) {
            this.selectRentalDuration(rentDayBtn.dataset.productId, Number(rentDayBtn.dataset.days));
            return;
        }

        const searchBtn = event.target.closest(this.selectors.searchBtn);
        if (searchBtn) {
            const input = document.querySelector(this.selectors.searchInput);
            this.searchProducts(input ? input.value.trim() : '');
            return;
        }

        const clearBtn = event.target.closest(this.selectors.clearSearchBtn);
        if (clearBtn) {
            this.clearSearch();
        }
    }

    /**
     * Handles form submit events delegated from the global listener.
     *
     * Implementation: Intercepts the catalog search form's Enter-key submission,
     * prevents the default browser action, and triggers searchProducts().
     *
     * @param {SubmitEvent} event - The submit event from the global delegated listener.
     * @returns {void}
     */
    handleSubmit(event) {
        const searchForm = event.target.closest('[data-catalog-search-form]');
        if (searchForm) {
            event.preventDefault();
            const input = searchForm.querySelector(this.selectors.searchInput);
            this.searchProducts(input ? input.value.trim() : '');
        }
    }

    // ===== Private Rendering Helpers =====

    /**
     * Renders the HTML card for a single product.
     *
     * Implementation: Reads inventory stock and the user's rent-day preference.
     * Builds the media element (image or emoji fallback), price display, rent-day
     * selector, and add-to-cart button. Attaches data-product-id to the article
     * element so selectRentalDuration() can locate the card by product ID.
     *
     * @param {Object} product - A product object from the catalogue.
     * @returns {string} HTML string for one product card article element.
     */
    _renderProductCard(product) {
        const { app } = this;
        const selectedDays = app.getRentDaysPreference(product.id);
        const stock = app.getInventoryStock(product.id);
        const isLowStock = stock <= 2;
        const stockLabel = isLowStock ? `נותרו ${stock} בלבד` : `${stock} במלאי`;
        const typeLabel = product.type === 'rent' ? 'השכרה' : 'רכישה';

        const mediaHtml = product.image
            ? `<img src="${app.escapeHtml(product.image)}" alt="${app.escapeHtml(product.name)}" class="product-image">`
            : `<div class="product-icon">${app.escapeHtml(product.visual)}</div>`;

        const priceHtml = `${product.price}<span class="product-currency">₪</span><span class="price-per-day"> ליום</span>`;

        return `
            <article class="product-card" data-product-id="${app.escapeHtml(product.id)}">
                ${mediaHtml}
                <h3 class="product-name">${app.escapeHtml(product.name)}</h3>
                <p class="product-description">${app.escapeHtml(product.description)}</p>
                <div class="product-meta">
                    <div class="badges-row">
                        <span class="type-badge ${product.type}">${app.escapeHtml(typeLabel)}</span>
                        <span class="stock-info${isLowStock ? ' low' : ''}">${app.escapeHtml(stockLabel)}</span>
                    </div>
                    <div class="product-price">${priceHtml}</div>
                </div>
                ${this._renderRentDaySelector(product.id, selectedDays)}
                <button type="button" class="btn btn-primary btn-block add-to-cart-btn"
                    data-action="add-to-cart"
                    data-product-id="${app.escapeHtml(product.id)}">
                    הוסף לסל
                </button>
            </article>
        `;
    }

    /**
     * Renders the rental-day selector widget for a product card.
     *
     * Implementation: Generates three day-option buttons (1, 2, 3), marks the
     * currently selected one as active, and shows a running total price.
     *
     * @param {string} productId - The ID of the product this selector belongs to.
     * @param {number} selectedDays - The currently selected rental duration.
     * @returns {string} HTML string for the rent-day selector widget.
     */
    _renderRentDaySelector(productId, selectedDays) {
        const product = this.app.getProductById(productId);
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
                            data-product-id="${this.app.escapeHtml(productId)}"
                            data-days="${days}"
                        >${days}</button>
                    `).join('')}
                </div>
                <span class="rent-total-label">סה"כ: <span class="rent-total-value">${total}</span> ₪</span>
            </div>
        `;
    }

    /**
     * Renders the empty-state message shown when the search query yields no results.
     *
     * @returns {string} HTML string for the empty-state element.
     */
    _renderEmptyState() {
        return `
            <div class="empty-state" style="grid-column: 1/-1;">
                <h2>לא נמצאו מוצרים</h2>
                <p>נסה מונח חיפוש אחר.</p>
            </div>
        `;
    }
}
