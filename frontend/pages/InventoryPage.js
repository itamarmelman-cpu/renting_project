import { CatalogPage } from './CatalogPage.js';

export class InventoryPage {
    static ROUTE = 'inventory';
    static URL = '#inventory';
    static FAQ = [
        { q: 'איך רואים מה במלאי?',        a: 'בכניסת ארגון בוחרים "ניהול מלאי" ומקבלים טבלה מלאה של כל המוצרים, הכמות והסטטוס שלהם.' },
        { q: 'איך בודקים השכרות פעילות?', a: 'בכניסת ארגון בוחרים "השכרה כרגע" ורואים אילו פריטים מושכרים, לכמה זמן ולכמה ימים נשארו.' },
        { q: 'איך מעדכנים מלאי?',           a: 'בכניסת ארגון בוחרים "ניהול מלאי" ואז אפשר לערוך מלאי, להוסיף מוצר חדש או להסיר מוצר קיים.' },
    ];

    constructor(app) {
        this.app = app;
        this.activeSection    = 'summary';
        this.dashboardSummary = null;
        this.currentFetchId   = 0;
        this._allOrders       = [];
        this._allReservations = [];
        this._allReturns      = [];

        this.historyFilters = {
            customerName: '',
            dateFrom:     '',
            dateTo:       '',
            type:         'all',
        };

        this.selectors = {
            sectionSelect:      '#inventory-section-select',
            dashboardPanel:     '#inventory-dashboard-panel',
            addProductBtn:      '#add-product-btn',
            editStockBtn:       '.edit-stock-btn',
            removeProductBtn:   '.remove-product-btn',
            editModal:          '#edit-stock-modal',
            editNameField:      '#edit-product-name',
            editStockField:     '#edit-stock-input',
            editPriceField:     '#edit-product-price',
            addModal:           '#add-product-modal',
            addForm:            '#add-product-form',
            addNameField:       '#new-product-name',
            addTypeField:       '#new-product-type',
            addStockField:      '#new-product-stock',
            addPriceField:      '#new-product-price',
            editStockForm:      '#edit-stock-form',
            historyNameFilter:  '#history-name-filter',
            historyDateFrom:    '#history-date-from',
            historyDateTo:      '#history-date-to',
            historyTypeFilter:  '#history-type-filter',
        };

        window.closeEditModal = () => this.closeEditModal();
        window.closeAddModal  = () => this.closeAddModal();
    }

    // ===== Navigation =====

