# Hughes Living Capital

The real estate arm of the Hughes companies — a static site plus a working
underwriting sheet. Property acquired for our own account, funded by operating
revenue from furniture retail, procurement, lockers, and auctions.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Thesis, the capital engine, the eight-strategy ladder, the furniture advantage, buy box, contact |
| `underwrite.html` | Deal calculator — flip, long-term rental, short-term rental, commercial — plus a saved pipeline |

## Underwriting sheet

Four strategies share one form renderer and one results panel
(`assets/js/underwrite.js`). Fields, defaults, and the math for each strategy
live in the `STRATEGIES` object; everything recalculates on input.

- **Rehab & resale** — 70% MAO, hard-money carry, points, selling costs, net
  spread, return on cash, annualized.
- **Long-term rental** — amortized P&I, NOI, cap rate on basis, cash-on-cash,
  DSCR, rent-to-price.
- **Short-term rental** — nights and turns from occupancy, cleaning in and out,
  platform fees, and a furnishing line that prices retail against our wholesale
  cost basis.
- **Commercial** — EGI, expense ratio, NOI, going-in cap, DSCR, value at market
  cap, equity created.

Each run is scored against the published buy box and returns a verdict
(clears / second look / pass) with the reasons spelled out.

The pipeline is stored in `localStorage` under `hlc-pipeline-v1` — this browser
only, nothing uploaded. Export to CSV before clearing browser data.

## Design

- Palette: ink `#14181c`, paper `#f3f0ea`, brick `#9c3d20`, slate `#4a5560`,
  moss `#2f5d4a`, line `#d5cfc3`.
- Type: Fraunces (display) / Inter Tight (body) / IBM Plex Mono (figures).
- Direction: a property record and underwriting sheet — ruled ledger rows,
  tabular figures, no marketing gloss.

## Local preview

```
py -m http.server 8754 --directory C:/Users/JayHu/Sites/hughes-living-capital
```

Registered in `.claude/launch.json` as `hughes-living-capital`.

## Honesty rules for this site

The company is in its acquisition phase. Nothing on the site claims a track
record — the hero panel carries the **buy box** (criteria) rather than doors
owned or dollars deployed. The footer states plainly that the site is not an
offer of securities and not investment advice, and the calculator is labeled an
estimating tool. Keep it that way as the portfolio grows: replace criteria with
results only when there are real results to show.

## To do

- Register the entity and put the real legal name, address, and phone in the
  contact section and footer.
- Replace `jhughes281@gmail.com` with a company address once DNS is sorted.
- Decide whether this sits under Hughes Strategic Group or as a peer holding
  company, and reflect that in the footer.
- Add a deal-submission form (Formspree or similar) if email alone gets noisy.
- Push to GitHub as `hughes-living-capital` and enable Pages.
