(() => {
  const marker = 'gmail-summary-extension-loaded';

  if (document.documentElement.dataset[marker]) {
    return;
  }

  document.documentElement.dataset[marker] = 'true';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'COLLECT_UNREAD_THREADS') {
      return false;
    }

    try {
      const { categories = [], maxThreads = 8 } = message.payload || {};
      const threads = collectUnreadThreads({ categories, maxThreads });

      sendResponse({ ok: true, threads });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'Failed to collect unread threads.' });
    }

    return false;
  });

  console.log('Gmail Summary content script loaded on:', window.location.href);
})();

const CATEGORY_ALIASES = {
  primary: 'other',
  work: 'business',
};

function normalizeSelectedCategories(categories) {
  return (Array.isArray(categories) ? categories : []).map((category) => CATEGORY_ALIASES[category] || category);
}

function collectUnreadThreads({ categories, maxThreads }) {
  const selectedCategories = normalizeSelectedCategories(categories);
  const unreadRows = Array.from(document.querySelectorAll('tr.zA.zE'));
  const threads = [];

  for (const row of unreadRows) {
    if (threads.length >= maxThreads) {
      break;
    }

    const subject = cleanText(row.querySelector('span.bog')?.textContent || 'No subject');
    const snippet = cleanText(row.querySelector('span.y2')?.textContent || '');
    const threadAnchor = row.querySelector('a[href*="#inbox/"]');
    const threadUrl = threadAnchor ? new URL(threadAnchor.getAttribute('href'), window.location.origin).toString() : null;

    const category = inferCategory(`${subject} ${snippet}`);

    if (selectedCategories.length > 0 && !selectedCategories.includes(category)) {
      continue;
    }

    threads.push({
      subject,
      snippet,
      category,
      threadUrl,
    });
  }

  return threads;
}

function inferCategory(text) {
  const normalized = text.toLowerCase();

  if (/(startup|founder|b2b|enterprise|revenue|pipeline|sales call|business)/.test(normalized)) {
    return 'business';
  }

  if (/(side hustle|freelance gig|moonlight|second income|etsy|shopify)/.test(normalized)) {
    return 'side-hustles';
  }

  if (/(remote work|work from home|distributed team|async|timezone|virtual office)/.test(normalized)) {
    return 'remote-work';
  }

  if (/(passive income|affiliate|dividend|royalty|automated income)/.test(normalized)) {
    return 'passive-income';
  }

  if (/(online income|creator fund|monetize|youtube earnings|ad revenue|substack)/.test(normalized)) {
    return 'online-income';
  }

  if (/(ai|artificial intelligence|llm|gpt|machine learning|neural)/.test(normalized)) {
    return 'ai';
  }

  if (/(tech|technology|software release|product launch|saas|cloud)/.test(normalized)) {
    return 'tech';
  }

  if (/(science|research|study|journal|experiment|peer review)/.test(normalized)) {
    return 'science';
  }

  if (/(coding|debug|code review|github|pull request|javascript|typescript)/.test(normalized)) {
    return 'coding';
  }

  if (/(programming|algorithm|api|sdk|framework|backend|frontend)/.test(normalized)) {
    return 'programming';
  }

  if (/(parenting|toddler|childcare|kids|family routine|school update)/.test(normalized)) {
    return 'parenting';
  }

  if (/(pregnancy|prenatal|trimester|obgyn|due date|baby registry)/.test(normalized)) {
    return 'pregnancy';
  }

  if (/(fitness|workout|nutrition|gym|steps|training plan|wellness)/.test(normalized)) {
    return 'fitness';
  }

  if (/(coupon|promo code|discount code|save \d+%|deal alert)/.test(normalized)) {
    return 'coupons';
  }

  if (/(free deal|freebie|limited free|no cost|complimentary|giveaway)/.test(normalized)) {
    return 'free-deals';
  }

  if (/(invoice|payment|receipt|bank|transaction|statement|billing)/.test(normalized)) {
    return 'finance';
  }

  if (/(sale|offer|deal|discount|promo|shop|save now)/.test(normalized)) {
    return 'promotions';
  }

  if (/(friend|social|invite|comment|mention|follow|network)/.test(normalized)) {
    return 'social';
  }

  return 'other';
}

function cleanText(value) {
  return value.replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim();
}
