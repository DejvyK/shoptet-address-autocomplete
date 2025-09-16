/**
 * Shoptet Address Autocomplete with ARES & Contact Validation
 *
 * @author David Král
 * @license MIT
 * @version 3.0.0
 *
 * Copyright (c) 2025 David Král
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
class DKralSeznamAddressAutocomplete {
  constructor(apiKey, maxUsagePerSession = 5, mappings) {
    this.suggestConfig = { lang: 'cs', limit: 7, types: ['regional.address','regional.street','regional.municipality']/* , locality: ['cz','sk'] */ };
    this.apiKey = apiKey;
    this.maxUsage = maxUsagePerSession;
    this.usageCount = this.getUsageCount();

    if (Array.isArray(mappings)) { this.mappings = mappings; }
    else if (mappings && typeof mappings === 'object') { this.mappings = [mappings]; }
    else {
      this.mappings = [];
      if (document.getElementById('billStreet')) {
        this.mappings.push({ street: 'billStreet', city: 'billCity', zip: 'billZip', country: 'billCountryId' });
      }
      if (document.getElementById('deliveryStreet')) {
        this.mappings.push({ street: 'deliveryStreet', city: 'deliveryCity', zip: 'deliveryZip' });
      }
    }

    this.addressCache = new Map();
    this.selectedValueByField = new Map();
    this.ignoreUntilDifferentByField = new Map();
    this.currentFetch = null;
    this.debounceMs = 300;
    this.minQuery = 3;

    this.iconOverlays = new WeakMap();
    this.overlayTracked = new Set();

    this.OK_SVG_DATA = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%2322a06b" d="M6.5 11.5 3 8l1.2-1.2 2.3 2.3 5.4-5.4L13 5z"/></svg>');

    this.injectStyles();
    this.init();
  }

  injectStyles() {
    const css = `
      .dkral-has-autocomplete { position: relative !important; }
      .dkral-autocomplete-suggestions {
        position: absolute !important; top:100% !important; background:#fff !important;
        border:1px solid #ddd !important; border-top:none !important; border-radius:0 0 6px 6px !important;
        box-shadow:0 6px 16px rgba(0,0,0,.15) !important; max-height:260px !important; overflow-y:auto !important;
        z-index:9999 !important; display:none !important;
      }
      .dkral-autocomplete-suggestions.dkral-visible { display:block !important; }
      .dkral-autocomplete-suggestion { padding:10px 12px !important; cursor:pointer !important; border-bottom:1px solid #f2f2f2 !important; background:#fff !important; line-height:1.35 !important; }
      .dkral-autocomplete-suggestion:last-child { border-bottom:0 !important; }
      .dkral-autocomplete-suggestion:hover, .dkral-autocomplete-suggestion.dkral-highlighted { background:#f8f9fa !important; }
      .dkral-suggestion-main { font-weight:500 !important; color:#222 !important; }
      .dkral-suggestion-loc  { font-size:12px !important; color:#666 !important; margin-top:2px !important; }
      .dkral-autocomplete-info { padding:10px 12px !important; text-align:center !important; color:#666 !important; font-style:italic !important; background:#fff !important; }

      .dkral-input-icon { position:absolute !important; pointer-events:none !important; z-index:10000 !important; width:18px !important; height:18px !important; background-repeat:no-repeat !important; background-size:18px 18px !important; background-position:center center !important; display:block !important; }

      .dkral-input-valid {}
      .dkral-label-input-valid {}
      .dkral-output {}
      .dkral-street-with-filled-number {}

      .dkral-usage-indicator { position:fixed !important; top:20px !important; right:20px !important; background:#2196f3 !important; color:#fff !important; padding:6px 10px !important; border-radius:6px !important; font-size:12px !important; z-index:10001 !important; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }

  init() {
  if (!this.noOkIds) this.noOkIds = new Set(); // ⬅️ skip-list pro fajfky (např. Country)

  this.contexts = [];
  this.mappings.forEach((map) => {
    const street = document.getElementById(map.street);
    if (!street) return;

    // ⬅️ Country nepřekreslovat fajfkou
    if (map.country) this.noOkIds.add(map.country);

    const formGroup = street.closest('.form-group') || street.parentElement;
    if (formGroup) formGroup.classList.add('dkral-has-autocomplete');

    const sugg = document.createElement('div');
    sugg.className = 'dkral-autocomplete-suggestions';
    (formGroup || street.parentElement).appendChild(sugg);

    [map.street, map.city, map.zip, map.country].filter(Boolean).forEach((id) => this.prepareField(id));

    street._dkral = { sugg, anchor: street, ro: null, map };
    this.positionSuggestions(street);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.positionSuggestions(street));
      ro.observe(street);
      street._dkral.ro = ro;
    }

    this.attachEvents(street);
    this.contexts.push({ map, street, sugg });
  });

  this.addUsageIndicator();

  if (!this._overlayHandlersInstalled) {
    this._overlayHandlersInstalled = true;
    window.addEventListener('scroll', () => this.repositionAllOverlays(), true);
    window.addEventListener('resize', () => this.repositionAllOverlays());
  }

  console.log('[dkral] multi init hotovo: ', this.contexts.length, 'sekcí');
    }

  prepareField(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add('dkral-init');
    const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${id}"]`);

    const clearValidState = () => {
      el.classList.remove('dkral-input-valid','dkral-output','dkral-street-with-filled-number');
      el.removeAttribute('data-dkral-validated-value');
      this.clearOkStyles(el);
      this.hideOverlayIcon(el);
      label && label.classList.remove('dkral-label-input-valid');
    };

    el.addEventListener('input', (e) => {
    if (!e.isTrusted) return;           // ⬅️ nepouštěj čištění na syntetické eventy
        clearValidState();
    });
    el.addEventListener('paste', clearValidState);
    el.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.key)) return;
      clearValidState();
    });

    ['focus','blur'].forEach(evt => {
      el.addEventListener(evt, () => {
        if (el.dataset.dkralValidatedValue) this.ensureOkNow(el);
      });
    });
  }

  positionSuggestions(streetInput) {
    const sugg = streetInput?._dkral?.sugg; if (!sugg) return;
    const fg = streetInput.closest('.form-group') || streetInput.parentElement;
    const fgRect = fg.getBoundingClientRect();
    const inRect = streetInput.getBoundingClientRect();
    if (!inRect.width) return;
    const left = inRect.left - fgRect.left;
    const width = inRect.width;
    sugg.style.left = `${left}px`; sugg.style.right = 'auto'; sugg.style.width = `${width}px`;
  }

  applyOkStyles(el) {
    const isSelect = el.tagName === 'SELECT';
    el.style.setProperty('background-image', `url("data:image/svg+xml,${this.OK_SVG_DATA}")`, 'important');
    el.style.setProperty('background-repeat', 'no-repeat', 'important');
    el.style.setProperty('background-position', isSelect ? 'right 34px center' : 'right 10px center', 'important');
    el.style.setProperty('background-size', '18px 18px', 'important');
    const pr = isSelect ? 44 : 36;
    el.style.setProperty('padding-right', `${pr}px`, 'important');
  }
  clearOkStyles(el) {
    el.style.removeProperty('background-image');
    el.style.removeProperty('background-repeat');
    el.style.removeProperty('background-position');
    el.style.removeProperty('background-size');
    el.style.removeProperty('padding-right');
  }
  ensureOkNow(el) {
  if (this.noOkIds && this.noOkIds.has(el.id)) return; // ⬅️ žádná fajfka pro Country (atd.)
  this.applyOkStyles(el);
  const checkAndFallback = () => {
    const bg = getComputedStyle(el).getPropertyValue('background-image');
    if (!bg || bg === 'none') { this.showOverlayIcon(el); } else { this.hideOverlayIcon(el); }
  };
  requestAnimationFrame(checkAndFallback);
  setTimeout(checkAndFallback, 60);
  setTimeout(checkAndFallback, 220);
}

  showOverlayIcon(el) {
  if (el.tagName === 'SELECT') return;
  if (this.noOkIds && this.noOkIds.has(el.id)) return; // ⬅️ žádný overlay na skipnutých polích

  let rec = this.iconOverlays.get(el);
  if (!rec) {
    const container = el.closest('.form-group') || el.parentElement;
    const icon = document.createElement('div');
    icon.className = 'dkral-input-icon';
    icon.style.backgroundImage = `url("data:image/svg+xml,${this.OK_SVG_DATA}")`;
    container.appendChild(icon);
    const ro = new ResizeObserver(() => this.positionOverlayIcon(el));
    ro.observe(el);
    rec = { icon, container, ro };
    this.iconOverlays.set(el, rec);
    this.overlayTracked.add(el);
  }
  this.positionOverlayIcon(el);
}
  hideOverlayIcon(el) {
    const rec = this.iconOverlays.get(el); if (!rec) return;
    rec.ro && rec.ro.disconnect();
    rec.icon && rec.icon.remove();
    this.iconOverlays.delete(el);
    this.overlayTracked.delete(el);
  }
  positionOverlayIcon(el) {
    const rec = this.iconOverlays.get(el); if (!rec) return;
    const { icon, container } = rec;
    const cRect = container.getBoundingClientRect();
    const iRect = el.getBoundingClientRect();
    if (!iRect.width) return;
    const gapRight = 10, iconW = 18, iconH = 18;
    const left = (iRect.left - cRect.left) + (iRect.width - gapRight - iconW);
    const top  = (iRect.top  - cRect.top ) + Math.round((iRect.height - iconH) / 2);
    icon.style.left = `${left}px`; icon.style.top = `${top}px`; icon.style.width = `${iconW}px`; icon.style.height = `${iconH}px`;
  }
  repositionAllOverlays() { this.overlayTracked.forEach((el) => this.positionOverlayIcon(el)); }

  attachEvents(streetField) {
    let t = null, highlighted = -1;
    const run = (q) => {
      const ignore = this.ignoreUntilDifferentByField.get(streetField) && q === this.selectedValueByField.get(streetField);
      if (ignore) return;
      this.ignoreUntilDifferentByField.set(streetField, false);
      if (q.length < this.minQuery) { this.hideSuggestions(streetField); return; }
      this.searchAddresses(q, streetField);
    };
    streetField.addEventListener('input', (e) => {
    if (!e.isTrusted) return;           // ⬅️ IGNORUJ programové inputy (ARES, autofill)
        const q = e.target.value.trim();
        clearTimeout(t); t = setTimeout(() => run(q), this.debounceMs);
    });
    streetField.addEventListener('focus', () => this.positionSuggestions(streetField));
    streetField.addEventListener('keydown', (e) => {
      const items = streetField._dkral.sugg.querySelectorAll('.dkral-autocomplete-suggestion');
      const max = items.length - 1;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlighted = Math.min(highlighted+1, max); this.highlight(items, highlighted); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlighted = Math.max(highlighted-1, -1); this.highlight(items, highlighted); }
      else if (e.key === 'Enter') { if (highlighted >= 0 && items[highlighted]) { e.preventDefault(); items[highlighted].click(); highlighted = -1; } }
      else if (e.key === 'Escape') { this.hideSuggestions(streetField); highlighted = -1; streetField.blur(); }
      else if (e.key === 'Tab') { if (items.length > 0 && highlighted === -1) this.selectAddress(items[0]._dkralData, streetField); }
    });
    document.addEventListener('click', (e) => {
      const wrap = (streetField.closest('.form-group') || streetField.parentElement);
      if (!wrap.contains(e.target)) this.hideSuggestions(streetField);
    });
  }

  setSuggestLocality(codes) {
    if (!codes) { this.suggestConfig.locality = null; return; }
    if (Array.isArray(codes)) this.suggestConfig.locality = codes.map(s => String(s).toLowerCase());
    else this.suggestConfig.locality = String(codes).split(',').map(s => s.trim().toLowerCase());
  }
  buildSuggestParams(query) {
    const p = new URLSearchParams({ query, lang: this.suggestConfig.lang || 'cs', limit: String(this.suggestConfig.limit || 7) });
    if (this.suggestConfig.types && this.suggestConfig.types.length) p.set('type', this.suggestConfig.types.join(','));
    if (this.suggestConfig.locality && this.suggestConfig.locality.length) p.set('locality', this.suggestConfig.locality.join(','));
    return p;
  }
  postFilterByCountry(items) {
    const loc = this.suggestConfig.locality; if (!loc || !loc.length) return items;
    const allow = new Set(loc.map(s => s.toUpperCase()));
    const nameAllow = new Set(['Česká republika','Czechia','Czech Republic','Slovensko','Slovakia']);
    return items.filter(it => {
      if (!it.regionalStructure) return true;
      const country = it.regionalStructure.find(r => r.type === 'regional.country');
      if (!country) return true;
      if (country.isoCode && allow.has(country.isoCode.toUpperCase())) return true;
      if (country.name && nameAllow.has(country.name)) return true;
      return false;
    });
  }

  async searchAddresses(query, streetField) {
    if (this.addressCache.has(query)) { this.renderSuggestions(this.addressCache.get(query), streetField); return; }
    if (this.currentFetch) this.currentFetch.abort();
    this.currentFetch = new AbortController();
    this.showInfo(streetField, 'Vyhledávám…');
    this.positionSuggestions(streetField);
    const params = this.buildSuggestParams(query);
    const url = `https://api.mapy.cz/v1/suggest?${params.toString()}&apikey=${this.apiKey}`;
    try {
      const res = await fetch(url, { signal: this.currentFetch.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.incrementUsageCount();
      const items = Array.isArray(data.items) ? data.items : [];
      const filtered = this.postFilterByCountry(items);
      this.addressCache.set(query, filtered);
      filtered.length ? this.renderSuggestions(filtered, streetField) : this.showInfo(streetField, 'Žádné výsledky');
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[dkral] suggest error:', err);
      this.showInfo(streetField, 'Chyba načítání');
    }
  }

  renderSuggestions(items, streetField) {
    const sugg = streetField._dkral.sugg; sugg.innerHTML = '';
    items.forEach((it) => {
      const row = document.createElement('div'); row.className = 'dkral-autocomplete-suggestion'; row._dkralData = it;
      const main = document.createElement('div'); main.className = 'dkral-suggestion-main'; main.textContent = it.name || it.title || '—';
      const loc = document.createElement('div'); loc.className = 'dkral-suggestion-loc'; loc.textContent = it.location || this.formatLocation(it) || '';
      row.appendChild(main); row.appendChild(loc);
      row.addEventListener('mouseenter', () => {
        sugg.querySelectorAll('.dkral-autocomplete-suggestion').forEach(el => el.classList.remove('dkral-highlighted'));
        row.classList.add('dkral-highlighted');
      });
      row.addEventListener('mouseleave', () => row.classList.remove('dkral-highlighted'));
      row.addEventListener('click', () => this.selectAddress(it, streetField));
      sugg.appendChild(row);
    });
    sugg.classList.add('dkral-visible');
    this.positionSuggestions(streetField);
  }

  showInfo(streetField, text) { const { sugg } = streetField._dkral; sugg.innerHTML = `<div class="dkral-autocomplete-info">${text}</div>`; sugg.classList.add('dkral-visible'); }
  hideSuggestions(streetField) { const { sugg } = streetField._dkral; sugg.classList.remove('dkral-visible'); sugg.innerHTML = ''; }
  highlight(nodes, idx) { nodes.forEach((n, i) => n.classList.toggle('dkral-highlighted', i === idx)); if (idx >= 0 && nodes[idx]) nodes[idx].scrollIntoView({ block: 'nearest' }); }

  selectAddress(item, streetField) {
    const map = streetField?._dkral?.map || this.mappings[0];
    const details = this.parseAddress(item);
    this.fillFormFields(details, map);
    this.selectedValueByField.set(streetField, streetField.value);
    this.ignoreUntilDifferentByField.set(streetField, true);
    [map.street, map.city, map.zip].filter(Boolean).forEach((id) => this.markValidated(id));
    this.hideSuggestions(streetField);
  }

  parseAddress(item) {
    const res = { street: '', city: '', zip: '', country: 'CZ' };
    if (Array.isArray(item.regionalStructure)) {
      const get = (t) => item.regionalStructure.find(r => r.type === t)?.name || '';
      const streetName = get('regional.street'); const houseNo = get('regional.address');
      res.street = [streetName, houseNo].filter(Boolean).join(' ').trim() || item.name || '';
      res.city = get('regional.municipality');
      if (item.zip) res.zip = String(item.zip).replace(/\s/g,'');
      const c = get('regional.country'); if (c && c !== 'Česká republika') res.country = c;
    } else {
      const name = item.name || '', loc = item.location || '';
      if (name.includes(',')) { const [a,b] = name.split(',').map(s=>s.trim()); res.street = a || ''; res.city = b || ''; }
      else { res.street = name; }
      if (!res.city && loc) res.city = (loc.split(',')[0]||'').trim();
      const m = `${name} ${loc}`.match(/(\d{3}\s*\d{2})/); if (m) res.zip = m[1].replace(/\s/g,'');
    }
    return res;
  }

  fillFormFields(details, map) {
    const apply = (id, val) => {
      const el = document.getElementById(id); if (!el || !val) return;
      el.value = val;
      el.classList.add('dkral-input-valid','dkral-output');
      const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${id}"]`);
      label && label.classList.add('dkral-label-input-valid');
      if (id === map.street && /\d/.test(val)) el.classList.add('dkral-street-with-filled-number');
      this.ensureOkNow(el);
      ['input','change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
      setTimeout(() => this.ensureOkNow(el), 120);
    };
    apply(map.street, details.street);
    apply(map.city,   details.city);
    apply(map.zip,    details.zip);

    if (details.country && map.country) {
      const sel = document.getElementById(map.country);
      if (sel) {
        const opt = sel.querySelector(`option[data-code="${details.country}"]`);
        if (opt) {
          sel.value = opt.value;
          sel.classList.add('dkral-input-valid','dkral-output');
          const label = (sel.closest('.form-group') || sel.parentElement)?.querySelector(`label[for="${map.country}"]`);
          label && label.classList.add('dkral-label-input-valid');
          this.ensureOkNow(sel);
          ['input','change'].forEach(t => sel.dispatchEvent(new Event(t, { bubbles: true })));
          setTimeout(() => this.ensureOkNow(sel), 120);
        }
      }
    }
  }

  markValidated(id) { const el = document.getElementById(id); if (!el) return; if (!el.dataset.dkralPrevValue) el.dataset.dkralPrevValue = el.value; el.dataset.dkralValidatedValue = el.value; }
  formatLocation(item) {
    if (!Array.isArray(item.regionalStructure)) return '';
    const get = (t) => item.regionalStructure.find(r => r.type === t)?.name || '';
    const parts = []; const municipality = get('regional.municipality'); const district = get('regional.district'); const country = get('regional.country');
    if (municipality) parts.push(municipality);
    if (district && district !== municipality) parts.push(district);
    if (country) parts.push(country);
    return parts.join(', ');
  }

  addUsageIndicator() { const el = document.createElement('div'); el.className = 'dkral-usage-indicator'; el.id = 'dkral-autocomplete-usage'; document.body.appendChild(el); this.updateUsageIndicator(); }
  updateUsageIndicator() { const el = document.getElementById('dkral-autocomplete-usage'); if (el) el.textContent = `API: ${this.usageCount} | Cache: ${this.addressCache.size}`; }
  getUsageCount() { const s = sessionStorage.getItem('dkralSeznamAutocompleteUsage'); return s ? parseInt(s, 10) : 0; }
  incrementUsageCount() { this.usageCount++; sessionStorage.setItem('dkralSeznamAutocompleteUsage', String(this.usageCount)); this.updateUsageIndicator(); }
}

/* ---------- Page guard ---------- */
function dkralIsCorrectPage() { const p = location.pathname; return p === '/objednavka/krok-2/' || p.includes('objednavka/krok-2'); }

/* --------------------------------------------------------------------------------
 * ARES VALIDÁTOR (bez našeptávače) – vyplní firemní údaje a vykreslí fajfky
 * -------------------------------------------------------------------------------- */
class DKralAresCompanyValidator {
  constructor(opts = {}) {
    this.icoFieldId = opts.icoFieldId || 'companyId';
    this.fields = Object.assign({
      vatId: 'vatId',
      company: 'billCompany',
      street: 'billStreet',
      city: 'billCity',
      zip: 'billZip',
      country: 'billCountryId' // volitelné <select> s option[data-code="CZ"]
    }, opts.fields || {});
    this.debounceMs = opts.debounceMs || 300;
    this.apiBase = opts.apiBase || 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';
    this.cache = new Map();
    this.currentFetch = null;

    // UI reuse (pokud existuje adresní našeptávač)
    this.ui = opts.ui || (window.dkralAutocomplete || null);
    this.OK_SVG_DATA = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%2322a06b" d="M6.5 11.5 3 8l1.2-1.2 2.3 2.3 5.4-5.4L13 5z"/></svg>');
    this.noOkIds = new Set();
    this.init();
  }

  init() {
  // ⬅️ nastav skip-list pro fajfky (Country)
  if (!this.noOkIds) this.noOkIds = new Set();
  if (this.fields && this.fields.country) this.noOkIds.add(this.fields.country);

  const icoEl = document.getElementById(this.icoFieldId);
  if (!icoEl) { console.warn('[dkral-ares] Nenalezen IČO input'); return; }

  this.prepareField(icoEl);

  let t = null;
  icoEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => this.onIcoChanged(icoEl), this.debounceMs);
  });
}

  prepareField(el) {
    const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${el.id}"]`);
    const clear = () => {
      el.classList.remove('dkral-input-valid','dkral-output');
      el.removeAttribute('data-dkral-validated-value');
      this.clearOkStyles(el);
      label && label.classList.remove('dkral-label-input-valid');
    };
    el.addEventListener('input', clear);
    el.addEventListener('paste', clear);
    ['focus','blur'].forEach(evt => el.addEventListener(evt, () => {
      if (el.dataset.dkralValidatedValue) this.ensureOkNow(el);
    }));
  }

  sanitizeICO(v) { return String(v || '').replace(/\D/g,'').slice(0,8); }

  isValidICO(ico) {
    if (!/^\d{8}$/.test(ico)) return false;
    const a = ico.split('').map(d=>parseInt(d,10));
    let sum = 0;
    for (let i=0;i<7;i++) sum += a[i] * (8 - i);
    let mod = sum % 11;
    let chk = 11 - mod;
    if (chk === 10) chk = 0;
    else if (chk === 11) chk = 1;
    return chk === a[7];
  }

  async onIcoChanged(icoEl) {
    const raw = icoEl.value;
    const ico = this.sanitizeICO(raw);
    if (ico !== raw) { icoEl.value = ico; }
    if (ico.length !== 8) return;
    if (!this.isValidICO(ico)) { this.markInvalid(icoEl, 'Neplatné IČO'); return; }

    // validní formát – ukaž fajfku už teď
    this.markValid(icoEl);

    // cache
    if (this.cache.has(ico)) { this.consumeAres(this.cache.get(ico)); return; }

    // abort předchozí fetch
    if (this.currentFetch) this.currentFetch.abort();
    this.currentFetch = new AbortController();

    try {
      const res = await fetch(`${this.apiBase}/${ico}`, { signal: this.currentFetch.signal });
      if (!res.ok) {
        console.warn('[dkral-ares] HTTP', res.status);
        return; // necháme jen fajfku u IČO, pole nevyplňujeme
      }
      const data = await res.json();
      this.cache.set(ico, data);
      this.consumeAres(data);
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[dkral-ares] fetch error', e);
    }
  }

  consumeAres(data) {
    if (!data || !data.obchodniJmeno) return;
    const sidlo = data.sidlo || {};
    const streetParts = [];
    if (sidlo.nazevUlice) streetParts.push(sidlo.nazevUlice);
    if (sidlo.cisloDomovni) streetParts.push(String(sidlo.cisloDomovni));
    if (!sidlo.nazevUlice && sidlo.nazevCastiObce) streetParts.push(sidlo.nazevCastiObce);
    const street = streetParts.join(' ').trim();
    const city = sidlo.nazevObce || '';
    const zip = (sidlo.psc || '').toString().replace(/\s/g,'');

    this.applyValue(this.fields.vatId, data.dic || '');
    this.applyValue(this.fields.company, data.obchodniJmeno || '');
    this.applyValue(this.fields.street, street);
    this.applyValue(this.fields.city, city);
    this.applyValue(this.fields.zip, zip);

    if (this.fields.country) {
      const sel = document.getElementById(this.fields.country);
      if (sel) {
        const opt = sel.querySelector(`option[data-code="CZ"]`) || sel.querySelector(`option[value="CZ"]`);
        if (opt) {
          sel.value = opt.value;
          this.markValid(sel);
          ['input','change'].forEach(t => sel.dispatchEvent(new Event(t, { bubbles: true })));
        }
      }
    }
  }

  applyValue(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.value = val;
    this.markValid(el);
    ['input','change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
  }

  markValid(el) {
    el.classList.add('dkral-input-valid','dkral-output');
    el.dataset.dkralValidatedValue = el.value;
    const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${el.id}"]`);
    label && label.classList.add('dkral-label-input-valid');
    this.ensureOkNow(el);
    setTimeout(() => this.ensureOkNow(el), 120);
  }

  markInvalid(el/*, msg*/) {
    // nyní jen smažeme valid stav; (pokud chceš, přidej .dkral-input-invalid a tooltip)
    el.classList.remove('dkral-input-valid','dkral-output');
    el.removeAttribute('data-dkral-validated-value');
    this.clearOkStyles(el);
  }

  // -------- fajfky (reuse z adresního autocomplete; fallback když není) ----------
  ensureOkNow(el) {
  if (this.noOkIds && this.noOkIds.has(el.id)) return; // ⬅️ nepřidávat fajfku na Country
  if (this.ui && typeof this.ui.ensureOkNow === 'function') {
    this.ui.ensureOkNow(el);
    return;
  }
  this.applyOkStyles(el);
}

  applyOkStyles(el) {
    const isSelect = el.tagName === 'SELECT';
    el.style.setProperty('background-image', `url("data:image/svg+xml,${this.OK_SVG_DATA}")`, 'important');
    el.style.setProperty('background-repeat', 'no-repeat', 'important');
    el.style.setProperty('background-position', isSelect ? 'right 34px center' : 'right 10px center', 'important');
    el.style.setProperty('background-size', '18px 18px', 'important');
    el.style.setProperty('padding-right', `${isSelect ? 44 : 36}px`, 'important');
  }
  clearOkStyles(el) {
    el.style.removeProperty('background-image');
    el.style.removeProperty('background-repeat');
    el.style.removeProperty('background-position');
    el.style.removeProperty('background-size');
    el.style.removeProperty('padding-right');
  }
}

