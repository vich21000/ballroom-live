/* Place Cards Thai font add-on 1.0.
 * No imports from Firebase, no network upload, no persistent font storage.
 * This script does not modify placecards.js or any guest data.
 */
(function () {
  'use strict';
  const FACE_FAMILY = 'Ballroom Thai 45 Light';
  const LOCAL_SOURCE = 'local("DB Helvethaica X 45 Li"), local("DBHelvethaicaX-45Li")';
  const DESCRIPTORS = { style: 'normal', weight: '300', unicodeRange: 'U+0E00-0E7F', display: 'swap' };
  const THAI = /[\u0e00-\u0e7f]/;
  let activeFace = null;
  let attempt = 0;
  let fontPending = Promise.resolve();
  let scheduled = false;
  let printPending = false;
  let status, picker, pickButton, sheets;

  function setStatus(message, state) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function wrapThaiOnly(element) {
    const fullName = element.textContent || '';
    if (!THAI.test(fullName)) return false;
    if (element.dataset.pcThaiOriginal !== fullName || !element.querySelector('.pc-thai-run')) {
      const fragment = document.createDocumentFragment();
      fullName.split(/([\u0e00-\u0e7f]+)/g).forEach(part => {
        if (!part) return;
        if (THAI.test(part)) {
          const span = document.createElement('span');
          span.className = 'pc-thai-run';
          span.lang = 'th';
          span.textContent = part;
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      element.replaceChildren(fragment);
      element.dataset.pcThaiOriginal = fullName;
    }
    element.dataset.pcThaiName = 'true';
    return true;
  }

  function fitThaiNames() {
    if (!sheets) return;
    sheets.querySelectorAll('.placecard-fullname').forEach(element => {
      if (!wrapThaiOnly(element)) return;
      if (!element.getBoundingClientRect().width) return;
      let points = 24; // Match the original name size; shrink only when necessary.
      element.style.fontSize = points + 'pt';
      const overflows = () => element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1;
      while (points > 12 && overflows()) {
        points -= 0.5;
        element.style.fontSize = points + 'pt';
      }
      element.dataset.pcNameOverflow = String(overflows());
    });
  }

  // Run after the original renderer's requestAnimationFrame(fitNames).
  function scheduleFit() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false;
      fitThaiNames();
    }));
  }

  async function loadFace(source, label, isFile) {
    const current = ++attempt;
    setStatus('Loading Thai font...', 'loading');
    try {
      const face = new FontFace(FACE_FAMILY, source, DESCRIPTORS);
      await face.load();
      if (current !== attempt) return;
      document.fonts.add(face);
      if (activeFace) document.fonts.delete(activeFace);
      activeFace = face;
      await document.fonts.ready;
      setStatus('Thai font ready - ' + label, 'ready');
      scheduleFit();
    } catch (error) {
      if (current !== attempt) return;
      if (activeFace) {
        setStatus('That file could not be loaded. The previous Thai font is still active.', 'warning');
      } else if (isFile) {
        setStatus('Font could not be loaded. Choose your original DB Helvethaica X Li v3.2.ttf file.', 'error');
      } else {
        setStatus('Thai font not loaded. Choose the font file on your computer before printing Thai names.', 'warning');
      }
    }
  }

  async function pickFont() {
    const file = picker.files && picker.files[0];
    picker.value = '';
    if (!file) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setStatus('Choose a valid TTF, OTF, WOFF or WOFF2 font file smaller than 10 MB.', 'error');
      return;
    }
    pickButton.disabled = true;
    try {
      const buffer = await file.arrayBuffer();
      // ArrayBuffer stays on this device; no URL fetch or upload is used.
      fontPending = loadFace(buffer, file.name + ' (this tab only)', true);
      await fontPending;
    } catch (error) {
      setStatus('The font file could not be read. Please select it again.', 'error');
    } finally {
      pickButton.disabled = false;
    }
  }

  function nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }

  async function printSafely() {
    if (printPending) return;
    printPending = true;
    try {
      await fontPending;
      await document.fonts.ready;
      fitThaiNames();
      await nextFrame();
      const hasThai = Array.from(sheets.querySelectorAll('.placecard-fullname'))
        .some(element => THAI.test(element.textContent || ''));
      if (hasThai && !activeFace) {
        alert('Thai font is not loaded. Choose DB Helvethaica X Li v3.2.ttf using "Load Thai font" before printing.');
        pickButton.focus();
        return;
      }
      if (sheets.querySelector('[data-pc-name-overflow="true"]')) {
        alert('A guest name is too long to fit without clipping. Please review the red-outlined name before printing.');
        return;
      }
      window.print();
    } finally {
      printPending = false;
    }
  }

  function initialise() {
    if (!document.body.classList.contains('placecards-page')) return;
    sheets = document.getElementById('placecardSheets');
    if (!sheets || document.getElementById('pcThaiFontToolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'pcThaiFontToolbar';
    toolbar.className = 'card no-print pc-font-toolbar';
    const info = document.createElement('div');
    info.className = 'pc-font-info';
    const title = document.createElement('strong');
    title.textContent = 'Thai names: DB Helvethaica X 45 Li';
    status = document.createElement('div');
    status.id = 'pcThaiFontStatus';
    status.className = 'pc-font-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const note = document.createElement('p');
    note.className = 'pc-font-note';
    note.textContent = 'Use the licensed font installed on this computer, or select your font file locally. Selected files are not uploaded or saved. Seat numbers and English text keep their original fonts.';
    info.append(title, status, note);
    pickButton = document.createElement('button');
    pickButton.id = 'pcThaiFontButton';
    pickButton.type = 'button';
    pickButton.textContent = 'Load Thai font';
    picker = document.createElement('input');
    picker.id = 'pcThaiFontFile';
    picker.type = 'file';
    picker.accept = '.ttf,.otf,.woff,.woff2';
    picker.hidden = true;
    pickButton.addEventListener('click', () => picker.click());
    picker.addEventListener('change', pickFont);
    toolbar.append(info, pickButton, picker);
    sheets.before(toolbar);

    if (!('FontFace' in window) || !document.fonts) {
      setStatus('This browser cannot load the Thai font. Use a current Chrome, Edge or Safari browser.', 'error');
      pickButton.disabled = true;
      return;
    }

    new MutationObserver(scheduleFit).observe(sheets, { childList: true, subtree: true, characterData: true });
    fontPending = loadFace(LOCAL_SOURCE, 'installed DB Helvethaica X 45 Li', false);
    scheduleFit();
    document.fonts.addEventListener('loadingdone', scheduleFit);
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('beforeprint', fitThaiNames);
    const printButton = document.getElementById('printBtn');
    if (printButton) {
      // Capture keeps the existing module's onclick from printing before fonts finish loading.
      printButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void printSafely();
      }, true);
    }
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void printSafely();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
}());
