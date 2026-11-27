(() => {
  "use strict";
  const sv = {
  "SERWER GRY ONLINE": "SPELENS ONLINESERVER",
  "Serwer będzie użyty przy następnym połączeniu.": "Servern används vid nästa anslutning.",
  "TRANSPORT GRY ONLINE": "ONLINEPROTOKOLL",
  "WebSocket (domyślny)": "WebSocket (standard)",
  "WebRTC / UDP (snapshoty)": "WebRTC / UDP (ögonblicksbilder)",
  "UDP wysyła tylko snapshoty; sterowanie i sygnalizacja zostają na WebSocket. Wymaga serwera DWA i otwartych portów UDP. Przy problemach gra wróci do WebSocket.": "UDP skickar bara spelsnapshots; styrning och signalering går via WebSocket. Kräver DWA och öppna UDP-portar. Spelet växlar tillbaka till WebSocket om UDP inte fungerar.",
  "UDP niedostępne — powrót do WebSocket": "UDP är inte tillgängligt — återgår till WebSocket",
  "KARABIN": "KULSPRUTA",
  "RAKIETA": "RAKET",
  "RAKIETA NAM.": "MÅLSÖKANDE RAKET",
  "BOMBY KAS.": "KLUSTERBOMBER",
  "PLAZMA": "PLASMA",
  "DZIAŁKO": "KANON",
  "MINY": "MINOR",
  "BOMBY": "BOMBER",
  "MŁOT": "HAMMARE",
  "RAŻENIE": "ELCHOCK",
  "SONIC BOOM": "LJUDVÅG",
  "MIOTACZ": "ELDKASTARE",
  "BROŃ": "VAPEN",
  "KOŃCOWA TABELA WYNIKÓW": "SLUTRESULTAT",
  "MIEJSCE": "PLATS",
  "NOWY GRACZ DOŁĄCZYŁ DO POKOJU": "EN NY SPELARE GICK MED I RUMMET",
  "Ustawienia": "Inställningar",
  "USTAWIENIA": "INSTÄLLNINGAR",
  "Zamknij ustawienia": "Stäng inställningar",
  "JĘZYK": "SPRÅK",
  "Zmiany zapisują się automatycznie.": "Ändringarna sparas automatiskt.",
  "Pauza lub wznowienie wyścigu": "Pausa eller återuppta loppet",
  "Pauza (P)": "Paus (P)",
  "Pokój online": "Onlinerum",
  "Kod pokoju": "Rumskod",
  "POKÓJ": "RUM",
  "TCP ↑ {up} · ↓ {down}": "TCP ↑ {up} · ↓ {down}",
  "Transfer TCP w tej sesji: wysłano {up}, odebrano {down}": "TCP-överföring i den här sessionen: skickat {up}, mottaget {down}",
  "Łączenie z serwerem…": "Ansluter till servern…",
  "Skopiuj link zaproszenia": "Kopiera inbjudningslänken",
  "Wyjdź do menu głównego Micro M": "Tillbaka till Micro Ms huvudmeny",
  "Menu główne": "Huvudmeny",
  "Eliminacje na krawędzi ekranu. Zbieraj punkty do dziesięciu.": "Eliminering vid skärmkanten. Samla tio poäng.",
  "Micro M — gra wyścigowa": "Micro M — racingspel",
  "Wyścig miniaturowych samochodów na wybranej trasie": "Lopp med miniatyrbilar på den valda banan",
  "STÓŁ BILARDOWY": "BILJARDBORD",
  "WANNA": "BADKAR",
  "LIDER": "LEDARE",
  "Odpadł": "Utslagen",
  "Gotowi: {ready}/{total}": "Redo: {ready}/{total}",
  "GOTOWY": "REDO",
  "NIEGOTOWY": "INTE REDO",
  "Gaz — gotowy · Wsteczny — anuluj": "Gas — redo · Backa — avbryt",
  "GOTOWY?": "REDO?",
  "Kolejna runda po potwierdzeniu wszystkich graczy.": "Nästa omgång när alla spelare är redo.",
  "UZBROJENIE": "VAPEN",
  "Tabela wyników": "Resultattavla",
  "Rozwiń tabelę wyników": "Visa resultattavlan",
  "Zwiń tabelę wyników": "Dölj resultattavlan",
  "Rozwiń tabelę wyników. Klasyfikacja: {names}": "Visa resultattavlan. Ställning: {names}",
  "WYNIKI": "RESULTAT",
  "RUNDA 1 · DO 10 PKT": "OMGÅNG 1 · TILL 10 P",
  "RUNDA {round} · DO 10 PKT": "OMGÅNG {round} · TILL 10 P",
  "LP": "PL",
  "KIEROWCA": "FÖRARE",
  "PKT": "P",
  "WYNIKI RUNDY": "OMGÅNGSRESULTAT",
  "Kolejna runda startuje z miejsca zwycięzcy": "Nästa omgång startar från vinnarens plats",
  "Ustawienia wyścigu": "Tävlingsinställningar",
  "WYBIERZ TRASĘ": "VÄLJ BANA",
  "GOTOWI NA": "REDO FÖR",
  "START?": "START?",
  "Kamera zawsze pokazuje lidera. Dotknięcie krawędzi eliminuje pozostałe auta. Punkty za miejsca: +2, +1, −1, −2 (dalsze miejsca: −3 itd.). Rundy trwają do osiągnięcia 10 punktów.": "Kameran visar alltid ledaren. Övriga bilar åker ut när de når skärmkanten. Placeringspoäng: +2, +1, −1, −2 (därefter −3 osv.). Spelet fortsätter tills någon når 10 poäng.",
  "Końcowa tabela wyników": "Slutresultat",
  "Zielone sukno, bile i łuzy": "Grön duk, bollar och fickor",
  "Mokra nawierzchnia, piana i kaczka": "Vått underlag, skum och anka",
  "IMIONA KIEROWCÓW (OPCJONALNIE)": "FÖRARNAMN (VALFRITT)",
  "GRACZE LOKALNI": "LOKALA SPELARE",
  "Liczba graczy lokalnych": "Antal lokala spelare",
  "BOTY": "BOTTAR",
  "Liczba botów": "Antal bottar",
  "Gra lokalna": "Spela lokalt",
  "Gra online": "Spela online",
  "Dołącz do pokoju": "Gå med i rum",
  "Dołącz": "Gå med",
  "GRA LOKALNA": "SPELA LOKALT",
  "GRA ONLINE": "SPELA ONLINE",
  "START ELIMINACJI": "STARTA ELIMINERING",
  "GRA ONLINE — NOWY POKÓJ": "SPELA ONLINE — NYTT RUM",
  "Online: maks. 8 osób. Twórca ustala liczbę botów; kolejni gracze zastępują boty po zapełnieniu toru.": "Online: max 8 spelare. Rumsskaparen väljer antalet bottar. Nya spelare ersätter bottar när banan är full.",
  "DOŁĄCZ DO POKOJU": "GÅ MED I RUM",
  "ABCDEF lub link": "ABCDEF eller länk",
  "Kod lub link do pokoju": "Rumskod eller länk",
  "DOŁĄCZ": "GÅ MED",
  "JAZDA: W/S LUB ↑/↓ • SKRĘT: A/D LUB ←/→ • HAMULEC: S / ↓ / R CTRL / LT • STRZAŁ: SPACJA / R SHIFT / X": "KÖR: W/S ELLER ↑/↓ • STYR: A/D ELLER ←/→ • BROMS: S / ↓ / R CTRL / LT • SKJUT: MELLANSLAG / R SHIFT / X",
  "Dotykowe sterowanie samochodem": "Pekstyrning av bilen",
  "Wirtualna gałka: lewo/prawo skręca autem, góra przyspiesza, dół hamuje i cofa": "Virtuell styrspak: vänster/höger styr, upp accelererar, ned bromsar och backar",
  "Przyciski samochodu": "Bilens knappar",
  "Strzał": "Skjut",
  "Hamulec": "Broms",
  "Gaz": "Gas",
  "HAMULEC": "BROMS",
  "GAZ": "GAS",
  "STEROWANIE": "KONTROLLER",
  "P1: WASD + E · P2: STRZAŁKI + SHIFT · P3: IJKL + O · P4: TFGH + Y · P5–P8: PAD": "P1: WASD + E · P2: PILTANGENTER + SHIFT · P3: IJKL + O · P4: TFGH + Y · P5–P8: HANDKONTROLL",
  "PAD: LEWY DRĄŻEK SKRĘT I GAZ/HAMULEC / RT GAZ / LT HAMULEC / X STRZAŁ": "HANDKONTROLL: VÄNSTER SPAK STYR OCH GAS/BROMS / RT GAS / LT BROMS / X SKJUT",
  "P: PAUZA": "P: PAUS",
  "ORYGINALNA MINIGRA INSPIROWANA KLASYKĄ WYŚCIGÓW MINIATUROWYCH": "ORIGINALSPEL INSPIRERAT AV KLASSISKA MINIATYRBILAR",
  "WYŚCIG <em>WSTRZYMANY.</em>": "LOPPET <em>PAUSAT.</em>",
  "Wznów i wróć na tor. Sterowanie pozostaje przypisane do tych samych kierowców.": "Fortsätt och återvänd till banan. Kontrollerna förblir tilldelade samma förare.",
  "WZNÓW WYŚCIG": "FORTSÄTT LOPPET",
  "KONIEC <em>MECZU.</em>": "MATCHEN <em>ÄR SLUT.</em>",
  "{name} zdobywa {points} punktów. Koniec po {round} rundach.": "{name} får {points} poäng. Slut efter {round} omgångar.",
  "NOWY MECZ": "NY MATCH",
  "P{number} ODPADA!": "P{number} ÅKER UT!",
  "POCISK × {count}": "PROJEKTIL × {count}",
  "Imię kierowcy {number}": "Förarnamn {number}",
  "MECZ WYGRYWA {name}": "{name} VINNER MATCHEN",
  "RUNDA {round} — WYNIKI": "OMGÅNG {round} — RESULTAT",
  "Pierwsze 10 punktów zdobyte — koniec meczu.": "Tio poäng uppnådda — matchen är slut.",
  "{points} pkt": "{points} p",
  "POWRÓT NA TOR": "TILLBAKA PÅ BANAN",
  "TURBO! PRZYSPIESZENIE": "TURBO! ACCELERATION",
  "3 POCISKI — NACIŚNIJ E": "3 PROJEKTILER — TRYCK E",
  "TRAFIENIE!": "TRÄFF!",
  "GO!": "KÖR!",
  "POŁĄCZENIE <em>ONLINE.</em>": "ANSLUTNING <em>ONLINE.</em>",
  "Serwer dedykowany przygotowuje wyścig. Kod pokoju jest w panelu zaproszenia.": "Den dedikerade servern förbereder loppet. Rumskoden finns i inbjudningspanelen.",
  "{reason}. Próba wznowienia połączenia…": "{reason}. Försöker återansluta…",
  "Utracono kontakt z serwerem": "Kontakten med servern förlorades",
  "Pokój nie działa na serwerze dedykowanym": "Rummet körs inte på en dedikerad server",
  "Oczekiwanie na autorytatywny stan wyścigu": "Väntar på serverns tävlingsstatus",
  "Ponowne łączenie…": "Återansluter…",
  "Przekroczono czas połączenia": "Anslutningen tog för lång tid",
  "Połączenie WebSocket przerwane": "WebSocket-anslutningen avbröts",
  "Serwer rozłączył połączenie": "Servern kopplade från",
  "Pokój zamknięty — brak aktywnych klientów": "Rummet stängdes — inga aktiva klienter",
  "Nie można otworzyć WebSocket": "Kan inte öppna WebSocket",
  "Łączenie…": "Ansluter…",
  "Nie można utworzyć bezpiecznego kodu pokoju": "Kan inte skapa en säker rumskod",
  "Wpisz sześć liter lub pełny link do pokoju.": "Ange sex bokstäver eller hela rumslänken.",
  "Skopiowano link zaproszenia": "Inbjudningslänken kopierades",
  "Nieprawidłowy link zaproszenia": "Ogiltig inbjudningslänk",
  "1 gracz": "1 spelare",
  "2 graczy": "2 spelare",
  "3 graczy": "3 spelare",
  "4 graczy": "4 spelare",
  "5 graczy": "5 spelare",
  "6 graczy": "6 spelare",
  "7 graczy": "7 spelare",
  "8 graczy": "8 spelare",
  "0 botów": "0 bottar",
  "1 bot": "1 bott",
  "2 boty": "2 bottar",
  "3 boty": "3 bottar",
  "4 boty": "4 bottar",
  "5 botów": "5 bottar",
  "6 botów": "6 bottar",
  "7 botów": "7 bottar"
};
  let language = "pl";
  try { if (localStorage.getItem("mikro-sprint-language") === "sv") language = "sv"; } catch {}
  const staticBindings = [];
  const dynamicBindings = new Map();
  function t(key, values = {}) {
    let value = language === "sv" && Object.hasOwn(sv, key) ? sv[key] : key;
    // Connection errors may contain a server code, a room URL or a slot number.
    if (language === "sv") {
      if (value.endsWith(" — ponawianie połączenia")) value = t(value.slice(0, -(" — ponawianie połączenia".length))) + " — återansluter";
      else if (value.startsWith("Serwer nie obsługuje jeszcze tego pokoju (")) value = "Servern stöder inte rummet ännu (" + value.slice("Serwer nie obsługuje jeszcze tego pokoju (".length);
      else if (value.startsWith("Serwer: ")) value = "Server: " + value.slice("Serwer: ".length);
      else if (value.startsWith("Link do skopiowania: ")) value = "Länk att kopiera: " + value.slice("Link do skopiowania: ".length);
    }
    return value.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name]) : token);
  }
  function apply(element, key, values, property) {
    const value = t(key, typeof values === "function" ? values() : values);
    element[property] = value;
  }
  function write(element, key, values = {}, property = "textContent") {
    let bindings = dynamicBindings.get(element);
    if (!bindings) dynamicBindings.set(element, bindings = new Map());
    bindings.set(property, { key, values });
    apply(element, key, values, property);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, original = node.nodeValue, key = original.trim();
    if (Object.hasOwn(sv, key)) staticBindings.push(() => {
      node.nodeValue = original.replace(key, t(key));
    });
  }
  for (const node of document.querySelectorAll("[title],[aria-label],[placeholder]")) {
    for (const attr of ["title", "aria-label", "placeholder"]) {
      const key = node.getAttribute(attr);
      if (key && Object.hasOwn(sv, key)) staticBindings.push(() => node.setAttribute(attr, t(key)));
    }
  }
  function refresh() {
    document.documentElement.lang = language;
    document.querySelector("#settings-language").value = language;
    staticBindings.forEach(fn => fn());
    for (const [element, bindings] of dynamicBindings) for (const [property, { key, values }] of bindings) apply(element, key, values, property);
    document.dispatchEvent(new Event("mikro-sprint-language"));
  }
  document.querySelector("#settings-language").addEventListener("change", event => {
    language = event.target.value === "sv" ? "sv" : "pl";
    try { localStorage.setItem("mikro-sprint-language", language); } catch {}
    refresh();
  });
  window.MikroSprintLocale = { t, write };
  refresh();
})();
