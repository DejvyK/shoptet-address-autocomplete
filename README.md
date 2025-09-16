# Shoptet Adresní Našeptávač

Integrovaný systém pro automatické doplňování adres, validaci IČO a kontaktních údajů pro e-commerce platformu Shoptet.

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
- kontrola formátu telefonních čísel (CZ/SK)

## Instalace

1. Získejte AP
I klíč pro Mapy.cz na https://api.mapy.cz/
2. V souboru `naseptavac-shoptet.js` nahraďte `YOUR_MAPY_CZ_API_KEY` vaším klíčem
3. Vložte skript do šablony Shoptetu (stránka objednávky - krok 2)

## Konfigurace

```javascript
// Základní použití
 const API_KEY = 'YOUR_MAPY_CZ_API_KEY'; // Získejte klíč na https://api.mapy.cz/
```

## Kompatibilita

- Shoptet platforma
- Moderní prohlížeče (Chrome, Firefox, Safari, Edge)
- Responsivní design

## Licence

MIT License - viz [LICENSE](LICENSE) soubor nebo hlavička v kódu.

Software je poskytován zdarma pro jakékoliv použití včetně komerčního.