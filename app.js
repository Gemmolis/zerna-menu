const menuGrid = document.getElementById("menuGrid");
const categoriesList = document.getElementById("categoriesList");

const cartPanel = document.getElementById("cartPanel");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotalCount = document.getElementById("cartTotalCount");
const cartTotalPrice = document.getElementById("cartTotalPrice");
const clearCartBtn = document.getElementById("clearCartBtn");
const checkoutBtn = document.getElementById("checkoutBtn");
const mobileCartBtn = document.getElementById("mobileCartBtn");
const cartToggle = document.getElementById("cartToggle");
const cartOverlay = document.getElementById("cartOverlay");
const closeCartBtn = document.getElementById("closeCartBtn");

const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");
const modalImage = document.getElementById("modalImage");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDescription = document.getElementById("modalDescription");
const modalComposition = document.getElementById("modalComposition");
const modalNutrition = document.getElementById("modalNutrition");
const modalAllergens = document.getElementById("modalAllergens");
const modalNoteWrap = document.getElementById("modalNoteWrap");
const modalNote = document.getElementById("modalNote");
const modalAddToCart = document.getElementById("modalAddToCart");

const checkoutForm = document.getElementById("checkoutForm");
const orderSuccess = document.getElementById("orderSuccess");
const orderSuccessText = document.getElementById("orderSuccessText");
const successOrderId = document.getElementById("successOrderId");
const newOrderBtn = document.getElementById("newOrderBtn");
const orderSubmitBtn = document.getElementById("orderSubmitBtn");
const phoneInput = document.getElementById("phone");

let orderSubmitInFlight = false;

function setSubmitOrderLoading(loading) {
  if (!orderSubmitBtn) return;
  if (loading) {
    if (!orderSubmitBtn.dataset.defaultLabel) {
      orderSubmitBtn.dataset.defaultLabel = orderSubmitBtn.textContent.trim();
    }
    orderSubmitBtn.disabled = true;
    orderSubmitBtn.setAttribute("aria-busy", "true");
    orderSubmitBtn.classList.add("is-busy");
    orderSubmitBtn.textContent = "Отправляем…";
  } else {
    orderSubmitBtn.disabled = false;
    orderSubmitBtn.removeAttribute("aria-busy");
    orderSubmitBtn.classList.remove("is-busy");
    orderSubmitBtn.textContent =
      orderSubmitBtn.dataset.defaultLabel || "Отправить заказ";
  }
}

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastSubtitle = document.getElementById("toastSubtitle");

let toastHideTimer = null;

function showToast(message, timeout = 4000, subtitle = null) {
  if (!toast || !toastMessage) return;
  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  toastMessage.textContent = message;
  if (toastSubtitle) {
    if (subtitle) {
      toastSubtitle.textContent = subtitle;
      toastSubtitle.hidden = false;
    } else {
      toastSubtitle.textContent = "";
      toastSubtitle.hidden = true;
    }
  }
  toast.classList.add("toast--visible");

  toastHideTimer = setTimeout(() => {
    toast.classList.remove("toast--visible");
    toastHideTimer = null;
  }, timeout);
}

// TODO: заменить на реальный URL бэкенда (твой ngrok)
const ORDER_WEBHOOK_URL =
  "https://rewrite-heritage-void.ngrok-free.dev/api/orders/from-site";

let menuData = [];
let categoriesData = [];
let activeCategory = "Все";
let cart = [];
let currentModalItem = null;
let currentSelectedModifiers = [];

// --- Работа с localStorage ---
function loadCartFromStorage() {
  try {
    const savedCart = localStorage.getItem("zerna_cart");
    if (savedCart) {
      cart = JSON.parse(savedCart);
    }
  } catch (e) {
    console.error("Ошибка чтения корзины:", e);
    cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem("zerna_cart", JSON.stringify(cart));
  } catch (e) {
    console.error("Ошибка сохранения корзины:", e);
  }
}

// --- Вспомогательные функции ---
function formatPrice(value) {
  return `${Number(value || 0)} ₽`;
}

