# Kanapówki ✳

Katalog czterech gier dla 1–8 osób: **Świetliki** i **Leśne Jednorożce** — lokalnie; **Micro M** i **Grand T** — lokalnie oraz online (do 8 osób w pokoju). Cała kompaktowa karta prowadzi do menu gry, a oznaczenia trybów informują o ich dostępności.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `14` → `15`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby. W katalogu i każdej grze wspólny komponent update-check.js + update-check.css pokazuje wersję w górnym pasku. Co 30 sekund sprawdza version.json; nowsza wersja i przycisk odświeżania pojawiają się obok bieżącej bez przerywania gry. Odświeżenie zachowuje adres pokoju i parametry URL.

## Micro M

Gra jest dostępna w katalogu pod adresem `micro-m/` (stary adres `mikro-sprint/` przekierowuje wraz z parametrami i fragmentem linku do pokoju). To autorska przeglądarkowa gra wyścigowa inspirowana klasycznymi wyścigami miniaturowych samochodów, z dwiema trasami: **stół bilardowy** (sukno, bile, łuzy) i **wanna** (śliska nawierzchnia, piana, kaczka, mydło). Nie wykorzystuje zasobów ani kodu Micro Machines. Obie trasy mają podwojone wymiary świata.

Mecz to eliminacje od 1 do 8 autek: kamera śledzi wyłącznie pierwsze i drugie auto według postępu trasy, z wagami 70% dla lidera i 30% dla drugiego auta. Dłuższy wymiar kadru nie przekracza 20 długości samochodu (20 × 47 = 940 jednostek świata gry), z wyjątkiem skrajnie wąskich proporcji ekranu wymagających zachowania marginesu lidera. Kamera porusza się z bezwładnością. Gdy liderzy są daleko od siebie, kadr nie oddala się poza ten limit. Korona obok koloru auta oznacza lidera, X oznacza odpadnięcie; HUD pokazuje uzbrojenie; komunikaty chwilowe znikają po 3 sekundach, także w trybie online. Nie ma minimapy. Domyślnie zwinięta, półprzezroczysta tabela wyników przy prawej krawędzi pokazuje kolory aut w kolejności klasyfikacji punktowej; po rozwinięciu wyświetla imiona i punkty większą czcionką. Prowadzące auto zachowuje co najmniej dwie długości samochodu wolnej przestrzeni do każdej krawędzi kadru (z dodatkowym zapasem na obrócony obrys auta), a pozostałe odpadają już po dotknięciu krawędzi kadru. Każda runda kończy się, gdy zostaje tylko jedno auto, a gracze otrzymują punkty za miejsca: 1. +2, 2. +1, 3. −1, 4. −2, 5. −3 itd. Wszystkie auta ruszają ponownie w pobliżu miejsca zwycięzcy w odwróconej kolejności wyników poprzedniej rundy (zwycięzca ostatni), po potwierdzeniu gotowości przez wszystkich ludzi (gaz potwierdza, hamulec/cofanie anuluje przed startem); boty nie blokują startu. Nie ma limitu okrążeń; cały mecz kończy się, gdy któryś kierowca osiągnie 10 punktów. Wyniki i imiona są wyświetlane w tabeli; nazwy (maksymalnie 18 znaków Unicode) można ustawić w panelu ustawień (koło zębate w prawym górnym rogu) i zmieniać w tabeli podczas gry. Panel umożliwia przełączenie języka polskiego i szwedzkiego; język i nazwa kierowcy na tym urządzeniu są zapamiętywane lokalnie. Obok ustawień znajduje się ikona powrotu do menu gry. Panel wstrzymuje wyścig lokalny, ale nie zatrzymuje serwera online. Samotny gracz bez botów może trenować bez limitu czasu i okrążeń. W menu wybierasz trasę, osobno 1–8 graczy lokalnych i 0–7 botów (łącznie maksymalnie 8 aut). P1–P4 mają sterowanie klawiaturą lub padem, a P5–P8 korzystają z padów. Modele mają bezwładność, poślizg, kolizje prostokątnych obrysów pojazdów z przenoszeniem pędu, tłumionym odbiciem i stopniowym powrotem botów na linię jazdy po uderzeniu, wypadanie z toru z automatycznym powrotem tylko po zatrzymaniu (prędkość do 5 jednostek/s) oraz przedmioty: turbo i 12 rodzajów broni, m.in. pociski, rakiety, miny, bomby oraz broń obszarową. Grę można uruchomić bez serwera i bez budowania aplikacji.

