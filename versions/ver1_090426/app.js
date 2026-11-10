const menuGrid = document.getElementById("menuGrid");
const categoriesList = document.getElementById("categoriesList");

const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");

const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDescription = document.getElementById("modalDescription");
const modalComposition = document.getElementById("modalComposition");
const modalNutrition = document.getElementById("modalNutrition");
const modalAllergens = document.getElementById("modalAllergens");
const modalNote = document.getElementById("modalNote");
const modalNoteWrap = document.getElementById("modalNoteWrap");

let menuData = [];
let activeCategory = "Все";

async function loadMenu() {
  try {
    const response = await fetch("./data/menu.json");
    const data = await response.json();

    menuData = data.items;
    renderCategories(data.categories);
    renderMenu(menuData);
  } catch (error) {
    menuGrid.innerHTML = "<p>Не удалось загрузить меню.</p>";
    console.error("Ошибка загрузки меню:", error);
  }
}

function renderCategories(categories) {
  const allCategories = ["Все", ...categories];

  categoriesList.innerHTML = allCategories
    .map((category) => {
      const isActive = category === activeCategory ? "active" : "";
      return `
        <button
          class="category-chip ${isActive}"
          type="button"
          data-category="${category}"
        >
          ${category}
        </button>
      `;
    })
    .join("");

  const buttons = categoriesList.querySelectorAll(".category-chip");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;

      const filteredItems =
        activeCategory === "Все"
          ? menuData
          : menuData.filter((item) => item.category === activeCategory);

      renderCategories(categories);
      renderMenu(filteredItems);
    });
  });
}

function getTagLabels(tags = []) {
  const labels = {
    vegan: "Веган",
    vegetarian: "Вегетарианское",
    "gluten-free": "Без глютена",
  };

  return tags
    .filter((tag) => tag !== "new")
    .map((tag) => `<span class="tag">${labels[tag] || tag}</span>`)
    .join("");
}

function renderNutrition(nutrition = {}) {
  const values = [
    { label: "Ккал", value: nutrition["ккал"] || "Уточняется" },
    { label: "Белки", value: nutrition["белки"] || "—" },
    { label: "Жиры", value: nutrition["жиры"] || "—" },
    { label: "Углеводы", value: nutrition["углеводы"] || "—" },
  ];

  return values
    .map((item) => {
      return `
        <div class="nutrition-card">
          <span class="nutrition-card__label">${item.label}</span>
          <strong class="nutrition-card__value">${item.value}</strong>
        </div>
      `;
    })
    .join("");
}

function renderAllergens(allergens = []) {
  if (!allergens.length) {
    return '<p class="empty-text">Явные аллергены не указаны.</p>';
  }

  return allergens
    .map((item) => `<span class="allergen-tag">${item}</span>`)
    .join("");
}

function openProductModal(item) {
  modalCategory.textContent = item.category || "";
  modalTitle.textContent = item.name || "";
  modalPrice.textContent = `${item.price} ₽`;
  modalDescription.textContent = item.description || "Описание уточняется.";

  modalComposition.innerHTML = (item.composition || [])
    .map((point) => `<li>${point}</li>`)
    .join("");

  modalNutrition.innerHTML = renderNutrition(item.nutrition);
  modalAllergens.innerHTML = renderAllergens(item.allergens);

  if (item.note) {
    modalNote.textContent = item.note;
    modalNoteWrap.style.display = "block";
  } else {
    modalNote.textContent = "";
    modalNoteWrap.style.display = "none";
  }

  productModal.showModal();
}

function renderMenu(items) {
  menuGrid.innerHTML = items
    .map((item) => {
      const hasNewBadge = item.tags?.includes("new");
      const tagsHtml = getTagLabels(item.tags);

      return `
        <article class="menu-card">
          ${hasNewBadge ? '<span class="menu-badge">Новинка</span>' : ""}

          <div class="menu-card__image">Фото</div>

          <div class="menu-card__body">
            <p class="menu-card__category">${item.category}</p>
            <h3>${item.name}</h3>

            ${tagsHtml ? `<div class="tags-row">${tagsHtml}</div>` : '<div class="tags-row tags-row--empty"></div>'}

            <div class="menu-card__footer">
              <p class="menu-card__price">${item.price} ₽</p>

              <div class="menu-card__actions">
                <button
                  class="secondary-btn details-btn"
                  type="button"
                  data-id="${item.id}"
                >
                  Подробнее
                </button>

                <button class="primary-btn" type="button">
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const detailButtons = document.querySelectorAll(".details-btn");

  detailButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = Number(button.dataset.id);
      const item = menuData.find((product) => product.id === itemId);

      if (item) {
        openProductModal(item);
      }
    });
  });
}

closeProductModal.addEventListener("click", () => {
  productModal.close();
});

productModal.addEventListener("click", (event) => {
  const dialogDimensions = productModal
    .querySelector(".product-modal__dialog")
    .getBoundingClientRect();

  const clickedInDialog =
    event.clientX >= dialogDimensions.left &&
    event.clientX <= dialogDimensions.right &&
    event.clientY >= dialogDimensions.top &&
    event.clientY <= dialogDimensions.bottom;

  if (!clickedInDialog) {
    productModal.close();
  }
});

loadMenu();