function escapeHtml(text) {
  const s = String(text ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMenuSkeleton() {
  if (!menuGrid) return;
  const n = 6;
  const cards = Array.from({ length: n }, () => {
    return `
      <article class="menu-card menu-card--skeleton" aria-hidden="true">
        <div class="menu-card__image menu-card__image--skeleton"></div>
        <div class="menu-card__body">
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--tags"></div>
          <div class="skeleton-line skeleton-line--price"></div>
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </article>
    `;
  }).join("");
  menuGrid.innerHTML = cards;
}

function setPhoneMask() {
  if (!phoneInput) return;

  phoneInput.addEventListener("focus", () => {
    if (!phoneInput.value) {
      phoneInput.value = "+7 ";
    }
  });

  phoneInput.addEventListener("input", () => {
    let digits = phoneInput.value.replace(/\D/g, "");
    if (!digits.startsWith("7")) {
      digits = "7" + digits.replace(/^7*/, "");
    }
    digits = digits.substring(0, 11);

    let formatted = "+7";
    if (digits.length > 1) {
      formatted += " (";
      formatted += digits.substring(1, Math.min(4, digits.length));
    }
    if (digits.length >= 4) {
      formatted += ") ";
      formatted += digits.substring(4, Math.min(7, digits.length));
    }
    if (digits.length >= 7) {
      formatted += "-";
      formatted += digits.substring(7, Math.min(9, digits.length));
    }
    if (digits.length >= 9) {
      formatted += "-";
      formatted += digits.substring(9, Math.min(11, digits.length));
    }
    phoneInput.value = formatted;
  });
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("7");
}

// --- Управление корзиной (UI) ---
function openCart() {
  if (cartPanel) cartPanel.classList.add("is-open");
  if (cartOverlay) cartOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCart() {
  if (cartPanel) cartPanel.classList.remove("is-open");
  if (cartOverlay) cartOverlay.hidden = true;
  document.body.style.overflow = "";
}

function getTagLabels(tags = []) {
  const labels = {
    vegan: "Веган",
    vegetarian: "Вегетарианское",
    "gluten-free": "Без глютена",
  };
  return tags
    .filter((tag) => tag !== "new")
    .map((tag) => `<span class="tag">${escapeHtml(labels[tag] || tag)}</span>`)
    .join("");
}

function getVisibleItems() {
  if (activeCategory === "Все") return menuData;
  return menuData.filter((item) => item.category === activeCategory);
}

function renderCategories() {
  const list = ["Все", ...categoriesData];
  if (!categoriesList) return;

  categoriesList.innerHTML = list
    .map((category) => {
      const activeClass = category === activeCategory ? "active" : "";
      return `<button class="category-chip ${activeClass}" type="button" data-category="${category}">${category}</button>`;
    })
    .join("");
}

function renderMenu(items) {
  if (!menuGrid) return;
  if (!items.length) {
    menuGrid.innerHTML = `<div class="cart-empty"><p>В этой категории пока нет позиций.</p></div>`;
    return;
  }

  menuGrid.innerHTML = items
    .map((item) => {
      const hasBadge = item.tags?.includes("new");
      const tagsHtml = getTagLabels(item.tags || []);

      return `
        <article class="menu-card">
          ${hasBadge ? '<span class="menu-badge">Новинка</span>' : ""}
          <div class="menu-card__image">
            ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">` : `<div class="menu-card__placeholder" role="img" aria-label="Фото появится позже"><span class="menu-card__placeholder-icon" aria-hidden="true"></span><span class="menu-card__placeholder-text">Фото скоро</span></div>`}
          </div>
          <div class="menu-card__body">
            <p class="menu-card__category">${escapeHtml(item.category)}</p>
            <h3>${escapeHtml(item.name)}</h3>
            ${tagsHtml ? `<div class="tags-row">${tagsHtml}</div>` : '<div class="tags-row tags-row--empty"></div>'}
            <div class="menu-card__footer">
              <p class="menu-card__price">${formatPrice(item.price)}</p>
              <div class="menu-card__actions">
                <button class="secondary-btn details-btn" type="button" data-id="${item.id}">Подробнее</button>
                <button class="primary-btn add-btn" type="button" data-add-id="${item.id}">Добавить</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNutrition(nutrition = {}) {
  if (!modalNutrition) return;
  const values = [
    { label: "Ккал", value: nutrition["ккал"] || "Уточняется" },
    { label: "Белки", value: nutrition["белки"] || "—" },
    { label: "Жиры", value: nutrition["жиры"] || "—" },
    { label: "Углеводы", value: nutrition["углеводы"] || "—" },
  ];
  modalNutrition.innerHTML = values
    .map(
      (item) =>
        `<div class="nutrition-card"><span class="nutrition-card__label">${item.label}</span><strong class="nutrition-card__value">${item.value}</strong></div>`,
    )
    .join("");
}

function renderAllergens(allergens = []) {
  if (!modalAllergens) return;
  if (!allergens.length) {
    modalAllergens.innerHTML =
      '<p class="empty-text">Явные аллергены не указаны.</p>';
    return;
  }
  modalAllergens.innerHTML = allergens
    .map((item) => `<span class="allergen-tag">${escapeHtml(item)}</span>`)
    .join("");
}

function openProductModal(item) {
  currentModalItem = item;
  currentSelectedModifiers = [];

  if (modalImage) {
    modalImage.innerHTML = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : `<div class="product-modal__image-placeholder" role="img" aria-label="Фото появится позже"><span class="menu-card__placeholder-icon" aria-hidden="true"></span><span class="menu-card__placeholder-text">Фото скоро</span></div>`;
  }

  if (modalCategory) modalCategory.textContent = item.category || "";
  if (modalTitle) modalTitle.textContent = item.name || "";
  if (modalDescription)
    modalDescription.textContent = item.description || "Описание уточняется.";
  if (modalPrice) modalPrice.textContent = formatPrice(item.price || 0);

  if (modalComposition) {
    modalComposition.innerHTML = (item.composition || [])
      .map((point) => `<li>${escapeHtml(point)}</li>`)
      .join("");
  }

  renderNutrition(item.nutrition || {});
  renderAllergens(item.allergens || []);

  if (modalNoteWrap && modalNote) {
    if (item.note) {
      modalNote.textContent = item.note;
      modalNoteWrap.style.display = "block";
    } else {
      modalNote.textContent = "";
      modalNoteWrap.style.display = "none";
    }
  }

  // Рендер модификаторов (добавок)
  const modWrap = document.getElementById("modalModifiersWrap");
  const modContainer = document.getElementById("modalModifiers");

  if (item.modifiers && item.modifiers.length > 0) {
    modWrap.style.display = "block";
    modContainer.innerHTML = item.modifiers
      .map(
        (mod) => `
      <label class="modifier-item">
        <input type="checkbox" value="${mod.id}" data-price="${mod.price}" data-name="${escapeHtml(mod.name)}">
        <span class="modifier-name">${escapeHtml(mod.name)}</span>
        <span class="modifier-price">+${formatPrice(mod.price)}</span>
      </label>
    `,
      )
      .join("");

    const checkboxes = modContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.addEventListener("change", updateModalPrice);
    });
  } else {
    modWrap.style.display = "none";
    modContainer.innerHTML = "";
  }

  if (productModal && typeof productModal.showModal === "function") {
    productModal.showModal();
  }
}

function updateModalPrice() {
  if (!currentModalItem) return;
  const modContainer = document.getElementById("modalModifiers");
  const checkboxes = modContainer.querySelectorAll(
    'input[type="checkbox"]:checked',
  );

  let extraPrice = 0;
  currentSelectedModifiers = [];

  checkboxes.forEach((cb) => {
    extraPrice += Number(cb.dataset.price);
    currentSelectedModifiers.push({
      id: cb.value,
      name: cb.dataset.name,
      price: Number(cb.dataset.price),
    });
  });

  const totalPrice = currentModalItem.price + extraPrice;
  if (modalPrice) modalPrice.textContent = formatPrice(totalPrice);
}

function closeModal() {
  if (productModal && productModal.open) {
    productModal.close();
  }
  currentModalItem = null;
}

function addToCart(itemId, modifiers = []) {
  const product = menuData.find((item) => item.id === itemId);
  if (!product) return;

  const modIds = modifiers
    .map((m) => m.id)
    .sort()
    .join("-");
  const cartItemId = modIds ? `${itemId}_${modIds}` : `${itemId}`;
  const modsPrice = modifiers.reduce((sum, m) => sum + m.price, 0);
  const finalPrice = product.price + modsPrice;
  const modsNames = modifiers.map((m) => m.name).join(", ");
  const finalName = modsNames ? `${product.name} (${modsNames})` : product.name;

  const existing = cart.find((item) => item.id === cartItemId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: cartItemId,
      originalId: product.id,
      name: finalName,
      category: product.category,
      price: finalPrice,
      quantity: 1,
    });
  }

  renderCart();
  openCart();
}

function increaseCartItem(itemId) {
  const item = cart.find((product) => product.id === itemId);
  if (!item) return;
  item.quantity += 1;
  renderCart();
}

function decreaseCartItem(itemId) {
  const item = cart.find((product) => product.id === itemId);
  if (!item) return;
  item.quantity -= 1;
  if (item.quantity <= 0) {
    cart = cart.filter((product) => product.id !== itemId);
  }
  renderCart();
}

function removeCartItem(itemId) {
  cart = cart.filter((item) => item.id !== itemId);
  renderCart();
}

function getCartTotals() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  return { totalCount, totalPrice };
}