- Klawiatura: P1 — A/D skręt w lewo/prawo względem auta, W gaz, S hamulec i cofanie, Spacja strzał; P2 — strzałki (lewo/prawo skręt, góra gaz, dół hamowanie/cofanie), prawy Ctrl hamulec, prawy Shift strzał; P3 — J/L/I/K, U, O; P4 — F/H/T/G, R, Y. Skręt zachowuje bezwładność jazdy.
- Gamepad dla kolejnych graczy: lewy drążek poziomo skręca względem auta, w górę przyspiesza, w dół hamuje i cofa; RT/A dodatkowo przyspiesza, LT/B hamuje, X/RB strzela.
- Dotyk: analogowa gałka P1 w lewym dolnym rogu skręca względem auta (lewo/prawo) i reguluje jazdę w przód lub hamowanie/cofanie (góra/dół), gdy pedały są zwolnione. Podczas trzymania gazu lub hamulca pionowe wychylenie gałki nie wpływa na prędkość — służy ona wtedy tylko do skręcania. Osobne przyciski strzału, gazu i hamulca po prawej. Obsługa wielu palców jednocześnie; gra zajmuje całe okno i blokuje przewijanie oraz pinch-zoom podczas jazdy.
- P lub Escape: pauza; Start: nowy wyścig lub wznowienie.
- Tryb lokalny działa bez sieci. **Gra online** tworzy prywatny pokój na serwerze dedykowanym `wss://gra.w.korzec-it.pl/ws` (do 8 graczy): wybierz trasę i liczbę botów, naciśnij „GRA ONLINE — NOWY POKÓJ”, udostępnij sześcioliterowy kod lub link `#room=ABCDEF`; zaproszeni gracze mogą dołączyć kodem albo linkiem. Każda przeglądarka steruje jednym autkiem. Liczba botów jest ustalana przy tworzeniu pokoju; kolejne auta dołączają aż do limitu 8, później gracze zastępują boty. Po rozłączeniu gracza jego auto przejmuje bot.
- Serwer `korzec/sockets` jest autorytatywny: symuluje te same reguły ruchu, kolizje, zbieranie przedmiotów, eliminacje przy dotknięciu wspólnego referencyjnego kadru, punktację rund, imiona oraz boty w 60 Hz, przesyła pozycję i skalę wspólnej kamery w snapshotach 30 Hz; wszystkie ekrany pokazują pełny referencyjny kadr 1200×700, a kamera i pozostali kierowcy są renderowani z tej samej interpolowanej osi czasu serwera. Własne auto i pociski są symulowane natychmiast na kliencie (60 Hz), a snapshot serwera zastępuje przewidziany stan i odtwarza niepotwierdzone wejścia. Eliminacje, trafienia i punktacja pozostają autorytatywne; kierowca nie może sam potwierdzić odpadnięcia. Zerwane połączenie jest automatycznie odnawiane; gracz po rozłączeniu przechodzi w bota. Cały pokój działa nadal, dopóki pozostaje choć jeden uczestnik.
- Wersje fizyki `mikro-sprint/game.js` oraz `korzec/sockets/vendor/mikro-sprint/game.js` muszą być zgodne. Serwer nie przechowuje pokojów po restarcie i ogranicza je do 8 graczy. Aktualizacja wymaga wdrożenia również repozytorium `korzec/sockets`.

## Grand T

