# Düzen

Emir'in kişisel sistemi: proje defteri, koç, iş takibi ve 20:00'den sonra Yarın sayfası.

Bu depo sadece uygulamanın kodu. Veriler özel depoda durur ve her cihazda o cihaza girilen GitHub anahtarıyla okunur; anahtar cihazdan çıkmaz.

## Kurulum
1. Cihazda https://mskldf.github.io/duzen/ adresini aç.
2. Tarayıcı menüsünden **Ana ekrana ekle** de; uygulama tam ekran açılır, internet yokken son kopyayla çalışır.
3. Ayarlar'dan GitHub anahtarını gir. Anahtar: fine-grained token, sadece `mskldf/duzen-veri`, Contents izni okuma ve yazma.

## Dosyalar
- `index.html`, `app.css`, `app.js`: uygulama
- `lib.js`: tarih, plan ve hız hesapları
- `sw.js`: çevrimdışı açılış için önbellek
- `film.html`, `film.css`, `film.js`: Film defteri (Letterboxd paneli); veriyi `duzen-veri/film/veri.json`'dan okur
- `vendor/marked.min.js` (MIT) ve `fonts/` (Barlow Condensed, IBM Plex Sans, IBM Plex Mono, Big Shoulders Display; OFL)

## Kısayollar
Uygulama simgesine basılı tutunca: Günü kapat, Odak modu, Okuma ekle, Görev ekle. Aynı istekler adresle de açılır: `?kapat`, `?odak`, `?ekle=okuma`, `?gorev`.