/* --------------------------------------------------------------------------------
 * DKralContactValidator – pouze CZ/SK podpora
 *  - E-mail: základní regex
 *  - Telefon: validní pouze pokud vybraná předvolba je CZ (+420) nebo SK (+421)
 *             a lokální číslo má přesně 9 číslic (bez mezer a znaků)
 *  - Předvolba se čte z .country-flags-inner .country-flag.selected[data-dial]
 * -------------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------------
 * DKralContactValidator – CZ/SK inteligentní validace e-mailu a telefonu
 * - Zjišťuje předvolbu z .country-flags-inner (.country-flag.selected[data-dial])
 * - Podporuje pouze CZ (+420) a SK (+421)
 * - Telefon: kontrola délky (9), předvolby a základní patterny dle národních plánů
 * - Fajfky reuse přes DKralSeznamAddressAutocomplete (pokud je k dispozici)
 * -------------------------------------------------------------------------------- */
class DKralContactValidator {
  constructor(opts = {}) {
    this.emailId = opts.emailId || 'email';
    this.phoneId = opts.phoneId || 'phone';

    // výslovně jen CZ/SK
    this.allowedCountryCodes = ['420', '421'];

    // reuse fajfek (pokud existuje)
    this.ui = opts.ui || (window.dkralAutocomplete || null);

    this.OK_SVG_DATA = encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%2322a06b" d="M6.5 11.5 3 8l1.2-1.2 2.3 2.3 5.4-5.4L13 5z"/></svg>'
    );

