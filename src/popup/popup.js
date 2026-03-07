const statusEl = document.getElementById('status');
const pingButton = document.getElementById('ping-button');
const categoriesForm = document.getElementById('categories-form');

const CATEGORY_ORDER = ['Primary', 'Social', 'Promotions', 'Updates', 'Forums'];

function setStatus(message) {
  statusEl.textContent = message;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function renderCategoryOptions(selectedCategories) {
  if (!categoriesForm) {
    return;
  }

  const selectedSet = new Set(selectedCategories);

  categoriesForm.innerHTML = '';
  CATEGORY_ORDER.forEach((category) => {
    const label = document.createElement('label');
    label.className = 'category-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category;
    input.checked = selectedSet.has(category);

    input.addEventListener('change', async () => {
      const selected = Array.from(categoriesForm.querySelectorAll('input[type="checkbox"]:checked')).map(
        (checkbox) => checkbox.value
      );

      try {
        const response = await sendMessage({ type: 'SET_SELECTED_CATEGORIES', selectedCategories: selected });
        if (response?.ok) {
          setStatus(`Tracking: ${response.selectedCategories.join(', ')}`);
        } else {
          setStatus(`Unable to save categories: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        setStatus(`Unable to save categories: ${error.message}`);
      }
    });

    const text = document.createElement('span');
    text.textContent = category;

    label.append(input, text);
    categoriesForm.append(label);
  });
}

async function initializePopup() {
  try {
    const response = await sendMessage({ type: 'GET_SELECTED_CATEGORIES' });
    const categories = response?.selectedCategories || CATEGORY_ORDER;
    renderCategoryOptions(categories);
    setStatus(`Tracking: ${categories.join(', ')}`);
  } catch (error) {
    setStatus(`Error loading categories: ${error.message}`);
  }
}

pingButton?.addEventListener('click', async () => {
  try {
    const response = await sendMessage({ type: 'PING' });

    if (response?.ok) {
      setStatus('Background service worker responded successfully.');
      return;
    }

    setStatus('No response from background service worker.');
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
});

initializePopup();