function renderCart() {
  const { totalCount, totalPrice } = getCartTotals();
  if (!cartItems) return;

  if (!cart.length) {
    cartItems.innerHTML = `<div class="cart-empty"><p>Пока пусто. Добавьте блюда из меню.</p></div>`;
  } else {
    cartItems.innerHTML = cart
      .map((item) => {
        const itemSum = item.price * item.quantity;
        return `
        <article class="cart-item">
          <div class="cart-item__top">
            <div>
              <p class="cart-item__category">${item.category}</p>
              <h3 class="cart-item__title">${item.name}</h3>
            </div>
            <button class="cart-item__remove" type="button" data-remove-id="${item.id}" aria-label="Удалить позицию">✕</button>
          </div>
          <div class="cart-item__bottom">
            <div class="cart-stepper">
              <button class="cart-stepper__btn" type="button" data-decrease-id="${item.id}" aria-label="Уменьшить количество">−</button>
              <span class="cart-stepper__value">${item.quantity}</span>
              <button class="cart-stepper__btn" type="button" data-increase-id="${item.id}" aria-label="Увеличить количество">+</button>
            </div>
            <strong class="cart-item__sum">${formatPrice(itemSum)}</strong>
          </div>
        </article>
      `;
      })
      .join("");
  }

  if (cartCount) cartCount.textContent = totalCount;
  if (cartTotalCount) cartTotalCount.textContent = totalCount;
  if (cartTotalPrice) cartTotalPrice.textContent = formatPrice(totalPrice);
  if (mobileCartBtn) {
    mobileCartBtn.textContent = totalCount
      ? `Корзина · ${formatPrice(totalPrice)}`
      : "Корзина · 0 ₽";
  }

  saveCartToStorage();
  bindCartItemActions();
}

