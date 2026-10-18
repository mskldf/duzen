/* Film defteri: Claude'daki Letterboxd panelinden, Düzen'e taşındı. */
function filmPaneliKur(DATA, ek) {
  "use strict";

  /* ---------- yardımcılar ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) kid.forEach(k => k != null && el.append(k));
      else el.append(kid);
    }
    return el;
  }
  const $ = id => document.getElementById(id);
  function put(el) {
    const kids = [];
    for (let i = 1; i < arguments.length; i++) [].concat(arguments[i]).forEach(k => { if (k != null && k !== false) kids.push(k); });
    el.replaceChildren(...kids);
  }
  const nf = new Intl.NumberFormat("tr-TR");
  const nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
  const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true });
  function fmtDate(iso) {
    if (!iso) return "";
    const p = iso.split("-").map(Number);
    return p[2] + " " + MON[p[1] - 1] + " " + p[0];
  }
  function stars(r) {
    if (r == null) return "";
    const full = Math.floor(r);
    return "★".repeat(full) + (r - full >= 0.5 ? "½" : "");
  }
  function ratingNum(r) {
    const full = Math.floor(r);
    return (full ? String(full) : "") + (r - full >= 0.5 ? "½" : "");
  }
  function decadeLabel(dec) {
    const t = Math.floor((dec % 100) / 10);
    return dec + ([1, 3, 4, 6, 9].includes(t) ? "'lar" : "'ler");
  }
  function niceTicks(max) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = steps.find(s => max / s <= 5) || 1000;
    const out = [];
    for (let v = 0; v <= Math.ceil(max / step) * step; v += step) out.push(v);
    if (out.length < 2) out.push(step);
    return out;
  }
  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }
  const boxd = f => f.c ? "https://boxd.it/" + f.c : (f.u || "https://letterboxd.com/search/" + encodeURIComponent(f.n) + "/");

  /* ---------- tooltip ---------- */
  const tip = $("tip");
  function showTip(target, title, lines) {
    tip.replaceChildren(h("b", { text: title }), ...lines.map(l => h("div", { text: l })));
    tip.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }
  function bindTip(el, fn) {
    el.addEventListener("pointerenter", () => { const t = fn(); showTip(el, t[0], t[1]); });
    el.addEventListener("pointerleave", hideTip);
    el.addEventListener("focus", () => { const t = fn(); showTip(el, t[0], t[1]); });
    el.addEventListener("blur", hideTip);
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------- veri ---------- */
  const FILMS = DATA.films;
  FILMS.forEach((f, i) => { f.i = i; });
  const WATCHED = FILMS.filter(f => f.s === "w");
  const LIST = FILMS.filter(f => f.s === "l");
  const RATED = WATCHED.filter(f => f.r != null);
  const DIARY = DATA.diary.map(e => Object.assign({ film: FILMS[e.f] }, e));
  const HAS_TMDB = !!DATA.tmdb;
  const EXPORT = DATA.guncel || DATA.export;
  const EXPORT_YEAR = +EXPORT.slice(0, 4), EXPORT_MONTH = +EXPORT.slice(5, 7);
  const mean = list => list.reduce((s, f) => s + f.r, 0) / list.length;

  const GENRE = {
    28: "Aksiyon", 12: "Macera", 16: "Animasyon", 35: "Komedi", 80: "Suç", 99: "Belgesel", 18: "Dram",
    10751: "Aile", 14: "Fantastik", 36: "Tarih", 27: "Korku", 10402: "Müzik", 9648: "Gizem",
    10749: "Romantik", 878: "Bilim kurgu", 10770: "TV filmi", 53: "Gerilim", 10752: "Savaş", 37: "Western"
  };
  const W_GENRE = {
    10752: 2, 18: 1, 36: 1, 27: 1, 80: 0.5, 53: 0.5, 9648: 0.5,
    99: 0, 878: 0, 37: 0, 10770: 0,
    10402: -0.5, 10749: -0.5, 28: -0.5, 14: -0.5, 12: -1, 10751: -1.5, 16: -1.5, 35: -2
  };
  const RT_RULES = [[95, -1, "95 dk altı"], [120, 0, "95–119 dk"], [150, 1, "120–149 dk"], [Infinity, 2, "150 dk ve üstü"]];
  const LEVELS = ["Hafif", "Orta", "Ağır"];
  const COUNTRY_FIX = { US: "ABD", GB: "Birleşik Krallık", SU: "Sovyetler Birliği", XC: "Çekoslovakya", YU: "Yugoslavya", XG: "Doğu Almanya", DD: "Doğu Almanya", HK: "Hong Kong", KR: "Güney Kore" };
  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(["tr"], { type: "region" }); } catch (e) { regionNames = null; }
  function countryName(code) {
    if (COUNTRY_FIX[code]) return COUNTRY_FIX[code];
    try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
  }
  const fmtSign = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + nf1.format(Math.abs(v)).replace(",0", "");

  function heaviness(f) {
    if (!f.k) return null;
    const parts = [];
    let score = 0;
    (f.g || []).forEach(g => {
      const w = W_GENRE[g] || 0;
      if (w) parts.push([GENRE[g], w]);
      score += w;
    });
    if (f.rt) {
      const rule = RT_RULES.find(x => f.rt < x[0]);
      if (rule[1]) parts.push([(f.k === "t" ? "toplam " : "") + nf.format(f.rt) + " dk", rule[1]]);
      score += rule[1];
    }
    const level = score <= -1 ? 0 : score >= 2 ? 2 : 1;
    return { score, level, parts, noRuntime: !f.rt };
  }
  FILMS.forEach(f => { f.hv = heaviness(f); });

  /* ---------- başlık ---------- */
  const joined = DATA.joined ? MONTHS[+DATA.joined.slice(5, 7) - 1] + " " + DATA.joined.slice(0, 4) : "";
  $("eyebrow").textContent = (DATA.user || "") + (joined ? " · Letterboxd üyeliği " + joined : "");
  const stamp = $("stamp");
  stamp.append("Veri ", h("b", { text: fmtDate(EXPORT) }), " · TMDB ");
  if (HAS_TMDB) {
    const gecerli = FILMS.filter(f => f.s !== "x");
    stamp.append(h("b", { text: nf.format(gecerli.filter(f => f.id && !f.tmdb_bekliyor).length) + "/" + nf.format(gecerli.length) + " film eşleşti" }));
  } else {
    stamp.append(h("b", { text: "verisi bekleniyor" }));
  }

  /* ---------- sekmeler ---------- */
  const TABS = ["genel", "kirilimlar", "secici"];
  let currentTab = "genel";
  function setTab(name, focus) {
    if (!TABS.includes(name)) name = "genel";
    currentTab = name;
    TABS.forEach(t => {
      const on = t === name;
      $("tab-" + t).setAttribute("aria-selected", on ? "true" : "false");
      $("tab-" + t).tabIndex = on ? 0 : -1;
      $(t).hidden = !on;
    });
    if (focus) $("tab-" + name).focus();
    store("lbp.tab", name);
    hideTip();
  }
  TABS.forEach((t, i) => {
    const btn = $("tab-" + t);
    btn.addEventListener("click", () => { setTab(t); history.replaceState(null, "", "#" + t); });
    btn.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      setTab(next, true);
    });
  });

  /* ---------- ortak: film listesi ---------- */
  function filmList(items, opts) {
    opts = opts || {};
    const limit = opts.limit || 25;
    const box = h("div");
    const ul = h("ul", { class: "flist" });
    box.append(ul);
    let shown = 0;
    function render() {
      items.slice(shown, shown + limit).forEach(it => {
        const f = it.film || it;
        const r = it.film ? it.r : f.r;
        ul.append(h("li", null,
          h("span", { class: "st", text: r != null ? stars(r) : (f.s === "l" ? "listede" : "—") }),
          h("span", { class: "ttl" },
            h("a", { href: boxd(f), target: "_blank", rel: "noopener", text: f.n }),
            f.y ? h("span", { class: "yr", text: String(f.y) }) : null,
            it.x ? h("span", { class: "badge", text: "tekrar" }) : null,
            f.l && opts.likes ? h("span", { class: "badge", text: "beğeni" }) : null),
          h("span", { class: "dt", text: opts.right ? opts.right(it) : "" })));
      });
      shown += limit;
      more.hidden = shown >= items.length;
      more.textContent = "Daha fazla göster (" + nf.format(items.length - shown) + ")";
    }
    const more = h("button", { class: "ghost more", type: "button", onclick: render });
    box.append(more);
    render();
    return box;
  }
  function drill(container, title, sub, content) {
    container.replaceChildren(h("div", { class: "drill" },
      h("div", { class: "drill-head" }, h("h3", { text: title }), h("span", { class: "dt", text: sub || "" })),
      content));
  }
  function byRatingThenName(a, b) {
    return (b.r != null) - (a.r != null) || (b.r || 0) - (a.r || 0) || collator.compare(a.n, b.n);
  }

  /* ---------- genel: hero ---------- */
  $("hero-num").textContent = nf.format(WATCHED.length);
  $("hero-cap").textContent = "izlenen film · izleme listesinde " + nf.format(LIST.length) + " film bekliyor";
  const rewatches = DIARY.filter(e => e.x).length;
  const tiles = [
    [nf2.format(mean(RATED)), "★", "ortalama puan", nf.format(RATED.length) + " puanlı film üzerinden"],
    [pct.format(RATED.length / WATCHED.length), "", "puanlanan", nf.format(RATED.length) + " / " + nf.format(WATCHED.length) + " film"],
    [nf.format(DIARY.length), "", "günlük kaydı", nf.format(rewatches) + " tekrar izleme"],
    [nf.format(DATA.likes), "", "beğeni", nf.format(DATA.reviews) + " inceleme"]
  ];
  $("tiles").replaceChildren(...tiles.map(t => h("div", { class: "tile" },
    h("div", { class: "v" }, t[0], t[1] ? h("small", { text: t[1] }) : null),
    h("div", { class: "k", text: t[2] }),
    h("div", { class: "m", text: t[3] }))));

  /* ---------- genel: puan dağılımı ---------- */
  (function ratings() {
    const bins = [];
    for (let k = 1; k <= 10; k++) bins.push({ r: k / 2, films: [] });
    RATED.forEach(f => bins[Math.round(f.r * 2) - 1].films.push(f));
    const max = Math.max(...bins.map(b => b.films.length));
    const ticks = niceTicks(max), top = ticks[ticks.length - 1];
    const m = mean(RATED);
    $("ratings-sub").textContent = nf.format(RATED.length) + " puanlı film · ortalama " + nf2.format(m);
    const H = 190;
    const yAxis = h("div", { class: "cc-y", style: "--h:" + H + "px" }, ticks.map(t => h("span", { style: "bottom:" + (t / top * 100) + "%", text: nf.format(t) })));
    const plot = h("div", { class: "cc-plot", style: "--h:" + H + "px" });
    ticks.slice(1).forEach(t => plot.append(h("div", { class: "cc-grid", style: "bottom:" + (t / top * 100) + "%" })));
    const cols = h("div", { class: "cc-cols", style: "--n:10" });
    const xlab = h("div", { class: "cc-x", style: "--n:10" });
    const maxBin = bins.reduce((a, b) => (b.films.length > a.films.length ? b : a));
    let selected = null;
    bins.forEach((b, idx) => {
      const n = b.films.length;
      const col = h("button", {
        class: "cc-col", type: "button", style: "--v:" + (n / top),
        "aria-pressed": "false",
        "aria-label": stars(b.r) + " " + n + " film",
        onclick: () => select(idx)
      }, h("span", { class: "cc-bar" }), b === maxBin ? h("span", { class: "cc-val", text: nf.format(n) }) : null);
      bindTip(col, () => [stars(b.r) + "  " + nf.format(n) + " film", [pct.format(n / RATED.length) + " · puan " + nf1.format(b.r)]]);
      cols.append(col);
      xlab.append(h("span", { text: ratingNum(b.r) }));
      b.col = col;
    });
    plot.append(cols);
    const meanPos = ((m * 2 - 1) + 0.5) / 10 * 100;
    plot.append(h("div", { class: "cc-mean", style: "left:" + meanPos + "%" }, h("span", { text: "ort. " + nf2.format(m) })));
    $("ratings-chart").replaceChildren(h("div", { class: "cc" }, yAxis, plot, xlab, h("div", { class: "axis-title", text: "Puan (★)" })));

    function select(idx) {
      const b = bins[idx];
      if (selected === idx) {
        selected = null;
        b.col.setAttribute("aria-pressed", "false");
        xlab.children[idx].classList.remove("on");
        $("ratings-drill").replaceChildren();
        return;
      }
      if (selected != null) {
        bins[selected].col.setAttribute("aria-pressed", "false");
        xlab.children[selected].classList.remove("on");
      }
      selected = idx;
      b.col.setAttribute("aria-pressed", "true");
      xlab.children[idx].classList.add("on");
      const items = b.films.slice().sort((x, y) => (y.rd || "").localeCompare(x.rd || "") || collator.compare(x.n, y.n));
      drill($("ratings-drill"), stars(b.r) + " verdiğin filmler", nf.format(items.length) + " film",
        filmList(items, { right: f => fmtDate(f.rd), likes: true }));
    }

    const table = h("table", null,
      h("thead", null, h("tr", null, h("th", { text: "Puan" }), h("th", { class: "num", text: "Film" }), h("th", { class: "num", text: "Pay" }))),
      h("tbody", null, bins.map(b => h("tr", null,
        h("td", { text: stars(b.r) + "  (" + nf1.format(b.r) + ")" }),
        h("td", { class: "num", text: nf.format(b.films.length) }),
        h("td", { class: "num", text: pct.format(b.films.length / RATED.length) })))));
    $("ratings-table").replaceChildren(h("div", { class: "tbl-wrap" }, table));
  })();

  /* ---------- genel: ay ay izlemeler ---------- */
  (function months() {
    /* koyu zeminde az = koyu, çok = açık; aylık sayılar çarpık dağıldığı için eşit aralık değil basamak kullanılıyor */
    const BINS = [[1, 3, "#104281"], [4, 6, "#1c5cab"], [7, 9, "#2a78d6"], [10, 14, "#5598e7"], [15, 24, "#86b6ef"], [25, Infinity, "#cde2fb"]];
    const byMonth = new Map();
    DIARY.forEach(e => {
      const key = e.d.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(e);
    });
    const years = [];
    const firstYear = +DIARY[0].d.slice(0, 4);
    for (let y = firstYear; y <= EXPORT_YEAR; y++) years.push(y);
    const max = Math.max(...[...byMonth.values()].map(v => v.length));
    const color = n => BINS.find(b => n >= b[0] && n <= b[1])[2];
    const total = DIARY.length;
    $("months-sub").textContent = "Günlüğe tarihli girilen " + nf.format(total) + " izleme, " + firstYear + "–" + EXPORT_YEAR + ". Hücreye tıkla, o ayın listesi açılsın.";

    const grid = h("div", { class: "hm", role: "group", "aria-label": "Aylara göre izleme sayısı" });
    grid.append(h("span"));
    MON.forEach(m => grid.append(h("span", { class: "hm-mh", title: m }, h("span", { class: "full", text: m }), h("span", { class: "ini", text: m.charAt(0) }))));
    grid.append(h("span", { class: "hm-mh", style: "text-align:right", text: "Top." }));
    let selectedCell = null;
    years.forEach(y => {
      grid.append(h("span", { class: "hm-y", text: String(y) }));
      let yearTotal = 0;
      for (let m = 1; m <= 12; m++) {
        const key = y + "-" + String(m).padStart(2, "0");
        const list = byMonth.get(key) || [];
        yearTotal += list.length;
        const future = y > EXPORT_YEAR || (y === EXPORT_YEAR && m > EXPORT_MONTH);
        if (future) { grid.append(h("span", { class: "hm-cell future", "aria-hidden": "true" })); continue; }
        const n = list.length;
        const cell = h("button", {
          class: "hm-cell", type: "button", "aria-pressed": "false",
          style: n ? "background:" + color(n) : null,
          "aria-label": MONTHS[m - 1] + " " + y + ": " + n + " izleme",
          onclick: () => {
            if (selectedCell === cell) {
              cell.setAttribute("aria-pressed", "false");
              selectedCell = null;
              $("months-drill").replaceChildren();
              return;
            }
            if (selectedCell) selectedCell.setAttribute("aria-pressed", "false");
            selectedCell = cell;
            cell.setAttribute("aria-pressed", "true");
            const items = list.slice().sort((a, b) => b.d.localeCompare(a.d));
            drill($("months-drill"), MONTHS[m - 1] + " " + y, nf.format(n) + " izleme",
              items.length ? filmList(items, { right: e => fmtDate(e.d), limit: 40 }) : h("p", { class: "note", text: "Bu ay günlüğe kayıt yok." }));
          }
        });
        const rw = list.filter(e => e.x).length;
        bindTip(cell, () => [MONTHS[m - 1] + " " + y, [nf.format(n) + " izleme" + (rw ? " (" + rw + " tekrar)" : "")]]);
        grid.append(cell);
      }
      const partial = y === EXPORT_YEAR && EXPORT_MONTH < 12;
      grid.append(h("span", { class: "hm-t" + (partial ? " partial" : ""), text: nf.format(yearTotal) }));
    });
    const legend = h("div", { class: "hm-legend" },
      h("span", { text: "Ayda" }),
      BINS.map(b => h("span", { class: "hm-key" }, h("i", { style: "background:" + b[2] }), b[1] === Infinity ? b[0] + "+" : b[0] + "–" + b[1])),
      h("span", { text: "izleme · en yoğun ay " + max + " · gri: kayıt yok · * " + fmtDate(EXPORT) + " tarihine kadar" }));
    $("months-chart").replaceChildren(h("div", { class: "tbl-wrap" }, grid), legend);

    const thead = h("tr", null, h("th", { text: "Yıl" }), MON.map(m => h("th", { class: "num", text: m })), h("th", { class: "num", text: "Toplam" }));
    const rows = years.map(y => {
      let t = 0;
      const cells = MON.map((_, i) => {
        const future = y === EXPORT_YEAR && i + 1 > EXPORT_MONTH;
        const n = (byMonth.get(y + "-" + String(i + 1).padStart(2, "0")) || []).length;
        t += n;
        return h("td", { class: "num" + (future ? " dim" : ""), text: future ? "–" : String(n) });
      });
      return h("tr", null, h("td", { text: String(y) }), cells, h("td", { class: "num", text: String(t) }));
    });
    $("months-table").replaceChildren(h("div", { class: "tbl-wrap" }, h("table", null, h("thead", null, thead), h("tbody", null, rows))));
  })();

  document.querySelectorAll("[data-table-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.tableToggle;
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "Grafik" : "Tablo";
      $(key + "-chart").hidden = on;
      $(key + "-table").hidden = !on;
    });
  });

  /* ---------- kırılımlar: grup tablosu ---------- */
  function groupTable(container, groups, opts) {
    opts = opts || {};
    const maxW = Math.max(1, ...groups.map(g => g.w.length), ...(opts.listBar ? groups.map(g => g.l.length) : []));
    const cols = [
      h("th", { text: opts.label }),
      h("th", { text: "İzlenen" }),
      opts.listBar ? h("th", { text: "Listede" }) : null,
      h("th", { class: "num", text: "Ort. puan" }),
      h("th", { class: "num hide-sm", text: "Puanlı" }),
      opts.listBar ? null : h("th", { class: "num hide-sm", text: "Listede" })
    ];
    const tbody = h("tbody");
    const ncol = cols.filter(Boolean).length;
    let limit = opts.limit || groups.length;
    function render() {
      tbody.replaceChildren();
      groups.slice(0, limit).forEach(g => {
        const rated = g.w.filter(f => f.r != null);
        const avg = rated.length ? mean(rated) : null;
        const row = h("tr", { class: "row", tabindex: "0", "aria-expanded": "false" },
          h("td", { text: g.label }),
          h("td", null, h("div", { class: "bar" }, h("i", { style: "width:" + (g.w.length / maxW * 100) + "%" }), h("b", { text: nf.format(g.w.length) }))),
          opts.listBar ? h("td", null, h("div", { class: "bar l" }, h("i", { style: "width:" + (g.l.length / maxW * 100) + "%" }), h("b", { text: nf.format(g.l.length) }))) : null,
          h("td", { class: "num" + (rated.length < 3 ? " dim" : ""), text: avg != null ? nf2.format(avg) : "—" }),
          h("td", { class: "num hide-sm", text: nf.format(rated.length) }),
          opts.listBar ? null : h("td", { class: "num hide-sm", text: nf.format(g.l.length) }));
        let detail = null;
        const toggle = () => {
          if (detail) { detail.remove(); detail = null; row.setAttribute("aria-expanded", "false"); return; }
          const watched = g.w.slice().sort(byRatingThenName);
          const body = h("div", null,
            watched.length ? filmList(watched, { right: f => (f.rt && opts.showRuntime ? f.rt + " dk" : ""), likes: true }) : h("p", { class: "note", text: "Bu grupta izlediğin film yok." }),
            g.l.length ? h("p", { class: "note", text: "İzleme listende bu gruptan " + nf.format(g.l.length) + " film var. Seçici sekmesinden süzebilirsin." }) : null);
          detail = h("tr", { class: "detail" }, h("td", { colspan: String(ncol) }, body));
          row.after(detail);
          row.setAttribute("aria-expanded", "true");
        };
        row.addEventListener("click", toggle);
        row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        tbody.append(row);
      });
      moreBtn.hidden = limit >= groups.length;
      moreBtn.textContent = "Tümünü göster (" + nf.format(groups.length) + ")";
    }
    const moreBtn = h("button", { class: "ghost more", type: "button", onclick: () => { limit = groups.length; render(); } });
    const parts = [];
    if (opts.listBar) parts.push(h("div", { class: "legend" },
      h("span", null, h("i", { style: "background:var(--s1)" }), "İzlenen"),
      h("span", null, h("i", { style: "background:var(--s2)" }), "İzleme listesi")));
    parts.push(h("div", { class: "tbl-wrap" }, h("table", { class: "bt" }, h("thead", null, h("tr", null, cols)), tbody)));
    parts.push(moreBtn);
    if (opts.note) parts.push(h("p", { class: "note", text: opts.note }));
    container.replaceChildren(...parts);
    render();
  }
  function groupBy(keyFn) {
    const map = new Map();
    FILMS.forEach(f => {
      const keys = keyFn(f);
      (Array.isArray(keys) ? keys : [keys]).forEach(k => {
        if (k == null) return;
        if (!map.has(k)) map.set(k, { key: k, w: [], l: [] });
        map.get(k)[f.s === "w" ? "w" : "l"].push(f);
      });
    });
    return [...map.values()];
  }
  const tmdbWaiting = text => h("div", { class: "placeholder", text: text || "TMDB verisi gelince dolacak." });

  (function decades() {
    const groups = groupBy(f => (f.y ? Math.floor(f.y / 10) * 10 : null)).sort((a, b) => a.key - b.key);
    groups.forEach(g => { g.label = decadeLabel(g.key); });
    groupTable($("decades"), groups, {
      label: "Dekad", listBar: true,
      note: "Ortalama puan, o dekaddeki puanlı filmlerinden hesaplanır; 3'ten az puanlı film varsa sönük gösterilir."
    });
  })();

  if (HAS_TMDB) {
    (function genres() {
      const groups = groupBy(f => f.g || null).filter(g => GENRE[g.key]);
      groups.forEach(g => { g.label = GENRE[g.key]; });
      groups.sort((a, b) => b.w.length - a.w.length || b.l.length - a.l.length);
      groupTable($("genres"), groups, { label: "Tür" });
    })();
    (function countries() {
      const groups = groupBy(f => f.co || null);
      groups.forEach(g => { g.label = countryName(g.key); });
      groups.sort((a, b) => b.w.length - a.w.length || b.l.length - a.l.length || collator.compare(a.label, b.label));
      groupTable($("countries"), groups, { label: "Ülke", limit: 15 });
    })();
    (function runtimes() {
      const B = [[0, 80, "80 dk altı"], [80, 95, "80–94 dk"], [95, 110, "95–109 dk"], [110, 120, "110–119 dk"], [120, 135, "120–134 dk"], [135, 150, "135–149 dk"], [150, 180, "150–179 dk"], [180, Infinity, "180 dk ve üstü"]];
      const groups = B.map(b => ({ key: b[2], label: b[2], w: [], l: [] }));
      FILMS.forEach(f => {
        if (!f.rt || f.k === "t") return;
        const i = B.findIndex(b => f.rt >= b[0] && f.rt < b[1]);
        groups[i][f.s === "w" ? "w" : "l"].push(f);
      });
      const withRt = WATCHED.filter(f => f.rt && f.k !== "t");
      const avgRt = withRt.reduce((s, f) => s + f.rt, 0) / withRt.length;
      const totalMin = withRt.reduce((s, f) => s + f.rt, 0);
      groupTable($("runtimes"), groups, {
        label: "Süre", showRuntime: true,
        note: "İzlediğin filmlerin ortalama süresi " + nf.format(Math.round(avgRt)) + " dk. Toplamı yaklaşık " + nf.format(Math.round(totalMin / 60)) + " saat (" + nf.format(withRt.length) + " filmin süresi var; tekrar izlemeler sayılmadı)."
      });
    })();
    (function directors() {
      const groups = groupBy(f => f.di || null).filter(g => g.w.length);
      const byCount = groups.slice().sort((a, b) => b.w.length - a.w.length || collator.compare(a.key, b.key)).slice(0, 15);
      const eligible = groups.filter(g => g.w.filter(f => f.r != null).length >= 3);
      eligible.forEach(g => { g.avg = mean(g.w.filter(f => f.r != null)); });
      const byAvg = eligible.sort((a, b) => b.avg - a.avg || b.w.length - a.w.length).slice(0, 15);
      const drillBox = h("div");
      function list(items, right) {
        return h("ol", { class: "flist" }, items.map(g => h("li", null,
          h("span", { class: "st", text: right(g) }),
          h("span", { class: "ttl" }, h("a", {
            href: "#", text: g.key, onclick: e => {
              e.preventDefault();
              const films = g.w.slice().sort(byRatingThenName);
              drill(drillBox, g.key, nf.format(g.w.length) + " izlenen" + (g.l.length ? " · listede " + nf.format(g.l.length) : ""),
                filmList(films, { right: f => (f.y ? String(f.y) : ""), likes: true }));
              drillBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          })),
          h("span", { class: "dt", text: g.l.length ? "listede " + nf.format(g.l.length) : "" }))));
      }
      $("directors").replaceChildren(
        h("div", { class: "two" },
          h("div", null, h("h3", { text: "En çok izlediklerin" }), list(byCount, g => nf.format(g.w.length) + " film")),
          h("div", null, h("h3", { text: "En yüksek ortalama (en az 3 puanlı film)" }), list(byAvg, g => nf2.format(g.avg) + " ★"))),
        drillBox,
        h("p", { class: "note", text: "Sol sütunda film sayısı, sağda ortalama puan. Ortalamaya yalnızca en az 3 filmini puanladığın yönetmenler girer." }));
    })();
    (function matching() {
      const c = DATA.tmdb.counts;
      const um = FILMS.filter(f => f.um);
      const loose = FILMS.filter(f => f.mt === "gevsek");
      const methods = {};
      FILMS.forEach(f => { if (f.mt) methods[f.mt] = (methods[f.mt] || 0) + 1; });
      const NAMES = { rss: "Letterboxd akışındaki TMDB numarası", sayfa: "Letterboxd sayfasındaki TMDB numarası", tam: "Ad ve yıl birebir", yil_farki: "Ad aynı, yıl ±1", baska_yayin_yili: "Ad aynı, o yıl başka gösterimi var", yilsiz: "Ad aynı, yılsız arama", dizi: "Mini dizi olarak bulundu", baskin_aday: "Aynı adlı adaylardan oyu açık ara önde olan", gevsek: "O yıl tek sonuç, adı farklı" };
      const rows = Object.keys(NAMES).filter(k => methods[k]).map(k => h("tr", null, h("td", { text: NAMES[k] }), h("td", { class: "num", text: nf.format(methods[k]) })));
      rows.push(h("tr", null, h("td", { text: "Eşleşmedi" }), h("td", { class: "num", text: nf.format(um.length) })));
      const tmdbUrl = (k, id) => "https://www.themoviedb.org/" + (k === "t" || k === "tv" ? "tv/" : "movie/") + id;
      const label = x => (x.t || "?") + (x.y ? " (" + x.y + ")" : "") + " · " + nf.format(x.v || 0) + " oy";
      const dominant = FILMS.filter(f => f.mt === "baskin_aday").sort((a, b) => collator.compare(a.n, b.n));
      const lowVotes = FILMS.filter(f => f.k && (f.vc || 0) < 20).sort((a, b) => (a.vc || 0) - (b.vc || 0) || collator.compare(a.n, b.n));
      const reviewRow = (f, lines) => h("li", null,
        h("span", { class: "st", text: f.s === "w" ? "izlendi" : "listede" }),
        h("span", { class: "ttl" },
          h("a", { href: boxd(f), target: "_blank", rel: "noopener", text: f.n }),
          f.y ? h("span", { class: "yr", text: String(f.y) }) : null,
          lines.filter(Boolean).map(t => h("div", { class: "dt", text: t }))),
        h("span", { class: "dt" }, h("a", { href: tmdbUrl(f.k, f.id), target: "_blank", rel: "noopener", text: "TMDB" })));
      const dominantList = h("ul", { class: "flist" }, dominant.map(f => reviewRow(f, [
        "seçilen: " + label({ t: f.tt || f.n, y: f.ty, v: f.vc }) + (f.k === "t" ? " · mini dizi" : ""),
        f.alt && f.alt.length ? "diğer: " + f.alt.map(label).join(", ") : null,
        f.pv ? "önceki eşleşme: " + label(f.pv) : null])));
      const lowList = h("ul", { class: "flist" }, lowVotes.map(f => reviewRow(f, [
        label({ t: f.tt || f.n, y: f.ty, v: f.vc }) + (f.di && f.di.length ? " · " + f.di[0] : "") + (f.rt ? " · " + f.rt + " dk" : "")])));
      const umList = h("ul", { class: "flist" }, um.map(f => h("li", null,
        h("span", { class: "st", text: f.s === "w" ? "izlendi" : "listede" }),
        h("span", { class: "ttl" },
          h("a", { href: boxd(f), target: "_blank", rel: "noopener", text: f.n }),
          f.y ? h("span", { class: "yr", text: String(f.y) }) : null,
          h("div", { class: "dt", text: f.um.why + (f.um.cand.length ? " · adaylar: " + f.um.cand.map(x => x.title + (x.year ? " (" + x.year + ")" : "")).join(", ") : "") })),
        h("span", { class: "dt" }, h("a", { href: "https://www.themoviedb.org/search?query=" + encodeURIComponent(f.n), target: "_blank", rel: "noopener", text: "TMDB'de ara" })))));
      const looseList = h("ul", { class: "flist" }, loose.map(f => h("li", null,
        h("span", { class: "st", text: f.s === "w" ? "izlendi" : "listede" }),
        h("span", { class: "ttl" }, h("a", { href: boxd(f), target: "_blank", rel: "noopener", text: f.n }), h("span", { class: "yr", text: "→ " + (f.tt || f.n) })),
        h("span", { class: "dt" }, h("a", { href: "https://www.themoviedb.org/" + (f.k === "t" ? "tv/" : "movie/") + f.id, target: "_blank", rel: "noopener", text: "TMDB" })))));
      put($("matching"),
        h("div", { class: "tbl-wrap" }, h("table", null, h("tbody", null, rows))),
        um.length ? h("details", { class: "how" }, h("summary", { text: "Eşleşmeyen " + nf.format(um.length) + " film" }), umList) : null,
        dominant.length ? h("details", { class: "how" }, h("summary", { text: "Oy farkıyla seçilen " + nf.format(dominant.length) + " film (kontrol için)" }), dominantList) : null,
        loose.length ? h("details", { class: "how" }, h("summary", { text: "Gevşek eşleşen " + nf.format(loose.length) + " film (kontrol için)" }), looseList) : null,
        lowVotes.length ? h("details", { class: "how" }, h("summary", { text: "20'den az oylu eşleşmeler: " + nf.format(lowVotes.length) + " film (kontrol için)" }), lowList) : null,
        h("p", { class: "note", text: "Oy farkıyla seçim: aynı adlı adaylar (o yıl, ±1 yıl ve mini diziler) arasında en çok oy alan en az 20 oya ve ikinciden en az 10 kat fazla oya sahipse seçilir. Eşleşmeyen filmler tür, ülke, yönetmen ve süre tablolarında yok; diğer her yerde var." }));
    })();
  } else {
    ["genres", "countries", "directors", "runtimes", "matching"].forEach(id => $(id).replaceChildren(tmdbWaiting()));
  }

  /* ---------- seçici ---------- */
  const PICK_DEFAULT = { lv: [0, 1, 2], rt: "all", genre: "all", dec: "all", co: "all", tv: false, unrel: false, sort: "added" };
  const pickState = Object.assign({}, PICK_DEFAULT, store("lbp.picker") || {});
  let currentPick = null;
  const recent = [];

  function released(f) {
    if (f.rl) return f.rl <= EXPORT;
    if (!f.y) return false;
    return f.y < EXPORT_YEAR || (f.y === EXPORT_YEAR && !HAS_TMDB);
  }
  function option(value, label) { return h("option", { value: String(value), text: label }); }
  function fillSelect(sel, opts, value) {
    sel.replaceChildren(...opts.map(o => option(o[0], o[1])));
    sel.value = String(value);
    if (sel.value !== String(value)) { sel.value = String(opts[0][0]); }
  }

  const lvlBox = $("f-lvl");
  LEVELS.forEach((name, lv) => {
    const btn = h("button", { type: "button", "aria-pressed": pickState.lv.includes(lv) ? "true" : "false", disabled: !HAS_TMDB },
      h("span", { class: "meter", "data-l": String(lv) }, h("i"), h("i"), h("i")), name);
    btn.addEventListener("click", () => {
      const on = btn.getAttribute("aria-pressed") === "true";
      if (on && pickState.lv.length === 1) return;
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      pickState.lv = on ? pickState.lv.filter(x => x !== lv) : pickState.lv.concat(lv).sort();
      onFilter();
    });
    lvlBox.append(btn);
  });

  fillSelect($("f-rt"), [["all", "Hepsi"], ["okuma", okumaEtiketi()], ["100", "100 dk'ya kadar"], ["120", "120 dk'ya kadar"], ["150", "150 dk'ya kadar"], ["long", "150 dk üstü"]], pickState.rt);
  const genreOpts = [["all", "Hepsi"]].concat(Object.keys(GENRE).filter(g => LIST.some(f => (f.g || []).includes(+g))).map(g => [g, GENRE[g]]).sort((a, b) => collator.compare(a[1], b[1])));
  fillSelect($("f-genre"), genreOpts, pickState.genre);
  const decs = [...new Set(LIST.filter(f => f.y).map(f => Math.floor(f.y / 10) * 10))].sort((a, b) => a - b);
  fillSelect($("f-dec"), [["all", "Hepsi"]].concat(decs.map(d => [d, decadeLabel(d)])), pickState.dec);
  const coCount = new Map();
  LIST.forEach(f => (f.co || []).forEach(c => coCount.set(c, (coCount.get(c) || 0) + 1)));
  const coOpts = [["all", "Hepsi"]].concat([...coCount.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, countryName(c) + " (" + n + ")"]));
  fillSelect($("f-co"), coOpts, pickState.co);
  fillSelect($("f-sort"), [["added", "Listeye eklenme (yeni önce)"], ["year", "Çıkış yılı (eski önce)"], ["runtime", "Süre (kısa önce)"], ["light", "Ağırlık (hafif önce)"], ["tmdb", "TMDB puanı (yüksek önce)"]], pickState.sort);
  $("f-tv").checked = !!pickState.tv;
  $("f-unrel").checked = !!pickState.unrel;
  if (!HAS_TMDB) {
    ["f-rt", "f-genre", "f-co"].forEach(id => { $(id).disabled = true; });
    $("f-tv").disabled = true;
    $("f-sort").querySelectorAll('option[value="runtime"], option[value="light"], option[value="tmdb"]').forEach(o => { o.disabled = true; });
  }
  ["f-rt", "f-genre", "f-dec", "f-co", "f-sort"].forEach(id => $(id).addEventListener("change", () => {
    const key = { "f-rt": "rt", "f-genre": "genre", "f-dec": "dec", "f-co": "co", "f-sort": "sort" }[id];
    pickState[key] = $(id).value;
    onFilter();
  }));
  $("f-tv").addEventListener("change", () => { pickState.tv = $("f-tv").checked; onFilter(); });
  $("f-unrel").addEventListener("change", () => { pickState.unrel = $("f-unrel").checked; onFilter(); });

  function matches(f) {
    const s = pickState;
    if (!s.unrel && !released(f)) return false;
    if (HAS_TMDB) {
      if (f.k === "t" && !s.tv) return false;
      if (s.lv.length < 3 && (!f.hv || !s.lv.includes(f.hv.level))) return false;
      if (s.rt === "okuma") {
        const kalan = ek.okumayaKalan();
        if (kalan == null || kalan <= 0 || !f.rt || f.k === "t" || f.rt > kalan) return false;
      } else if (s.rt !== "all") {
        if (!f.rt || f.k === "t") return false;
        if (s.rt === "long" ? f.rt <= 150 : f.rt > +s.rt) return false;
      }
      if (s.genre !== "all" && !(f.g || []).includes(+s.genre)) return false;
      if (s.co !== "all" && !(f.co || []).includes(s.co)) return false;
    }
    if (s.dec !== "all" && (!f.y || Math.floor(f.y / 10) * 10 !== +s.dec)) return false;
    return true;
  }
  const SORTS = {
    added: (a, b) => b.d.localeCompare(a.d) || collator.compare(a.n, b.n),
    year: (a, b) => (a.y || 9999) - (b.y || 9999) || collator.compare(a.n, b.n),
    runtime: (a, b) => (a.rt || 9999) - (b.rt || 9999) || collator.compare(a.n, b.n),
    light: (a, b) => (a.hv ? a.hv.score : 99) - (b.hv ? b.hv.score : 99) || collator.compare(a.n, b.n),
    tmdb: (a, b) => (b.va || 0) - (a.va || 0) || collator.compare(a.n, b.n)
  };
  let filtered = [];
  let plistShown = 0;
  // "Bu akşam ne izlesem": okuma bloğunun başlangıcına kalan süre
  function okumaEtiketi() {
    const kalan = ek.okumayaKalan();
    if (kalan == null) return "Okumaya kadar (planda yok)";
    if (kalan <= 0) return "Okumaya kadar (vakit kalmadı)";
    return "Okumaya kadar (" + nf.format(kalan) + " dk)";
  }
  function onFilter() {
    const okumaSec = $("f-rt").querySelector('option[value="okuma"]');
    if (okumaSec) okumaSec.textContent = okumaEtiketi();
    store("lbp.picker", pickState);
    filtered = LIST.filter(matches).sort(SORTS[pickState.sort] || SORTS.added);
    const hiddenUnrel = pickState.unrel ? 0 : LIST.filter(f => !released(f)).length;
    $("pick-count").textContent = nf.format(filtered.length) + " film uyuyor" + (hiddenUnrel ? " · çıkmamış " + nf.format(hiddenUnrel) + " film gizli" : "");
    $("pick").disabled = !filtered.length;
    $("list-title").textContent = "Uyanlar (" + nf.format(filtered.length) + ")";
    plistShown = 0;
    $("plist").replaceChildren();
    renderPlist();
  }
  function renderPlist() {
    const ol = $("plist");
    filtered.slice(plistShown, plistShown + 60).forEach(f => {
      const meta = [f.y || "", f.rt ? f.rt + " dk" : "", f.va ? "TMDB " + nf1.format(f.va) : ""].filter(Boolean).join(" · ");
      const li = h("li", { tabindex: "0", "aria-current": currentPick === f ? "true" : "false" },
        f.hv ? h("span", { class: "meter", "data-l": String(f.hv.level), title: LEVELS[f.hv.level] }, h("i"), h("i"), h("i")) : h("span"),
        h("span", { class: "pt", text: f.n }),
        h("span", { class: "pm", text: meta }));
      const choose = () => { showTicket(f); $("ticket").scrollIntoView({ behavior: "smooth", block: "nearest" }); };
      li.addEventListener("click", choose);
      li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
      f._li = li;
      ol.append(li);
    });
    plistShown += 60;
    const more = $("plist-more");
    more.hidden = plistShown >= filtered.length;
    more.textContent = "Daha fazla göster (" + nf.format(Math.max(0, filtered.length - plistShown)) + ")";
  }
  $("plist-more").addEventListener("click", renderPlist);

  function showTicket(f) {
    if (currentPick && currentPick._li) currentPick._li.setAttribute("aria-current", "false");
    currentPick = f;
    if (f && f._li) f._li.setAttribute("aria-current", "true");
    const box = $("ticket");
    if (!f) { box.replaceChildren(h("div", { class: "placeholder", text: "Bu süzgece uyan film yok. Bir filtreyi gevşet." })); return; }
    const hv = f.hv;
    const metaBits = [f.y ? String(f.y) : null, f.rt ? (f.k === "t" ? "toplam " : "") + f.rt + " dk" : null, f.k === "t" ? "mini dizi" + (f.ep ? ", " + f.ep + " bölüm" : "") : null, (f.co || []).slice(0, 2).map(countryName).join(", ") || null].filter(Boolean);
    const main = h("div", { class: "t-main" },
      h("p", { class: "t-code", text: "boxd.it/" + f.c + " · listeye eklendi " + fmtDate(f.d) }),
      h("h2", { class: "t-title", text: f.n }),
      f.tt ? h("p", { class: "t-alt", text: "TMDB'de: " + f.tt }) : null,
      metaBits.length ? h("p", { class: "t-meta", text: metaBits.join(" · ") }) : null,
      (f.di && f.di.length) || (f.ca && f.ca.length) ? h("p", { class: "t-people" },
        f.di && f.di.length ? (f.k === "t" ? "Yaratıcı: " : "Yönetmen: ") + f.di.join(", ") : "",
        f.di && f.di.length && f.ca && f.ca.length ? " · " : "",
        f.ca && f.ca.length ? "Oyuncular: " + f.ca.join(", ") : "") : null,
      f.g && f.g.length ? h("div", { class: "chips" }, f.g.map(g => h("span", { class: "chip", text: GENRE[g] }))) : null,
      f.ov ? h("p", { class: "t-ov", lang: "en", text: f.ov }) : null,
      h("div", { class: "t-links" },
        h("a", { href: boxd(f), target: "_blank", rel: "noopener", text: "Letterboxd'da aç ↗" }),
        f.id ? h("a", { href: "https://www.themoviedb.org/" + (f.k === "t" ? "tv/" : "movie/") + f.id, target: "_blank", rel: "noopener", text: "TMDB ↗" }) : null));
    let stub;
    if (hv) {
      const why = hv.parts.length ? hv.parts.map(p => p[0] + " " + fmtSign(p[1])).join(" · ") : "Ağırlık katan tür ya da süre yok";
      stub = h("div", { class: "t-stub" },
        h("span", { class: "label", text: "Ağırlık" }),
        h("span", { class: "meter lg", "data-l": String(hv.level) }, h("i"), h("i"), h("i")),
        h("p", { class: "t-lvl", text: LEVELS[hv.level] }),
        h("p", { class: "t-why" }, why + " = ", h("b", { text: fmtSign(hv.score) })),
        hv.noRuntime ? h("p", { class: "t-score", text: "Süre bilgisi yok, yalnız türe göre." }) : null,
        f.va ? h("p", { class: "t-score", text: "TMDB " + nf1.format(f.va) + " (" + nf.format(f.vc) + " oy)" }) : null);
    } else {
      stub = h("div", { class: "t-stub" },
        h("span", { class: "label", text: "Ağırlık" }),
        h("p", { class: "t-why", text: HAS_TMDB ? "Bu film TMDB'de eşleşmedi, ağırlığı hesaplanamadı." : "TMDB verisi gelince hesaplanacak." }));
    }
    box.replaceChildren(h("article", { class: "ticket", "aria-live": "polite" }, main, stub));
  }
  $("pick").addEventListener("click", () => {
    if (!filtered.length) return;
    let pool = filtered.filter(f => !recent.includes(f) && f !== currentPick);
    if (!pool.length) pool = filtered;
    const f = pool[Math.floor(Math.random() * pool.length)];
    recent.push(f);
    if (recent.length > 8) recent.shift();
    showTicket(f);
  });

  const howRows = Object.keys(W_GENRE).filter(g => W_GENRE[g]).sort((a, b) => W_GENRE[b] - W_GENRE[a]).map(g => h("tr", null, h("td", { text: GENRE[g] }), h("td", { class: "num", text: fmtSign(W_GENRE[g]) })));
  $("how-body").replaceChildren(
    h("p", { class: "note", text: "Her film için türlerinin puanları ve süre puanı toplanır. Toplam −1 ya da altı Hafif, +2 ya da üstü Ağır, aradakiler Orta. Mini dizilerde süre olarak toplam süre kullanılır. Puanı sıfır olan türler (Belgesel, Bilim kurgu, Western, TV filmi) toplamı değiştirmez." }),
    h("div", { class: "tbl-wrap" }, h("table", null,
      h("thead", null, h("tr", null, h("th", { text: "Tür / süre" }), h("th", { class: "num", text: "Puan" }))),
      h("tbody", null, howRows, RT_RULES.filter(r => r[1]).map(r => h("tr", null, h("td", { text: r[2] }), h("td", { class: "num", text: fmtSign(r[1]) })))))));

  $("picker-sub").textContent = HAS_TMDB
    ? "İzleme listendeki " + nf.format(LIST.length) + " filmden süz, sonra rastgele çek."
    : "İzleme listendeki " + nf.format(LIST.length) + " film. Ağırlık, süre, tür ve ülke süzgeçleri TMDB verisi gelince açılacak; şimdilik dekada göre süzüp çekebilirsin.";

  /* ---------- alt bilgi ---------- */
  put($("foot"),
    h("p", { text: "Kaynak: Letterboxd veri dışa aktarımı (" + fmtDate(DATA.export) + ") ve her sabah okunan Letterboxd akışı (son: " + fmtDate(EXPORT) + "): izlenenler, izleme listesi, puanlar, günlük ve beğeniler." + (HAS_TMDB ? " Tür, ülke, süre, yönetmen ve oyuncu bilgisi TMDB'den (" + fmtDate((DATA.tmdb.created || "").slice(0, 10)) + ")." : "") }),
    h("p", { text: "Ortalamalar yalnızca puan verdiğin filmlerden hesaplanır. Ay ay grafiği günlüğe tarihiyle girilen izlemeleri sayar; günlük 2021'den başlıyor, daha önceki izlemeler orada yok." }),
    HAS_TMDB ? h("p", { text: "This product uses the TMDB API but is not endorsed or certified by TMDB." }) : null);

  /* ---------- başlat ---------- */
  function start(saved) {
    saved = saved || {};
    const [fromHash, hashArg] = (location.hash || "").slice(1).split("&");
    if (hashArg === "okuma") { pickState.rt = "okuma"; $("f-rt").value = "okuma"; }
    setTab(TABS.includes(fromHash) ? fromHash : (saved.tab || store("lbp.tab") || "genel"));
    onFilter();
    const savedPick = saved.pick && FILMS.find(f => f.c === saved.pick && f.s === "l");
    if (savedPick) showTicket(savedPick);
    else if (filtered.length) showTicket(filtered[Math.floor(Math.random() * filtered.length)]);
    else showTicket(null);
  }
  start({});
  setInterval(() => { if (pickState.rt === "okuma" && currentTab === "secici") onFilter(); else { const o = $("f-rt").querySelector('option[value="okuma"]'); if (o) o.textContent = okumaEtiketi(); } }, 60000);
}

