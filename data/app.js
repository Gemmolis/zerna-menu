// ===== ЭЛЕМЕНТЫ И СОСТОЯНИЕ =====

const menuGrid = document.getElementById("menuGrid");
const categoriesList = document.getElementById("categoriesList");

const cartPanel = document.getElementById("cartPanel");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotalCount = document.getElementById("cartTotalCount");
const cartTotalPrice = document.getElementById("cartTotalPrice");

const clearCartBtn = document.getElementById("clearCartBtn");
const checkoutForm = document.getElementById("checkoutForm");
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

const phoneInput = document.getElementById("phone");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

// TODO: заменить на реальный URL бэкенда на проде
const ORDER_WEBHOOK_URL =
  "https://rewrite-heritage-void.ngrok-free.dev/api/orders/from-site";
     https://rewrite-heritage-void.ngrok-free.dev -> http://localhost:8

let menuData = [];
let categoriesData = [];
let activeCategory = "Все";
let cart = [];
let currentModalItem = null;

// ===== УТИЛИТЫ =====

function formatPrice(value) {
  return `${Number(value || 0)} ₽`;
}

function showToast(message, timeout = 4000) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.classList.add("toast--visible");
  setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, timeout);
}

// Маска телефона: +7 (XXX) XXX-XX-XX, 11 цифр
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

function openCart() {
  if (cartPanel) {
    cartPanel.classList.add("is-open");
  }
  if (cartOverlay) {
    cartOverlay.hidden = false;
  }
  document.body.style.overflow = "hidden";
}

function closeCart() {
  if (cartPanel) {
    cartPanel.classList.remove("is-open");
  }
  if (cartOverlay) {
    cartOverlay.hidden = true;
  }
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
    .map((tag) => `${labels[tag] || tag}`)
    .join("");
}

function getVisibleItems() {
  if (activeCategory === "Все") return menuData;
  return menuData.filter((item) => item.category === activeCategory);
}

// ===== РЕНДЕР КАТЕГОРИЙ И МЕНЮ =====

function renderCategories() {
  const list = ["Все", ...categoriesData];
  if (!categoriesList) return;

  categoriesList.innerHTML = list
    .map((category) => {
      const activeClass = category === activeCategory ? "active" : "";
      return `
        <button
          type="button"
          class="categories__item ${activeClass}"
          data-category="${category}"
        >
          ${category}
        </button>
      `;
    })
    .join("");
}