function bindCategoryActions() {
  const categoryButtons = document.querySelectorAll("[data-category]");
  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCategories();
      renderMenu(getVisibleItems());
      bindCategoryActions();
      bindMenuActions();
    });
  });
}

function bindMenuActions() {
  const addButtons = document.querySelectorAll("[data-add-id]");
  const detailsButtons = document.querySelectorAll(".details-btn");

  addButtons.forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(Number(button.dataset.addId));
    });
  });

  detailsButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = Number(button.dataset.id);
      const item = menuData.find((product) => product.id === itemId);
      if (item) {
        openProductModal(item);
      }
    });
  });
}

function bindCartItemActions() {
  const increaseButtons = document.querySelectorAll("[data-increase-id]");
  const decreaseButtons = document.querySelectorAll("[data-decrease-id]");
  const removeButtons = document.querySelectorAll("[data-remove-id]");

  increaseButtons.forEach((button) => {
    button.addEventListener("click", () =>
      increaseCartItem(button.dataset.increaseId),
    );
  });
  decreaseButtons.forEach((button) => {
    button.addEventListener("click", () =>
      decreaseCartItem(button.dataset.decreaseId),
    );
  });
  removeButtons.forEach((button) => {
    button.addEventListener("click", () =>
      removeCartItem(button.dataset.removeId),
    );
  });
}

