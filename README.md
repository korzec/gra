# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, **Nocny Kurs**, miejska gra arcade dla 1–8 osób ze wspólną kamerą, oraz **Leśne Jednorożce**, kooperacyjna leśna wyprawa dla 1–8 osób.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `14` → `15`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby.

## Nocny Kurs

Znajdziesz go pod adresem `nocny-kurs/`. Zbierzcie 12 przesyłek w nocnym mieście. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Amunicja jest nielimitowana. Około 70% aut jeździ ulicami; to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta wybuchają po trzech trafieniach, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Samochody są o 50% szybsze. Postacie mają autorski sprite z góry bez cienia pod stopami, z głową pośrodku tułowia i czytelnym kierunkiem twarzy; ręce i nogi są stale widoczne, a podczas ruchu animują się. W postoju postać pali vape z delikatnym dymkiem. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością. Śmierć jednej osoby nie kończy rundy pozostałych.

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

## Leśne Jednorożce

Znajdziesz je pod adresem `lesne-jednorozce/`. Wspólnie przemierzajcie leśną mapę z polanami, rzeczką, stawem, kamiennym kręgiem, wielkim drzewem i grzybowymi zagajnikami. Bieg nabiera prędkości przez sekundę; tylko z pełnego rozpędu jednorożec może przeskoczyć nurt, zostawiając za sobą smugę. Żeby zebrać kwiat, zatrzymajcie się i skierujcie pyszczek blisko kwiatu; jednorożec schyli głowę i go zje. Większe kwiaty ułatwiają celowanie pyszczkiem, ale nie można ich zebrać samym tułowiem. Kwiaty odrastają po 12–18 sekundach. Zbierzcie razem 20 kwiatów.

- Klawiatura: maksymalnie 2 zestawy, WASD i strzałki; Enter lub Spacja uruchamia rundę i dołącza kolejne osoby
- Kontrolery: lewy drążek lub krzyżak; A dołącza i uruchamia grę. Indeks kontrolera odpowiada stałemu numerowi P1–P8
- Dotyk: wirtualna gałka steruje P1
