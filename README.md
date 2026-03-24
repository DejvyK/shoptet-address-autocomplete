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

1. Získejte API klíč pro Mapy.cz na https://api.mapy.cz/
2. V souboru `naseptavac-shoptet.js` nahraďte `YOUR_MAPY_CZ_API_KEY` vaším klíčem
3. Vložení do Shoptetu:
   - Stáhněte si soubor naseptavac-shoptet.js , pomocí správce souborů ho vložte do libovolné složky a pravým kliknutím si nechejte zobrazit URL adresu --> tu si zkopírujte
   - Administrace → Vzhled a obsah → Editor --> HTML kód --> zápatí 
   - Vložte ---->        <script src="URL_ADRESA_KTEROU_JSTE_SI_ULOZILI"></script>

## Konfigurace

```javascript
// Základní použití
 const API_KEY = 'YOUR_MAPY_CZ_API_KEY'; // Získejte klíč na https://api.mapy.cz/
```

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