function setFormStatus(message = "", type = "") {
  if (!checkoutForm) return;
  let statusEl = checkoutForm.querySelector(".form-status");
  if (!statusEl) {
    statusEl = document.createElement("p");
    statusEl.className = "form-status";
    checkoutForm.appendChild(statusEl);
  }
  statusEl.textContent = message;
  statusEl.className = "form-status";
  if (type) {
    statusEl.classList.add(`is-${type}`);
  }
}

function getOrderFormData() {
  const name = document.getElementById("orderName")?.value.trim() || "";
  const phone = document.getElementById("phone")?.value.trim() || "";
  const vk = document.getElementById("orderVk")?.value.trim() || "";
  const pickupType = document.getElementById("pickupType")?.value || "";
  const comment = document.getElementById("orderComment")?.value.trim() || "";
  const policyAccepted =
    document.getElementById("orderPolicy")?.checked || false;
  const vkNotify = document.getElementById("orderVkNotify")?.checked || false;
  const totals = getCartTotals();

  return {
    customer: { name, phone, vk },
    order: {
      pickupType,
      comment,
      items: cart.map((item) => ({
        id: item.originalId || item.id, // Отправляем числовой ID бэкенду
        name: item.name,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      totalCount: totals.totalCount,
      totalPrice: totals.totalPrice,
    },
    consents: { policyAccepted, vkNotify },
    meta: { source: "website" },
  };
}

function showOrderSuccess(responseData = {}) {
  if (checkoutForm) checkoutForm.hidden = true;
  if (orderSuccess) orderSuccess.hidden = false;
  if (successOrderId)
    successOrderId.textContent =
      responseData.orderId || "Будет присвоен оператором";
  if (orderSuccessText) {
    orderSuccessText.textContent =
      responseData.message ||
      "Спасибо! Мы получили вашу заявку и скоро свяжемся с вами.";
  }
}

function resetOrderFlow() {
  if (checkoutForm) {
    checkoutForm.reset();
    checkoutForm.hidden = false;
  }
  if (orderSuccess) orderSuccess.hidden = true;
  setSubmitOrderLoading(false);
  orderSubmitInFlight = false;
  setFormStatus("", "");
  cart = [];
  renderCart();
  closeCart();
}

function getApiErrorMessage(result, status) {
  const detail = result?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) =>
        typeof entry?.msg === "string" ? entry.msg : String(entry?.msg ?? ""),
      )
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (typeof result?.message === "string" && result.message)
    return result.message;
  return `Ошибка отправки: ${status}`;
}

async function submitOrder(orderData) {
  const response = await fetch(ORDER_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(orderData),
  });

  let result = {};
  try {
    result = await response.json();
  } catch (error) {
    result = {};
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(result, response.status));
  }
  return result;
}

