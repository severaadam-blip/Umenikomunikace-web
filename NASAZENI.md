# Nasazení webu umenikomunikace.com na Cloudflare

## Co je v balíčku
- `index.html`: celý web (jedna stránka)
- `_worker.js`: obsluha formuláře. Zprávy chodí na severa.adam@gmail.com, m.severa56@gmail.com a m.severa@seznam.cz
- `site-config.js`: jediný soubor s nastavením (Google Analytics a Turnstile)
- `fonts/`, `images/`, `logo/`: písma (hostovaná přímo na webu), fotky, logo
- `favicon.svg`, `apple-touch-icon.png`, `og-image.png`: ikony a náhled při sdílení
- `robots.txt`, `sitemap.xml`, `_headers`: SEO a zabezpečení

## 1. Cloudflare Pages
1. Účet na cloudflare.com, poté Workers & Pages, Create, Pages.
2. Doporučeno: nahrát složku do GitHub repozitáře a zvolit Connect to Git. Build příkaz nechte prázdný, výstupní složka je `/`. Další úpravy se pak nasadí samy.
3. Alternativa: `npx wrangler pages deploy .` ve složce webu.
4. Web poběží na adrese `něco.pages.dev`. Na ní vše vyzkoušejte, než se přepne doména.

Formulář běží přes soubor `_worker.js`. Nahrání složky přetažením v administraci jsem neověřil, proto doporučuji GitHub nebo Wrangler.

## 2. Odesílání formuláře (Resend)
1. Účet na resend.com (bezplatný tarif stačí).
2. Domains, přidat `umenikomunikace.com`. Resend ukáže DNS záznamy (SPF, DKIM). Až bude doména na Cloudflare, vloží se jedním klikem.
3. API Keys, vytvořit klíč.
4. V Pages: Settings, Variables and Secrets. Přidat:
   - `RESEND_API_KEY` (Secret): klíč z Resend
   - `MAIL_FROM` (Text): `Umění komunikace <web@umenikomunikace.com>`
5. Dokud není doména v Resend ověřená, e-maily se odeslat nepodaří a formulář ukáže chybu.

## 3. Ochrana proti robotům (Turnstile, zdarma)
1. Cloudflare, Turnstile, Add widget, doména `umenikomunikace.com` (a `pages.dev` pro test).
2. Site key vložit do `site-config.js` do `TURNSTILE_SITE_KEY`.
3. Secret key přidat v Pages jako `TURNSTILE_SECRET` (Secret).
Bez těchto klíčů formulář funguje, jen s jednodušší ochranou (skryté pole proti robotům).

## 4. Google Analytics
1. Vytvořit vlastnost v Google Analytics 4 a zkopírovat ID měření (`G-...`).
2. Vložit do `site-config.js` do `GA_MEASUREMENT_ID`.
3. Po vložení se na webu objeví lišta cookies. Analytika se spustí až po souhlasu návštěvníka. V patičce je odkaz Nastavení cookies.

## 5. Po přepnutí domény
- Google Search Console: ověřit doménu a odeslat `https://www.umenikomunikace.com/sitemap.xml`.
- Přesměrování `umenikomunikace.com` na `www.umenikomunikace.com` (Cloudflare, Rules, Redirect Rules).
- Otestovat sdílení odkazu (Facebook, LinkedIn) a rychlost (PageSpeed Insights).

## Úpravy obsahu
Texty jsou přímo v `index.html`. Fotky se vyměňují v `images/` (zachovejte název a formát WebP).