Znajdziesz go pod adresem `grand-t/` (stary adres `nocny-kurs/` przekierowuje wraz z parametrami i fragmentem linku do pokoju). Zbierzcie 12 przesyłek w nocnym mieście; nie ma limitu czasu. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Każde auto ma kierowcę NPC. Gdy gracz przejmie samochód, kierowca wypada na ulicę, ściga skradziony pojazd i próbuje go odzyskać; może wyrzucić gracza z wolno jadącego lub stojącego auta. Po wysiadce gracza porzucony samochód nie rusza sam bez kierowcy. Kierowcy i ich pościg synchronizują się w multiplayer. Samochód z kierowcą NPC po trafieniu pociskiem gracza natychmiast przyspiesza do swojej maksymalnej prędkości i ucieka ulicami w kierunku oddalającym go od strzelającego. Dotyczy to aut zaparkowanych i jadących; przejęte przez gracza pojazdy nie uciekają. Na skrzyżowaniach działają sygnalizatory z zielonym, żółtym i czerwonym światłem oraz liniami zatrzymania. Samochody prowadzone przez NPC, również uciekające po ostrzale, hamują przed czerwonym i żółtym oraz ruszają, gdy zaświeci zielone; cykle świateł są synchronizowane w multiplayer. Samochody prowadzone przez graczy pozostają pod ich kontrolą. Gracz zaczyna z nożem, który zadaje 1,5 HP obrażeń. Strażnicy mają 5 HP. Przycisk ataku używa automatycznie bazooki, pistoletu albo noża (w zwarciu, tylko pieszo), zależnie od dostępnej amunicji. Pokonani strażnicy i piesi NPC pozostawiają pistolet z 20 nabojami. Podejście pieszo zbiera amunicję do limitu 100; nadmiar pozostaje na ziemi. Po śmierci gracz wraca z nożem. Na ziemi może pozostać do 64 pistoletów. Na początku gry na każdym odcinku między sąsiednimi skrzyżowaniami jest co najmniej jedno auto (98 aut łącznie: 90 w ruchu i 8 zaparkowanych); to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta mają 10 HP i wybuchają dopiero po ich wyczerpaniu, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Potrącenia pieszych przy prędkości większej niż 50% prędkości maksymalnej danego pojazdu zabierają 100% ich zdrowia; dotyczy to także strażników (5 HP), których wolniejsze, dostatecznie mocne potrącenie ogłusza i uszkadza; potrącenie przez gracza podnosi poziom poszukiwania; gracz siedzący w aucie nie traci zdrowia od strzałów, zderzeń ani pobliskich eksplozji; obrażenia otrzymuje tylko przy wybuchu zajmowanego samochodu. Sam samochód traci przy kolizji maksymalnie 3 z 10 HP, a ciągły kontakt z przeszkodą ma krótki odstęp między naliczaniem uszkodzeń. Śmierć kierowcy nie powoduje wybuchu sprawnego samochodu. Samochody są o 50% szybsze. Prędkość biegania postaci została zmniejszona o połowę (do 77,5 jednostki/s). Postacie mają autorski sprite z góry bez cienia pod stopami, z głową pośrodku tułowia i czytelnym kierunkiem twarzy; ręce i nogi są stale widoczne, a podczas ruchu animują się. W postoju postać pali vape z delikatnym dymkiem. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością. Śmierć jednej osoby nie kończy gry pozostałych.