function bindStaticActions() {
  if (cartToggle) cartToggle.addEventListener("click", openCart);
  if (mobileCartBtn) mobileCartBtn.addEventListener("click", openCart);
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      cart = [];
      renderCart();
    });
  }

  if (checkoutBtn) checkoutBtn.addEventListener("click", openCart);

  if (closeProductModal)
    closeProductModal.addEventListener("click", closeModal);

  if (productModal) {
    productModal.addEventListener("click", (event) => {
      const dialog = productModal.querySelector(".product-modal__dialog");
      if (!dialog) return;
      const rect = dialog.getBoundingClientRect();
      const clickedInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!clickedInside) closeModal();
    });
    productModal.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal();
    });
  }

  if (modalAddToCart) {
    modalAddToCart.addEventListener("click", () => {
      if (!currentModalItem) return;
      addToCart(currentModalItem.id, currentSelectedModifiers);
      closeModal();
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!cart.length) {
        setFormStatus("Корзина пока пуста.", "error");
        return;
      }

      const orderData = getOrderFormData();

      if (
        !orderData.customer.name ||
        !orderData.customer.phone ||
        !orderData.order.pickupType
      ) {
        setFormStatus("Пожалуйста, заполните обязательные поля.", "error");
        return;
      }

      if (!isValidPhone(orderData.customer.phone)) {
        setFormStatus("Введите полный номер телефона: +7 и 10 цифр.", "error");
        return;
      }

      if (!orderData.consents.policyAccepted) {
        setFormStatus("Нужно согласие на обработку заявки.", "error");
        return;
      }

      if (orderSubmitInFlight) return;
      orderSubmitInFlight = true;
      setSubmitOrderLoading(true);

      try {
        setFormStatus("Отправляем заказ...", "");
        const result = await submitOrder(orderData);
        setFormStatus("", "");
        showOrderSuccess(result);
        showToast(
          "Спасибо за заказ!",
          6000,
          "Мы свяжемся с Вами для подтверждения.",
        );
      } catch (error) {
        console.error(error);
        setFormStatus(
          error.message || "Не удалось отправить заказ. Попробуйте ещё раз.",
          "error",
        );
      } finally {
        orderSubmitInFlight = false;
        if (checkoutForm && !checkoutForm.hidden) setSubmitOrderLoading(false);
      }
    });
  }

  if (newOrderBtn) newOrderBtn.addEventListener("click", resetOrderFlow);
}

async function loadMenu() {
  renderMenuSkeleton();
  if (categoriesList)
    categoriesList.innerHTML = `<p class="categories-loading">Загрузка меню…</p>`;

  try {
    const response = await fetch("./data/menu.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    categoriesData = data.categories || [];
    menuData = data.items || [];

    renderCategories();
    renderMenu(getVisibleItems());
    renderCart();
    bindCategoryActions();
    bindMenuActions();
  } catch (error) {
    console.error("Ошибка загрузки меню:", error);
    if (categoriesList) categoriesList.innerHTML = "";
    if (menuGrid)
      menuGrid.innerHTML = `<div class="cart-empty"><p>Не удалось загрузить меню. Проверьте файл data/menu.json.</p></div>`;
  }
}

// --- ИНТЕГРАЦИЯ С TELEGRAM ---
function initTelegramWebApp() {
  // Проверяем, есть ли объект Telegram
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.expand(); // Разворачиваем на весь экран

    // Даем странице полсекунды на загрузку DOM
    setTimeout(() => {
      if (tg.initDataUnsafe) {
        // Показываем отладочное окно, чтобы понять, приходят ли данные на телефоне
        tg.showAlert("Данные от TG: " + JSON.stringify(tg.initDataUnsafe));

        if (tg.initDataUnsafe.user) {
          const user = tg.initDataUnsafe.user;
          const nameInput = document.getElementById("orderName");

          // Подставляем имя, если поле пустое
          if (nameInput && !nameInput.value) {
            nameInput.value = user.first_name || "";
          }
        }
      } else {
        tg.showAlert("Telegram не передал данные (initDataUnsafe пуст)");
      }
    }, 500);
  } else {
    console.log("Открыто не в Telegram");
  }
}

// --- Инициализация при запуске ---
loadCartFromStorage();
bindStaticActions();
loadMenu();
setPhoneMask();
initTelegramWebApp();