    this.init();
  }

  /* ---------- init & listeners ---------- */
  init() {
    const emailEl = document.getElementById(this.emailId);
    const phoneEl = document.getElementById(this.phoneId);

    if (emailEl) {
      this.prepareField(emailEl);
      const ve = () => this.validateEmail(emailEl);
      emailEl.addEventListener('input', (e) => { if (!e.isTrusted) return; ve(); });
      emailEl.addEventListener('blur', ve);
      emailEl.addEventListener('paste', () => setTimeout(ve, 0));
      // počáteční stav
      ve();
    }

    if (phoneEl) {
      this.prepareField(phoneEl);
      const vp = () => this.validatePhone(phoneEl);
      phoneEl.addEventListener('input', (e) => { if (!e.isTrusted) return; vp(); });
      phoneEl.addEventListener('blur', vp);
      phoneEl.addEventListener('paste', () => setTimeout(vp, 0));
      this.setupPrefixRevalidate(phoneEl);
      // počáteční stav
      vp();
    }
  }

  /* ---------- email ---------- */
  isValidEmail(v) {
    if (!v) return false;
    if (v.length > 254) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(String(v).trim());
  }

  validateEmail(el) {
    const ok = this.isValidEmail(el.value);
    ok ? this.markValid(el) : this.markInvalid(el);
    return ok;
  }

  /* ---------- phone (CZ/SK plán) ---------- */
  validatePhone(el) {
    const nsn = String(el.value || '').replace(/\D/g, ''); // lokální část (bez +420/+421)
    if (!/^\d{9}$/.test(nsn)) { this.markInvalid(el); return false; }

    const dial = this.getDialCode(el);
    if (!dial || !this.allowedCountryCodes.includes(String(dial))) {
      this.markInvalid(el);
      return false;
    }

    let type = 'unknown';
    if (String(dial) === '420') type = this.classifyCZ(nsn);
    else if (String(dial) === '421') type = this.classifySK(nsn);

    // co uznáváme jako platné číslo do formuláře
    const ok = type !== 'unknown';
    ok ? this.markValid(el) : this.markInvalid(el);
    return ok;
  }

  // CZ – 9 číslic; základní inteligence podle prefixů
  classifyCZ(nsn) {
    // bezplatné / služby
    if (/^800\d{6}$/.test(nsn)) return 'tollfree';
    if (/^90\d{7}$/.test(nsn)) return 'premium';     // 90x
    if (/^8[1234]\d{6}$/.test(nsn)) return 'service'; // 81x/82x/83x/84x

    // geografické pevné linky: 2–5 + 8 číslic celkem
    if (/^[2-5]\d{8}$/.test(nsn)) return 'fixed';

    // mobilní (nejběžnější rozsahy)
    // 601–608, 70[2-9], 72x, 73x, 77x, 79x
    if (/^60[1-8]\d{6}$/.test(nsn)) return 'mobile';
    if (/^70[2-9]\d{6}$/.test(nsn)) return 'mobile';
    if (/^7(2|3|7|9)\d{7}$/.test(nsn)) return 'mobile';

    // VoIP / nomadické: 910–919, příp. některé 95x
    if (/^91[0-9]\d{6}$/.test(nsn)) return 'voip';
    if (/^95\d{7}$/.test(nsn)) return 'voip';

    // ostatní 8xx jako služby
    if (/^8\d{8}$/.test(nsn)) return 'service';

    return 'unknown';
  }

  // SK – 9 číslic; mobil: 9xx, pevné: 2–5, bezplatné 800, služby 8xx, premium 90x
  classifySK(nsn) {
    if (/^800\d{6}$/.test(nsn)) return 'tollfree';
    if (/^90\d{7}$/.test(nsn)) return 'premium';
    if (/^[2-5]\d{8}$/.test(nsn)) return 'fixed';
    if (/^9\d{8}$/.test(nsn)) return 'mobile';
    if (/^8\d{8}$/.test(nsn)) return 'service';
    return 'unknown';
  }

  /* ---------- prefix handling z .country-flags-inner ---------- */
  getDialCode(phoneEl) {
    const scope = (phoneEl && typeof phoneEl.closest === 'function' && phoneEl.closest('.phone-combined-input')) || document;
    const flagsRoot =
      scope.querySelector('.country-flags-inner') ||
      document.querySelector('.country-flags-inner');

    if (flagsRoot) {
      const selected = flagsRoot.querySelector('.country-flag.selected');
      if (selected) {
        const d1 = (selected.getAttribute('data-dial') || '').replace(/\D/g, '');
        if (d1) return d1;
        const lbl = selected.querySelector('.shp-flag-label');
        if (lbl && lbl.textContent) {
          const d2 = lbl.textContent.replace(/\D/g, '');
          if (d2) return d2;
        }
      }
    }
    return null;
  }

  setupPrefixRevalidate(phoneEl) {
    const scope = (phoneEl && typeof phoneEl.closest === 'function' && phoneEl.closest('.phone-combined-input')) || document;
    const revalidate = () => this.validatePhone(phoneEl);

    scope.addEventListener('change', revalidate);
    scope.addEventListener('click', () => setTimeout(revalidate, 0));
    scope.addEventListener('keydown', () => setTimeout(revalidate, 0));

    const flagsRoot =
      scope.querySelector('.country-flags-inner') ||
      document.querySelector('.country-flags-inner');
    if (flagsRoot && window.MutationObserver) {
      try {
        const mo = new MutationObserver(() => this.validatePhone(phoneEl));
        mo.observe(flagsRoot, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-dial', 'class', 'aria-selected']
        });
        phoneEl._dkralPhonePrefixObserver = mo;
      } catch (_) { /* ignore */ }
    }
  }

  /* ---------- UI helpers (fajfky) ---------- */
  prepareField(el) {
    el.classList.add('dkral-init');
    const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${el.id}"]`);
    const clear = () => {
      el.classList.remove('dkral-input-valid', 'dkral-output');
      el.removeAttribute('data-dkral-validated-value');
      this.clearOkStyles(el);
      if (label) label.classList.remove('dkral-label-input-valid');
    };
    el.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.key)) return;
      clear();
    });
    el.addEventListener('input', (e) => { if (!e.isTrusted) return; clear(); });
    el.addEventListener('paste', clear);

    ['focus','blur'].forEach(evt => el.addEventListener(evt, () => {
      if (el.dataset.dkralValidatedValue) this.ensureOkNow(el);
    }));
  }

  markValid(el) {
    el.classList.add('dkral-input-valid', 'dkral-output');
    el.dataset.dkralValidatedValue = el.value;
    const label = (el.closest('.form-group') || el.parentElement)?.querySelector(`label[for="${el.id}"]`);
    if (label) label.classList.add('dkral-label-input-valid');
    this.ensureOkNow(el);
    setTimeout(() => this.ensureOkNow(el), 120);
  }

  markInvalid(el) {
    el.classList.remove('dkral-input-valid', 'dkral-output');
    el.removeAttribute('data-dkral-validated-value');
    this.clearOkStyles(el);
  }

  ensureOkNow(el) {
    if (this.ui && typeof this.ui.ensureOkNow === 'function') { this.ui.ensureOkNow(el); return; }
    this.applyOkStyles(el);
  }

  applyOkStyles(el) {
    const isSelect = el.tagName === 'SELECT';
    el.style.setProperty('background-image', `url("data:image/svg+xml,${this.OK_SVG_DATA}")`, 'important');
    el.style.setProperty('background-repeat', 'no-repeat', 'important');
    el.style.setProperty('background-position', isSelect ? 'right 34px center' : 'right 10px center', 'important');
    el.style.setProperty('background-size', '18px 18px', 'important');
    el.style.setProperty('padding-right', `${isSelect ? 44 : 36}px`, 'important');
  }

  clearOkStyles(el) {
    el.style.removeProperty('background-image');
    el.style.removeProperty('background-repeat');
    el.style.removeProperty('background-position');
    el.style.removeProperty('background-size');
    el.style.removeProperty('padding-right');
  }
}



/* ---------- Mount ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!dkralIsCorrectPage()) return;

  const API_KEY = 'YOUR_MAPY_CZ_API_KEY'; // Získejte klíč na https://api.mapy.cz/

  // 1) Adresní našeptávač
  window.dkralAutocomplete = new DKralSeznamAddressAutocomplete(API_KEY, 5);

  // 2) ARES validátor (bez našeptávače)
  window.dkralAres = new DKralAresCompanyValidator({
    icoFieldId: 'companyId',
    fields: {
      vatId: 'vatId',
      company: 'billCompany',
      street: 'billStreet',
      city: 'billCity',
      zip: 'billZip',
      country: 'billCountryId'
    },
    ui: window.dkralAutocomplete
  });

  // 3) Kontakt (email + telefon s externí předvolbou)
  window.dkralContacts = new DKralContactValidator({
    emailId: 'email',
    phoneId: 'phone',
    ui: window.dkralAutocomplete
  });
});



