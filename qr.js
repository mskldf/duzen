/* QR ile cihaz ekleme: anahtarlı cihaz anahtarı QR olarak gösterir, diğer cihaz kamerayla okur.
   Anahtar sadece ekranda görünür; hiçbir yere gönderilmez. 60 saniye sonra QR kaybolur. */
(window.DuzenModuller = window.DuzenModuller || []).push(function (D) {
  'use strict';
  const $ = id => document.getElementById(id);
  const okunabilir = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  let qrZaman = null, akis = null, tarama = null;

  function dugmeleriAyarla() {
    $('qrGoster').hidden = !D.durum.anahtar || typeof window.qrcode !== 'function';
    $('qrOku').hidden = !okunabilir;
  }

  function qrGizle() {
    clearTimeout(qrZaman);
    $('qrAlani').hidden = true;
    $('qrKutu').innerHTML = '';
  }

  function qrGoster() {
    if (!D.durum.anahtar) return;
    const qr = window.qrcode(0, 'M');
    qr.addData(D.durum.anahtar);
    qr.make();
    $('qrKutu').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
    $('qrAlani').hidden = false;
    clearTimeout(qrZaman);
    qrZaman = setTimeout(qrGizle, 60000);
  }

  function kameraKapat() {
    clearInterval(tarama);
    tarama = null;
    if (akis) { akis.getTracks().forEach(t => t.stop()); akis = null; }
    const v = $('qrKamera');
    v.srcObject = null;
    v.hidden = true;
  }

  async function qrOku() {
    qrGizle();
    const v = $('qrKamera');
    try {
      akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e) {
      D.hataGoster('Kamera açılamadı. Tarayıcıya kamera izni verip tekrar dene.');
      return;
    }
    v.srcObject = akis;
    v.hidden = false;
    await v.play().catch(() => {});
    const dedektor = new window.BarcodeDetector({ formats: ['qr_code'] });
    tarama = setInterval(async () => {
      if (!akis) return;
      try {
        const bulunan = await dedektor.detect(v);
        const kod = bulunan.map(b => b.rawValue).find(x => /^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(x || ''));
        if (!kod) return;
        kameraKapat();
        $('ayar-anahtar').value = kod;
        $('anahtarKaydet').click();   // her zamanki doğrulamayla kaydedilir
      } catch (e) { /* bir sonraki karede tekrar */ }
    }, 300);
  }

  $('qrGoster').addEventListener('click', () => ($('qrAlani').hidden ? qrGoster() : qrGizle()));
  $('qrOku').addEventListener('click', () => (akis ? kameraKapat() : qrOku()));
  // Pencere açılınca düğmeler, kapanınca kamera ve QR temizlenir
  const ayar = $('ayarDialog');
  new MutationObserver(() => { if (ayar.open) dugmeleriAyarla(); else { qrGizle(); kameraKapat(); } })
    .observe(ayar, { attributes: true, attributeFilter: ['open'] });
  ayar.addEventListener('close', () => { qrGizle(); kameraKapat(); });
  dugmeleriAyarla();
});
