Co-authored-by: David Kral alter ego

# Shoptet Adresní Našeptávač

Integrovaný systém pro automatické doplňování adres, validaci IČO a kontaktních údajů pro e-commerce platformu Shoptet.

## Recommended for production

Podporovaná `production installation` pro živý Shoptet obchod používá `backend proxy`.

Tok požadavku pro produkci je:

1. Shoptet stránka načte `browser script` `naseptavac-shoptet.js`
2. `browser script` volá backend endpoint obchodníka `/suggest`
3. `backend proxy` doplní `MAPY_CZ_API_KEY` na serveru a odešle požadavek do Mapy.cz

Pro produkci proto platí:

- prohlížeč nevolá `https://api.mapy.cz/v1/suggest` přímo
- `MAPY_CZ_API_KEY` existuje jen v backendu, nikdy ne ve storefront JavaScriptu
- podporovaná cesta pro živý obchod zahrnuje CORS allowlist přes `ALLOWED_ORIGINS` a rate limiting v backendu

Pokud provozujete live shop, začněte vždy `production installation via backend proxy`. Detailní deployment postup je v [backend/README.md](backend/README.md).
Pokud backend hosting nemáte, přímé browser volání berte pouze jako `Development / quick demo only`, ne jako podporovanou produkční cestu.
Aktuální verze repozitáře ale ještě nedodává samostatný přepínač backend endpointu v `naseptavac-shoptet.js`, takže produkční nasazení vyžaduje upravit volání v tomto souboru.

## Funkce

### 🗺️ Adresní našeptávač
- Napojení na Mapy.cz API pro vyhledávání adres
- Automatické doplnění ulic, měst a PSČ
- Podpora více sekcí (fakturační/doručovací adresa)
- Vizuální indikace validovaných polí

### 🏢 ARES validátor
- Automatické načtení firemních údajů podle IČO
- Validace správnosti IČO
- Doplnění DIČ, názvu firmy a adresy

### ✉️ Validátor kontaktů
- Kontrola formátu e-mailové adresy
- Kontrola formátu telefonních čísel (CZ/SK)

## Production installation

Pro produkční nasazení nepoužívejte přímé vložení `Mapy.cz API key` do `browser script`.

1. Nasaďte `backend proxy` podle [backend/README.md](backend/README.md).
2. V backendu nastavte `MAPY_CZ_API_KEY`, `ALLOWED_ORIGINS` a další proměnné v `backend/.env`.
3. Upravte aktuální `browser script`, aby místo přímého volání `https://api.mapy.cz/v1/suggest` volal váš backend `/suggest` endpoint.
4. Nahrajte `naseptavac-shoptet.js` do Shoptetu a vložte ho do zápatí:
   - nahrajte `naseptavac-shoptet.js` do libovolné složky
   - zkopírujte výslednou URL souboru
   - v administraci přejděte na `Vzhled a obsah -> Editor -> HTML kód -> zápatí`
   - vložte `<script src="URL_ADRESA_KTEROU_JSTE_SI_ULOZILI"></script>`

Produkční `browser request target` je vždy váš backend `/suggest` endpoint. `backend proxy` pak do Mapy.cz přeposílá jen povolené parametry `query`, `lang`, `limit`, `type`, `locality`.

## Konfigurace

V aktuálním stavu repozitáře `naseptavac-shoptet.js` stále obsahuje přímé volání Mapy.cz a placeholder `API_KEY`. Repo zatím neposkytuje hotový backend base URL přepínač.

Pro `production installation` proto upravte přímo volání v `naseptavac-shoptet.js` tak, aby `browser script` posílal request na váš backend `/suggest` endpoint. `Mapy.cz API key` nastavujte jen na backendu.

Příklady:

- lokální vývojový target po úpravě skriptu: `http://localhost:3001/suggest`
- produkční target po úpravě skriptu: `https://vas-backend.example/suggest`

## Migration note

Pokud jste vycházeli ze starší verze README, migrujte instalaci takto:

- přestaňte vkládat `MAPY_CZ_API_KEY` do `naseptavac-shoptet.js`
- nahraďte přímé volání Mapy.cz v `naseptavac-shoptet.js` vlastním backend `/suggest` endpointem
- na backendu nastavte `ALLOWED_ORIGINS` na domény vašeho Shoptet storefrontu

## Development / quick demo only

Přímé browser volání Mapy.cz s klíčem vloženým do JavaScriptu ponechávejte maximálně pro krátký lokální test nebo rychlé demo. Není to doporučená ani podporovaná `production installation`, protože vystavuje `Mapy.cz API key` v klientském kódu.

## Kompatibilita

- Shoptet platforma (verze 3.0.0+)
- Moderní prohlížeče (Chrome, Firefox, Safari, Edge)
- Responsivní design

## Výkon a optimalizace

- Skript se načítá pouze na stránce objednávky (krok 2)
- Využívá cache pro opakované vyhledávání
- Debouncing vstupů (300ms) pro snížení počtu API volání

## Přispívání

Příspěvky jsou vítány! Prosím:
1. Forkněte repozitář
2. Vytvořte feature branch (`git checkout -b feature/nova-funkce`)
3. Commitujte změny (`git commit -am 'Přidání nové funkce'`)
4. Pushněte branch (`git push origin feature/nova-funkce`)
5. Vytvořte Pull Request

## Licence

MIT License - viz [LICENSE](LICENSE) soubor nebo hlavička v kódu.

Software je poskytován zdarma pro jakékoliv použití včetně komerčního.
