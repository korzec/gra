# Kanapówki ✳

Katalog małych gier do wspólnego grania: **Świetliki**, zręcznościowa gra dla 1–8 osób, **Nocny Kurs**, miejska gra arcade dla 1–8 osób ze wspólną kamerą, oraz **Leśne Jednorożce**, kooperacyjna leśna wyprawa dla 1–8 osób.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny, np. `python3 -m http.server`.

## Wersje i publikowanie

Przy każdej nowej publikacji zwiększ liczbę w pliku `VERSION` o 1 (np. `14` → `15`) i wypchnij zmianę do `main`. GitHub Pages zapisze tę wersję oraz SHA kompilacji w `version.json`; SHA nadal wersjonuje zasoby.

## Nocny Kurs

Znajdziesz go pod adresem `nocny-kurs/`. Zbierzcie 12 przesyłek w nocnym mieście; nie ma limitu czasu. Mapa przedstawia małe europejskie miasteczko z krętymi zaułkami, kamienicami i rynkiem z fontanną. Kamera podąża za grupą i oddala kadr do połowy skali, kiedy gracze się rozdzielą. Poza ekranem wskazuje ich strzałka z dystansem. Można wsiadać do aut, jeździć i strzelać do strażników — także zza kierownicy. Amunicja jest nielimitowana. Około 70% aut jeździ ulicami; to te same pojazdy, do których można wsiadać i które można zniszczyć. Po wybuchu auto wraca na obrzeże miasta. Auta wybuchają po trzech trafieniach, ogłuszając i odrzucając pobliskich graczy. Piesi nie przechodzą przez samochody, a jadące auta mogą potrącać. Samochody są o 50% szybsze. Postacie mają autorski sprite z góry bez cienia pod stopami, z głową pośrodku tułowia i czytelnym kierunkiem twarzy; ręce i nogi są stale widoczne, a podczas ruchu animują się. W postoju postać pali vape z delikatnym dymkiem. Każdy gracz ma trzy punkty zdrowia; mocne potrącenia, postrzały i wybuchy mogą odebrać zdrowie. Po śmierci pojawia się napis `WASTED`, a gracz wraca po chwili przy oznaczonym szpitalu z pełnym zdrowiem i krótką nietykalnością. Śmierć jednej osoby nie kończy gry pozostałych.

- Klawiatura: maksymalnie 2 osoby; gracz 1: WASD, gracz 2: strzałki
- Strzelanie: trzymaj Q (gracz 1) lub . (gracz 2); puszczenie zatrzymuje serię, a wystrzelone pociski dalej lecą
- Wsiadanie i wysiadanie: E (gracz 1), Shift (gracz 2)
- Kontrolery: drążek lub krzyżak; A dołącza i zaczyna, a podczas gry strzela tak długo, jak jest wciśnięte; prawy spust RT działa jako alternatywa analogowa; B wykonuje akcję wsiadania lub wysiadania. Puszczenie A/RT zatrzymuje serię, a wystrzelone pociski dalej lecą
- Enter: start i dołączanie kolejnych graczy klawiaturowych

Pociski graczy i strażników są rysowane o 50% mniejsze (grubość, długość śladu i poświata); zasięg trafień nie zmienia się. Strażnik może strzelać tylko do gracza, którego **osobiście widział podczas strzału w ostatnich 5 sekundach**, pod warunkiem że nadal widzi go w zasięgu ognia. Usłyszany zza budynku strzał nadal przyciąga uwagę, ale nie uprawnia do otwarcia ognia; sama obecność gracza w polu widzenia też nie wystarcza.

### Multiplayer online w Nocnym Kursie

Wybierz **Gra online**, aby założyć prywatny pokój. Pierwsza przeglądarka jest gospodarzem
i wykonuje całą symulację gry. Pokój otrzymuje losowy kod z **6 wielkich liter**
(np. `ABCDEF`). W trakcie rozgrywki widoczne są tylko dwa małe przyciski:
**Kopiuj link** (kopiuje zaproszenie z kodem pokoju) i **Rozłącz**.
Goście mogą otworzyć skopiowany link albo wkleić kod w pole **Dołącz do pokoju**
na ekranie startowym i nacisnąć **Dołącz**. W pokoju może być łącznie maksymalnie
8 graczy, wliczając lokalnych graczy gospodarza.

