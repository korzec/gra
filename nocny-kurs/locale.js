(() => {
  'use strict';
  const messages = {
  "pl": {
    "pageTitle": "Nocny Kurs — gra miejska",
    "description": "Nocny Kurs — wspólna, miejska gra arcade z widokiem z góry. Zbieraj przesyłki i nie zgub ekipy z oczu.",
    "back": "← EKRAN STARTOWY",
    "gameAria": "Gra Nocny Kurs",
    "canvasAria": "Widok z góry na nocne miasto",
    "wantedAria": "Poziom alarmu",
    "intro": "Zbierzcie 12 przesyłek i wróćcie w jednym kawałku.",
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
    "round": "12 PRZESYŁEK",
    "camera": "KADR",
    "ammo": "AMMO ∞",
    "bonus": "BONUS $",
    "deliveries": "PRZESYŁKI",
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
    "fire": "Strzał",
    "action": "Akcja",
    "footerMotto": "MAJĄC MAPĘ, NIKT NIE ZGINIE.",
    "playTogether": "GRAJ RAZEM",
    "enRoute": "EKIPA W DRODZE",
    "roundDone": "KURS DOWIEZIONY",
    "deliveryDone": "DOSTAWA KOMPLETNA",
    "finishHtml": "Dobra robota.<br><em>Kurs dowieziony!</em>",
    "parcels": "Paczki: {count} / 12",
    "alarm": "ALARM",
    "alarmLevel": "Poziom alarmu: {level} z {max}",
    "healthLabel": "Zdrowie P{id}: {health} z {max}",
    "wasted": "WASTED",
    "space": "SPACJA",
    "controlsMove": "WASD / STRZAŁKI",
    "controlsShoot": "Q · STRZAŁ",
    "controlsAct": "E · AKCJA",
    "controlsPadTouch": "PAD / DOTYK",
    "leftStick": "LEWY DRĄŻEK",
    "dpad": "KRZYŻAK",
    "padA": "A · START / STRZAŁ",
    "padRT": "RT · STRZAŁ",
    "padB": "B · AKCJA",
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
    "guardDown": "OCHRONA ROZBROJONA",
    "guardStunned": "STRAŻNIK OGŁUSZONY",
    "carDamaged": "AUTO USZKODZONE · {health}/3",
    "hitByCar": "POTRĄCENIE",
    "shot": "POSTRZAŁ",
    "explosion": "WYBUCH",
    "replay": "Zagraj ponownie ↗",
    "connectionLost": "Połączenie przerwane",
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
    "pageTitle": "Nocny Kurs — stadsspel",
    "description": "Nocny Kurs — ett gemensamt arkadspel i en nattlig stad sett uppifrån. Samla paket och håll ihop laget.",
    "back": "← STARTSKÄRM",
    "gameAria": "Spelet Nattbudet",
    "canvasAria": "Vy uppifrån över en stad på natten",
    "wantedAria": "Larmnivå",
    "intro": "Samla 12 paket och ta er tillbaka helskinnade.",
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
    "round": "12 PAKET",
    "camera": "VY",
    "ammo": "AMMUNITION ∞",
    "bonus": "BONUS $",
    "deliveries": "PAKET",
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
    "fire": "Skjut",
    "action": "Interagera",
    "footerMotto": "MED EN KARTA HITTAR ALLA HEM.",
    "playTogether": "SPELA TILLSAMMANS",
    "enRoute": "LAGET ÄR PÅ VÄG",
    "roundDone": "UPPDRAG SLUTFÖRT",
    "deliveryDone": "LEVERANSEN KLAR",
    "finishHtml": "Bra jobbat!<br><em>Leveransen är klar!</em>",
    "parcels": "Paket: {count} / 12",
    "alarm": "LARM",
    "alarmLevel": "Larmnivå: {level} av {max}",
    "healthLabel": "Hälsa för P{id}: {health} av {max}",
    "wasted": "UTSLAGEN",
    "space": "MELLANSLAG",
    "controlsMove": "WASD / PILTANGENTER",
    "controlsShoot": "Q · SKJUT",
    "controlsAct": "E · INTERAGERA",
    "controlsPadTouch": "HANDKONTROLL / PEKSKÄRM",
    "leftStick": "VÄNSTER SPAK",
    "dpad": "STYRKNAPPAR",
    "padA": "A · START / SKJUT",
    "padRT": "RT · SKJUT",
    "padB": "B · INTERAGERA",
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
    "guardDown": "VAKTEN OSKADLIGGJORD",
    "guardStunned": "VAKTEN BEDÖVAD",
    "carDamaged": "BILEN SKADAD · {health}/3",
    "hitByCar": "PÅKÖRD",
    "shot": "SKOTTSKADA",
    "explosion": "EXPLOSION",
    "replay": "Spela igen ↗",
    "connectionLost": "Anslutningen bröts",
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
  render();
  window.NocnyKursLocale = {
    t, setLocale, render, onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    get locale() { return current; }
  };
})();
