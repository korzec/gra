# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, oraz **Nocny Kurs**, miejska gra arcade dla 1–8 osób ze wspólną kamerą.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `6` → `7`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby.

## Nocny Kurs

Znajdziesz go pod adresem `nocny-kurs/`. Zbierzcie 12 przesyłek w nocnym mieście. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Amunicja jest nielimitowana. Około 70% aut jeździ ulicami; to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta wybuchają po trzech trafieniach, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Samochody są o 50% szybsze. Postacie widać z góry; podczas ruchu animują ręce i nogi, a gdy stoją, palą vape. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością. Śmierć jednej osoby nie kończy rundy pozostałych.

- Klawiatura: maksymalnie 2 osoby; gracz 1: WASD, gracz 2: strzałki
- Strzelanie: trzymaj Q (gracz 1) lub . (gracz 2); puszczenie zatrzymuje serię, a wystrzelone pociski dalej lecą
- Wsiadanie i wysiadanie: E (gracz 1), Shift (gracz 2)
- Kontrolery: drążek lub krzyżak; A dołącza i zaczyna, a podczas gry strzela tak długo, jak jest wciśnięte; prawy spust RT działa jako alternatywa analogowa; B wykonuje akcję wsiadania lub wysiadania. Puszczenie A/RT zatrzymuje serię, a wystrzelone pociski dalej lecą
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