    goToCatalog() {
        const page = new CatalogPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== Section Actions =====

    changeSection(sectionName) {
        this.activeSection = sectionName;
        this.renderDashboardPanel();
    }

    async saveStockEdit() {
        const { app } = this;
        const stockField = document.querySelector(this.selectors.editStockField);
        const priceField = document.querySelector(this.selectors.editPriceField);
        if (!stockField?.dataset.productId) return;

        const productId = stockField.dataset.productId;
        const newStock  = parseInt(stockField.value, 10);
        const newPrice  = parseFloat(priceField.value);

        if (isNaN(newStock) || newStock < 0) return;
        if (isNaN(newPrice) || newPrice < 0) return;

        await fetch(`/api/products/${productId}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ stock: newStock, price: newPrice }),
        });

        await app.refreshFromBackend();
        this.closeEditModal();
        app.rerender();
    }

    async saveNewProduct() {
        const { app } = this;
        const nameField  = document.querySelector(this.selectors.addNameField);
        const typeField  = document.querySelector(this.selectors.addTypeField);
        const stockField = document.querySelector(this.selectors.addStockField);
        const priceField = document.querySelector(this.selectors.addPriceField);

        if (!nameField || !typeField || !stockField || !priceField) return;

        const name  = nameField.value.trim();
        const type  = typeField.value;
        const stock = parseInt(stockField.value, 10);
        const price = parseFloat(priceField.value);

        if (!name)                     return;
        if (!type)                     return;
        if (isNaN(stock) || stock < 0) return;
        if (isNaN(price) || price < 0) return;

        const res = await fetch('/api/products', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, type, stock, price }),
        });
        if (!res.ok) return;

        await app.refreshFromBackend();
        this.closeAddModal();
        app.rerender();
    }

    async deleteProduct(productId) {
        const { app } = this;
        const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
        if (!res.ok) return;
        await app.refreshFromBackend();
        app.rerender();
    }

    // ===== Event Handlers =====

    render() {
        return `
            <section class="card inventory-dashboard-shell">
                <div class="inventory-section-header">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <h1>ניהול מלאי ארגון</h1>
                    </div>
                    <label class="inventory-section-selector">
                        <span class="inventory-section-note">קטגוריה</span>
                        <select id="inventory-section-select" class="text-input inventory-view-select">
                            <option value="summary"${this.activeSection === 'summary'      ? ' selected' : ''}>סטטיסטיקות</option>
                            <option value="rentals"${this.activeSection === 'rentals'      ? ' selected' : ''}>בהשכרה כרגע</option>
                            <option value="reservations"${this.activeSection === 'reservations' ? ' selected' : ''}>הזמנות מוקדמות</option>
                            <option value="inventory"${this.activeSection === 'inventory'  ? ' selected' : ''}>ניהול מלאי</option>
                            <option value="history"${this.activeSection === 'history'     ? ' selected' : ''}>היסטוריית הזמנות</option>
                        </select>
                    </label>
                </div>

                <div id="inventory-dashboard-panel" class="inventory-dashboard-panel"></div>
            </section>
        `;
    }

    afterRender() {
        void this.fetchDashboardData();
    }

    handleClick(event) {
        const addBtn = event.target.closest(this.selectors.addProductBtn);
        if (addBtn) { this.openAddModal(); return; }

        const editBtn = event.target.closest(this.selectors.editStockBtn);
        if (editBtn) { this.openEditModal(editBtn.dataset.productId, editBtn.dataset.productName); return; }

        const removeBtn = event.target.closest(this.selectors.removeProductBtn);
        if (removeBtn) {
            if (confirm(`להסיר את "${removeBtn.dataset.productName}" מהמלאי?`)) {
                this.deleteProduct(removeBtn.dataset.productId);
            }
            return;
        }

        const cancelResBtn = event.target.closest('.cancel-reservation-btn');
        if (cancelResBtn) {
            const resId = cancelResBtn.dataset.reservationId;
            if (confirm('לבטל את ההזמנה המוקדמת? הפריטים יוחזרו למלאי הזמין.')) {
                void this.cancelReservation(resId);
            }
        }
    }

    async cancelReservation(reservationId) {
        const { app } = this;
        const res = await fetch(`/api/reservations/${reservationId}`, { method: 'DELETE' });
        if (!res.ok) return;
        await app.refreshFromBackend();
        await this.fetchDashboardData();
    }

    handleChange(event) {
        if (event.target.matches(this.selectors.sectionSelect)) {
            this.changeSection(event.target.value || 'summary');
            return;
        }

        if (
            event.target.matches(this.selectors.historyNameFilter) ||
            event.target.matches(this.selectors.historyDateFrom)   ||
            event.target.matches(this.selectors.historyDateTo)     ||
            event.target.matches(this.selectors.historyTypeFilter)
        ) {
            this._updateHistoryFilter(event.target);
        }
    }

    handleSubmit(event) {
        if (event.target.closest(this.selectors.editStockForm)) {
            event.preventDefault();
            void this.saveStockEdit();
            return;
        }
        if (event.target.closest(this.selectors.addForm)) {
            event.preventDefault();
            this.saveNewProduct();
        }
    }

    // ===== Dashboard Data =====

    async fetchDashboardData() {
        const [ordersRes, resRes, retRes] = await Promise.allSettled([
            fetch('/api/orders'),
            fetch('/api/reservations'),
            fetch('/api/returns'),
        ]);

        this._allOrders       = ordersRes.status === 'fulfilled' && ordersRes.value.ok
            ? await ordersRes.value.json() : this.app.loadStoredJson('grabit.orders', []);
        this._allReservations = resRes.status === 'fulfilled' && resRes.value.ok
            ? await resRes.value.json() : [];
        this._allReturns      = retRes.status === 'fulfilled' && retRes.value.ok
            ? await retRes.value.json() : [];

        this.dashboardSummary = this.buildDashboardSummary(this._allOrders);

        this.dashboardSummary = this.buildDashboardSummary(this._allOrders);
        this.renderDashboardPanel();
    }

    buildDashboardSummary(orders) {
        const now      = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;

        // Build a mutable map of unredeemed returns: `${customerName}|${productId}` -> qty
        const remainingReturns = {};
        for (const ret of (this._allReturns || [])) {
            const customerName = `${ret.firstName || ''} ${ret.lastName || ''}`.trim();
            const key = `${customerName}|${ret.productId}`;
            remainingReturns[key] = (remainingReturns[key] || 0) + (ret.quantity || 1);
        }

        const activeRentals = [];
        const dueSoon       = [];
        let soldUnits = 0, salesRevenue = 0, rentedUnits = 0;
        let rentalRevenue = 0, totalRentDays = 0, rentItemCount = 0;
        const productCounts = {};
        const hourlyCounts  = new Array(24).fill(0);
        const dailyCounts   = new Array(7).fill(0);

        orders.forEach((order) => {
            if (order.createdAt) {
                const d = new Date(order.createdAt);
                hourlyCounts[d.getHours()]++;
                dailyCounts[d.getDay()]++;
            }

            (order.items || []).forEach((item) => {
                const product  = this.app.getProductById(item.productId);
                if (!product) return;

                const quantity = Number(item.quantity || 1);
                const rentDays = Number(item.rentDays || 1);

                productCounts[item.productId] = (productCounts[item.productId] || 0) + quantity;

                if (product.type === 'rent') {
                    const startedAt   = new Date(order.createdAt || Date.now()).getTime();
                    const dueAt       = startedAt + rentDays * msPerDay;
                    const remainingMs = dueAt - now;

                    rentalRevenue += product.price * quantity * rentDays;
                    totalRentDays += rentDays;
                    rentItemCount++;

                    if (remainingMs > 0) {
                        const remainingDays = Math.max(1, Math.ceil(remainingMs / msPerDay));

                        // Subtract any units already returned by this customer
                        const returnKey   = `${order.customerName || ''}|${item.productId}`;
                        const toDeduct    = Math.min(remainingReturns[returnKey] || 0, quantity);
                        remainingReturns[returnKey] = (remainingReturns[returnKey] || 0) - toDeduct;
                        const activeQty   = quantity - toDeduct;

                        if (activeQty > 0) {
                            rentedUnits += activeQty;
                            const rental = {
                                orderId:      order.id,
                                productId:    item.productId,
                                productName:  product.name,
                                quantity:     activeQty,
                                rentDays,
                                customerName: order.customerName || 'לא צוין',
                                startedAt:    order.createdAt || null,
                                dueAt:        new Date(dueAt).toISOString(),
                                remainingDays,
                            };
                            activeRentals.push(rental);
                            if (remainingDays <= 1) dueSoon.push(rental);
                        }
                    }
                    return;
                }

                soldUnits    += quantity;
                salesRevenue += product.price * quantity;
            });
        });

        const avgRentDays  = rentItemCount > 0
            ? Math.round((totalRentDays / rentItemCount) * 10) / 10
            : 0;

        return {
            activeRentals,
            dueSoon,
            rentedUnits,
            soldUnits,
            salesRevenue,
            rentalRevenue,
            totalRevenue: rentalRevenue + salesRevenue,
            avgRentDays,
            totalOrders: orders.length,
            productCounts,
            hourlyCounts,
            dailyCounts,
        };
    }

    renderDashboardPanel(isError = false) {
        const panel  = document.querySelector(this.selectors.dashboardPanel);
        const select = document.querySelector(this.selectors.sectionSelect);
        if (!panel || !select) return;
        select.value    = this.activeSection;
        panel.innerHTML = this.renderPanelContent(this.activeSection, this.dashboardSummary, isError);
    }

    renderPanelContent(section, summary, isError = false) {
        const { app } = this;

        // ── Rentals ──────────────────────────────────────────────────────────
        if (section === 'rentals') {
            const rentals = summary?.activeRentals || [];
            return `
                <div class="inventory-section-header inventory-panel-header">
                    <div>
                        <span class="eyebrow">בהשכרה כרגע</span>
                        <h3>אילו פריטים מושכרים ולאיזו תקופה</h3>
                    </div>
                    <span class="inventory-section-note">${isError ? 'שגיאה בטעינת נתונים' : rentals.length ? `נמצאו ${rentals.length} פריטי השכרה פעילים` : 'אין כרגע פריטים מושכרים'}</span>
                </div>
                <div class="inventory-rentals-list">
                    ${rentals.length ? rentals.map((rental) => {
                        const overdue = rental.remainingDays <= 0;
                        return `
                        <article class="rental-card${overdue ? ' rental-card--overdue' : ''}">
                            <div class="rental-card-header">
                                <strong class="rental-product-name">${app.escapeHtml(rental.productName)}</strong>
                                ${overdue
                                    ? `<span class="rental-badge rental-badge--overdue">באיחור</span>`
                                    : `<span class="rental-badge rental-badge--active">פעיל</span>`}
                            </div>
                            <div class="rental-card-fields">
                                <div class="rental-field">
                                    <span class="rental-field-label">לקוח</span>
                                    <span class="rental-field-value">${app.escapeHtml(rental.customerName)}</span>
                                </div>
                                <div class="rental-field">
                                    <span class="rental-field-label">כמות</span>
                                    <span class="rental-field-value">${rental.quantity} יח'</span>
                                </div>
                                <div class="rental-field">
                                    <span class="rental-field-label">תקופת השכרה</span>
                                    <span class="rental-field-value">${rental.rentDays} ימים</span>
                                </div>
                                <div class="rental-field">
                                    <span class="rental-field-label">נותרו</span>
                                    <span class="rental-field-value${overdue ? ' rental-field-value--overdue' : ''}">${overdue ? 'באיחור' : `${rental.remainingDays} ימים`}</span>
                                </div>
                                <div class="rental-field">
                                    <span class="rental-field-label">מועד סיום</span>
                                    <span class="rental-field-value">${app.formatDate(rental.dueAt)}</span>
                                </div>
                            </div>
                        </article>
                    `}).join('') : `<div class="inventory-empty-state">${isError ? 'לא ניתן לטעון את נתוני ההשכרה כרגע.' : 'אין כרגע פריטים מושכרים.'}</div>`}
                </div>
            `;
        }

        // ── Reserved Products ─────────────────────────────────────────────────
        if (section === 'reservations') {
            const reservations  = this._allReservations || [];
            const activeCount   = reservations.filter((r) => r.status === 'active').length;

            const statusBadge = (status) => {
                if (status === 'active')    return `<span class="rental-badge rental-badge--active">פעיל</span>`;
                if (status === 'expired')   return `<span class="rental-badge rental-badge--overdue">פג תוקף</span>`;
                if (status === 'cancelled') return `<span class="rental-badge reservation-badge--cancelled">בוטל</span>`;
                if (status === 'collected') return `<span class="rental-badge rental-badge--returned">נאסף</span>`;
                return `<span class="rental-badge">${app.escapeHtml(status)}</span>`;
            };

            const rows = reservations.length
                ? reservations.map((r) => {
                    const itemSummary = (r.items || []).map((item) => {
                        const p = app.getProductById(item.productId);
                        return `${app.escapeHtml(p ? p.name : item.productId)} (${item.quantity})`;
                    }).join(' · ');

                    const cancelBtn = r.status === 'active'
                        ? `<button class="action-button cancel-reservation-btn" data-reservation-id="${app.escapeHtml(r.id)}">ביטול</button>`
                        : '—';

                    return `
                        <tr>
                            <td><span class="order-id-chip">${app.escapeHtml(r.id)}</span></td>
                            <td>${app.escapeHtml(r.customerName)}</td>
                            <td class="reservation-items-cell">${itemSummary}</td>
                            <td>${app.formatDate(r.createdAt)}</td>
                            <td>${app.formatDate(r.expiresAt)}</td>
                            <td>${statusBadge(r.status)}</td>
                            <td>${cancelBtn}</td>
                        </tr>
                    `;
                }).join('')
                : `<tr><td colspan="7" style="text-align:center;padding:var(--space-5);color:var(--color-ink-muted);">אין הזמנות מוקדמות במערכת</td></tr>`;

            return `
                <div class="inventory-section-header inventory-panel-header">
                    <div>
                        <span class="eyebrow">הזמנות מוקדמות</span>
                        <h3>פריטים ששוריינו מראש על ידי סטודנטים</h3>
                    </div>
                    <span class="inventory-section-note">
                        ${activeCount} פעילות · ${reservations.length} סה"כ · תוקף מרבי 5 ימים
                    </span>
                </div>

                <div class="table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>מ"ה הזמנה</th>
                                <th>שם סטודנט</th>
                                <th>פריטים</th>
                                <th>תאריך הזמנה</th>
                                <th>תוקף עד</th>
                                <th>סטטוס</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        // ── Inventory Management ─────────────────────────────────────────────
        if (section === 'inventory') {
            const inventoryRows = app.products.map((product) => {
                const stock       = app.getInventoryStock(product.id);
                const statusClass = stock <= 2 ? 'stock-low' : 'stock-ok';
                const statusText  = stock <= 2 ? 'נמוך' : 'תקין';
                return `
                    <tr data-product-id="${product.id}">
                        <td>${app.escapeHtml(product.name)}</td>
                        <td>${app.escapeHtml(product.categoryLabel)}</td>
                        <td>${stock}</td>
                        <td>${product.price != null ? Number(product.price).toFixed(2) + ' ₪' : '—'}</td>
                        <td><span class="stock-pill ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="action-button edit-stock-btn" data-product-id="${product.id}" data-product-name="${app.escapeHtml(product.name)}">✏️ עריכה</button>
                            <button class="action-button remove-product-btn" data-product-id="${product.id}" data-product-name="${app.escapeHtml(product.name)}">❌ הסרה</button>
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
                    <button class="primary-button" id="add-product-btn">הוסף מוצר חדש</button>
                </div>

                <div class="table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>מוצר</th>
                                <th>סוג</th>
                                <th>מלאי</th>
                                <th>מחיר</th>
                                <th>סטטוס</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>${inventoryRows}</tbody>
                    </table>
                </div>

                <div id="edit-stock-modal" class="modal" style="display:none;">
                    <div class="modal-content">
                        <h2>עריכת מוצר</h2>
                        <form id="edit-stock-form">
                            <div class="form-field">
                                <label for="edit-product-name">שם המוצר</label>
                                <input type="text" id="edit-product-name" class="text-input" readonly style="background:#f0f0f0;">
                            </div>
                            <div class="form-field">
                                <label for="edit-stock-input" class="field-required">כמות במלאי</label>
                                <input type="number" id="edit-stock-input" class="text-input" min="0" required>
                            </div>
                            <div class="form-field">
                                <label for="edit-product-price" class="field-required">מחיר (₪)</label>
                                <input type="number" id="edit-product-price" class="text-input" min="0" step="0.01" required>
                            </div>
                            <div class="modal-actions">
                                <button type="submit" class="primary-button">שמירה</button>
                                <button type="button" class="secondary-button" onclick="closeEditModal()">ביטול</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div id="add-product-modal" class="modal" style="display:none;">
                    <div class="modal-content">
                        <h2>הוספת מוצר חדש</h2>
                        <form id="add-product-form">
                            <div class="form-field">
                                <label for="new-product-name" class="field-required">שם המוצר</label>
                                <input type="text" id="new-product-name" class="text-input" required>
                            </div>
                            <div class="form-field">
                                <label for="new-product-type" class="field-required">סוג</label>
                                <select id="new-product-type" class="text-input" required>
                                    <option value="">בחר...</option>
                                    <option value="rent">השכרה</option>
                                    <option value="buy">רכישה</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="new-product-stock" class="field-required">מלאי התחלתי</label>
                                <input type="number" id="new-product-stock" class="text-input" min="0" value="0" required>
                            </div>
                            <div class="form-field">
                                <label for="new-product-price" class="field-required">מחיר (₪)</label>
                                <input type="number" id="new-product-price" class="text-input" min="0" step="0.01" value="0" required>
                            </div>
                            <div class="modal-actions">
                                <button type="submit" class="primary-button">הוסף מוצר</button>
                                <button type="button" class="secondary-button" onclick="closeAddModal()">ביטול</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        }

        // ── Order History ────────────────────────────────────────────────────
        if (section === 'history') {
            const orders  = this._allOrders || [];
            const filters = this.historyFilters;

            const filtered = orders.filter((order) => {
                if (filters.customerName && !order.customerName?.toLowerCase().includes(filters.customerName.toLowerCase())) return false;
                if (filters.dateFrom && order.createdAt < filters.dateFrom) return false;
                if (filters.dateTo   && order.createdAt > filters.dateTo + 'T23:59:59') return false;
                if (filters.type !== 'all') {
                    const hasType = (order.items || []).some((item) => {
                        const p = app.getProductById(item.productId);
                        return p && p.type === filters.type;
                    });
                    if (!hasType) return false;
                }
                return true;
            });

            const totalRevenue = filtered.reduce((sum, o) => sum + Number(o.total || 0), 0);

            const rows = filtered.length
                ? filtered.map((order) => `
                    <tr>
                        <td><span class="order-id-chip">${app.escapeHtml(order.id)}</span></td>
                        <td>${app.escapeHtml(order.customerName || 'לא צוין')}</td>
                        <td>${app.formatDate(order.createdAt)}</td>
                        <td>${(order.items || []).length} פריטים</td>
                        <td>${order.total != null ? Number(order.total).toFixed(2) + ' ₪' : '-'}</td>
                        <td>${app.escapeHtml(order.provider || '-')}</td>
                    </tr>`).join('')
                : `<tr><td colspan="6" style="text-align:center;padding:var(--space-5);color:var(--color-ink-muted);">אין הזמנות תואמות את הסינון</td></tr>`;

            return `
                <div class="inventory-section-header inventory-panel-header">
                    <div>
                        <span class="eyebrow">היסטוריית הזמנות</span>
                        <h3>כל ההזמנות והרכישות</h3>
                    </div>
                    <span class="inventory-section-note">${filtered.length} הזמנות · ${totalRevenue.toFixed(2)} ₪ הכנסות</span>
                </div>

                <div class="history-filters">
                    <div class="history-filter-group">
                        <label for="history-name-filter">שם לקוח</label>
                        <input type="text" id="history-name-filter" class="text-input" placeholder="חיפוש חופשי..." value="${app.escapeHtml(filters.customerName)}">
                    </div>
                    <div class="history-filter-group">
                        <label for="history-date-from">מתאריך</label>
                        <input type="date" id="history-date-from" class="text-input" value="${filters.dateFrom}">
                    </div>
                    <div class="history-filter-group">
                        <label for="history-date-to">עד תאריך</label>
                        <input type="date" id="history-date-to" class="text-input" value="${filters.dateTo}">
                    </div>
                    <div class="history-filter-group">
                        <label for="history-type-filter">סוג הזמנה</label>
                        <select id="history-type-filter" class="text-input">
                            <option value="all"  ${filters.type === 'all'  ? 'selected' : ''}>הכל</option>
                            <option value="rent" ${filters.type === 'rent' ? 'selected' : ''}>השכרה</option>
                            <option value="buy"  ${filters.type === 'buy'  ? 'selected' : ''}>רכישה</option>
                        </select>
                    </div>
                </div>

                <div class="table-wrap">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>מזהה הזמנה</th>
                                <th>לקוח</th>
                                <th>תאריך</th>
                                <th>פריטים</th>
                                <th>סכום</th>
                                <th>אמצעי תשלום</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        // ── Summary - full business-insights dashboard ───────────────────────
        const {
            activeRentals  = [],
            dueSoon        = [],
            rentedUnits    = 0,
            soldUnits      = 0,
            salesRevenue   = 0,
            rentalRevenue  = 0,
            totalRevenue   = 0,
            avgRentDays    = 0,
            totalOrders    = 0,
            productCounts  = {},
            hourlyCounts   = new Array(24).fill(0),
            dailyCounts    = new Array(7).fill(0),
        } = summary || {};

        // ── Hourly bar chart ─────────────────────────────────────────────────
        const maxHourly  = Math.max(...hourlyCounts, 1);
        const hourBars   = hourlyCounts.map((count, hour) => {
            const h = Math.max(2, Math.round((count / maxHourly) * 110));
            return `<div class="bar-wrap" title="${String(hour).padStart(2, '0')}:00 - ${count} הזמנות">
                        <div class="bar" style="height:${h}px;"></div>
                        <span class="bar-label">${String(hour).padStart(2, '0')}</span>
                    </div>`;
        }).join('');

        // ── Horizontal product popularity chart ───────────────────────────────
        const sortedProducts  = Object.entries(productCounts).sort(([, a], [, b]) => b - a).slice(0, 7);
        const maxProductCount = Math.max(...sortedProducts.map(([, c]) => c), 1);
        const productHBars    = sortedProducts.map(([productId, count]) => {
            const product = app.getProductById(productId);
            const name    = product ? product.name : productId;
            const pct     = Math.round((count / maxProductCount) * 100);
            return `<div class="hbar-row">
                        <span class="hbar-label" title="${app.escapeHtml(name)}">${app.escapeHtml(name)}</span>
                        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;"></div></div>
                        <span class="hbar-value">${count}</span>
                    </div>`;
        }).join('');

        // ── Weekly bar chart ─────────────────────────────────────────────────
        const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
        const maxDaily   = Math.max(...dailyCounts, 1);
        const dayBars    = dailyCounts.map((count, day) => {
            const h = Math.max(2, Math.round((count / maxDaily) * 110));
            return `<div class="bar-wrap" title="${DAY_LABELS[day]} - ${count} הזמנות">
                        <div class="bar bar--weekly" style="height:${h}px;"></div>
                        <span class="bar-label">${DAY_LABELS[day]}</span>
                    </div>`;
        }).join('');

        // ── Revenue split ─────────────────────────────────────────────────────
        const totalRev = rentalRevenue + salesRevenue;
        const rentPct  = totalRev > 0 ? Math.round((rentalRevenue / totalRev) * 100) : 0;
        const buyPct   = totalRev > 0 ? Math.round((salesRevenue  / totalRev) * 100) : 0;

        // ── Low stock items ───────────────────────────────────────────────────
        const lowStock = app.products.filter((p) => app.getInventoryStock(p.id) <= 2);

        // ── Active reservations ───────────────────────────────────────────────
        const now              = Date.now();
        const activeReservations = (this._allReservations || []).filter((r) => r.status === 'active');
        const reservedUnits    = activeReservations.reduce(
            (sum, r) => sum + (r.items || []).reduce((s, i) => s + i.quantity, 0), 0
        );
        const expiringToday = activeReservations.filter(
            (r) => new Date(r.expiresAt).getTime() - now < 24 * 60 * 60 * 1000
        );

        return `
            <div class="inventory-section-header inventory-panel-header">
                <div>
                    <span class="eyebrow">סטטיסטיקות</span>
                    <h3>לוח בקרה - תובנות עסקיות</h3>
                </div>
                <span class="inventory-section-note">${totalOrders} הזמנות בסה"כ</span>
            </div>

            <!-- ── KPI Cards ──────────────────────────────────────────── -->
            <section class="dashboard-kpi-grid" aria-live="polite">
                <article class="card inventory-stat-card">
                    <span class="inventory-stat-label">סה"כ הזמנות</span>
                    <strong>${totalOrders}</strong>
                    <small>כלל ההזמנות שנרשמו במערכת</small>
                </article>
                <article class="card inventory-stat-card kpi-2">
                    <span class="inventory-stat-label">השכרות פעילות</span>
                    <strong>${activeRentals.length}</strong>
                    <small>השכרות שטרם הסתיימו</small>
                </article>
                <article class="card inventory-stat-card kpi-3">
                    <span class="inventory-stat-label">יחידות מושכרות כרגע</span>
                    <strong>${rentedUnits}</strong>
                    <small>סך פריטים להשכרה שיצאו מהמלאי</small>
                </article>
                <article class="card inventory-stat-card kpi-4">
                    <span class="inventory-stat-label">פריטים שנמכרו</span>
                    <strong>${soldUnits}</strong>
                    <small>סך פריטים לרכישה שיצאו מהמלאי</small>
                </article>
                <article class="card inventory-stat-card kpi-5">
                    <span class="inventory-stat-label">סה"כ הכנסות</span>
                    <strong>${totalRevenue.toFixed(0)} ₪</strong>
                    <small>הכנסות כוללות מהשכרות ורכישות</small>
                </article>
                <article class="card inventory-stat-card kpi-2">
                    <span class="inventory-stat-label">הזמנות מוקדמות פעילות</span>
                    <strong>${activeReservations.length}</strong>
                    <small>הזמנות ששוריינו וטרם נאספו</small>
                </article>
            </section>

            <!-- ── Charts Row ─────────────────────────────────────────── -->
            <div class="dashboard-charts-grid">
                <div class="card dashboard-chart-card">
                    <h4 class="chart-title">שעות שיא - הזמנות לפי שעה ביום</h4>
                    <div class="bar-chart-wrap dashboard-chart-inner">
                        <div class="bar-chart-bars">${hourBars}</div>
                    </div>
                </div>
                <div class="card dashboard-chart-card">
                    <h4 class="chart-title">מוצרים פופולריים - לפי כמות יחידות שנרשמו</h4>
                    ${sortedProducts.length
                        ? `<div class="hbar-list">${productHBars}</div>`
                        : `<div class="inventory-empty-state insight-empty">אין נתוני הזמנות עדיין</div>`}
                </div>
            </div>

            <!-- ── Weekly Chart + Revenue Split ─────────────────────── -->
            <div class="dashboard-charts-grid">
                <div class="card dashboard-chart-card">
                    <h4 class="chart-title">הזמנות לפי יום בשבוע</h4>
                    <div class="bar-chart-wrap dashboard-chart-inner">
                        <div class="bar-chart-bars bar-chart-bars--weekly">${dayBars}</div>
                    </div>
                </div>
                <div class="card insight-card">
                    <h4 class="insight-title">פירוט הכנסות</h4>
                    ${totalRev > 0 ? `
                        <div class="revenue-split">
                            <div class="revenue-row">
                                <span class="revenue-label">השכרות</span>
                                <div class="split-track">
                                    <div class="split-fill split-rent" style="width:${rentPct}%;"></div>
                                </div>
                                <span class="revenue-value">${rentalRevenue.toFixed(0)} ₪</span>
                            </div>
                            <div class="revenue-row">
                                <span class="revenue-label">רכישות</span>
                                <div class="split-track">
                                    <div class="split-fill split-buy" style="width:${buyPct}%;"></div>
                                </div>
                                <span class="revenue-value">${salesRevenue.toFixed(0)} ₪</span>
                            </div>
                        </div>
                        <div class="revenue-total">סה"כ: <strong>${totalRevenue.toFixed(0)} ₪</strong></div>
                    ` : `<div class="inventory-empty-state insight-empty">אין נתוני הכנסות עדיין</div>`}
                </div>
            </div>

            <!-- ── Insights Row ───────────────────────────────────────── -->
            <div class="dashboard-insights-grid">
                <div class="card insight-card">
                    <h4 class="insight-title">
                        מסתיים בקרוב
                        ${dueSoon.length ? `<span class="insight-badge insight-badge-danger">${dueSoon.length}</span>` : ''}
                    </h4>
                    ${dueSoon.length ? `
                        <ul class="insight-list">
                            ${dueSoon.map((r) => `
                                <li class="insight-list-item">
                                    <div class="insight-item-info">
                                        <strong>${app.escapeHtml(r.productName)}</strong>
                                        <span>${app.escapeHtml(r.customerName)}</span>
                                    </div>
                                    <span class="due-badge">${r.remainingDays <= 0 ? 'היום' : 'מחר'}</span>
                                </li>`).join('')}
                        </ul>
                    ` : `<div class="inventory-empty-state insight-empty insight-ok">אין פריטים המסתיימים בקרוב</div>`}
                </div>

                <div class="card insight-card">
                    <h4 class="insight-title">
                        התראות מלאי נמוך
                        ${lowStock.length ? `<span class="insight-badge insight-badge-warn">${lowStock.length}</span>` : ''}
                    </h4>
                    ${lowStock.length ? `
                        <ul class="insight-list">
                            ${lowStock.map((p) => {
                                const stock = app.getInventoryStock(p.id);
                                return `<li class="insight-list-item">
                                    <span class="insight-item-name">${app.escapeHtml(p.name)}</span>
                                    <span class="stock-pill ${stock === 0 ? 'stock-empty' : 'stock-low'}">${stock} יחידות</span>
                                </li>`;
                            }).join('')}
                        </ul>
                    ` : `<div class="inventory-empty-state insight-empty insight-ok">כל המלאי תקין</div>`}
                </div>

                <div class="card insight-card">
                    <h4 class="insight-title">
                        הזמנות מוקדמות פעילות
                        ${activeReservations.length ? `<span class="insight-badge insight-badge-warn">${activeReservations.length}</span>` : ''}
                    </h4>
                    ${activeReservations.length ? `
                        <ul class="insight-list">
                            ${activeReservations.map((r) => {
                                const msLeft   = new Date(r.expiresAt).getTime() - now;
                                const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
                                const badge    = daysLeft <= 0
                                    ? `<span class="due-badge">היום</span>`
                                    : daysLeft === 1
                                    ? `<span class="due-badge">מחר</span>`
                                    : `<span class="stock-pill stock-low">${daysLeft} ימים</span>`;
                                const itemSummary = (r.items || []).map((item) => {
                                    const p = app.getProductById(item.productId);
                                    return `${app.escapeHtml(p?.name ?? item.productId)} ×${item.quantity}`;
                                }).join(', ');
                                return `<li class="insight-list-item">
                                    <div class="insight-item-info">
                                        <strong>${app.escapeHtml(r.customerName)}</strong>
                                        <span>${itemSummary}</span>
                                    </div>
                                    ${badge}
                                </li>`;
                            }).join('')}
                        </ul>
                    ` : `<div class="inventory-empty-state insight-empty insight-ok">אין הזמנות מוקדמות פעילות</div>`}
                </div>
            </div>
        `;
    }

    // ===== History Filter Helper =====

    _updateHistoryFilter(input) {
        const inputId = input.id;
        if (input.id === 'history-name-filter') this.historyFilters.customerName = input.value;
        if (input.id === 'history-date-from')   this.historyFilters.dateFrom     = input.value;
        if (input.id === 'history-date-to')     this.historyFilters.dateTo       = input.value;
        if (input.id === 'history-type-filter') this.historyFilters.type         = input.value;
        this.renderDashboardPanel();
        const refocused = document.getElementById(inputId);
        if (refocused && refocused.type === 'text') {
            const len = refocused.value.length;
            refocused.focus();
            refocused.setSelectionRange(len, len);
        }
    }

    // ===== Modal Helpers =====

    openEditModal(productId, productName) {
        const modal      = document.querySelector(this.selectors.editModal);
        const nameField  = document.querySelector(this.selectors.editNameField);
        const stockField = document.querySelector(this.selectors.editStockField);
        const priceField = document.querySelector(this.selectors.editPriceField);
        if (modal && nameField && stockField && priceField) {
            const product                = this.app.getProductById(productId);
            nameField.value              = productName;
            stockField.value             = this.app.getInventoryStock(productId);
            stockField.dataset.productId = productId;
            priceField.value             = product?.price ?? 0;
            modal.style.display          = 'flex';
        }
    }

    closeEditModal() {
        const modal = document.querySelector(this.selectors.editModal);
        if (modal) modal.style.display = 'none';
    }

    openAddModal() {
        const modal = document.querySelector(this.selectors.addModal);
        const form  = document.querySelector(this.selectors.addForm);
        if (modal && form) {
            form.reset();
            modal.style.display = 'flex';
        }
    }

    closeAddModal() {
        const modal = document.querySelector(this.selectors.addModal);
        if (modal) modal.style.display = 'none';
    }

}