/* Yükleyici: film/veri.json duzen-veri deposundan; son kopya cihazda (Cache Storage) durur. */
(function () {
  'use strict';
  const SAHIP = 'mskldf', DEPO = 'duzen-veri', DAL = 'main', API = 'https://api.github.com';
  const ONBELLEK = 'duzen-film-1';
  const $ = id => document.getElementById(id);
  function yerel(k, v) { try { const x = localStorage.getItem('duzen.' + k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } }
  const anahtar = yerel('anahtar', '');

  function bildir(metin, dugme) {
    const b = $('bildirim');
    b.replaceChildren(document.createTextNode(metin));
    if (dugme) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ghost'; btn.textContent = dugme.ad;
      btn.addEventListener('click', dugme.fn);
      b.append(' ', btn);
    }
    b.hidden = false;
  }

  async function gh(yol, ayar) {
    ayar = ayar || {};
    const r = await fetch(API + yol, {
      method: ayar.method || 'GET', body: ayar.body, cache: 'no-store',
      headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + anahtar }, ayar.headers || {}),
    });
    if (!r.ok) {
      const e = new Error('GitHub ' + r.status); e.status = r.status;
      try { e.detay = (await r.json()).message; } catch (x) { /* gövde yok */ }
      throw e;
    }
    return ayar.ham ? r.text() : (r.status === 204 ? null : r.json());
  }
  function b64Coz(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u8);
  }
  function b64Bayt(buf) {
    const u8 = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function kopyaAl() {
    try {
      const c = await caches.open(ONBELLEK);
      const r = await c.match('film-veri');
      return r ? { sha: r.headers.get('x-sha'), veri: await r.json() } : null;
    } catch (e) { return null; }
  }
  async function kopyaYaz(sha, metin) {
    try {
      const c = await caches.open(ONBELLEK);
      await c.put('film-veri', new Response(metin, { headers: { 'content-type': 'application/json', 'x-sha': sha } }));
    } catch (e) { /* yer yoksa kopyasız devam */ }
  }

  // Bugünün iskeletindeki okuma bloğuna kaç dakika var (Düzen'in eşitlediği kopyadan)
  function okumayaKalan() {
    const L = window.DuzenLib;
    const dosyalar = yerel('dosyalar', {});
    const d = dosyalar['defter/iskelet.json'];
    if (!L || !d) return null;
    let isk;
    try { isk = JSON.parse(d.metin); } catch (e) { return null; }
    const simdi = new Date();
    const plan = L.gunPlani(isk, L.sadeceGun(simdi));
    const okuma = plan.bloklar.find(b => /okuma/i.test(b.is || '') && /^\d{1,2}:\d{2}-/.test(b.saat || ''));
    if (!okuma) return null;
    return L.saatAnahtari(okuma.saat) - (simdi.getHours() * 60 + simdi.getMinutes());
  }

  let kuruldu = false;
  function kur(veri) {
    if (kuruldu) return;
    kuruldu = true;
    $('yukleniyor').hidden = true;
    $('panel').hidden = false;
    filmPaneliKur(veri, { okumayaKalan });
    $('veri-durum').textContent = 'Son veri ' + (veri.guncel || veri.export || '');
  }

  function durumYaz(d) {
    if (!d) return;
    const parca = [];
    if (d.rss_hata) parca.push('Letterboxd akışı ' + d.rss_hata.ilk + ' tarihinden beri alınamıyor.');
    if (d.tmdb_bekleyen && !d.tmdb_anahtari) parca.push(d.tmdb_bekleyen + ' yeni filmin tür, yönetmen ve süre bilgisi için TMDB anahtarı gerekiyor (duzen-veri > Settings > Secrets and variables > Actions > TMDB_API_KEY).');
    else if (d.tmdb_bekleyen) parca.push(d.tmdb_bekleyen + ' filmin TMDB bilgisi sıradaki güncellemede gelecek.');
    if (parca.length) bildir(parca.join(' '));
  }

  async function basla() {
    const kopya = await kopyaAl();
    if (kopya) kur(kopya.veri);
    if (!anahtar) {
      if (!kopya) { $('yukleniyor').textContent = 'Bu cihazda anahtar yok. Düzen\'de Ayarlar\'dan GitHub anahtarını gir.'; }
      return;
    }
    try {
      const liste = await gh(`/repos/${SAHIP}/${DEPO}/contents/film?ref=${DAL}`);
      const v = liste.find(x => x.name === 'veri.json');
      const dz = liste.find(x => x.name === 'durum.json');
      if (dz) gh(`/repos/${SAHIP}/${DEPO}/contents/film/durum.json?ref=${DAL}`).then(r => durumYaz(JSON.parse(b64Coz(r.content)))).catch(() => {});
      if (!v) { if (!kopya) $('yukleniyor').textContent = 'Depoda film verisi yok.'; return; }
      if (kopya && kopya.sha === v.sha) return;
      const metin = await gh(`/repos/${SAHIP}/${DEPO}/git/blobs/${v.sha}`, { ham: true, headers: { Accept: 'application/vnd.github.raw+json' } });
      await kopyaYaz(v.sha, metin);
      if (kopya) bildir('Yeni film verisi geldi.', { ad: 'Yenile', fn: () => location.reload() });
      else kur(JSON.parse(metin));
    } catch (e) {
      const neden = e.status === 401 ? 'Anahtar geçersiz.' : e.status === 404 ? 'Anahtar duzen-veri deposunu göremiyor.' : (navigator.onLine ? 'GitHub\'a ulaşılamadı.' : 'İnternet yok.');
      if (kopya) bildir(neden + ' Son kopya gösteriliyor.');
      else $('yukleniyor').textContent = neden + ' Film verisi alınamadı.';
    }
  }

  // ---------- veri araçları ----------
  function notYaz(metin) { const n = $('veri-not'); if (n) n.textContent = metin; }
  async function dosyaKoy(yol, b64, mesaj) {
    let sha;
    try { sha = (await gh(`/repos/${SAHIP}/${DEPO}/contents/${yol}?ref=${DAL}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    const govde = { message: mesaj, content: b64, branch: DAL };
    if (sha) govde.sha = sha;
    await gh(`/repos/${SAHIP}/${DEPO}/contents/${yol}`, { method: 'PUT', body: JSON.stringify(govde), headers: { 'Content-Type': 'application/json' } });
  }
  document.addEventListener('click', async e => {
    if (e.target.id !== 'simdiGuncelle') return;
    if (!anahtar) { notYaz('Önce Düzen\'de anahtar gir.'); return; }
    e.target.disabled = true;
    try {
      await dosyaKoy('film/istek.json', btoa(JSON.stringify({ t: new Date().toISOString() }) + '\n'), 'Film: güncelleme isteği');
      notYaz('İstek gönderildi. Bir iki dakika içinde güncellenir; sonra sayfayı yenile.');
    } catch (x) { notYaz('Gönderilemedi (' + (x.status || 'ağ') + ').'); }
    e.target.disabled = false;
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'exportDosya' || !e.target.files.length) return;
    const dosya = e.target.files[0];
    if (!anahtar) { notYaz('Önce Düzen\'de anahtar gir.'); return; }
    if (!/\.zip$/i.test(dosya.name)) { notYaz('Letterboxd\'un verdiği ZIP dosyasını seç.'); return; }
    if (dosya.size > 20 * 1024 * 1024) { notYaz('Dosya beklenenden büyük; doğru dosya mı?'); return; }
    notYaz('Yükleniyor…');
    try {
      const ad = 'letterboxd-' + new Date().toISOString().slice(0, 10) + '.zip';
      await dosyaKoy('film/export/' + ad, b64Bayt(await dosya.arrayBuffer()), 'Film: Letterboxd export yüklendi');
      notYaz('Yüklendi. Birkaç dakika içinde işlenir; izleme listesindeki yeniler ve puanlar gelir.');
    } catch (x) { notYaz('Yüklenemedi (' + (x.status || 'ağ') + (x.detay ? ': ' + x.detay : '') + ').'); }
    e.target.value = '';
  });

  basla();
})();