Połączenie korzysta z serwera relay w repozytorium korzec/sockets pod
adresem wss://gra.w.korzec-it.pl/ws, z przestrzenią gry nocny-kurs.
Gospodarz utrzymuje połączenie WebSocket oraz zegar wysyłania snapshotów
w osobnym **dedykowanym Web Workerze** (`host-worker.js`); w przypadku braku
obsługi Worker używany jest dotychczasowy transport przeglądarki.
Nie jest to Service Worker: przeglądarki mogą dowolnie kończyć jego działanie,
co uniemożliwia utrzymanie stałego listen servera i stanu rozgrywki.
Snapshoty sieciowe oraz sygnały sterowania gościa są wysyłane z docelową
częstotliwością **60 Hz** (wdrożony limit serwera relay: 100 wiadomości/s
na klienta). Rysowanie pozostaje zależne od
rzeczywistego `requestAnimationFrame`, a cała symulacja gry nadal działa
w karcie gospodarza, więc worker nie zapobiega wszystkim rodzajom uśpienia.

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
Nazwę można zmienić w trakcie gry bezpośrednio w wierszu swojej postaci na liście graczy; nie ma osobnego pola nad listą. Nazwa zapisuje się automatycznie w localStorage tej przeglądarki i jest przywracana przy kolejnej wizycie. Wyczyszczenie nazwy przywraca etykietę P1/P2. Język przełącza się kompaktowym selektorem pokazującym bieżącą flagę i strzałkę rozwijania; dostępne są polski i szwedzki.
W multiplayer nazwa gościa jest przesyłana wraz z danymi sterowania, a
gospodarz wysyła aktualne nazwy do wszystkich klientów. Pole dotyczy
postaci sterowanej na danym urządzeniu (w grze lokalnej — pierwszego gracza);
pozostali gracze lokalni zachowują oznaczenia numeryczne.

Gość: WASD lub strzałki — ruch, Q lub kropka — strzał, E lub Shift — wejście/wyjście
z auta; działa też pierwszy podłączony kontroler (A/RT: strzał, B: akcja)
oraz sterowanie dotykowe. Gość steruje jedną postacią. Pozostali gracze
i świat są synchronizowani z przeglądarki gospodarza. Gospodarz może nadal
korzystać z lokalnych klawiatur i kontrolerów.

Gość **symuluje lokalnie ruch swojej postaci oraz pojazdu w 60 Hz**, a pozostałe
postacie, auta i strażników płynnie przewiduje z ostatnich odebranych prędkości.
Ruch i sterowanie nie czekają na kolejne pakiety. Gospodarz przesyła stan z
numerem kroku i potwierdzeniem ostatniego zastosowanego sterowania; klient
odtwarza niepotwierdzone kroki i koryguje tylko rozbieżności pozycji z
wygaszaniem błędu zamiast teleportowania przy każdym pakiecie. Rzeczywista
zmiana auta, respawn i bardzo duża rozbieżność są przełączane natychmiast.
Opóźnienie sieci jest mierzone przez ping/pong; przewidywanie obcych obiektów
kończy się po 200 ms bez aktualizacji. Punkty, kolizje z obrażeniami,
przedmioty i zakończenie gry pozostają rozstrzygane wyłącznie przez gospodarza.
Przy dużym opóźnieniu lub utracie pakietów korekty nadal mogą być widoczne.
Ślady hamowania i pozostałości po postaciach (ciała, później obrysy kredą) są
synchronizowane osobnymi, małymi pakietami 10 razy na sekundę. Klienci
przechowują i starzeją je lokalnie, a nowi gracze otrzymują bieżącą historię
śladów po dołączeniu. Główne snapshoty ruchu pozostają w 60 Hz; razem to
około 70 wiadomości/s gospodarza, poniżej limitu serwera 100 wiadomości/s.

Symulacja gospodarza działa na niezależnym zegarze **60 Hz** (`setInterval`),
a rysowanie w `requestAnimationFrame`. Zegar nadrabia maksymalnie 1 sekundę
opóźnienia, gdy przeglądarka opóźni wywołanie (maks. 60 kroków).
Dzięki temu przejście na inną kartę nie zatrzymuje automatycznie symulacji.
Przeglądarki nadal mogą ograniczać czasomierze i sieć w tle, szczególnie
po dłuższym uśpieniu — do pełnej ciągłości wymagana byłaby symulacja na serwerze.
Gospodarz musi utrzymywać otwartą kartę przeglądarki. Nie ma migracji
gospodarza ani automatycznego wznowienia pokoju po jego wyjściu. Serwer nie zapisuje stanu gry. Nowy pokój
wymaga nowego klucza. W razie rozłączenia kliknij **Rozłącz** i połącz się ponownie.

### Test dwóch przeglądarek (Playwright)

Test E2E uruchamia dwie niezależne sesje Chromium — gospodarza i gościa.
Obie łączą się z lokalnym serwerem WebSocket emulującym protokół relay `sockets`.
Sprawdza on utworzenie pokoju, dołączenie gościa, zmiany nazw graczy,
przywracanie oznaczeń P1/P2 po wyczyszczeniu pola, start rozgrywki,
lokalne przewidywanie auta podczas krótkiego braku snapshotów, synchronizację
śladów opon i pozostałości po postaciach na kliencie oraz
przesyłanie ruchu świata **po zatrzymaniu renderowania gospodarza**
(symulacja zachowania przeglądarki w tle). Playwright utrzymuje strony
w stanie `visible`, więc nie jest to test rzeczywistego systemowego
uśpienia karty ani dostępności produkcyjnego serwera WebSocket.

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
