/* =========================================================
   Hughes Living Capital — underwriting sheet
   Four strategies, one form renderer, one results panel.
   No dependencies. Pipeline persists to localStorage only.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- formatting ---------- */

  var usd0 = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });

  function money(n) {
    if (!isFinite(n)) return '—';
    return usd0.format(Math.round(n));
  }
  function pct(n, d) {
    if (!isFinite(n)) return '—';
    return (n * 100).toFixed(d === undefined ? 1 : d) + '%';
  }
  function ratio(n) {
    if (!isFinite(n)) return '∞';
    return n.toFixed(2) + '×';
  }
  function whole(n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  /* Monthly payment on an amortizing loan. */
  function pmt(principal, annualRatePct, years) {
    var n = years * 12;
    if (principal <= 0 || n <= 0) return 0;
    var r = annualRatePct / 100 / 12;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  /* ---------- field + strategy definitions ---------- */

  function f(id, label, unit, def, hint) {
    return { id: id, label: label, unit: unit, def: def, hint: hint };
  }

  var STRATEGIES = {

    flip: {
      tab: 'Rehab & resale',
      title: 'Rehab & resale',
      tag: 'Flip',
      groups: [
        { legend: 'Acquisition', fields: [
          f('purchase', 'Purchase price', 'usd', 172000),
          f('rehab', 'Rehab budget', 'usd', 58000),
          f('arv', 'After-repair value', 'usd', 320000, 'What it sells for, finished'),
          f('buyClosePct', 'Buying closing costs', 'pct', 2, '% of purchase price')
        ]},
        { legend: 'Financing', fields: [
          f('ltcPct', 'Loan-to-cost', 'pct', 85, '% of purchase + rehab'),
          f('ratePct', 'Interest rate', 'pct', 11.5, 'Hard money, interest only'),
          f('pointsPct', 'Points', 'pct', 2, '% of loan, paid at close')
        ]},
        { legend: 'Carry & exit', fields: [
          f('holdMonths', 'Holding period', 'num', 6, 'Months, purchase to closing'),
          f('carryMonthly', 'Monthly carry', 'usd', 550, 'Taxes, insurance, utilities'),
          f('sellPct', 'Selling costs', 'pct', 8, '% of ARV — commission + closing')
        ]}
      ],
      compute: function (v) {
        var basis = v.purchase + v.rehab;
        var loan = Math.max(0, basis * v.ltcPct / 100);
        var downCash = Math.max(0, basis - loan);
        var buyClose = v.purchase * v.buyClosePct / 100;
        var points = loan * v.pointsPct / 100;
        var interest = loan * (v.ratePct / 100 / 12) * v.holdMonths;
        var carry = v.carryMonthly * v.holdMonths;
        var sellCosts = v.arv * v.sellPct / 100;

        var totalCost = v.purchase + v.rehab + buyClose + points + interest + carry + sellCosts;
        var profit = v.arv - totalCost;
        var cashIn = downCash + buyClose + points + interest + carry;
        var roi = cashIn > 0 ? profit / cashIn : NaN;
        var annualized = (isFinite(roi) && v.holdMonths > 0) ? roi * (12 / v.holdMonths) : NaN;

        var mao = 0.70 * v.arv - v.rehab;
        var spread = mao - v.purchase;

        var rows = [
          { k: 'Max allowable offer (70%)', v: money(mao), major: true },
          { k: 'Your offer vs. MAO', v: (spread >= 0 ? '+' : '') + money(spread), cls: spread >= 0 ? 'pos' : 'neg' },
          { k: 'Loan amount', v: money(loan) },
          { k: 'Interest + points', v: money(interest + points) },
          { k: 'Carry for ' + whole(v.holdMonths) + ' mo', v: money(carry) },
          { k: 'Selling costs', v: money(sellCosts) },
          { k: 'Total project cost', v: money(totalCost) },
          { k: 'Cash out of pocket', v: money(cashIn), major: true },
          { k: 'Net profit', v: money(profit), cls: profit >= 0 ? 'pos' : 'neg', major: true },
          { k: 'Return on cash', v: pct(roi) },
          { k: 'Annualized', v: pct(annualized) }
        ];

        var why = [];
        var state;
        if (v.arv <= 0 || v.purchase <= 0) {
          state = 'idle';
          why.push('Enter a purchase price and an ARV to score this deal.');
        } else {
          if (spread >= 0) why.push('Offer is ' + money(spread) + ' under the 70% rule.');
          else why.push('Offer is ' + money(-spread) + ' over the 70% rule.');

          if (profit >= 35000) why.push('Clears the $35,000 spread floor.');
          else why.push('Net profit is ' + money(35000 - profit) + ' short of the $35,000 floor.');

          if (isFinite(annualized)) why.push('Annualized return on cash: ' + pct(annualized) + '.');

          if (profit >= 35000 && spread >= 0) state = 'pass';
          else if (profit >= 20000) state = 'watch';
          else state = 'fail';
        }

        return {
          rows: rows,
          state: state,
          why: why,
          summary: { label: 'Net profit', value: money(profit) }
        };
      }
    },

    rental: {
      tab: 'Rental',
      title: 'Long-term rental',
      tag: 'SFR / MF',
      groups: [
        { legend: 'Acquisition', fields: [
          f('purchase', 'Purchase price', 'usd', 145000),
          f('rehab', 'Rehab / make-ready', 'usd', 10000),
          f('closePct', 'Closing costs', 'pct', 3, '% of purchase price')
        ]},
        { legend: 'Financing', fields: [
          f('downPct', 'Down payment', 'pct', 25, '% of purchase price'),
          f('ratePct', 'Interest rate', 'pct', 7.25),
          f('termYears', 'Loan term', 'num', 30, 'Years')
        ]},
        { legend: 'Income (monthly)', fields: [
          f('rentMonthly', 'Gross rent', 'usd', 2150, 'All units combined'),
          f('otherMonthly', 'Other income', 'usd', 0, 'Laundry, storage, pet rent')
        ]},
        { legend: 'Fixed expenses', fields: [
          f('taxes', 'Property taxes', 'usd', 3400, 'Per year — check the county, not the listing'),
          f('insurance', 'Insurance', 'usd', 2000, 'Per year'),
          f('hoaMonthly', 'HOA', 'usd', 0, 'Per month')
        ]},
        { legend: 'Reserves — % of gross rent', cols3: true, fields: [
          f('vacPct', 'Vacancy', 'pct', 7),
          f('maintPct', 'Maintenance', 'pct', 8),
          f('capexPct', 'CapEx', 'pct', 8),
          f('mgmtPct', 'Management', 'pct', 0, 'Use 8 if you hire a manager')
        ]}
      ],
      compute: function (v) {
        var loan = v.purchase * (1 - v.downPct / 100);
        var downAmt = v.purchase - loan;
        var closing = v.purchase * v.closePct / 100;
        var cashIn = downAmt + v.rehab + closing;

        var pi = pmt(loan, v.ratePct, v.termYears);
        var gsi = (v.rentMonthly + v.otherMonthly) * 12;
        var vacancy = gsi * v.vacPct / 100;
        var egi = gsi - vacancy;
        var reserves = gsi * (v.maintPct + v.capexPct + v.mgmtPct) / 100;
        var opex = v.taxes + v.insurance + v.hoaMonthly * 12 + reserves;
        var noi = egi - opex;
        var ds = pi * 12;
        var cf = noi - ds;

        var basis = v.purchase + v.rehab;
        var cap = basis > 0 ? noi / basis : NaN;
        var coc = cashIn > 0 ? cf / cashIn : NaN;
        var dscr = ds > 0 ? noi / ds : Infinity;
        var onePct = basis > 0 ? v.rentMonthly / basis : NaN;

        var rows = [
          { k: 'Monthly P&I', v: money(pi) },
          { k: 'Gross scheduled income', v: money(gsi) },
          { k: 'Vacancy loss', v: '−' + money(vacancy) },
          { k: 'Operating expenses', v: '−' + money(opex) },
          { k: 'Net operating income', v: money(noi), major: true },
          { k: 'Annual debt service', v: '−' + money(ds) },
          { k: 'Cash flow / year', v: money(cf), cls: cf >= 0 ? 'pos' : 'neg', major: true },
          { k: 'Cash flow / month', v: money(cf / 12), cls: cf >= 0 ? 'pos' : 'neg' },
          { k: 'Cash out of pocket', v: money(cashIn), major: true },
          { k: 'Cap rate on basis', v: pct(cap) },
          { k: 'Cash-on-cash', v: pct(coc), cls: coc >= 0.10 ? 'pos' : '', major: true },
          { k: 'DSCR', v: ratio(dscr) },
          { k: 'Rent-to-price', v: pct(onePct, 2) }
        ];

        var why = [];
        var state;
        if (v.purchase <= 0 || v.rentMonthly <= 0) {
          state = 'idle';
        } else {
          if (cf > 0) why.push('Positive cash flow of ' + money(cf / 12) + ' a month.');
          else why.push('Negative cash flow of ' + money(-cf / 12) + ' a month.');

          why.push(coc >= 0.10
            ? 'Cash-on-cash of ' + pct(coc) + ' clears the 10% floor.'
            : 'Cash-on-cash of ' + pct(coc) + ' is under the 10% floor.');

          why.push(dscr >= 1.25
            ? 'DSCR of ' + ratio(dscr) + ' would satisfy most lenders.'
            : 'DSCR of ' + ratio(dscr) + ' is thin — expect lender pushback.');

          if (cf > 0 && coc >= 0.10 && dscr >= 1.25) state = 'pass';
          else if (cf > 0) state = 'watch';
          else state = 'fail';
        }

        return {
          rows: rows,
          state: state,
          why: why,
          summary: { label: 'Cash-on-cash', value: pct(coc) }
        };
      }
    },

    coliving: {
      tab: 'Co-living',
      title: 'Co-living, rent by the room',
      tag: 'PadSplit',
      groups: [
        { legend: 'Acquisition', fields: [
          f('purchase', 'Purchase price', 'usd', 165000),
          f('conversion', 'Conversion cost', 'usd', 24000, 'Framing, doors, locks, egress'),
          f('closePct', 'Closing costs', 'pct', 3, '% of purchase price')
        ]},
        { legend: 'The rooms', cols3: true, fields: [
          f('rooms', 'Rooms after conversion', 'num', 6),
          f('weeklyRent', 'Rent per room', 'usd', 165, 'Per week, utilities included'),
          f('occPct', 'Room occupancy', 'pct', 88, 'Across the full year'),
          f('tenancyMonths', 'Average tenancy', 'num', 7, 'Months a member stays')
        ]},
        { legend: 'Furnishing \u2014 the Hughes Living line', fields: [
          f('furnRetailRoom', 'Furnishing at retail', 'usd', 1000, 'Per room. PadSplit budgets $1,000'),
          f('costBasisPct', 'Our cost basis', 'pct', 45, '% of retail, from the warehouse')
        ]},
        { legend: 'Platform', fields: [
          f('platformPct', 'Ongoing fee', 'pct', 8, '% of rent collected'),
          f('placementDays', 'Placement fee', 'num', 10, 'Days of rent kept per new member')
        ]},
        { legend: 'Financing', fields: [
          f('downPct', 'Down payment', 'pct', 25, '% of purchase price'),
          f('ratePct', 'Interest rate', 'pct', 7.5),
          f('termYears', 'Loan term', 'num', 30, 'Years')
        ]},
        { legend: 'Fixed expenses', fields: [
          f('taxes', 'Property taxes', 'usd', 3600, 'Per year'),
          f('insurance', 'Insurance', 'usd', 2400, 'Per year'),
          f('utilitiesMonthly', 'Utilities + internet', 'usd', 520, 'Per month, and uncapped'),
          f('hoaMonthly', 'HOA', 'usd', 0, 'Per month')
        ]},
        { legend: 'Reserves \u2014 % of rent collected', cols3: true, fields: [
          f('maintPct', 'Maintenance', 'pct', 10, 'Six tenants, one kitchen'),
          f('capexPct', 'CapEx', 'pct', 8),
          f('mgmtPct', 'Local management', 'pct', 0, 'Use 5 if someone walks the house')
        ]}
      ],
      compute: function (v) {
        var furnCostRoom = v.furnRetailRoom * v.costBasisPct / 100;
        var furnCost = furnCostRoom * v.rooms;
        var furnSaved = (v.furnRetailRoom - furnCostRoom) * v.rooms;

        var loan = v.purchase * (1 - v.downPct / 100);
        var downAmt = v.purchase - loan;
        var closing = v.purchase * v.closePct / 100;
        var cashIn = downAmt + v.conversion + closing + furnCost;

        var gsi = v.rooms * v.weeklyRent * 52;
        var vacancy = gsi * (1 - v.occPct / 100);
        var collected = gsi - vacancy;

        /* PadSplit keeps the first N days of each new member's rent, so the
           bill scales with turnover, not just with rent. Only filled rooms
           turn over, hence the occupancy factor. */
        var turnsPerRoom = v.tenancyMonths > 0 ? 12 / v.tenancyMonths : 0;
        var placements = turnsPerRoom * v.rooms * v.occPct / 100;
        var placementFee = placements * v.weeklyRent * v.placementDays / 7;
        var platformFee = collected * v.platformPct / 100;

        var reserves = collected * (v.maintPct + v.capexPct + v.mgmtPct) / 100;
        var opex = v.taxes + v.insurance + (v.utilitiesMonthly + v.hoaMonthly) * 12 + reserves;

        var noi = collected - placementFee - platformFee - opex;
        var pi = pmt(loan, v.ratePct, v.termYears);
        var ds = pi * 12;
        var cf = noi - ds;

        var basis = v.purchase + v.conversion + furnCost;
        var cap = basis > 0 ? noi / basis : NaN;
        var coc = cashIn > 0 ? cf / cashIn : NaN;
        var dscr = ds > 0 ? noi / ds : Infinity;
        var perRoom = v.rooms > 0 ? collected / v.rooms / 12 : NaN;
        var take = collected > 0 ? (placementFee + platformFee) / collected : NaN;

        var rows = [
          { k: 'Monthly P&I', v: money(pi) },
          { k: 'Gross scheduled income', v: money(gsi) },
          { k: 'Vacancy loss', v: '−' + money(vacancy) },
          { k: 'Placement fees', v: '−' + money(placementFee) },
          { k: 'Platform fees', v: '−' + money(platformFee) },
          { k: 'Operating expenses', v: '−' + money(opex) },
          { k: 'Net operating income', v: money(noi), major: true },
          { k: 'Annual debt service', v: '−' + money(ds) },
          { k: 'Cash flow / year', v: money(cf), cls: cf >= 0 ? 'pos' : 'neg', major: true },
          { k: 'Cash flow / month', v: money(cf / 12), cls: cf >= 0 ? 'pos' : 'neg' },
          { k: 'Rent / room / month', v: money(perRoom) },
          { k: 'Furnishing at our cost', v: money(furnCost) },
          { k: 'Saved vs. retail', v: '+' + money(furnSaved), cls: 'pos' },
          { k: 'Cash out of pocket', v: money(cashIn), major: true },
          { k: 'Cap rate on basis', v: pct(cap) },
          { k: 'Cash-on-cash', v: pct(coc), cls: coc >= 0.14 ? 'pos' : '', major: true },
          { k: 'DSCR', v: ratio(dscr) }
        ];

        var why = [];
        var state;
        if (v.purchase <= 0 || v.rooms <= 0 || v.weeklyRent <= 0) {
          state = 'idle';
        } else {
          why.push(whole(v.rooms) + ' rooms at ' + money(v.weeklyRent) +
            ' a week collect ' + money(collected) + ' a year at ' + pct(v.occPct / 100, 0) + ' full.');

          why.push('Furnishing from the warehouse keeps ' + money(furnSaved) + ' in the deal.');

          if (isFinite(take)) {
            why.push('PadSplit takes ' + pct(take) + ' of what you collect, placement fees included.');
          }

          why.push(cf > 0
            ? 'Positive cash flow of ' + money(cf / 12) + ' a month.'
            : 'Negative cash flow of ' + money(-cf / 12) + ' a month.');

          why.push(coc >= 0.14
            ? 'Cash-on-cash of ' + pct(coc) + ' clears the 14% co-living floor.'
            : 'Cash-on-cash of ' + pct(coc) + ' is under the 14% co-living floor.');

          why.push('Deed restrictions and occupancy limits decide this one, not the arithmetic. Check the address before you close.');

          if (cf > 0 && coc >= 0.14 && dscr >= 1.25) state = 'pass';
          else if (cf > 0) state = 'watch';
          else state = 'fail';
        }

        return {
          rows: rows,
          state: state,
          why: why,
          summary: { label: 'Cash-on-cash', value: pct(coc) }
        };
      }
    },

    str: {
      tab: 'Short-term',
      title: 'Short-term rental',
      tag: 'STR',
      groups: [
        { legend: 'Acquisition', fields: [
          f('purchase', 'Purchase price', 'usd', 235000),
          f('rehab', 'Rehab', 'usd', 12000),
          f('closePct', 'Closing costs', 'pct', 3, '% of purchase price')
        ]},
        { legend: 'Furnishing — the Hughes Living line', fields: [
          f('furnRetail', 'Furnishing at retail', 'usd', 28000, 'What anyone else would pay'),
          f('costBasisPct', 'Our cost basis', 'pct', 55, '% of retail, buying wholesale')
        ]},
        { legend: 'Financing', fields: [
          f('downPct', 'Down payment', 'pct', 25, '% of purchase price'),
          f('ratePct', 'Interest rate', 'pct', 7.5),
          f('termYears', 'Loan term', 'num', 30, 'Years')
        ]},
        { legend: 'Bookings', cols3: true, fields: [
          f('adr', 'Average daily rate', 'usd', 215),
          f('occPct', 'Occupancy', 'pct', 70, 'Across the full year'),
          f('avgStayNights', 'Nights per stay', 'num', 3),
          f('cleanFee', 'Cleaning fee charged', 'usd', 135, 'Per stay'),
          f('cleanCost', 'Cleaning cost', 'usd', 95, 'Per turn, what you pay'),
          f('platformPct', 'Platform fee', 'pct', 3, 'Host share, % of revenue')
        ]},
        { legend: 'Fixed expenses', fields: [
          f('taxes', 'Property taxes', 'usd', 5400, 'Per year'),
          f('insurance', 'Insurance', 'usd', 3000, 'Per year — STR policy'),
          f('utilitiesMonthly', 'Utilities + internet', 'usd', 340, 'Per month'),
          f('hoaMonthly', 'HOA', 'usd', 0, 'Per month')
        ]},
        { legend: 'Reserves — % of revenue', cols3: true, fields: [
          f('mgmtPct', 'Management', 'pct', 10, 'Co-host split; 20% full service'),
          f('maintPct', 'Maintenance', 'pct', 6),
          f('capexPct', 'CapEx + resupply', 'pct', 6)
        ]}
      ],
      compute: function (v) {
        var furnCost = v.furnRetail * v.costBasisPct / 100;
        var furnSaved = v.furnRetail - furnCost;

        var loan = v.purchase * (1 - v.downPct / 100);
        var downAmt = v.purchase - loan;
        var closing = v.purchase * v.closePct / 100;
        var cashIn = downAmt + v.rehab + closing + furnCost;

        var nights = 365 * v.occPct / 100;
        var turns = v.avgStayNights > 0 ? nights / v.avgStayNights : 0;
        var rentalRev = v.adr * nights;
        var cleanRev = v.cleanFee * turns;
        var gross = rentalRev + cleanRev;

        var platform = gross * v.platformPct / 100;
        var cleaning = v.cleanCost * turns;
        var reserves = gross * (v.mgmtPct + v.maintPct + v.capexPct) / 100;
        var opex = v.taxes + v.insurance + v.hoaMonthly * 12 + v.utilitiesMonthly * 12 + cleaning + reserves;

        var noi = gross - platform - opex;
        var pi = pmt(loan, v.ratePct, v.termYears);
        var ds = pi * 12;
        var cf = noi - ds;

        var basis = v.purchase + v.rehab + furnCost;
        var cap = basis > 0 ? noi / basis : NaN;
        var coc = cashIn > 0 ? cf / cashIn : NaN;
        var dscr = ds > 0 ? noi / ds : Infinity;

        var rows = [
          { k: 'Nights booked / year', v: whole(nights) + ' · ' + whole(turns) + ' turns' },
          { k: 'Gross revenue', v: money(gross), major: true },
          { k: 'Platform fees', v: '−' + money(platform) },
          { k: 'Cleaning cost', v: '−' + money(cleaning) },
          { k: 'Other operating expenses', v: '−' + money(opex - cleaning) },
          { k: 'Net operating income', v: money(noi), major: true },
          { k: 'Annual debt service', v: '−' + money(ds) },
          { k: 'Cash flow / year', v: money(cf), cls: cf >= 0 ? 'pos' : 'neg', major: true },
          { k: 'Cash flow / month', v: money(cf / 12), cls: cf >= 0 ? 'pos' : 'neg' },
          { k: 'Furnishing at our cost', v: money(furnCost) },
          { k: 'Saved vs. retail', v: '+' + money(furnSaved), cls: 'pos' },
          { k: 'Cash out of pocket', v: money(cashIn), major: true },
          { k: 'Cap rate on basis', v: pct(cap) },
          { k: 'Cash-on-cash', v: pct(coc), cls: coc >= 0.15 ? 'pos' : '', major: true },
          { k: 'DSCR', v: ratio(dscr) }
        ];

        var why = [];
        var state;
        if (v.purchase <= 0 || v.adr <= 0) {
          state = 'idle';
        } else {
          why.push('Furnishing at wholesale keeps ' + money(furnSaved) + ' in the deal.');

          why.push(cf > 0
            ? 'Positive cash flow of ' + money(cf / 12) + ' a month.'
            : 'Negative cash flow of ' + money(-cf / 12) + ' a month.');

          why.push(coc >= 0.15
            ? 'Cash-on-cash of ' + pct(coc) + ' clears the 15% short-term floor.'
            : 'Cash-on-cash of ' + pct(coc) + ' is under the 15% short-term floor.');

          var breakeven = v.adr > 0 ? (ds + opex + platform) / v.adr / 365 : NaN;
          if (isFinite(breakeven)) {
            why.push('Break-even occupancy is roughly ' + pct(breakeven, 0) + '.');
          }

          if (cf > 0 && coc >= 0.15 && dscr >= 1.25) state = 'pass';
          else if (cf > 0) state = 'watch';
          else state = 'fail';
        }

        return {
          rows: rows,
          state: state,
          why: why,
          summary: { label: 'Cash-on-cash', value: pct(coc) }
        };
      }
    },

    comm: {
      tab: 'Commercial',
      title: 'Strip center / event center',
      tag: 'Commercial',
      groups: [
        { legend: 'Acquisition', fields: [
          f('purchase', 'Purchase price', 'usd', 620000),
          f('rehabTI', 'Rehab + tenant improvements', 'usd', 60000),
          f('closePct', 'Closing costs', 'pct', 3, '% of purchase price')
        ]},
        { legend: 'Income (annual)', fields: [
          f('gsr', 'Gross scheduled rent', 'usd', 96000, 'All bays at full occupancy'),
          f('otherIncome', 'Reimbursements & other', 'usd', 14000, 'NNN recoveries, signage'),
          f('vacPct', 'Vacancy + credit loss', 'pct', 12)
        ]},
        { legend: 'Expenses (annual)', fields: [
          f('opexAnnual', 'Operating expenses', 'usd', 34000, 'Owner-paid, after NNN recovery')
        ]},
        { legend: 'Financing', fields: [
          f('downPct', 'Down payment', 'pct', 30, '% of purchase price'),
          f('ratePct', 'Interest rate', 'pct', 7.75),
          f('amortYears', 'Amortization', 'num', 25, 'Years')
        ]},
        { legend: 'Exit', fields: [
          f('marketCapPct', 'Market cap rate', 'pct', 8.5, 'What comparable centers trade at')
        ]}
      ],
      compute: function (v) {
        var potential = v.gsr + v.otherIncome;
        var egi = potential * (1 - v.vacPct / 100);
        var noi = egi - v.opexAnnual;

        var basis = v.purchase + v.rehabTI;
        var loan = v.purchase * (1 - v.downPct / 100);
        var downAmt = v.purchase - loan;
        var closing = v.purchase * v.closePct / 100;
        var cashIn = downAmt + v.rehabTI + closing;

        var pi = pmt(loan, v.ratePct, v.amortYears);
        var ds = pi * 12;
        var cf = noi - ds;

        var cap = basis > 0 ? noi / basis : NaN;
        var coc = cashIn > 0 ? cf / cashIn : NaN;
        var dscr = ds > 0 ? noi / ds : Infinity;
        var value = v.marketCapPct > 0 ? noi / (v.marketCapPct / 100) : NaN;
        var equity = isFinite(value) ? value - basis : NaN;
        var expRatio = egi > 0 ? v.opexAnnual / egi : NaN;

        var rows = [
          { k: 'Effective gross income', v: money(egi) },
          { k: 'Operating expenses', v: '−' + money(v.opexAnnual) },
          { k: 'Expense ratio', v: pct(expRatio) },
          { k: 'Net operating income', v: money(noi), major: true },
          { k: 'Annual debt service', v: '−' + money(ds) },
          { k: 'Cash flow / year', v: money(cf), cls: cf >= 0 ? 'pos' : 'neg', major: true },
          { k: 'Cash out of pocket', v: money(cashIn), major: true },
          { k: 'Cap rate on basis', v: pct(cap), cls: cap >= 0.08 ? 'pos' : '', major: true },
          { k: 'Value at market cap', v: money(value) },
          { k: 'Equity created', v: (equity >= 0 ? '+' : '') + money(equity), cls: equity >= 0 ? 'pos' : 'neg' },
          { k: 'Cash-on-cash', v: pct(coc) },
          { k: 'DSCR', v: ratio(dscr) }
        ];

        var why = [];
        var state;
        if (v.purchase <= 0 || v.gsr <= 0) {
          state = 'idle';
        } else {
          why.push(cap >= 0.08
            ? 'Going-in cap of ' + pct(cap) + ' clears the 8% floor.'
            : 'Going-in cap of ' + pct(cap) + ' is under the 8% floor.');

          why.push(dscr >= 1.30
            ? 'DSCR of ' + ratio(dscr) + ' clears the 1.30 commercial bar.'
            : 'DSCR of ' + ratio(dscr) + ' is below the 1.30 commercial bar.');

          if (isFinite(equity)) {
            why.push(equity >= 0
              ? 'Worth ' + money(equity) + ' more than basis at a ' + v.marketCapPct + '% cap.'
              : 'Worth ' + money(-equity) + ' less than basis at a ' + v.marketCapPct + '% cap.');
          }

          if (cap >= 0.08 && dscr >= 1.30 && cf > 0) state = 'pass';
          else if (cf > 0) state = 'watch';
          else state = 'fail';
        }

        return {
          rows: rows,
          state: state,
          why: why,
          summary: { label: 'Cap rate', value: pct(cap) }
        };
      }
    }
  };

  var ORDER = ['flip', 'rental', 'coliving', 'str', 'comm'];

  var VERDICT_WORDS = {
    pass:  'Clears the box',
    watch: 'Worth a second look',
    fail:  'Pass on it',
    idle:  'Enter a deal'
  };

  /* Which way is better, per result row, judged on the figure as printed.
     Only rows whose direction is unambiguous appear here — leverage, offer
     gaps and headline sizes are deliberately left out, because more is not
     plainly better. A row in neither map is never flagged.

     Note the expense rows in BETTER_HIGH: they print with a leading minus, so
     the strongest column is the greatest — the least negative — one. Sorting
     them the other way would crown the biggest expense. */
  var BETTER_HIGH = {
    'Net profit': 1, 'Equity created': 1, 'Annualized': 1, 'Return on cash': 1,
    'Cash-on-cash': 1, 'Cash flow / month': 1, 'Cash flow / year': 1,
    'Cap rate on basis': 1, 'DSCR': 1, 'Rent-to-price': 1,
    'Net operating income': 1, 'Effective gross income': 1,
    'Gross scheduled income': 1, 'Gross revenue': 1,
    'Value at market cap': 1, 'Saved vs. retail': 1,
    /* printed as negatives */
    'Vacancy loss': 1, 'Operating expenses': 1, 'Other operating expenses': 1,
    'Annual debt service': 1, 'Platform fees': 1, 'Cleaning cost': 1,
    'Placement fees': 1
  };
  var BETTER_LOW = {
    'Cash out of pocket': 1, 'Total project cost': 1, 'Expense ratio': 1,
    'Selling costs': 1, 'Interest + points': 1, 'Monthly P&I': 1
  };

  /* ---------- state ---------- */

  var STORE_KEY = 'hlc-pipeline-v1';
  var current = 'flip';
  var values = {};   // values[strategyKey] = { fieldId: number }
  var names = {};    // names[strategyKey] = string

  var FIELD_INDEX = {};   // FIELD_INDEX[strategyKey][fieldId] = field definition
  var compareIds = [];    // saved-deal ids picked for the comparison, in pick order

  ORDER.forEach(function (key) {
    values[key] = {};
    names[key] = '';
    FIELD_INDEX[key] = {};
    STRATEGIES[key].groups.forEach(function (g) {
      g.fields.forEach(function (fd) {
        values[key][fd.id] = fd.def;
        FIELD_INDEX[key][fd.id] = fd;
      });
    });
  });

  /* ---------- DOM ---------- */

  var elTabs = document.querySelector('[data-tabs]');
  var elFields = document.querySelector('[data-fields]');
  var elRows = document.querySelector('[data-rows]');
  var elVerdict = document.querySelector('[data-verdict]');
  var elWord = document.querySelector('[data-verdict-word]');
  var elWhy = document.querySelector('[data-verdict-why]');
  var elTitle = document.querySelector('[data-result-title]');
  var elTag = document.querySelector('[data-result-tag]');
  var elPipeline = document.querySelector('[data-pipeline]');
  var elCompare = document.querySelector('[data-compare]');
  var cmpBtn = null;   // rebuilt with the pipeline table, kept in sync on every tick
  var btnSave = document.querySelector('[data-save]');
  var btnReset = document.querySelector('[data-reset]');
  var form = document.querySelector('[data-form]');

  if (!elTabs || !elFields || !form) return;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'cls') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (kid) { if (kid) node.appendChild(kid); });
    return node;
  }

  /* ---------- tabs ---------- */

  function buildTabs() {
    elTabs.innerHTML = '';
    ORDER.forEach(function (key) {
      var b = el('button', {
        type: 'button',
        role: 'tab',
        id: 'tab-' + key,
        'data-key': key,
        'aria-selected': String(key === current),
        text: STRATEGIES[key].tab
      });
      b.addEventListener('click', function () { select(key); });
      b.addEventListener('keydown', function (e) {
        var i = ORDER.indexOf(key);
        if (e.key === 'ArrowRight') { e.preventDefault(); select(ORDER[(i + 1) % ORDER.length], true); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); select(ORDER[(i - 1 + ORDER.length) % ORDER.length], true); }
      });
      elTabs.appendChild(b);
    });
  }

  function select(key, focus) {
    current = key;
    Array.prototype.forEach.call(elTabs.children, function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-key') === key));
    });
    buildFields();
    calc();
    if (focus) {
      var t = document.getElementById('tab-' + key);
      if (t) t.focus();
    }
  }

  /* ---------- fields ---------- */

  function buildFields() {
    var s = STRATEGIES[current];
    elFields.innerHTML = '';
    form.setAttribute('aria-labelledby', 'tab-' + current);

    /* deal name — same on every strategy */
    var nameInput = el('input', { type: 'text', id: 'deal-name', placeholder: '1420 Ashland St, Houston' });
    nameInput.value = names[current];
    nameInput.addEventListener('input', function () { names[current] = nameInput.value; });

    elFields.appendChild(
      el('fieldset', { cls: 'fs' }, [
        el('legend', { text: 'Property' }),
        el('div', { cls: 'fields' }, [
          el('div', { cls: 'field field--wide' }, [
            el('label', { for: 'deal-name', text: 'Deal name or address' }),
            nameInput
          ])
        ])
      ])
    );

    s.groups.forEach(function (g) {
      var wrap = el('div', { cls: 'fields' + (g.cols3 ? ' fields--3' : '') });

      g.fields.forEach(function (fd) {
        var inputId = current + '-' + fd.id;
        var label = el('label', { for: inputId });
        label.appendChild(document.createTextNode(fd.label));
        if (fd.hint) label.appendChild(el('span', { cls: 'hint', text: fd.hint }));

        var input = el('input', {
          type: 'number',
          id: inputId,
          'data-field': fd.id,
          inputmode: 'decimal',
          step: fd.unit === 'pct' ? '0.05' : (fd.unit === 'usd' ? '100' : '1'),
          min: '0'
        });
        input.value = values[current][fd.id];
        input.addEventListener('input', function () {
          var n = parseFloat(input.value);
          values[current][fd.id] = isFinite(n) ? n : 0;
          calc();
        });

        wrap.appendChild(el('div', { cls: 'field' }, [label, input]));
      });

      elFields.appendChild(el('fieldset', { cls: 'fs' }, [el('legend', { text: g.legend }), wrap]));
    });
  }

  /* ---------- results ---------- */

  function calc() {
    var s = STRATEGIES[current];
    var out = s.compute(values[current]);

    elTitle.textContent = s.title;
    elTag.textContent = s.tag;

    elRows.innerHTML = '';
    out.rows.forEach(function (r) {
      elRows.appendChild(
        el('div', { cls: 'row' + (r.major ? ' row--major' : '') }, [
          el('span', { cls: 'row__k', text: r.k }),
          el('span', { cls: 'row__v ' + (r.cls || ''), text: r.v })
        ])
      );
    });

    elVerdict.className = 'verdict is-' + out.state;
    elWord.textContent = VERDICT_WORDS[out.state];

    elWhy.innerHTML = '';
    (out.why || []).forEach(function (line) {
      elWhy.appendChild(el('li', { text: line }));
    });

    return out;
  }

  /* ---------- pipeline ---------- */

  var uidSeq = 0;
  function uid() {
    uidSeq += 1;
    return 'd' + Date.now().toString(36) + uidSeq.toString(36);
  }

  function loadPipeline() {
    var list;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      list = raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
    if (!Array.isArray(list)) return [];

    /* Deals saved before the comparison existed have no id. Stamp one so
       selection and removal survive the list being reordered. */
    var patched = false;
    list.forEach(function (d) {
      if (d && !d.id) { d.id = uid(); patched = true; }
    });
    if (patched) savePipeline(list);
    return list;
  }

  function savePipeline(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
    catch (err) { /* private mode — pipeline is session-only */ }
  }

  function renderPipeline() {
    var list = loadPipeline();
    elPipeline.innerHTML = '';

    /* Drop selections whose deal has since been removed or aged off the list. */
    var alive = {};
    list.forEach(function (d) { alive[d.id] = 1; });
    compareIds = compareIds.filter(function (id) { return alive[id]; });

    if (!list.length) {
      elPipeline.appendChild(el('p', {
        cls: 'pipeline__empty',
        text: 'No deals saved yet. Run a property above and press “Save to pipeline”.'
      }));
      renderCompare(false);
      return;
    }

    var thead = el('thead', {}, [
      el('tr', {}, [
        el('th', { scope: 'col', cls: 'pick', text: 'Cmp' }),
        el('th', { scope: 'col', text: 'Deal' }),
        el('th', { scope: 'col', text: 'Strategy' }),
        el('th', { scope: 'col', text: 'Headline' }),
        el('th', { scope: 'col', text: 'Verdict' }),
        el('th', { scope: 'col', text: 'Saved' }),
        el('th', { scope: 'col', text: 'Actions' })
      ])
    ]);

    var tbody = el('tbody');
    list.forEach(function (d) {
      var pick = el('input', {
        type: 'checkbox',
        'aria-label': 'Compare ' + (d.name || 'unnamed deal')
      });
      pick.checked = compareIds.indexOf(d.id) !== -1;
      pick.addEventListener('change', function () {
        var at = compareIds.indexOf(d.id);
        if (pick.checked && at === -1) compareIds.push(d.id);
        else if (!pick.checked && at !== -1) compareIds.splice(at, 1);
        /* Redrawing the whole table here would drop the checkbox the user is
           standing on, so only the button and the panel are refreshed. */
        syncCompareButton();
        renderCompare(false);
      });

      var loadBtn = el('button', { type: 'button', text: 'Load' });
      loadBtn.addEventListener('click', function () {
        current = d.strategy;
        names[current] = d.name;
        Object.keys(d.values).forEach(function (k) { values[current][k] = d.values[k]; });
        select(current);
        document.getElementById('sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      var delBtn = el('button', { type: 'button', text: 'Remove' });
      delBtn.addEventListener('click', function () {
        savePipeline(loadPipeline().filter(function (x) { return x.id !== d.id; }));
        renderPipeline();
      });

      tbody.appendChild(el('tr', {}, [
        el('td', { cls: 'pick' }, [pick]),
        el('th', { scope: 'row', text: d.name || '(unnamed)' }),
        el('td', { text: STRATEGIES[d.strategy] ? STRATEGIES[d.strategy].title : d.strategy }),
        el('td', { cls: 'n', text: d.metricLabel + ' ' + d.metricValue }),
        el('td', { text: VERDICT_WORDS[d.state] || d.state }),
        el('td', { cls: 'n', text: d.date }),
        el('td', { cls: 'act' }, [loadBtn, delBtn])
      ]));
    });

    cmpBtn = el('button', { cls: 'btn', type: 'button' });
    cmpBtn.addEventListener('click', function () { renderCompare(true); });
    syncCompareButton();

    var exportBtn = el('button', { cls: 'btn btn--ghost', type: 'button', text: 'Export CSV' });
    exportBtn.addEventListener('click', function () { exportCsv(list); });

    var clearBtn = el('button', { cls: 'btn btn--ghost', type: 'button', text: 'Clear all' });
    clearBtn.addEventListener('click', function () {
      if (window.confirm('Remove all ' + list.length + ' saved deals from this browser?')) {
        savePipeline([]);
        renderPipeline();
      }
    });

    elPipeline.appendChild(el('div', { cls: 'tablewrap' }, [el('table', { cls: 'data' }, [thead, tbody])]));
    elPipeline.appendChild(el('div', { cls: 'uw__actions', style: 'border:1px solid var(--line);border-top:0' }, [cmpBtn, exportBtn, clearBtn]));

    renderCompare(false);
  }

  /* ---------- comparison ---------- */

  function syncCompareButton() {
    if (!cmpBtn) return;
    var n = compareIds.length;
    cmpBtn.textContent = n > 1 ? 'Compare ' + n + ' deals' : 'Compare deals';
    cmpBtn.disabled = n < 2;
    cmpBtn.title = n < 2 ? 'Tick two or more deals in the Cmp column' : '';
  }


  /* Pull a number back out of a formatted figure so one row can be ranked
     across columns. Every deal in a row went through the same formatter, so
     the parsed values are comparable. Em dashes and infinities fall out as NaN. */
  function parseFigure(str) {
    var s = String(str).replace(/\u2212/g, '-').replace(/[^0-9.\-]/g, '');
    if (!s || s === '-' || s === '.') return NaN;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  /* Index of the strongest column in a row, or -1 when the row should not be
     ranked at all: unknown direction, a gap in any column, or a flat tie. */
  function bestColumn(label, cells) {
    var dir = BETTER_HIGH[label] ? 1 : (BETTER_LOW[label] ? -1 : 0);
    if (!dir) return -1;

    var nums = [];
    for (var i = 0; i < cells.length; i++) {
      var n = parseFigure(cells[i]);
      if (!isFinite(n)) return -1;
      nums.push(n);
    }

    var best = 0;
    var tied = true;
    for (var j = 1; j < nums.length; j++) {
      if (nums[j] !== nums[0]) tied = false;
      if (dir === 1 ? nums[j] > nums[best] : nums[j] < nums[best]) best = j;
    }
    return tied ? -1 : best;
  }

  function fieldLabel(strategyKey, fieldId) {
    var fd = FIELD_INDEX[strategyKey] && FIELD_INDEX[strategyKey][fieldId];
    return fd ? fd.label : fieldId;
  }

  function fieldCell(strategyKey, fieldId, val) {
    if (typeof val !== 'number' || !isFinite(val)) return '\u2014';
    var fd = FIELD_INDEX[strategyKey] && FIELD_INDEX[strategyKey][fieldId];
    if (!fd) return whole(val);
    if (fd.unit === 'usd') return money(val);
    if (fd.unit === 'pct') return val + '%';
    return whole(val);
  }

  /* Recompute every picked deal from its stored inputs, then line the rows up.
     Recomputing rather than replaying the saved headline means a comparison
     always reflects the current formulas, not the ones in force on the day the
     deal was saved. */
  function compareModel() {
    var byId = {};
    loadPipeline().forEach(function (d) { byId[d.id] = d; });

    var deals = [];
    compareIds.forEach(function (id) {
      var d = byId[id];
      if (d && STRATEGIES[d.strategy]) deals.push(d);
    });
    if (deals.length < 2) return null;

    var outs = deals.map(function (d) { return STRATEGIES[d.strategy].compute(d.values); });

    /* Union of result rows in first-appearance order. A strategy that does not
       produce a row leaves an em dash in its column. */
    var order = [];
    var seen = {};
    outs.forEach(function (out) {
      out.rows.forEach(function (r) {
        if (!seen[r.k]) { seen[r.k] = 1; order.push(r.k); }
      });
    });

    var resultRows = order.map(function (label) {
      var cells = outs.map(function (out) {
        var hit = '\u2014';
        out.rows.forEach(function (r) { if (r.k === label) hit = r.v; });
        return hit;
      });
      return { label: label, cells: cells, best: bestColumn(label, cells) };
    });

    /* Same treatment for the inputs behind each deal. */
    var inputOrder = [];
    var inputOwner = {};
    deals.forEach(function (d) {
      Object.keys(d.values).forEach(function (id) {
        if (!inputOwner[id]) { inputOwner[id] = d.strategy; inputOrder.push(id); }
      });
    });

    var inputRows = inputOrder.map(function (id) {
      return {
        label: fieldLabel(inputOwner[id], id),
        cells: deals.map(function (d) {
          return Object.prototype.hasOwnProperty.call(d.values, id)
            ? fieldCell(d.strategy, id, d.values[id])
            : '\u2014';
        })
      };
    });

    var mixed = deals.some(function (d) { return d.strategy !== deals[0].strategy; });

    return {
      deals: deals, outs: outs,
      resultRows: resultRows, inputRows: inputRows,
      mixed: mixed
    };
  }

  function groupRow(span, label) {
    return el('tr', { cls: 'cmp__group' }, [
      el('th', { scope: 'colgroup', colspan: String(span), text: label })
    ]);
  }

  function figureCell(text, isBest) {
    var td = el('td', { cls: 'n' + (isBest ? ' is-best' : '') });
    td.appendChild(document.createTextNode(text));
    if (isBest) td.appendChild(el('span', { cls: 'cmp__flag', text: 'best' }));
    return td;
  }

  function renderCompare(scrollTo) {
    if (!elCompare) return;
    elCompare.innerHTML = '';

    var m = compareModel();
    if (!m) return;

    var span = m.deals.length + 1;

    var dropBtn = el('button', { cls: 'btn btn--ghost', type: 'button', text: 'Clear selection' });
    dropBtn.addEventListener('click', function () {
      compareIds = [];
      renderPipeline();
    });

    elCompare.appendChild(el('div', { cls: 'cmp__head' }, [
      el('div', {}, [
        el('p', { cls: 'label', text: 'Side by side' }),
        el('h3', { text: m.deals.length + ' deals compared' })
      ]),
      dropBtn
    ]));

    if (m.mixed) {
      elCompare.appendChild(el('p', {
        cls: 'cmp__note',
        text: 'These deals were run on different sheets. A row one strategy does not produce shows an em dash, and no row with a gap in it is ranked.'
      }));
    }

    var headCells = [
      el('th', { scope: 'col', cls: 'cmp__corner' }, [el('span', { cls: 'u-vh', text: 'Figure' })])
    ];
    m.deals.forEach(function (d) {
      headCells.push(el('th', { scope: 'col', text: d.name || '(unnamed)' }));
    });

    var tbody = el('tbody');

    tbody.appendChild(groupRow(span, 'Deal'));

    tbody.appendChild(el('tr', {}, [el('th', { scope: 'row', text: 'Strategy' })].concat(
      m.deals.map(function (d) { return el('td', { text: STRATEGIES[d.strategy].title }); })
    )));

    tbody.appendChild(el('tr', {}, [el('th', { scope: 'row', text: 'Verdict' })].concat(
      m.outs.map(function (out) {
        return el('td', {
          cls: 'cmp__verdict is-' + out.state,
          text: VERDICT_WORDS[out.state] || out.state
        });
      })
    )));

    tbody.appendChild(el('tr', {}, [el('th', { scope: 'row', text: 'Saved' })].concat(
      m.deals.map(function (d) { return el('td', { cls: 'n', text: d.date || '\u2014' }); })
    )));

    tbody.appendChild(groupRow(span, 'Results'));
    m.resultRows.forEach(function (r) {
      tbody.appendChild(el('tr', {}, [el('th', { scope: 'row', text: r.label })].concat(
        r.cells.map(function (c, i) { return figureCell(c, i === r.best); })
      )));
    });

    tbody.appendChild(groupRow(span, 'Inputs'));
    m.inputRows.forEach(function (r) {
      tbody.appendChild(el('tr', {}, [el('th', { scope: 'row', text: r.label })].concat(
        r.cells.map(function (c) { return el('td', { cls: 'n', text: c }); })
      )));
    });

    elCompare.appendChild(el('div', { cls: 'tablewrap' }, [
      el('table', { cls: 'data cmp' }, [el('thead', {}, [el('tr', {}, headCells)]), tbody])
    ]));

    var csvBtn = el('button', { cls: 'btn btn--ghost', type: 'button', text: 'Export comparison' });
    csvBtn.addEventListener('click', function () { exportCompareCsv(m); });

    elCompare.appendChild(el('div', {
      cls: 'uw__actions',
      style: 'border:1px solid var(--line);border-top:0'
    }, [csvBtn]));

    elCompare.appendChild(el('p', {
      cls: 'cmp__note',
      text: 'Best marks the strongest single figure in a row, not the better deal \u2014 read the verdict row for that. Rows where more is not plainly better, like loan amount, are never marked.'
    }));

    if (scrollTo) elCompare.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- csv ---------- */

  function csvCell(v) {
    return '"' + String(v).replace(/"/g, '""') + '"';
  }

  function csvRow(cells) {
    return cells.map(csvCell).join(',');
  }

  function downloadCsv(text, filename) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCompareCsv(m) {
    var lines = [
      csvRow(['Figure'].concat(m.deals.map(function (d) { return d.name || '(unnamed)'; }))),
      csvRow(['Strategy'].concat(m.deals.map(function (d) { return STRATEGIES[d.strategy].title; }))),
      csvRow(['Verdict'].concat(m.outs.map(function (o) { return VERDICT_WORDS[o.state] || o.state; }))),
      csvRow(['Saved'].concat(m.deals.map(function (d) { return d.date || ''; }))),
      '',
      csvRow(['Results'])
    ];
    m.resultRows.forEach(function (r) { lines.push(csvRow([r.label].concat(r.cells))); });
    lines.push('');
    lines.push(csvRow(['Inputs']));
    m.inputRows.forEach(function (r) { lines.push(csvRow([r.label].concat(r.cells))); });

    downloadCsv(lines.join('\r\n'), 'hlc-comparison.csv');
  }

  function exportCsv(list) {
    var lines = [
      csvRow(['Deal', 'Strategy', 'Headline metric', 'Value', 'Verdict', 'Saved', 'Inputs'])
    ];

    list.forEach(function (d) {
      var inputs = Object.keys(d.values).map(function (k) { return k + '=' + d.values[k]; }).join(' | ');
      lines.push(csvRow([
        d.name || '(unnamed)',
        STRATEGIES[d.strategy] ? STRATEGIES[d.strategy].title : d.strategy,
        d.metricLabel,
        d.metricValue,
        VERDICT_WORDS[d.state] || d.state,
        d.date,
        inputs
      ]));
    });

    downloadCsv(lines.join('\r\n'), 'hlc-pipeline.csv');
  }

  /* ---------- actions ---------- */

  btnSave.addEventListener('click', function () {
    var out = calc();
    var d = new Date();
    var stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    var list = loadPipeline();
    list.unshift({
      name: names[current],
      strategy: current,
      values: JSON.parse(JSON.stringify(values[current])),
      metricLabel: out.summary.label,
      metricValue: out.summary.value,
      state: out.state,
      date: stamp
    });
    savePipeline(list.slice(0, 60));
    renderPipeline();

    btnSave.textContent = 'Saved';
    setTimeout(function () { btnSave.textContent = 'Save to pipeline'; }, 1400);
  });

  btnReset.addEventListener('click', function () {
    names[current] = '';
    STRATEGIES[current].groups.forEach(function (g) {
      g.fields.forEach(function (fd) { values[current][fd.id] = fd.def; });
    });
    buildFields();
    calc();
  });

  /* ---------- boot ---------- */

  buildTabs();
  buildFields();
  calc();
  renderPipeline();
})();
