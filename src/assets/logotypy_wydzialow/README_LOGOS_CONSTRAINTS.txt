=============================================================
 WYTYCZNE DLA NOWYCH LOGOTYPÓW WYDZIAŁOWYCH (TABLETY)
=============================================================

Ten plik zawiera informacje, jak optymalnie przygotować 
i dodawać nowe loga wydziałów do stopki w interfejsie tabletu.

1. LOKALIZACJA PLIKÓW I KODU
-------------------------------------------------------------
- Grafiki należy umieszczać w: `src/assets/logotypy_wydzialow/<nazwa_wydzialu>/`
- Następnie trzeba je zaimportować w pliku: `src/app/layout/Tablet.tsx` 
  i dodać do funkcji mapującej `getFacultyLogo(room)`.

2. WYMIARY I PROPORCJE (CONSTRAINTS)
-------------------------------------------------------------
- WYSOKOŚĆ GRAFIKI: Interfejs nakłada na sztywno wysokość `height: 28px`. 
  Aby zachować ostrość na ekranach wysokiej rozdzielczości (Retina), 
  oryginalny plik powinien mieć wysokość co najmniej 112px (czyli 4x więcej).
- SZEROKOŚĆ: Skaluje się automatycznie (`width: auto; object-fit: contain;`). 
  Zalecane maksymalne proporcje to 5:1 (np. 500px szerokości przy 100px wysokości). 
  Zbyt szerokie logo (np. długi tekst obok sygnetu) może na wąskich ekranach
  ścisnąć środkowy element lub popsuć wyśrodkowanie Flexboxa.
- MARGINESY (PADDING) WEWNĄTRZ GRAFIKI: Loga powinny być przycięte równo 
  z krawędziami obrazu (bez przezroczystej pustej przestrzeni dookoła). 
  Odstępy między logami są generowane przez CSS (`gap: 1.5rem`). Jeśli grafika 
  ma pusty margines wewnętrzny, odstęp wizualnie wyda się niesymetryczny.

3. FORMAT I KOLORYSTYKA
-------------------------------------------------------------
- FORMAT: Wyłącznie pliki .png z przezroczystym tłem (Alpha Channel).
- KOLORYSTYKA: Należy zwrócić uwagę, że tło stopki na tabletach jest ciemne 
  (domyślny tryb Dark Mode: #0f172a / #0b0f19) lub jasne (Light Mode). 
  Preferowane są sygnety z czytelnym kontrastem w obu trybach lub 
  stosowanie jasnych obrysów (tzw. "outline bez tła").
  
  Uwaga: Główne logo ZUT ma nałożony filtr z CSS: 
  `filter: brightness(0) invert(1);` (czyli zawsze jest białe).
  Znak wydziału NIE ma tego filtru, zachowuje swoje oryginalne kolory.

=============================================================
 Podsumowując: Najlepszy plik to ładnie docięty .png bez 
 tła o wysokości ~120-200px i proporcjach nie szerszych niż 5:1.
=============================================================
