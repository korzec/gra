# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, oraz **Nocny Kurs**, miejska gra arcade dla 1–8 osób ze wspólną kamerą.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Nocny Kurs

Znajdziesz go pod adresem `nocny-kurs/`. Zbierzcie 12 przesyłek w nocnym mieście. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać — także zza kierownicy.

- Gracz 1: WASD
- Gracz 2: strzałki
- Gracz 3: IJKL
- Gracz 4: TFGH
- Strzelanie: Q / . / U / R; wsiadanie i wysiadanie: E / Shift / O / V
- Kontrolery: drążek lub krzyżak; A dołącza i zaczyna, B wsiada, RT strzela
- Enter: start i dołączanie kolejnych graczy klawiaturowych

## Świetliki

Znajdziesz je pod adresem `swietliki/`. Zbieraj świetliki, unikaj cieni i wygraj 60-sekundową rundę.

- Gracz 1: WASD
- Gracz 2: strzałki
- Gracz 3: IJKL
- Gracz 4: TFGH
- Kontrolery: lewy drążek lub krzyżak; naciśnij A, aby dołączyć
- Enter: start i dołączanie kolejnych graczy klawiaturowych

Wynik najlepszego gracza zapisuje się lokalnie w przeglądarce. GitHub Actions publikuje stronę w GitHub Pages po wypchnięciu zmian do `main`.