Co 60 sekund aktywnej rozgrywki na ulicach pojawia się zielona, oznaczona symbolem `# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, **Grand T**, miejska gra arcade dla 1–8 osób ze wspólną kamerą, oraz **Leśne Jednorożce**, kooperacyjna leśna wyprawa dla 1–8 osób.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `14` → `15`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby.

## Grand T

Znajdziesz go pod adresem `grand-t/` (stary adres `nocny-kurs/` przekierowuje wraz z parametrami i fragmentem linku do pokoju). Zbierzcie 12 przesyłek w nocnym mieście; nie ma limitu czasu. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Każde auto ma kierowcę NPC. Gdy gracz przejmie samochód, kierowca wypada na ulicę, ściga skradziony pojazd i próbuje go odzyskać; może wyrzucić gracza z wolno jadącego lub stojącego auta. Po wysiadce gracza porzucony samochód nie rusza sam bez kierowcy. Kierowcy i ich pościg synchronizują się w multiplayer. Samochód z kierowcą NPC po trafieniu pociskiem gracza natychmiast przyspiesza do swojej maksymalnej prędkości i ucieka ulicami w kierunku oddalającym go od strzelającego. Dotyczy to aut zaparkowanych i jadących; przejęte przez gracza pojazdy nie uciekają. Na skrzyżowaniach działają sygnalizatory z zielonym, żółtym i czerwonym światłem oraz liniami zatrzymania. Samochody prowadzone przez NPC, również uciekające po ostrzale, hamują przed czerwonym i żółtym oraz ruszają, gdy zaświeci zielone; cykle świateł są synchronizowane w multiplayer. Samochody prowadzone przez graczy pozostają pod ich kontrolą. Gracz zaczyna z nożem, który zadaje 1,5 HP obrażeń. Strażnicy mają 5 HP. Przycisk ataku używa automatycznie bazooki, pistoletu albo noża (w zwarciu, tylko pieszo), zależnie od dostępnej amunicji. Pokonani strażnicy i piesi NPC pozostawiają pistolet z 20 nabojami. Podejście pieszo zbiera amunicję do limitu 100; nadmiar pozostaje na ziemi. Po śmierci gracz wraca z nożem. Na ziemi może pozostać do 64 pistoletów. Na początku gry na każdym odcinku między sąsiednimi skrzyżowaniami jest co najmniej jedno auto (98 aut łącznie: 90 w ruchu i 8 zaparkowanych); to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta mają 10 HP i wybuchają dopiero po ich wyczerpaniu, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Potrącenia pieszych przy prędkości większej niż 50% prędkości maksymalnej danego pojazdu zabierają 100% ich zdrowia; dotyczy to także strażników (5 HP), których wolniejsze, dostatecznie mocne potrącenie ogłusza i uszkadza; potrącenie przez gracza podnosi poziom poszukiwania; gracz siedzący w aucie nie traci zdrowia od strzałów, zderzeń ani pobliskich eksplozji; obrażenia otrzymuje tylko przy wybuchu zajmowanego samochodu. Sam samochód traci przy kolizji maksymalnie 3 z 10 HP, a ciągły kontakt z przeszkodą ma krótki odstęp między naliczaniem uszkodzeń. Śmierć kierowcy nie powoduje wybuchu sprawnego samochodu. Samochody są o 50% szybsze. Prędkość biegania postaci została zmniejszona o połowę (do 77,5 jednostki/s). Postacie mają autorski sprite z góry bez cienia pod stopami, z głową pośrodku tułowia i czytelnym kierunkiem twarzy; ręce i nogi są stale widoczne, a podczas ruchu animują się. W postoju postać pali vape z delikatnym dymkiem. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością.  ciężarówka konwojowa z gotówką. Konwój jeździ zgodnie z ruchem ulicznym i reaguje na ostrzał jak inne pojazdy. Po zniszczeniu wypada paczka o wartości **500** do zebrania i doliczenia do wyniku gotówki. Nienaruszone konwoje NPC znikają po 115 sekundach, aby nie blokować dróg. Mechanika działa w grze lokalnej i na dedykowanym serwerze online (po wdrożeniu `korzec/sockets`).

### Sklep z bronią

W mieście znajduje się oznaczony neonem sklep z bronią. Podejdź pieszo do wejścia i użyj przycisku akcji (E, prawy Ctrl, B na padzie lub przycisk dotykowy), aby kupić bazookę za **500 $** ze wspólnej zebranej gotówki. Każdy zakup daje **100 rakiet**. Bazooka strzela wolniej od zwykłej broni, rakiety wybuchają przy zderzeniu i rażą cele w pobliżu. Liczba rakiet jest wyświetlana przy wskaźniku amunicji, a po wystrzeleniu ostatniej bazooka znika; następne ataki używają pistoletu, jeśli pozostały naboje, albo noża. Nie można ponownie kupić bazooki przed wyczerpaniem poprzedniej. Po śmierci bazooka wypada w miejscu śmierci wraz z pozostałą amunicją. Żywy gracz bez bazooki podnosi ją automatycznie, gdy podejdzie pieszo; przedmiot znika po podniesieniu lub rozpoczęciu nowej rundy. Serwer synchronizuje przedmioty i rozstrzyga podnoszenie w trybie online. Stan zakupów, rakiet, wybuchów i gotówki jest rozstrzygany przez serwer w trybie online (po wdrożeniu odpowiedniej wersji `korzec/sockets`).

- Klawiatura: maksymalnie 2 osoby; gracz 1: WASD, gracz 2: strzałki
- Strzelanie: trzymaj Spację (gracz 1) lub prawy Shift (gracz 2); puszczenie zatrzymuje serię, a wystrzelone pociski dalej lecą
- Wsiadanie i wysiadanie: E (gracz 1), prawy Ctrl (gracz 2). Akcja wybiera najbliższe widoczne auto w odległości do 10 m od jego obrysu; postać automatycznie podbiega do poruszającego się pojazdu i wsiada, gdy może do niego dotrzeć. Ruch ręczny lub kolejne naciśnięcie akcji przerywa pościg.
- Kontrolery: drążek lub krzyżak; A dołącza i zaczyna, a podczas gry strzela tak długo, jak jest wciśnięte; prawy spust RT działa jako alternatywa analogowa; B wykonuje akcję wsiadania lub wysiadania. Puszczenie A/RT zatrzymuje serię, a wystrzelone pociski dalej lecą
- Prowadzenie auta: A/D, strzałki lewo/prawo, poziome wychylenie gałki lub pada skręca względem przodu pojazdu (nie względem mapy). W/strzałka w górę lub gałka pada w górę to gaz, S/strzałka w dół lub gałka pada w dół hamuje, a po zatrzymaniu cofa auto. Na ekranie dotykowym gałka skręca, a dwa osobne przyciski z ikonami służą do jazdy w przód (po prawej) i hamowania/cofania (po lewej); wszystkie cztery przyciski akcji są jednakowej wielkości. Puszczenie gazu pozwala autu toczyć się dalej, a przytrzymanie hamulca powoduje zmianę kierunku dopiero po zatrzymaniu. Ruch pieszo pozostaje względem mapy. Takie samo sterowanie działa lokalnie i online po aktualizacji serwera.
- Enter: start i dołączanie kolejnych graczy klawiaturowych

Pociski graczy i strażników są rysowane o 50% mniejsze (grubość, długość śladu i poświata); zasięg trafień nie zmienia się. Strażnik może strzelać tylko do gracza, którego **osobiście widział podczas strzału w ostatnich 5 sekundach**, pod warunkiem że nadal widzi go w zasięgu ognia. Usłyszany zza budynku strzał nadal przyciąga uwagę, ale nie uprawnia do otwarcia ognia; sama obecność gracza w polu widzenia też nie wystarcza.

### Multiplayer online w Grand T

Wybierz **Gra online**, aby założyć prywatny pokój na **serwerze dedykowanym**.
Serwer w repozytorium `korzec/sockets` pod adresem `wss://gra.w.korzec-it.pl/ws`
wykonuje całą symulację Grand T w 60 Hz, a przeglądarki wysyłają
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