function renderMenu(items) {
  if (!menuGrid) return;

  if (!items.length) {
    menuGrid.innerHTML = `
      <div class="menu-empty">
        <p>В этой категории пока нет позиций.</p>
      </div>
    `;
    return;
  }

  menuGrid.innerHTML = items
    .map((item) => {
      const tagsHtml = getTagLabels(item.tags || []);
      return `
        <article class="menu-card" data-id="${item.id}">
          <button type="button" class="menu-card__image-btn" data-action="open-modal" data-id="${item.id}">
            ${
              item.image
                ? `<img src="${item.image}" alt="${item.name}" class="menu-card__image">`
                : `<div class="menu-card__image menu-card__image--placeholder">Фото</div>`
            }
          </button>
          <div class="menu-card__body">
            <div class="menu-card__top">
              <div class="menu-card__category">${item.category || ""}</div>
              ${
                tagsHtml
                  ? `<div class="menu-card__tags">
                      ${tagsHtml}
                    </div>`
                  : ""
              }
            </div>
            <h3 class="menu-card__title">${item.name}</h3>
            ${
              item.description
                ? `<p class="menu-card__description">${item.description}</p>`
                : ""
            }
            <div class="menu-card__bottom">
              <div class="menu-card__price">${formatPrice(item.price)}</div>
              <button
                type="button"
                class="btn btn-secondary menu-card__add"
                data-action="add-to-cart"
                data-id="${item.id}"
              >
                В корзину
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

// ===== КОРЗИНА =====

function saveCart() {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch (e) {
    console.warn("Не удалось сохранить корзину:", e);
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem("cart");
    if (raw) {
      cart = JSON.parse(raw) || [];
    }
  } catch (e) {
    cart = [];
  }
}

function renderCart() {
  if (!cartItems) return;

  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <p>Пока пусто. Добавьте блюда из меню.</p>
      </div>
    `;
  } else {
    cartItems.innerHTML = cart
      .map((item) => {
        return `
          <div class="cart-item" data-id="${item.id}">
            <div class="cart-item__main">
              <div class="cart-item__info">
                <div class="cart-item__title">${item.name}</div>
                ${
                  item.category
                    ? `<div class="cart-item__category">${item.category}</div>`
                    : ""
                }
              </div>
              <div class="cart-item__controls">
                <button
                  type="button"
                  class="cart-item__btn"
                  data-action="decrease"
                  data-id="${item.id}"
                >−</button>
                <span class="cart-item__quantity">${item.quantity}</span>
                <button
                  type="button"
                  class="cart-item__btn"
                  data-action="increase"
                  data-id="${item.id}"
                >+</button>
              </div>
            </div>
            <div class="cart-item__bottom">
              <div class="cart-item__price">
                ${formatPrice(item.price * item.quantity)}
              </div>
              <button
                type="button"
                class="cart-item__remove"
                data-action="remove"
                data-id="${item.id}"
              >
                Удалить
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  if (cartCount) cartCount.textContent = totalCount;
  if (cartTotalCount) cartTotalCount.textContent = `${totalCount} поз.`;
  if (cartTotalPrice) cartTotalPrice.textContent = formatPrice(totalPrice);

  saveCart();
}

function addToCart(item) {
  const existing = cart.find((cartItem) => cartItem.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      category: item.category || "",
      price: item.price,
      quantity: 1,
    });
  }
  renderCart();
}

function changeCartItemQuantity(id, delta) {
  const target = cart.find((item) => item.id === id);
  if (!target) return;

  target.quantity += delta;
  if (target.quantity <= 0) {
    cart = cart.filter((item) => item.id !== id);
  }
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((item) => item.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

// ===== МОДАЛЬНОЕ ОКНО ТОВАРА =====

function openProductModal(item) {
  currentModalItem = item;
  if (modalImage) {
    modalImage.innerHTML = item.image
      ? `<img src="${item.image}" alt="${item.name}" class="modal-product__image">`
      : `<div class="modal-product__image modal-product__image--placeholder">Фото</div>`;
  }
  if (modalCategory) modalCategory.textContent = item.category || "";
  if (modalTitle) modalTitle.textContent = item.name || "";
  if (modalPrice) modalPrice.textContent = formatPrice(item.price || 0);
  if (modalDescription) {
    modalDescription.textContent = item.description || "Описание уточняется.";
  }
  if (modalComposition) {
    modalComposition.innerHTML = (item.composition || [])
      .map((point) => `<li>${point}</li>`)
      .join("");
  }
  if (modalNutrition) {
    modalNutrition.innerHTML = (item.nutrition || [])
      .map((point) => `<li>${point}</li>`)
      .join("");
  }
  if (modalAllergens) {
    const allergens = item.allergens || [];
    if (!allergens.length) {
      modalAllergens.textContent = "Явные аллергены не указаны.";
    } else {
      modalAllergens.innerHTML = allergens.map((a) => `<li>${a}</li>`).join("");
    }
  }
  if (modalNoteWrap) {
    if (item.note) {
      modalNoteWrap.hidden = false;
      modalNote.textContent = item.note;
    } else {
      modalNoteWrap.hidden = true;
    }
  }

  if (productModal) {
    productModal.classList.add("is-open");
  }
  document.body.style.overflow = "hidden";
}

function closeProductModalHandler() {
  if (productModal) {
    productModal.classList.remove("is-open");
  }
  document.body.style.overflow = "";
  currentModalItem = null;
}

// ===== ЗАГРУЗКА МЕНЮ =====

async function loadMenuData() {
  try {
    const res = await fetch("data/menu.json");
    if (!res.ok) {
      throw new Error("Не удалось загрузить меню");
    }
    const data = await res.json();
    menuData = data.items || [];
    categoriesData = Array.from(
      new Set(menuData.map((item) => item.category).filter(Boolean)),
    );

    renderCategories();
    renderMenu(getVisibleItems());
  } catch (err) {
    console.error(err);
    if (menuGrid) {
      menuGrid.innerHTML = `
        <div class="menu-error">
          <p>Не удалось загрузить меню. Проверьте файл data/menu.json.</p>
        </div>
      `;
    }
  }
}

// ===== ОБРАБОТЧИКИ =====

function initCategoryListeners() {
  if (!categoriesList) return;
  categoriesList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-category]");
    if (!btn) return;
    const category = btn.getAttribute("data-category");
    if (!category) return;

    activeCategory = category;
    renderCategories();
    renderMenu(getVisibleItems());
  });
}

function initMenuListeners() {
  if (!menuGrid) return;

  menuGrid.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    if (!id) return;

    const item = menuData.find((x) => x.id === id);
    if (!item) return;

    if (action === "add-to-cart") {
      addToCart(item);
      showToast("Добавлено в корзину");
    }

    if (action === "open-modal") {
      openProductModal(item);
    }
  });
}

function initCartListeners() {
  if (cartItems) {
    cartItems.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (!id) return;

      if (action === "increase") changeCartItemQuantity(id, 1);
      if (action === "decrease") changeCartItemQuantity(id, -1);
      if (action === "remove") removeFromCart(id);
    });
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      if (!cart.length) return;
      clearCart();
    });
  }

  if (mobileCartBtn) {
    mobileCartBtn.addEventListener("click", () => {
      openCart();
    });
  }

  if (cartToggle) {
    cartToggle.addEventListener("click", () => {
      openCart();
    });
  }

  if (cartOverlay) {
    cartOverlay.addEventListener("click", () => {
      closeCart();
    });
  }

  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", () => {
      closeCart();
    });
  }
}

function initModalListeners() {
  if (closeProductModal) {
    closeProductModal.addEventListener("click", closeProductModalHandler);
  }
  if (productModal) {
    productModal.addEventListener("click", (event) => {
      if (event.target === productModal) {
        closeProductModalHandler();
      }
    });
  }
  if (modalAddToCart) {
    modalAddToCart.addEventListener("click", () => {
      if (currentModalItem) {
        addToCart(currentModalItem);
        showToast("Добавлено в корзину");
        closeProductModalHandler();
      }
    });
  }
}

// ===== ОФОРМЛЕНИЕ ЗАКАЗА =====

function initCheckoutForm() {
  if (!checkoutForm) return;

  checkoutForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!cart.length) {
      showToast("Корзина пуста. Добавьте блюда в заказ.");
      return;
    }

    const formData = new FormData(checkoutForm);
    const name = (formData.get("name") || "").trim();
    const phone = (formData.get("phone") || "").trim();
    const comment = (formData.get("comment") || "").trim();
    const pickupType = formData.get("pickupType") || "in_cafe";
    const policyAccepted = !!formData.get("policyAccepted");
    const vkNotify = !!formData.get("vkNotify");

    if (!name) {
      showToast("Пожалуйста, укажите ваше имя.");
      return;
    }

    if (!phone || !isValidPhone(phone)) {
      showToast("Введите телефон в формате +7 (XXX) XXX-XX-XX");
      return;
    }

    if (!policyAccepted) {
      showToast("Необходимо согласие на обработку персональных данных.");
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = cart.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    const orderPayload = {
      customer: {
        name,
        phone: phoneDigits,
        vk: null,
      },
      order: {
        pickupType,
        comment: comment || null,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category || null,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })),
        totalCount,
        totalPrice,
      },
      consents: {
        policyAccepted: true,
        vkNotify,
      },
      meta: {
        source: "website",
      },
    };

    fetch(ORDER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.detail || "Ошибка при отправке заказа");
          });
        }
        return res.json();
      })
      .then((data) => {
        cart = [];
        renderCart();
        checkoutForm.reset();
        showToast("Заказ принят, мы свяжемся с Вами в ближайшее время");
        closeCart();
      })
      .catch((err) => {
        console.error(err);
        showToast("Ошибка при оформлении заказа. Попробуйте ещё раз.");
      });
  });
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

function init() {
  setPhoneMask();
  loadCart();
  renderCart();
  loadMenuData();
  initCategoryListeners();
  initMenuListeners();
  initCartListeners();
  initModalListeners();
  initCheckoutForm();
}

document.addEventListener("DOMContentLoaded", init);
