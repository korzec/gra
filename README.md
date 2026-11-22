# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, **Nocny Kurs**, miejska gra arcade dla 1–8 osób ze wspólną kamerą, oraz **Leśne Jednorożce**, kooperacyjna leśna wyprawa dla 1–8 osób.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `14` → `15`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby.

## Nocny Kurs

Znajdziesz go pod adresem `nocny-kurs/`. Zbierzcie 12 przesyłek w nocnym mieście; nie ma limitu czasu. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Każde auto ma kierowcę NPC. Gdy gracz przejmie samochód, kierowca wypada na ulicę, ściga skradziony pojazd i próbuje go odzyskać; może wyrzucić gracza z wolno jadącego lub stojącego auta. Po wysiadce gracza porzucony samochód nie rusza sam bez kierowcy. Kierowcy i ich pościg synchronizują się w multiplayer. Samochód z kierowcą NPC po trafieniu pociskiem gracza natychmiast przyspiesza do swojej maksymalnej prędkości i ucieka ulicami w kierunku oddalającym go od strzelającego. Dotyczy to aut zaparkowanych i jadących; przejęte przez gracza pojazdy nie uciekają. Na skrzyżowaniach działają sygnalizatory z zielonym, żółtym i czerwonym światłem oraz liniami zatrzymania. Samochody prowadzone przez NPC, również uciekające po ostrzale, hamują przed czerwonym i żółtym oraz ruszają, gdy zaświeci zielone; cykle świateł są synchronizowane w multiplayer. Samochody prowadzone przez graczy pozostają pod ich kontrolą. Amunicja jest nielimitowana. Około 70% aut jeździ ulicami; to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta mają 10 HP i wybuchają dopiero po ich wyczerpaniu, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Potrącenia pieszych przy prędkości większej niż 50% prędkości maksymalnej danego pojazdu zabierają 100% ich zdrowia; kierowca przy zderzeniu traci maksymalnie 50% swojego pełnego zdrowia na jedno uderzenie, nawet przy największej prędkości. Sam samochód traci przy kolizji maksymalnie 3 z 10 HP, a ciągły kontakt z przeszkodą ma krótki odstęp między naliczaniem uszkodzeń. Śmierć kierowcy nie powoduje wybuchu sprawnego samochodu. Samochody są o 50% szybsze. Postacie mają autorski sprite z góry bez cienia pod stopami, z głową pośrodku tułowia i czytelnym kierunkiem twarzy; ręce i nogi są stale widoczne, a podczas ruchu animują się. W postoju postać pali vape z delikatnym dymkiem. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością. Śmierć jednej osoby nie kończy gry pozostałych.

- Klawiatura: maksymalnie 2 osoby; gracz 1: WASD, gracz 2: strzałki
- Strzelanie: trzymaj Q (gracz 1) lub . (gracz 2); puszczenie zatrzymuje serię, a wystrzelone pociski dalej lecą
- Wsiadanie i wysiadanie: E (gracz 1), Shift (gracz 2)
- Kontrolery: drążek lub krzyżak; A dołącza i zaczyna, a podczas gry strzela tak długo, jak jest wciśnięte; prawy spust RT działa jako alternatywa analogowa; B wykonuje akcję wsiadania lub wysiadania. Puszczenie A/RT zatrzymuje serię, a wystrzelone pociski dalej lecą
- Enter: start i dołączanie kolejnych graczy klawiaturowych

Pociski graczy i strażników są rysowane o 50% mniejsze (grubość, długość śladu i poświata); zasięg trafień nie zmienia się. Strażnik może strzelać tylko do gracza, którego **osobiście widział podczas strzału w ostatnich 5 sekundach**, pod warunkiem że nadal widzi go w zasięgu ognia. Usłyszany zza budynku strzał nadal przyciąga uwagę, ale nie uprawnia do otwarcia ognia; sama obecność gracza w polu widzenia też nie wystarcza.

### Multiplayer online w Nocnym Kursie

Wybierz **Gra online**, aby założyć prywatny pokój na **serwerze dedykowanym**.
Serwer w repozytorium `korzec/sockets` pod adresem `wss://gra.w.korzec-it.pl/ws`
wykonuje całą symulację Nocnego Kursu w 60 Hz, a przeglądarki wysyłają
sterowanie i odbierają autorytatywny stan gry. Nie istnieje tryb multiplayer,
w którym przeglądarka jednego gracza pełni rolę hosta.