W multiplayer: WASD lub strzałki — ruch, Spacja lub prawy Shift — strzał, E lub prawy Ctrl —
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


### Synchronizacja i bufor jittera (przygotowana optymalizacja)

Oprócz lokalnej predykcji sterowanej postaci klienci utrzymują bufor
maksymalnie 24 migawek na obiekt i odtwarzają zdalne postacie, auta,
strażników i kierowców kilka kroków symulacji za stanem serwera.
Interpolator korzysta z numerów kroków zamiast aktualizować pozycje
bezpośrednio przy nadejściu pakietu; krótkie zmiany interwału dostarczania
migawek nie powodują przeskoków. Po przerwie extrapolacja nie przekracza
200 ms, a prawdziwe teleporty, zmiany pojazdu i respawny pozostają
natychmiastowe. Aktualizacje starsze niż już zastosowane są ignorowane.
Kamera i lokalnie prowadzony pojazd nadal korzystają z predykcji wejść
i łagodnych korekt, bez dodatkowego opóźnienia bufora innych graczy.

Testy: node --test tests/nocny-kurs-prediction.unit.cjs. Zmiana nie obniża
rzeczywistego RTT łącza — jej celem jest ograniczenie szarpania obrazu i
niepotrzebnych korekt przy nieregularnie przychodzących snapshotach.

