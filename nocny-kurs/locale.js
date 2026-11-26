(() => {
  'use strict';
  const messages = {
  "pl": {
    "pageTitle": "Grand T — gra miejska",
    "description": "Grand T — rywalizacja w nocnym mieście. Zdobądź 20 punktów przed innymi.",
    "back": "← EKRAN STARTOWY",
    "gameMenu": "Menu główne Grand T",
    "settings": "Ustawienia",
    "closeSettings": "Zamknij ustawienia",
    "language": "Język",
    "roomCaption": "POKÓJ",
    "settingsSaved": "Zmiany zapisują się automatycznie.",
    "gameAria": "Gra Grand T",
    "canvasAria": "Widok z góry na nocne miasto",
    "wantedAria": "Poziom alarmu",
    "intro": "Pierwszy do 20 punktów wygrywa. Paczka +1, gotówka z konwoju +2, pokonanie gracza +1.",
    "local": "Gra lokalna",
    "online": "Gra online",
    "nameStart": "Twoja nazwa (opcjonalnie)",
    "namePlaceholder": "Bez nazwy: P1, P2…",
    "nameAria": "Nazwa gracza",
    "nameLive": "Twoja nazwa",
    "nameLivePlaceholder": "Zmień nazwę",
    "nameLiveAria": "Zmień nazwę gracza w trakcie gry",
    "joinTitle": "Dołącz do pokoju",
    "joinPlaceholder": "ABCDEF lub link",
    "joinKeyAria": "Klucz pokoju lub link",
    "join": "Dołącz",
    "round": "DO 20 PUNKTÓW",
    "camera": "KADR",
    "ammo": "AMUNICJA",
    "pistolName": "PISTOLET",
    "tankName": "CZOŁG",
    "knifeName": "NÓŻ",
    "knife": "NÓŻ",
    "bonus": "GOTÓWKA $",
    "deliveries": "PACZKI",
    "rank": "#", "player": "GRACZ", "convoys": "KONWOJE", "kills": "ELIM.", "points": "PKT", "winner": "Wygrywa {name}",
    "scoreboardTitle":"WYNIKI","scoreboardExpand":"Rozwiń tabelę wyników","scoreboardCollapse":"Zwiń tabelę wyników","scoreboardPlayer":"GRACZ","scoreboardPoints":"PKT",
    "cityWait": "MIASTO CZEKA",
    "roomAria": "Pokój multiplayer",
    "multiplayerToggle": "MULTIPLAYER",
    "disconnect": "Rozłącz",
    "connecting": "Łączenie...",
    "shareLabel": "Link do udostępnienia",
    "shareAria": "Link do pokoju",
    "copy": "Kopiuj link",
    "roomKeyLabel": "Klucz pokoju (6 liter)",
    "roomKeyAria": "Klucz pokoju",
    "touchAria": "P1 dotyk",
    "stickAria": "Sterowanie analogowe P1",
    "fire": "Atak",
    "action": "Akcja",
    "driveForward": "Jedź do przodu",
    "driveBrake": "Hamuj i cofaj",
    "switchWeapon": "Zmień broń",
    "footerMotto": "MAJĄC MAPĘ, NIKT NIE ZGINIE.",
    "playTogether": "GRAJ RAZEM",
    "enRoute": "RYWALIZACJA",
    "roundDone": "KONIEC GRY",
    "deliveryDone": "KONIEC RUNDY",
    "finishHtml": "Dobra robota.<br><em>Kurs dowieziony!</em>",
    "parcels": "Paczki: {count} / 12",
    "alarm": "ALARM",
    "alarmLevel": "Poziom alarmu: {level} z {max}",
    "healthLabel": "Zdrowie P{id}: {health} z {max}",
    "wasted": "WASTED",
    "space": "SPACJA",
    "controlsMove": "WASD / STRZAŁKI",
    "controlsShoot": "SPACJA / R SHIFT · STRZAŁ",
    "controlsAct": "E / R CTRL · AKCJA",
    "jump": "Skok", "controlsJump": "L CTRL / END · SKOK", "padX": "X · AKCJA", "padY": "Y · STRZAŁ",
    "controlsPadTouch": "PAD / DOTYK",
    "leftStick": "LEWY DRĄŻEK",
    "dpad": "KRZYŻAK",
    "padA": "A · START / SKOK / GAZ",
    "padRT": "RT · STRZAŁ",
    "padB": "B · HAMULEC / WSTECZNY",
    "touchStick": "DOTYK GAŁKA",
    "guard": "OCHRONA",
    "hospital": "SZPITAL",
    "exit": "WYJŚCIE",
    "market": "RYNEK",
    "streetNight": "UL. NOCNA",
    "streetMarket": "UL. RYNKOWA",
    "streetPark": "UL. PARKOWA",
    "streetOld": "UL. STARA",
    "respawn": "P{id} WRACA ZE SZPITALA",
    "dead": "P{id} · WASTED{reason}",
    "damaged": "P{id} · {health}/{max} ZDROWIA",
    "heart": "P{id} · +1 SERCE",
    "carExploded": "AUTO WYBUCHŁO",
    "cashConvoyArrived": "KONWÓJ Z GOTÓWKĄ W MIEŚCIE",
    "cashConvoyRobbed": "KONWÓJ ROZBITY · ZBIERZ 500 GOTÓWKI",
    "weaponShop": "SKLEP Z BRONIĄ",
    "weaponShopPrice": "BAZOOKA · {price} $ · AKCJA",
    "bazookaName": "BAZOOKA",
    "bazookaBought": "P{id} · KUPIONO BAZOOKĘ · 100 RAKIET",
    "bazookaEmpty": "P{id} · BRAK RAKIET · BAZOOKA ZNIKA",
    "bazookaAlreadyOwned": "P{id} · MASZ JUŻ BAZOOKĘ",
    "bazookaTooExpensive": "BAZOOKA KOSZTUJE {price} $",
    "guardDown": "OCHRONA ROZBROJONA",
    "guardStunned": "STRAŻNIK OGŁUSZONY",
    "carDamaged": "AUTO USZKODZONE · {health}/{max}",
    "carHijacked": "KIEROWCA WYRZUCONY · POŚCIG",
    "carReclaimed": "KIEROWCA ODZYSKAŁ AUTO",
    "driverDamaged": "KIEROWCA RANNY · {health}/{max} HP",
    "driverDown": "KIEROWCA POKONANY",
    "hitByCar": "POTRĄCENIE",
    "shot": "POSTRZAŁ",
    "explosion": "WYBUCH",
    "replay": "Zagraj ponownie ↗",
    "connectionLost": "Połączenie przerwane",
    "reconnecting": "Brak odpowiedzi serwera · ponawiam połączenie...",
    "reconnectingTitle": "Przywracanie połączenia",
    "reconnectingCopy": "Łączę ponownie z pokojem. Gra wróci automatycznie po synchronizacji.",
    "connectionLostCopy": "{error} Odśwież stronę lub rozłącz się.",
    "rejectedByServer": "Serwer odrzucił połączenie: {code}",
    "genericError": "błąd",
    "roomActive": "Pokój aktywny · czekam na graczy",
    "waitingForHost": "Połączono · czekam na gospodarza",
    "noHost": "W tym pokoju nie ma aktywnego gospodarza.",
    "roomFull": "Pokój jest pełny (8 graczy).",
    "peerJoined": "Pokój aktywny · gracz dołączył",
    "peerLeft": "Pokój aktywny · gracz wyszedł",
    "hostLeft": "Gospodarz opuścił pokój.",
    "playingAs": "Połączono · grasz jako P{id}",
    "joinRejected": "Odmowa dołączenia.",
    "socketError": "Nie można połączyć się z serwerem WebSocket.",
    "socketClosed": "Utracono połączenie z serwerem WebSocket.",
    "workerError": "Błąd przetwarzania wątku gospodarza.",
    "socketStartError": "Nie można uruchomić połączenia WebSocket.",
    "connectingServer": "Łączenie z serwerem...",
    "joiningRoom": "Dołączanie do pokoju",
    "joiningCopy": "Czekam na gospodarza i synchronizację gry.",
    "keyGenerationError": "Przeglądarka nie obsługuje bezpiecznego generatora kluczy.",
    "errorTitle": "Błąd",
    "invalidKey": "Wklej sześć liter klucza pokoju (np. ABCDEF) lub link.",
    "linkCopied": "Link skopiowany · przekaż go znajomym",
    "invalidLink": "Nieprawidłowy link",
    "invalidLinkCopy": "Klucz pokoju w linku jest nieprawidłowy."
  },
  "sv": {
    "pageTitle": "Grand T — stadsspel",
    "description": "Grand T — tävla i nattstaden. Nå 20 poäng före de andra.",
    "back": "← STARTSKÄRM",
    "gameMenu": "Grand T:s huvudmeny",
    "settings": "Inställningar",
    "closeSettings": "Stäng inställningar",
    "language": "Språk",
    "roomCaption": "RUM",
    "settingsSaved": "Ändringar sparas automatiskt.",
    "gameAria": "Spelet Grand T",
    "canvasAria": "Vy uppifrån över en stad på natten",
    "wantedAria": "Larmnivå",
    "intro": "Först till 20 poäng vinner. Paket +1, konvojbyte +2, besegra en spelare +1.",
    "local": "Lokalt spel",
    "online": "Onlinespel",
    "nameStart": "Ditt namn (valfritt)",
    "namePlaceholder": "Inget namn: P1, P2…",
    "nameAria": "Spelarnamn",
    "nameLive": "Ditt namn",
    "nameLivePlaceholder": "Ändra namn",
    "nameLiveAria": "Ändra spelarnamn under spelet",
    "joinTitle": "Gå med i ett rum",
    "joinPlaceholder": "ABCDEF eller länk",
    "joinKeyAria": "Rumskod eller länk",
    "join": "Gå med",
    "round": "TILL 20 POÄNG",
    "camera": "VY",
    "ammo": "AMMUNITION",
    "pistolName": "PISTOL",
    "tankName": "STRIDSVAGN",
    "knifeName": "KNIV",
    "knife": "KNIV",
    "bonus": "GOTÓWKA $",
    "deliveries": "PAKET",
    "rank": "#", "player": "SPELARE", "convoys": "KONVOJER", "kills": "ELIM.", "points": "P", "winner": "{name} vinner",
    "scoreboardTitle":"RESULTAT","scoreboardExpand":"Visa resultat","scoreboardCollapse":"Dölj resultat","scoreboardPlayer":"SPELARE","scoreboardPoints":"P",
    "cityWait": "STADEN VÄNTAR",
    "roomAria": "Flerspelarrum",
    "multiplayerToggle": "FLERSPELARLÄGE",
    "disconnect": "Koppla från",
    "connecting": "Ansluter...",
    "shareLabel": "Länk att dela",
    "shareAria": "Länk till rummet",
    "copy": "Kopiera länk",
    "roomKeyLabel": "Rumskod (6 bokstäver)",
    "roomKeyAria": "Rumskod",
    "touchAria": "P1 pekstyrning",
    "stickAria": "Analog styrning för P1",
    "fire": "Attackera",
    "action": "Interagera",
    "driveForward": "Kör framåt",
    "driveBrake": "Bromsa / backa",
    "switchWeapon": "Byt vapen",
    "footerMotto": "MED EN KARTA HITTAR ALLA HEM.",
    "playTogether": "SPELA TILLSAMMANS",
    "enRoute": "TÄVLING PÅGÅR",
    "roundDone": "SPELET ÄR SLUT",
    "deliveryDone": "RUNDAN ÄR SLUT",
    "finishHtml": "Bra jobbat!<br><em>Leveransen är klar!</em>",
    "parcels": "Paket: {count} / 12",
    "alarm": "LARM",
    "alarmLevel": "Larmnivå: {level} av {max}",
    "healthLabel": "Hälsa för P{id}: {health} av {max}",
    "wasted": "UTSLAGEN",
    "space": "MELLANSLAG",
    "controlsMove": "WASD / PILTANGENTER",
    "controlsShoot": "MELLANSLAG / R SHIFT · SKJUT",
    "controlsAct": "E / R CTRL · INTERAGERA",
    "jump": "Hoppa", "controlsJump": "L CTRL / END · HOPPA", "padX": "X · INTERAGERA", "padY": "Y · SKJUT",
    "controlsPadTouch": "HANDKONTROLL / PEKSKÄRM",
    "leftStick": "VÄNSTER SPAK",
    "dpad": "STYRKNAPPAR",
    "padA": "A · START / HOPPA / GAS",
    "padRT": "RT · SKJUT",
    "padB": "B · BROMS / BACKA",
    "touchStick": "PEKSTYRNING",
    "guard": "VAKT",
    "hospital": "SJUKHUS",
    "exit": "UTGÅNG",
    "market": "TORGET",
    "streetNight": "NATTGATAN",
    "streetMarket": "TORGGATAN",
    "streetPark": "PARKGATAN",
    "streetOld": "GAMLA GATAN",
    "respawn": "P{id} ÄR TILLBAKA FRÅN SJUKHUSET",
    "dead": "P{id} · UTSLAGEN{reason}",
    "damaged": "P{id} · {health}/{max} HÄLSA",
    "heart": "P{id} · +1 HJÄRTA",
    "carExploded": "BILEN EXPLODERADE",
    "cashConvoyArrived": "PENGATRANSPORTEN HAR ANLÄNT",
    "cashConvoyRobbed": "PENGATRANSPORTEN STOPPAD · SAMLA 500",
    "weaponShop": "VAPENBUTIK",
    "weaponShopPrice": "BAZOOKA · {price} $ · INTERAGERA",
    "bazookaName": "BAZOOKA",
    "bazookaBought": "P{id} · BAZOOKA KÖPT · 100 RAKETER",
    "bazookaEmpty": "P{id} · RAKETER SLUT · BAZOOKAN FÖRSVINNER",
    "bazookaAlreadyOwned": "P{id} · DU HAR REDAN EN BAZOOKA",
    "bazookaTooExpensive": "BAZOOKAN KOSTAR {price} $",
    "guardDown": "VAKTEN OSKADLIGGJORD",
    "guardStunned": "VAKTEN BEDÖVAD",
    "carDamaged": "BILEN SKADAD · {health}/{max}",
    "carHijacked": "FÖRAREN UTKASTAD · JAGAR BILEN",
    "carReclaimed": "FÖRAREN TOG TILLBAKA BILEN",
    "driverDamaged": "FÖRAREN SKADAD · {health}/{max} HP",
    "driverDown": "FÖRAREN UTSLAGEN",
    "hitByCar": "PÅKÖRD",
    "shot": "SKOTTSKADA",
    "explosion": "EXPLOSION",
    "replay": "Spela igen ↗",
    "connectionLost": "Anslutningen bröts",
    "reconnecting": "Servern svarar inte · återansluter...",
    "reconnectingTitle": "Återansluter",
    "reconnectingCopy": "Ansluter till rummet igen. Spelet fortsätter efter synkronisering.",
    "connectionLostCopy": "{error} Uppdatera sidan eller koppla från.",
    "rejectedByServer": "Servern avvisade anslutningen: {code}",
    "genericError": "fel",
    "roomActive": "Rummet är aktivt · väntar på spelare",
    "waitingForHost": "Ansluten · väntar på värden",
    "noHost": "Det finns ingen aktiv värd i rummet.",
    "roomFull": "Rummet är fullt (8 spelare).",
    "peerJoined": "Rummet är aktivt · en spelare anslöt",
    "peerLeft": "Rummet är aktivt · en spelare lämnade",
    "hostLeft": "Värden lämnade rummet.",
    "playingAs": "Ansluten · du spelar som P{id}",
    "joinRejected": "Du kunde inte gå med.",
    "socketError": "Kunde inte ansluta till WebSocket-servern.",
    "socketClosed": "Anslutningen till WebSocket-servern bröts.",
    "workerError": "Fel i värdens bakgrundstråd.",
    "socketStartError": "Kunde inte starta WebSocket-anslutningen.",
    "connectingServer": "Ansluter till servern...",
    "joiningRoom": "Ansluter till rummet",
    "joiningCopy": "Väntar på värden och att spelet ska synkroniseras.",
    "keyGenerationError": "Webbläsaren stöder inte säker generering av rumskoder.",
    "errorTitle": "Fel",
    "invalidKey": "Ange en rumskod med sex bokstäver (t.ex. ABCDEF) eller en länk.",
    "linkCopied": "Länken kopierad · dela den med dina vänner",
    "invalidLink": "Ogiltig länk",
    "invalidLinkCopy": "Rumskoden i länken är ogiltig."
  }
};
  const supported = new Set(['pl', 'sv']);
  const normalize = value => typeof value === 'string' && /^sv(?:-|$)/i.test(value) ? 'sv' : 'pl';
  let saved = '';
  try { saved = localStorage.getItem('nocny-kurs-language') || ''; } catch {}
  let current = supported.has(saved) ? saved : normalize(navigator.language);
  const listeners = new Set();

  function t(key, vars = {}) {
    const message = messages[current][key] ?? messages.pl[key] ?? key;
    return message.replace(/\{([a-zA-Z]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '');
  }

  function render() {
    document.documentElement.lang = current;
    document.title = t('pageTitle');
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = t(element.dataset.i18n);
    }
    for (const attr of ['aria-label', 'title', 'placeholder', 'content']) {
      const key = 'i18n' + attr.replace(/(^|-)([a-z])/g, (_, dash, c) => c.toUpperCase());
      for (const element of document.querySelectorAll('[data-' + key.replace(/[A-Z]/g, x => '-' + x.toLowerCase()) + ']')) {
        element.setAttribute(attr, t(element.dataset[key]));
      }
    }
    const picker = document.getElementById('language-select');
    if (picker) picker.value = current;
    const flag = document.getElementById('language-flag');
    if (flag) flag.textContent = current === 'sv' ? '🇸🇪' : '🇵🇱';
  }

  function setLocale(next) {
    if (!supported.has(next) || next === current) return;
    current = next;
    try { localStorage.setItem('nocny-kurs-language', next); } catch {}
    render();
    for (const callback of listeners) callback();
  }

  document.getElementById('language-select')?.addEventListener('change', event => {
    setLocale(event.target.value);
  });

  // The same controls remain in the top bar on every screen size.
  const dialog = document.getElementById('gt-settings-dialog');
  const settingsName = document.getElementById('gt-settings-name');
  const startName = document.getElementById('player-name-start');
  if (dialog && settingsName && startName) {
    document.getElementById('gt-settings-open').addEventListener('click', () => {
      settingsName.value = startName.value;
      dialog.showModal();
      // Clear any held keyboard/touch controls before editing settings.
      window.dispatchEvent(new Event('blur'));
    });
    document.getElementById('gt-settings-close').addEventListener('click', () => dialog.close());
    settingsName.addEventListener('input', () => {
      startName.value = settingsName.value;
      startName.dispatchEvent(new Event('input', { bubbles: true }));
    });
    dialog.addEventListener('keydown', event => event.stopPropagation());
  }
  render();
  window.NocnyKursLocale = {
    t, setLocale, render, onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    get locale() { return current; }
  };
})();