Pokój otrzymuje losowy kod z **6 wielkich liter** (np. `ABCDEF`).
W trakcie gry widoczne są dwa przyciski: **Kopiuj link** i **Rozłącz**.
Link albo kod w polu **Dołącz do pokoju** pozwala dołączyć do tego samego
pokoju. W jednym pokoju gra maksymalnie 8 graczy. Wszyscy mogą opuścić
pokój niezależnie od założyciela; serwer usuwa pokój po wyjściu ostatniej
osoby. Serwer obsługuje maksymalnie 8 dedykowanych pokoi jednocześnie.
Snapshoty są wysyłane z częstotliwością docelową 60 Hz, a osobne ślady
10 Hz; limit wejściowy relay wynosi 100 wiadomości/s na klienta.

Kod pokoju jest jedyną informacją potrzebną do dołączenia, więc udostępniaj go
tylko zaproszonym osobom. Sześć liter to około 28 bitów możliwości
(26^6 = 308 915 776), dlatego nie zapewnia ochrony przed celowym zgadywaniem.
Kod jest rozwijany w przeglądarce do zgodnego z protokołem serwera ciągu
z prefiksem `nocny-kurs-room-v1-`; nie zwiększa to entropii kodu.
Nowe linki zawierają `#room=ABCDEF` (fragment URL, nie żądanie HTTP).
Wcześniejsze linki z długim kluczem pozostają obsługiwane.
Jeśli w konfiguracji sockets ustawiono ALLOWED_ORIGINS, trzeba dopuścić
origin strony z grą (dla GitHub Pages: https://korzec.github.io).

Przed wyborem **Gra lokalna**, **Gra online** lub **Dołącz** można wpisać
opcjonalną nazwę gracza. Jeśli pole jest puste, niewielka etykieta przy postaci
(i przy prowadzonym przez nią aucie) pokazuje numer **P1**, **P2** itd.
Nazwę można zmienić w trakcie gry bezpośrednio w wierszu swojej postaci na liście graczy; nie ma osobnego pola nad listą. Nazwa zapisuje się automatycznie w localStorage tej przeglądarki i jest przywracana przy kolejnej wizycie. Wyczyszczenie nazwy przywraca etykietę P1/P2. Język przełącza się kompaktowym selektorem pokazującym bieżącą flagę i strzałkę rozwijania. Na ekranie startowym znajduje się obok trzeciej opcji (dołączania do pokoju). W grze na telefonie flaga jest razem z przyciskami **Kopiuj link** i **Rozłącz** przy samej górnej krawędzi ekranu, na miejscu napisu KANAPÓWKI, lecz bez zasłaniania logo ✳. Na większym ekranie selektor pozostaje w panelu graczy. Język można zmieniać w trakcie gry. Dostępne są polski i szwedzki.
W multiplayer nazwa gracza jest przesyłana wraz z danymi sterowania, a
serwer synchronizuje nazwy z pozostałymi klientami. Pole dotyczy
postaci sterowanej na danym urządzeniu (w grze lokalnej — pierwszego gracza);
pozostali gracze lokalni zachowują oznaczenia numeryczne.

W multiplayer: WASD lub strzałki — ruch, Q lub kropka — strzał, E lub Shift —
wejście/wyjście z auta; działa też pierwszy podłączony kontroler oraz
sterowanie dotykowe. Każda przeglądarka steruje jedną postacią.
Klient przewiduje lokalnie ruch w 60 Hz i koryguje pozycje na podstawie
pakietów z serwera. Kolizje, obrażenia, przedmioty i koniec gry rozstrzyga
wyłącznie dedykowany serwer. Nazwy graczy, ślady opon i pozostałości po
postaciach są synchronizowane z serwera.

Połączenie jest monitorowane poprzez `probe` co 4 sekundy, z limitem
14 sekund na odpowiedź. Brak snapshotów przez 9 sekund uruchamia ponowne
połączenie. Wznowienie zachowuje kod pokoju, o ile pokój nadal istnieje
na serwerze. Po odejściu wszystkich graczy stan pokoju jest zwalniany.

### Test dwóch przeglądarek (Playwright)

Test E2E uruchamia dwie niezależne sesje Chromium połączone z lokalną
imitacją protokołu serwera dedykowanego. Sprawdza tworzenie i dołączanie
do pokoju, statusy, synchronizację danych oraz rekonfigurację po utracie
połączenia bez hostowania symulacji przez przeglądarkę.

Uruchamianie lokalne: `npm install`, `npx playwright install chromium`,
`npm run test:e2e`.

W GitHub Actions test działa w Chromium headless. Pipeline zapisuje
do cache zarówno pobrane pakiety npm, jak i binaria przeglądarki Chromium
Playwright, a w razie porażki publikuje ślad i zrzut ekranu jako artefakty.

## Świetliki

Znajdziesz je pod adresem `swietliki/`. Zbieraj świetliki, unikaj cieni i poprawiaj wynik bez limitu czasu. Gra nie kończy się automatycznie; najlepszy indywidualny wynik zapisuje się na urządzeniu.

- Gracz 1: WASD
- Gracz 2: strzałki
- Gracz 3: IJKL
- Gracz 4: TFGH
- Kontrolery: lewy drążek lub krzyżak; naciśnij A, aby dołączyć
- Enter: start i dołączanie kolejnych graczy klawiaturowych

Wynik najlepszego gracza zapisuje się lokalnie w przeglądarce. GitHub Actions publikuje stronę w GitHub Pages po wypchnięciu zmian do `main`.

## Leśne Jednorożce

Znajdziesz je pod adresem `lesne-jednorozce/`. Wspólnie przemierzajcie mapę z polanami, centralną rzeczką, stawem, kamiennym kręgiem i grzybowymi zagajnikami. Każda z sześciu polanek ma cztery stałe miejsca dla kwiatów: na początku pojawia się jeden w losowym miejscu, a po każdym zbiorze kwiat odrasta w losowym wolnym miejscu; kolejne zbiory zwiększają liczbę kwiatów do maksymalnie czterech na polanę. Bieg rozpędza się przez sekundę, a zmiana kierunku ma bezwładność: przy wolnym biegu jednorożec skręca powoli, zaś z rozpędem reaguje szybciej. Gdy stoi, najpierw obraca się w miejscu do wskazanego kierunku, a potem rusza. Tylko z pełnego rozpędu może przeskoczyć nurt, zostawiając za sobą smugę. Żeby zebrać kwiat, zatrzymajcie się i skierujcie pyszczek ku niemu; większy obszar przy głowie ułatwia jedzenie, ale nie pozwala zbierać kwiatów tułowiem ani tyłem. Kwiaty odrastają po około 36 sekundach podzielonych przez liczbę aktywnych graczy (±10%, minimum 3 s). Zbierzcie razem 20 kwiatów.

- Klawiatura: maksymalnie 2 zestawy, WASD i strzałki; Enter lub Spacja uruchamia grę i dołącza kolejne osoby
- Kontrolery: lewy drążek lub krzyżak; A dołącza i uruchamia grę. Indeks kontrolera odpowiada stałemu numerowi P1–P8
- Dotyk: wirtualna gałka steruje P1

### Postacie po śmierci (v87)

Na urządzeniach mobilnych lista graczy pozostaje czytelna, ale nie pokazuje
legendy klawiszy i przycisków pada. Spodnie postaci są szare lub brązowe,
również podczas postoju. Leżące postacie i ich kredowe obrysy korzystają
z tej samej sylwetki inspirowanej zielonym pieszym na polskim sygnalizatorze S-5
(zgięte ramiona i nogi w kroku).

Każdy zabity gracz, strażnik i kierowca NPC zostawia ciało, a następnie jego
kredowy obrys. Dotyczy to także kierowców w wybuchających samochodach.
Ciało pozostaje przez 10 sekund; **wszystkie pozostałości NPC znikają
po 60 sekundach od śmierci**, a ślady graczy zachowują dotychczasowy czas.
W multiplayer ślady są synchronizowane przez sześciopolowe rekordy
z flagą NPC; starsze pięciopolowe rekordy graczy pozostają obsługiwane.
Gra na serwerze dedykowanym wymaga wdrożenia aktualnej kopii kodu
`vendor/nocny-kurs/game.js` w repozytorium `sockets`.
