/* Düzen: veri ve tarih yardımcıları. Tarayıcıda window.DuzenLib, Node'da module.exports. */
(function (kok, fabrika) {
  const lib = fabrika();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else kok.DuzenLib = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GUN_KODLARI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const BIRIM = { 'küçük': 1, 'orta': 2, 'büyük': 4 };
  const DURUM_ADI = { bitti: 'Bitti', devam: 'Devam', planlandi: 'Planlandı', baslanmadi: 'Başlanmadı', rafta: 'Rafta', dustu: 'Düştü' };

  const pad = n => String(n).padStart(2, '0');
  const isoTarih = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const sadeceGun = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function tarihAyristir(s) {
    const [y, m, g] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, g || 1);
  }
  function gunEkle(d, n) { const x = sadeceGun(d); x.setDate(x.getDate() + n); return x; }
  function gunFarki(a, b) {
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  }
  const tarihYazi = d => d.getDate() + ' ' + AY_ADLARI[d.getMonth()] + ' ' + GUN_ADLARI[d.getDay()];
  const kisaTarih = d => d.getDate() + ' ' + AY_ADLARI[d.getMonth()];
  const saatYazi = d => pad(d.getHours()) + ':' + pad(d.getMinutes());

  // Saat 20:00 ve sonrası Yarın sayfası
  function gunModu(simdi) {
    const yarin = simdi.getHours() >= 20;
    return { yarin, hedef: yarin ? gunEkle(simdi, 1) : sadeceGun(simdi) };
  }

  function degerCoz(v) {
    if (v === '') return '';
    try { return JSON.parse(v); } catch (e) { /* düz YAML değeri */ }
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    return v.replace(/^['"]|['"]$/g, '');
  }

  // "---" arasındaki "anahtar: değer" satırları
  function onYaziAyristir(metin) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(metin || '');
    if (!m) return { meta: {}, govde: metin || '' };
    const meta = {};
    for (const satir of m[1].split(/\r?\n/)) {
      if (/^\s/.test(satir)) continue;
      const i = satir.indexOf(':');
      if (i < 1) continue;
      meta[satir.slice(0, i).trim()] = degerCoz(satir.slice(i + 1).trim());
    }
    return { meta, govde: metin.slice(m[0].length) };
  }

  function bolumler(govde) {
    const sonuc = {};
    let baslik = null, tampon = [];
    for (const satir of (govde || '').split(/\r?\n/)) {
      const m = /^##\s+(.+?)\s*$/.exec(satir);
      if (m) {
        if (baslik !== null) sonuc[baslik] = tampon.join('\n').trim();
        baslik = m[1]; tampon = [];
      } else if (baslik !== null) tampon.push(satir);
    }
    if (baslik !== null) sonuc[baslik] = tampon.join('\n').trim();
    return sonuc;
  }

  function bolumBul(b, onEk) {
    const k = Object.keys(b).find(x => x.startsWith(onEk));
    return k ? b[k] : '';
  }

  function ilkParagraf(govde) {
    const s = (govde || '').split(/\r?\n/);
    let i = s.findIndex(x => /^#\s/.test(x));
    i = i < 0 ? 0 : i + 1;
    while (i < s.length && !s[i].trim()) i++;
    const out = [];
    while (i < s.length && s[i].trim() && !/^#/.test(s[i])) out.push(s[i++].trim());
    return out.join(' ');
  }

  // Gövdeden "# Başlık" satırını çıkarır (başlık antette gösteriliyor)
  function basliksizGovde(govde) {
    return (govde || '').replace(/^\s*#\s[^\n]*\n?/, '');
  }

  function projeOku(yol, metin) {
    const { meta, govde } = onYaziAyristir(metin);
    const b = bolumler(govde);
    return {
      slug: yol.split('/').pop().replace(/\.md$/, ''),
      yol, meta, govde,
      ozet: ilkParagraf(govde),
      sirada: bolumBul(b, 'Sıradaki adım').replace(/\s+/g, ' ').trim(),
    };
  }

  // "06:00-07:00" → 360; saat yazmayan bloklar kaba yerine oturur
  function saatAnahtari(s) {
    const m = /^(\d{1,2}):(\d{2})/.exec(s || '');
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const t = String(s || '').toLocaleLowerCase('tr');
    if (t.includes('öğleden sonra')) return 13 * 60;
    if (t.includes('gün içi')) return 10 * 60;
    if (t.includes('sabah')) return 8 * 60;
    if (t.includes('akşam')) return 19 * 60;
    return 24 * 60;
  }

  // Haftalık iskeletten bir günün planı
  function gunPlani(iskelet, tarih) {
    if (!iskelet) return { bloklar: [], uyku: null, serbest: null, kod: GUN_KODLARI[tarih.getDay()] };
    const kod = GUN_KODLARI[tarih.getDay()];
    const iso = isoTarih(tarih);
    const bloklar = (iskelet.bloklar || []).filter(b => (b.gunler || []).includes(kod))
      .slice().sort((a, b) => saatAnahtari(a.saat) - saatAnahtari(b.saat));
    let uyku = null;
    for (const u of (iskelet.uyku || [])) if (u.baslangic <= iso && (!uyku || u.baslangic >= uyku.baslangic)) uyku = u;
    // "ışıktan önceki 30 dk" gibi bloklar o günün ışık saatine göre gerçek saate çevrilir
    const dkYazi = n => pad(Math.floor(((n % 1440) + 1440) % 1440 / 60)) + ':' + pad(((n % 60) + 60) % 60);
    const cozulmus = bloklar.map(b => {
      const m = /ışıktan önceki\s+(\d+)\s*dk/i.exec(b.saat || '');
      if (!m || !uyku) return b;
      const bit = saatAnahtari(uyku.isik);
      return Object.assign({}, b, { saat: dkYazi(bit - Number(m[1])) + '-' + uyku.isik });
    }).sort((a, b) => saatAnahtari(a.saat) - saatAnahtari(b.saat));
    return { bloklar: cozulmus, uyku, serbest: iskelet.serbest_aksam || null, kod };
  }

  function jsonlOku(metin) {
    const out = [];
    for (const s of (metin || '').split(/\r?\n/)) {
      const t = s.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch (e) { /* bozuk satır atlanır */ }
    }
    return out;
  }

  // Bir günün eksik girdileri: o günün uykusu (dün geceki ışık, bu sabahki kalkış), hafta içi sabah bloğu
  // ve dün geceki okuma (okuma ışıktan önceki yarım saatte, günü kapattıktan sonra). Hariç günlerde (gezi, askerlik) hiçbiri.
  function eksikGirdiler(kayitlar, tarih, haric) {
    const iso = isoTarih(tarih);
    const dun = isoTarih(gunEkle(tarih, -1));
    const var_ = (tur, t) => kayitlar.some(k => k.t === t && k.tur === tur);
    const eksik = [];
    if (haricMi(iso, haric)) return eksik;
    if (!var_('uyku', iso)) eksik.push({ tur: 'uyku', t: iso });
    const g = tarih.getDay();
    if (g >= 1 && g <= 5 && !var_('sabah_blogu', iso)) eksik.push({ tur: 'sabah_blogu', t: iso });
    if (!haricMi(dun, haric) && !var_('okuma', dun)) eksik.push({ tur: 'okuma', t: dun });
    return eksik;
  }

  function haricMi(iso, haric) {
    return (haric || []).some(([a, b]) => iso >= a && iso <= b);
  }

  // Haftanın pazartesisi
  function haftaBasi(d) {
    const x = sadeceGun(d);
    return gunEkle(x, -((x.getDay() + 6) % 7));
  }

  // Gece yarısından sonra 04:00'e kadar hâlâ önceki gün sayılır (günü kapatırken)
  function kapanisGunu(simdi) {
    return simdi.getHours() < 4 ? gunEkle(simdi, -1) : sadeceGun(simdi);
  }

  // O günün okuma bloğu (iskelette "Okuma" geçen ve saati çözülmüş blok)
  function okumaBloku(plan) {
    return (plan.bloklar || []).find(b => /okuma/i.test(b.is || '') && /^\d{1,2}:\d{2}-/.test(b.saat || '')) || null;
  }

  // Haftanın albümü: sıradaki albüm bir önceki dinlendikten sonraki pazartesi başlar; dinlenmeyen albüm sonraki haftaya geçer
  function albumPlani(veri, bugun) {
    const albumler = (veri && veri.albumler) || [];
    const bas = haftaBasi(tarihAyristir((veri && veri.baslangic) || isoTarih(bugun)));
    const buHafta = haftaBasi(bugun);
    let hafta = bas, aktif = null;
    const plan = [];
    for (const a of albumler) {
      // Kuyruğa sonradan eklenen albüm eklendiği haftadan önce başlamış sayılmaz
      if (a.eklendi) { const e = haftaBasi(tarihAyristir(a.eklendi)); if (e > hafta) hafta = e; }
      const satir = { album: a, hafta: isoTarih(hafta) };
      if (a.dinlendi) {
        plan.push(satir);
        const sonraki = gunEkle(haftaBasi(tarihAyristir(a.dinlendi)), 7);
        hafta = sonraki > gunEkle(hafta, 7) ? sonraki : gunEkle(hafta, 7);
        continue;
      }
      if (!aktif) {
        if (hafta > buHafta) { satir.gelecek = true; plan.push(satir); hafta = gunEkle(hafta, 7); aktif = satir; continue; }
        satir.kacinci = Math.floor(gunFarki(hafta, buHafta) / 7) + 1;
        aktif = satir;
        plan.push(satir);
        hafta = gunEkle(buHafta, 7);
        continue;
      }
      satir.gelecek = true;
      plan.push(satir);
      hafta = gunEkle(hafta, 7);
    }
    return { plan, aktif: aktif && !aktif.gelecek ? aktif : null };
  }

  // [bas, bit] dahil, hariç aralıklar düşülmüş gün sayısı
  function etkinGun(bas, bit, haric) {
    let n = 0;
    for (let d = sadeceGun(bas); d <= bit; d = gunEkle(d, 1)) if (!haricMi(isoTarih(d), haric)) n++;
    return n;
  }

  // 2027 hızı: biten ve bugüne kadar beklenen birim
  function hiz(projeler, havuzMeta, bugun) {
    const birim = (havuzMeta && havuzMeta.birim) || BIRIM;
    const basIso = havuzMeta && havuzMeta.baslangic;
    let toplam = 0, biten = 0;
    for (const p of projeler) {
      const m = p.meta || {};
      if (m.durum === 'dustu') continue;
      if (m.durum === 'bitti' && basIso && m.bitis && m.bitis < basIso) continue;
      const u = birim[m.buyukluk] || 0;
      toplam += u;
      if (m.durum === 'bitti') biten += u;
    }
    if (!havuzMeta || !havuzMeta.baslangic || !havuzMeta.bitis_hedef) return { toplam, biten, beklenen: null, haftalik: null };
    const bas = tarihAyristir(havuzMeta.baslangic);
    const son = tarihAyristir(havuzMeta.bitis_hedef);
    const toplamGun = etkinGun(bas, son, havuzMeta.haric);
    const gecen = bugun < bas ? 0 : etkinGun(bas, bugun < son ? sadeceGun(bugun) : son, havuzMeta.haric);
    return {
      toplam, biten,
      beklenen: toplamGun ? toplam * gecen / toplamGun : 0,
      haftalik: toplamGun ? toplam / (toplamGun / 7) : 0,
      kalanHafta: Math.max(0, (toplamGun - gecen) / 7),
    };
  }

  // Işık saati hedeften toleranstan fazla geç mi? Akşam hedefinde gece yarısından sonrası ertesi gün sayılır.
  function isikGecMi(v, hedef, tolerans) {
    if (!v || !hedef) return false;
    let a = saatAnahtari(v);
    const b = saatAnahtari(hedef);
    if (b >= 18 * 60 && a < 12 * 60) a += 24 * 60;
    return a - b > (tolerans == null ? 15 : tolerans);
  }

  // Haftalık ölçüler ve kendi baseline'ın: son n hafta; baseline, bu haftadan önceki en fazla 4 geçerli haftanın ortalaması.
  // Geçerli hafta: takip başladıktan sonra ve en az 4 günü hariç (gezi, askerlik) olmayan hafta.
  const OLCULER = [
    { ad: 'uyku', baslik: 'Işık hedefine uyulan gece', birim: 'gece', tur: 'uyku', iyi: 1 },
    { ad: 'sabah', baslik: 'Sabah bloğu', birim: 'gün', tur: 'sabah_blogu', iyi: 1 },
    { ad: 'okuma', baslik: 'Okunan gece', birim: 'gece', tur: 'okuma', iyi: 1 },
    { ad: 'film', baslik: 'Film', birim: 'film', tur: 'film', iyi: 0 },
    { ad: 'bisiklet', baslik: 'Bisiklet', birim: 'km', tur: 'bisiklet', iyi: 1 },
    { ad: 'atolye', baslik: 'Atölye', birim: 'dk', tur: 'atolye', iyi: 1 },
    { ad: 'muzik', baslik: 'Haftanın albümü', birim: 'albüm', tur: 'muzik', iyi: 1 },
  ];
  function haftalikOlculer(kayitlar, bugun, ayar) {
    ayar = ayar || {};
    const n = ayar.n || 8, haric = ayar.haric || [];
    const hedefIsik = ayar.hedefIsik || (() => null);
    const buHafta = haftaBasi(bugun);
    const ilk = kayitlar.map(k => k.t).filter(Boolean).sort()[0];
    const basHafta = ayar.baslangic ? haftaBasi(tarihAyristir(ayar.baslangic)) : (ilk ? haftaBasi(tarihAyristir(ilk)) : buHafta);
    const haftalar = [];
    for (let i = n - 1; i >= 0; i--) {
      const h = gunEkle(buHafta, -7 * i);
      let haricGun = 0;
      for (let g = 0; g < 7; g++) if (haricMi(isoTarih(gunEkle(h, g)), haric)) haricGun++;
      haftalar.push({ bas: isoTarih(h), son: isoTarih(gunEkle(h, 6)), gecerli: h >= basHafta && haricGun < 4, haricGun, buHafta: i === 0 });
    }
    const deger = (o, bas, son) => {
      const ks = kayitlar.filter(k => k.tur === o.tur && k.t >= bas && k.t <= son);
      if (o.ad === 'uyku') return ks.filter(k => k.isik && !isikGecMi(k.isik, hedefIsik(k.t))).length;
      if (o.ad === 'sabah' || o.ad === 'okuma') return ks.filter(k => k.yapildi !== false).length;
      if (o.ad === 'bisiklet') return Math.round(ks.reduce((a, k) => a + (Number(k.km) || 0), 0) * 10) / 10;
      if (o.ad === 'atolye') return ks.reduce((a, k) => a + (Number(k.dk) || 0), 0);
      return ks.length;
    };
    // Hafta bitmeden karşılaştırma: baseline haftanın geçen kısmına oranlanır (bugün, girdisi varsa sayılır)
    const bugunIso = isoTarih(bugun);
    const gecen = gunFarki(buHafta, sadeceGun(bugun));   // bugünden önceki günler
    return OLCULER.map(o => {
      const veriVar = kayitlar.some(k => k.tur === o.tur);
      const degerler = haftalar.map(h => (h.gecerli ? deger(o, h.bas, h.son) : null));
      const onceki = degerler.slice(0, -1).filter(v => v !== null).slice(-4);
      const baz = onceki.length ? onceki.reduce((a, b) => a + b, 0) / onceki.length : null;
      const bu = degerler[degerler.length - 1];
      const bugunVar = kayitlar.some(k => k.tur === o.tur && k.t === bugunIso);
      const gun = gecen + (bugunVar ? 1 : 0);
      const oran = o.ad === 'sabah' ? Math.min(gun, 5) / 5 : gun / 7;
      const beklenen = baz === null ? null : baz * oran;
      return Object.assign({}, o, { veriVar, haftalar, degerler, baz, bazHafta: onceki.length, bu, beklenen,
        fark: beklenen !== null && bu !== null ? bu - beklenen : null });
    });
  }

  function kalanGun(iso, bugun) { return iso ? gunFarki(sadeceGun(bugun), tarihAyristir(iso)) : null; }
  function kalanYazi(n) {
    if (n === null || n === undefined) return '';
    if (n === 0) return 'bugün';
    if (n === 1) return 'yarın';
    if (n > 1) return n + ' gün kaldı';
    if (n === -1) return 'dün geçti';
    return (-n) + ' gün geçti';
  }

  // Açık görevler: en yakın tarihi olan önce, tarihsizler sonda
  function gorevSirala(gorevler) {
    const ilk = g => [g.son_tarih, g.deadline].filter(Boolean).sort()[0] || '9999-99-99';
    return gorevler.slice().sort((a, b) => ilk(a).localeCompare(ilk(b)) || String(a.baslik).localeCompare(String(b.baslik), 'tr'));
  }

  const HAVA = {
    0: 'Açık', 1: 'Çoğunlukla açık', 2: 'Parçalı bulutlu', 3: 'Kapalı', 45: 'Sisli', 48: 'Kırağılı sis',
    51: 'Hafif çisenti', 53: 'Çisenti', 55: 'Yoğun çisenti', 56: 'Donan çisenti', 57: 'Donan çisenti',
    61: 'Hafif yağmur', 63: 'Yağmurlu', 65: 'Kuvvetli yağmur', 66: 'Donan yağmur', 67: 'Donan yağmur',
    71: 'Hafif kar', 73: 'Karlı', 75: 'Yoğun kar', 77: 'Kar taneleri', 80: 'Hafif sağanak', 81: 'Sağanak',
    82: 'Şiddetli sağanak', 85: 'Kar sağanağı', 86: 'Yoğun kar sağanağı', 95: 'Gök gürültülü fırtına',
    96: 'Dolulu fırtına', 99: 'Dolulu fırtına',
  };

  return {
    GUN_KODLARI, GUN_ADLARI, AY_ADLARI, BIRIM, DURUM_ADI, HAVA,
    pad, isoTarih, sadeceGun, tarihAyristir, gunEkle, gunFarki, tarihYazi, kisaTarih, saatYazi, gunModu,
    onYaziAyristir, bolumler, bolumBul, ilkParagraf, basliksizGovde, projeOku, saatAnahtari, gunPlani,
    jsonlOku, eksikGirdiler, haricMi, haftaBasi, kapanisGunu, okumaBloku, albumPlani, etkinGun, hiz, kalanGun, kalanYazi, gorevSirala,
    isikGecMi, OLCULER, haftalikOlculer,
  };
});
