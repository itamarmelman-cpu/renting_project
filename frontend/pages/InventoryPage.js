import { CatalogPage } from './CatalogPage.js';

export class InventoryPage {
    static ROUTE = 'inventory';
    static URL = '#inventory';

    constructor(app) {
        this.app = app;
        this.activeSection    = 'summary';
        this.dashboardSummary = null;
        this.currentFetchId   = 0;
        this._allOrders       = [];

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

    saveStockEdit() {
        const { app } = this;
        const stockField = document.querySelector(this.selectors.editStockField);
        if (!stockField?.dataset.productId) return;

        const productId = stockField.dataset.productId;
        const newStock  = parseInt(stockField.value, 10);

        if (isNaN(newStock) || newStock < 0) return;

        app.state.inventory[productId] = newStock;
        app.saveInventoryState();
        this.closeEditModal();
        app.rerender();
    }

    saveNewProduct() {
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

        const newId = `p${String(app.products.length + 1).padStart(3, '0')}`;
        app.products.push({
            id:            newId,
            name,
            description:   `${name} - נוסף ${new Date().toLocaleDateString('he-IL')}`,
            type:          type === 'rent' ? 'rent' : 'buy',
            price,
            stock,
            visual:        '📦',
            image:         '',
            categoryLabel: type === 'rent' ? 'השכרה' : 'רכישה',
            rentLabel:     type === 'rent' ? 'ליום' : '',
            searchTerms:   name.toLowerCase(),
        });

        app.state.inventory[newId] = stock;
        app.saveInventoryState();
        this.closeAddModal();
        app.rerender();
    }

    deleteProduct(productId) {
        const { app } = this;
        const product = app.products.find((p) => p.id === productId);
        if (!product) return;

        app.products.splice(app.products.indexOf(product), 1);
        delete app.state.inventory[productId];
        app.saveInventoryState();
        app.rerender();
    }

    // ===== Event Handlers =====

    render() {
        return `
            <section class="card inventory-dashboard-shell">
                <div class="inventory-section-header">
                    <div>
                        <h1>ניהול מלאי אגודה</h1>
                    </div>
                    <label class="inventory-section-selector">
                        <span class="inventory-section-note">קטגוריה</span>
                        <select id="inventory-section-select" class="text-input inventory-view-select">
                            <option value="summary"${this.activeSection === 'summary'   ? ' selected' : ''}>סטטיסטיקות</option>
                            <option value="rentals"${this.activeSection === 'rentals'   ? ' selected' : ''}>בהשכרה כרגע</option>
                            <option value="inventory"${this.activeSection === 'inventory' ? ' selected' : ''}>ניהול מלאי</option>
                            <option value="history"${this.activeSection === 'history'   ? ' selected' : ''}>היסטוריית הזמנות</option>
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
        }
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
            this.saveStockEdit();
            return;
        }
        if (event.target.closest(this.selectors.addForm)) {
            event.preventDefault();
            this.saveNewProduct();
        }
    }

    // ===== Dashboard Data =====

    async fetchDashboardData() {
        let orders;
        try {
            const res = await fetch('/api/orders');
            if (res.ok) {
                orders = await res.json();
            } else {
                throw new Error('API unavailable');
            }
        } catch {
            orders = this.app.loadStoredJson('agugo.orders', []);
        }
        this._allOrders       = orders;
        this.dashboardSummary = this.buildDashboardSummary(orders);
        this.renderDashboardPanel();
    }

    buildDashboardSummary(orders) {
        const now      = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;

        const activeRentals = [];
        const dueSoon       = [];
        let soldUnits = 0, salesRevenue = 0, rentedUnits = 0;
        let rentalRevenue = 0, totalRentDays = 0, rentItemCount = 0;
        const productCounts = {};
        const hourlyCounts  = new Array(24).fill(0);

        orders.forEach((order) => {
            if (order.createdAt) {
                hourlyCounts[new Date(order.createdAt).getHours()]++;
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
                        rentedUnits += quantity;
                        const rental = {
                            orderId:      order.id,
                            productId:    item.productId,
                            productName:  product.name,
                            quantity,
                            rentDays,
                            customerName: order.customerName || 'לא צוין',
                            startedAt:    order.createdAt || null,
                            dueAt:        new Date(dueAt).toISOString(),
                            remainingDays,
                        };
                        activeRentals.push(rental);
                        if (remainingDays <= 1) dueSoon.push(rental);
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
                    ${rentals.length ? rentals.map((rental) => `
                        <article class="inventory-rental-row">
                            <div class="inventory-rental-main">
                                <strong>${app.escapeHtml(rental.productName)}</strong>
                                <span>כמות: ${rental.quantity} · לקוח: ${app.escapeHtml(rental.customerName)}</span>
                            </div>
                            <div class="inventory-rental-meta">
                                <span>תקופה: ${rental.rentDays} ימים</span>
                                <span>נותרו: ${rental.remainingDays} ימים</span>
                                <span>מועד סיום: ${app.formatDate(rental.dueAt)}</span>
                            </div>
                        </article>
                    `).join('') : `<div class="inventory-empty-state">${isError ? 'לא ניתן לטעון את נתוני ההשכרה כרגע.' : 'אין כרגע פריטים מושכרים.'}</div>`}
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
                                <th>סטטוס</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>${inventoryRows}</tbody>
                    </table>
                </div>

                <div id="edit-stock-modal" class="modal" style="display:none;">
                    <div class="modal-content">
                        <h2>עדכון מלאי</h2>
                        <form id="edit-stock-form">
                            <div>
                                <label>שם המוצר</label>
                                <input type="text" id="edit-product-name" readonly style="background:#f0f0f0;">
                            </div>
                            <div>
                                <label class="field-required">כמות במלאי</label>
                                <input type="number" id="edit-stock-input" min="0" required>
                            </div>
                            <div style="display:flex;gap:10px;margin-top:20px;">
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
                            <div>
                                <label class="field-required">שם המוצר</label>
                                <input type="text" id="new-product-name" required>
                            </div>
                            <div>
                                <label class="field-required">סוג</label>
                                <select id="new-product-type" required>
                                    <option value="">בחר...</option>
                                    <option value="rent">השכרה</option>
                                    <option value="buy">רכישה</option>
                                </select>
                            </div>
                            <div>
                                <label class="field-required">מלאי התחלתי</label>
                                <input type="number" id="new-product-stock" min="0" value="0" required>
                            </div>
                            <div>
                                <label class="field-required">מחיר (₪)</label>
                                <input type="number" id="new-product-price" min="0" step="0.01" value="0" required>
                            </div>
                            <div style="display:flex;gap:10px;margin-top:20px;">
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
                        <td>${order.total != null ? Number(order.total).toFixed(2) + ' ₪' : '—'}</td>
                        <td>${app.escapeHtml(order.provider || '—')}</td>
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

        // ── Summary — full business-insights dashboard ───────────────────────
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
        } = summary || {};

        // ── Hourly bar chart ──────────────────────────────────────────────────
        const maxHourly  = Math.max(...hourlyCounts, 1);
        const hourBars   = hourlyCounts.map((count, hour) => {
            const h = Math.max(2, Math.round((count / maxHourly) * 110));
            return `<div class="bar-wrap" title="${String(hour).padStart(2, '0')}:00 — ${count} הזמנות">
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

        // ── Revenue split ─────────────────────────────────────────────────────
        const totalRev = rentalRevenue + salesRevenue;
        const rentPct  = totalRev > 0 ? Math.round((rentalRevenue / totalRev) * 100) : 0;
        const buyPct   = totalRev > 0 ? Math.round((salesRevenue  / totalRev) * 100) : 0;

        // ── Low stock items ───────────────────────────────────────────────────
        const lowStock = app.products.filter((p) => app.getInventoryStock(p.id) <= 2);

        return `
            <div class="inventory-section-header inventory-panel-header">
                <div>
                    <span class="eyebrow">סטטיסטיקות</span>
                    <h3>לוח בקרה — תובנות עסקיות</h3>
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
                    <small>סך פריטים שיצאו מהמלאי</small>
                </article>
                <article class="card inventory-stat-card kpi-4">
                    <span class="inventory-stat-label">פריטים נמכרו</span>
                    <strong>${soldUnits}</strong>
                    <small>מוצרי רכישה שנמכרו</small>
                </article>
                <article class="card inventory-stat-card kpi-5">
                    <span class="inventory-stat-label">סה"כ הכנסות</span>
                    <strong>${totalRevenue.toFixed(0)} ₪</strong>
                    <small>השכרה + רכישה גם יחד</small>
                </article>
                <article class="card inventory-stat-card kpi-6">
                    <span class="inventory-stat-label">ממוצע ימי השכרה</span>
                    <strong>${avgRentDays}</strong>
                    <small>ממוצע ימים לפריט שהושכר</small>
                </article>
            </section>

            <!-- ── Charts Row ─────────────────────────────────────────── -->
            <div class="dashboard-charts-grid">
                <div class="card dashboard-chart-card">
                    <h4 class="chart-title">שעות שיא — הזמנות לפי שעה ביום</h4>
                    <div class="bar-chart-wrap dashboard-chart-inner">
                        <div class="bar-chart-bars">${hourBars}</div>
                    </div>
                </div>
                <div class="card dashboard-chart-card">
                    <h4 class="chart-title">מוצרים פופולריים — לפי כמות יחידות שנרשמו</h4>
                    ${sortedProducts.length
                        ? `<div class="hbar-list">${productHBars}</div>`
                        : `<div class="inventory-empty-state insight-empty">אין נתוני הזמנות עדיין</div>`}
                </div>
            </div>

            <!-- ── Insights Row ───────────────────────────────────────── -->
            <div class="dashboard-insights-grid">
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
                                    <span class="due-badge">היום</span>
                                </li>`).join('')}
                        </ul>
                    ` : `<div class="inventory-empty-state insight-empty insight-ok">אין פריטים המסתיימים היום</div>`}
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
        if (modal && nameField && stockField) {
            nameField.value              = productName;
            stockField.value             = this.app.getInventoryStock(productId);
            stockField.dataset.productId = productId;
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
