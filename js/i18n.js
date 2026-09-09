(function () {
  var SUPPORTED = ['ko', 'es', 'en'];
  var STORAGE_KEY = 'konecta_lang';
  var cache = {};

  function getStoredLang() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.indexOf(v) !== -1) return v;
    } catch (e) {}
    return 'ko';
  }

  function setStoredLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function getByPath(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return (acc && acc[key] !== undefined) ? acc[key] : undefined;
    }, obj);
  }

  function loadLang(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch('/i18n/' + lang + '.json')
      .then(function (res) { return res.json(); })
      .then(function (data) { cache[lang] = data; return data; });
  }

  function applyTranslations(data, lang) {
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = getByPath(data, el.getAttribute('data-i18n'));
      if (typeof val === 'string') el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var val = getByPath(data, el.getAttribute('data-i18n-placeholder'));
      if (typeof val === 'string') el.setAttribute('placeholder', val);
    });

    // Count-up suffixes (e.g. "개국"/"countries") aren't in the i18n JSON —
    // they're set directly as per-language attributes on the element.
    document.querySelectorAll('[data-suffix-ko]').forEach(function (el) {
      var suffix = el.getAttribute('data-suffix-' + lang) || el.getAttribute('data-suffix-ko');
      el.setAttribute('data-suffix', suffix);
    });

    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'ko';
    setStoredLang(lang);
    return loadLang(lang).then(function (data) {
      applyTranslations(data, lang);
      window.konectaI18nData = data;
      window.konectaI18nLang = lang;
      document.dispatchEvent(new CustomEvent('konecta:i18n', { detail: { lang: lang, data: data } }));
    });
  }

  function initSwitcher() {
    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLanguage(btn.getAttribute('data-lang'));
      });
    });
  }

  initSwitcher();
  setLanguage(getStoredLang());

  window.konectaI18n = { setLanguage: setLanguage, getByPath: getByPath, SUPPORTED: SUPPORTED };
})();