### Telemetria wydajności

Grand T wysyła z multiplayer co około 30 sekund zagregowane, anonimowe pomiary przez istniejące połączenie WebSocket (`type: telemetry`). Mierzymy FPS, P95 czasu klatki i renderowania, ping/jitter, odstępy między snapshotami, rozbieżności pozycji przed korektą oraz wysyłane/odbierane bajty JSON. Dane są oznaczone wersją gry, trybem multiplayer i klasą urządzenia. Nie przesyłamy nazwy gracza, kodu pokoju ani identyfikatora sesji. Liczniki transferu po stronie przeglądarki to **rozmiary nieskompresowanych wiadomości aplikacji**; rzeczywisty transfer TCP mierzy serwer sockets. W przeglądarce lokalnej bez multiplayer dane nie są wysyłane. Test: `npm run test:unit`. Wykresy wymagają osobnego wdrożenia serwerowego endpointu /metrics oraz VictoriaMetrics/Grafana.

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

Micro M: poza torem przyspieszenie i prędkość maksymalna są ograniczone, a opór ruchu większy. Powrót na dowolny odcinek toru przywraca normalną fizykę od następnego kroku symulacji; utraconą prędkość odzyskuje się przez przyspieszanie. Rozpoznawanie nawierzchni jest niezależne od postępu wyścigu. Reset zatrzymanego auta, kolizje i eliminacje bez zmian.

Micro M: skróty nie mają limitu. Poza torem pozycja w klasyfikacji jest aktualizowana w każdym kroku symulacji poprzez interpolację odległości wzdłuż trasy (stała czasowa 180 ms); na torze pozycja jest dokładna. Kamera i eliminacja korzystają z tej samej klasyfikacji. Ostatnia potwierdzona pozycja na torze pozostaje punktem awaryjnego resetu. Fizyka poza torem bez zmian.

Micro M: eliminacja następuje dopiero przy kontakcie rzeczywistego obrysu obróconego auta z krawędzią kadru. Klient zachowuje kadr serwera i wyświetla krótką animację dojścia do krawędzi po potwierdzeniu eliminacji (bez zmiany wyniku serwera).

Grand T: w trakcie gry legenda przy graczach jest ukryta. Dolny panel pokazuje rzeczywiste klawisze (WASD, Spacja, E, strzałki, prawy Shift/Ctrl), przyciski pada A/RT/B i osie drążka lub ikony przycisków dotykowych. Aktywne wejścia są podświetlane niezależnie, także przy równoczesnym wciskaniu przeciwnych kierunków. Online monitoruje własne urządzenie, lokalnie wszystkich graczy. Panel nie ingeruje w sterowanie ani komunikację sieciową.

Micro M i Grand T korzystają ze wspólnego modelu graficznego auta osobowego (`shared-car-art.js`). W Micro M model ma długość 47 jednostek i zachowuje kolory, turbo oraz fizykę wyścigu. Obrys eliminacji odpowiada nowej grafice; ciężarówki GT pozostają tylko w Grand T.
