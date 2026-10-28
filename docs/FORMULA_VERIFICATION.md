# Formula verification report

**BBC Perfomance Dashboard · Reporting date used for verification: 2026-10-27**

## Method and independence

Actual workbook inputs and original formula caches were extracted with Python ZIP/XML parsing. An anonymized fixture retains numerical/date inputs and record relationships, with personal names and prose replaced. Expected values were calculated separately with Python datetime/statistics, not with React functions. Tests compare every derived field of all 20 objectives on 2026-09-29 and 2026-10-27, all headline values, goal/ministry rollups and original cached objective values. The cached snapshot date 2026-09-29 is confirmed by all objective plans and remaining-day values.

## Complete calculation mapping

| Excel location | Calculation | Expected Excel behavior | React equivalent | Result / action |
| --- | --- | --- | --- | --- |
| Objective Entry J | Planned Completion % | Before start 0; on/after end 1; otherwise elapsed / duration; zero duration becomes 1 on date | plannedCompletion | Passed; invalid/reversed dates now unavailable |
| Objective Entry L | Variance % | Actual minus planned on the same valid row | objectiveViews; buildDashboard mean | Passed; paired average fixed |
| Objective Entry R | Days Remaining | End date minus reporting date | differenceDays / objectiveViews | Passed; date-only arithmetic |
| Objective Entry S | Overdue | Reporting date > end AND actual < 1 | objectiveViews.overdue | Passed; due day and completion tested |
| Objective Entry T | Objective KPI achievement | AVERAGEIF linked KPI ratios, excluding unavailable values | avg(linked.map(kpiAchievement)) | Passed |
| Objective Entry U | Data Quality Check | Unique ID, required fields, valid references, dates, rating and actual bounds | objectiveViews.dataQuality | Passed; stronger numeric/date guards |
| Objective Entry V | Attention Flag | Data Quality → Overdue → Status Risk → Behind Plan → KPI Below Target → Due Soon | objectiveViews.attention | Passed; exact precedence |
| Objective Entry W | Exception Score | Additive workbook weights; strict variance/KPI thresholds | objectiveViews.exceptionScore | Passed |
| Objective Entry X | Dashboard Include | SUBTOTAL visibility; 1 for selected objective | matchesFilters; selected IDs | Passed in app; native filter UI not tested |
| Objective Entry Y | Filtered Exception Key | Positive score + source row / 100000 | buildDashboard exception sort/sourceIndex | Passed; reverse row tie-break |
| Objective Entry Z | Primary KPI ID | First related KPI in source order | objectiveViews.primaryKpiId | Passed |
| Objective Entry AA | Dashboard Year | YEAR(Last Update Date) | objectiveViews.year | Passed; malformed date not a year |
| Objective Entry AB | Goal Description helper | Lookup BBC Strategic Goal title, not long Goal Description | objectiveViews.goalName | Passed |
| Objective Entry AC | Status Description | Rating 1–5 text labels | RATING_LABELS; export rating labels | Passed (short UI wording; source labels retained) |
| KPI Tracking H | KPI achievement | Actual / Target | kpiAchievement | Passed; blank/zero produce unavailable |
| KPI Tracking I | KPI status | Ratio >= 1 Met / Exceeded; otherwise Below Target; blank unavailable | KPI table and exporter | Passed |
| KPI Tracking L–Q | Parent helpers | Lookup goal, ministry, role, priority, status and rating | objective-ID map | Passed; all six helpers regenerated |
| KPI Tracking R | Dashboard Include | Parent objective visibility | scopedKpis / export parent link | Passed |
| Objective Updates H–L | Current parent helpers | Current goal/ministry/role/priority/status, not historical attribution | scopedUpdates; export objective map | Passed |
| Objective Updates M | Dashboard Include | Parent objective visibility | selected objective IDs | Passed |
| Dashboard A15/C15 | Goals / objectives | Represented distinct goals / included objectives | buildDashboard.goals/objectives | Passed; no empty-master-goal inflation |
| Dashboard E15/G15/I15 | Actual / planned / variance means | Separate valid actual/planned means; mean of row variances | buildDashboard | Passed |
| Dashboard K15/M15/O15 | On track / at risk / overdue | Rating >=4 and not overdue and status != Completed / rating <=2 / overdue flag | buildDashboard | Passed; counts may overlap |
| Dashboard Q15 | Executive KPI mean | Average selected KPI ROW ratios | buildDashboard.kpi | Passed; distinct from objective means |
| Dashboard B89:O98 | Ranked exceptions | LARGE filtered key; INDEX/MATCH row details | buildDashboard.exceptions; attention table | Passed data/order; native display not tested |
| Analysis A5:L34 | Goal scorecard | Objective counts, means, risk counts and objective-level KPI mean | summarizeBy(goalId) | Passed |
| Analysis L5 pattern | Goal performance label | Overdue → Attention; variance >=5 pp Ahead; >=-5 pp On Plan; else rating <3 At Risk; else Behind | summarizeBy.performance | Passed boundary tests |
| Analysis N5:X31 | Ministry scorecard | Current ministry groups; KPI mean of objective means | summarizeBy(ministry) | Passed for actual baseline ministries |
| Analysis A40:C44 | Rating distribution | Counts for ratings 1–5 | ratings chart data | Passed selector logic |
| Analysis F40:G44 | Status distribution | Counts by status | summarizeBy(status) | Passed selector logic |
| Analysis J40:L51 | 12-month trend | Average all snapshots in each full month, filtered via current parent; gaps blank | monthlyTrend | Passed; no invented zero months |
| Analysis N40:O59 | Ministry KPI chart | Average KPI ROW ratios per ministry | Insights ministry KPI chart selector | Passed weighting; rendering not tested |
| Lists / named ranges | Dropdown controls | Ministries, roles, ratings, statuses, priorities, active flags, units, years | Lists; import union; export controlled lists | Passed round trip |

## Headline reconciliation

| Metric | Original cached date 2026-09-29 | Independent 2026-10-27 expectation | Test result |
| --- | --- | --- | --- |
| Goals represented | 5 | 5 | Passed |
| Objectives | 20 | 20 | Passed |
| Actual completion | 52.80% | 52.80% | Passed |
| Planned completion | 59.01% | 67.35% | Passed |
| Variance | -6.21 pp | -14.55 pp | Passed |
| On track | 11 | 11 | Passed |
| At risk | 5 | 5 | Passed |
| Overdue | 3 | 3 | Passed |
| Executive KPI achievement | 96.12% | 96.12% | Passed |

Additional live metrics on the controlled date: 38 KPI records, 2 objectives at exactly 100% completion, and 3 objectives with a valid objective-level KPI mean below 80%. Overview counts all 5 master goals; the dashboard counts represented goals after filters.

## Objective-by-objective expectation at 2026-10-27

| ID | Actual | Planned | Variance (pp) | KPI mean | Days left | Overdue | Attention | Score | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OBJ001 | 66.00% | 71.00% | -5.00 | 101.25% | 87 | No | None | 0 | Passed |
| OBJ002 | 72.00% | 63.75% | +8.25 | 112.75% | 87 | No | None | 0 | Passed |
| OBJ003 | 55.00% | 100.00% | -45.00 | 64.25% | -93 | Yes | Overdue | 125 | Passed |
| OBJ004 | 0.00% | 8.67% | -8.67 | 105.00% | 137 | No | None | 0 | Passed |
| OBJ005 | 100.00% | 100.00% | +0.00 | 109.75% | -153 | No | None | 0 | Passed |
| OBJ006 | 48.00% | 76.25% | -28.25 | 89.25% | 57 | No | Behind Plan | 30 | Passed |
| OBJ007 | 52.00% | 68.33% | -16.33 | 102.75% | 57 | No | Behind Plan | 20 | Passed |
| OBJ008 | 25.00% | 63.75% | -38.75 | 80.25% | 87 | No | Status Risk | 55 | Passed |
| OBJ009 | 66.00% | 71.00% | -5.00 | 102.00% | 87 | No | None | 0 | Passed |
| OBJ010 | 72.00% | 63.75% | +8.25 | 109.75% | 87 | No | None | 0 | Passed |
| OBJ011 | 63.00% | 100.00% | -37.00 | 60.50% | -93 | Yes | Overdue | 125 | Passed |
| OBJ012 | 0.00% | 8.67% | -8.67 | 102.00% | 137 | No | None | 0 | Passed |
| OBJ013 | 100.00% | 100.00% | +0.00 | 114.25% | -153 | No | None | 0 | Passed |
| OBJ014 | 48.00% | 76.25% | -28.25 | 90.00% | 57 | No | Behind Plan | 30 | Passed |
| OBJ015 | 52.00% | 68.33% | -16.33 | 99.75% | 57 | No | Behind Plan | 20 | Passed |
| OBJ016 | 25.00% | 63.75% | -38.75 | 77.25% | 87 | No | Status Risk | 75 | Passed |
| OBJ017 | 66.00% | 71.00% | -5.00 | 102.00% | 87 | No | None | 0 | Passed |
| OBJ018 | 72.00% | 63.75% | +8.25 | 113.50% | 87 | No | None | 0 | Passed |
| OBJ019 | 74.00% | 100.00% | -26.00 | 81.00% | -93 | Yes | Overdue | 95 | Passed |
| OBJ020 | 0.00% | 8.67% | -8.67 | 99.00% | 137 | No | None | 0 | Passed |

The expected exception order is OBJ011, OBJ003, OBJ019, OBJ016, OBJ008, OBJ014, OBJ006, OBJ015, OBJ007. Equal scores retain Excel's later-source-row-first ordering. Source IDs are shown as identifiers, never summed or averaged.

## Important weighting distinction

With two objectives, where the first has KPI ratios 50% and 100% and the second has a single 200% ratio, the executive KPI mean is **116.6667%** across three records. The scorecard mean is **137.5%** across two objective averages (75% and 200%). A dedicated independent test asserts both results. Goal/ministry scorecards use the latter definition; the dashboard and ministry KPI chart use the former. None is substituted for the other.

## Boundaries and interpretation

- Planned progress: before start, exact start, midpoint, exact end, after end, zero duration, missing/invalid/leap dates and reversed schedules were tested. Date arithmetic is independent of DST. New York UTC-midnight and DST transitions were checked.
- Overdue: the deadline day is not overdue; the next day is overdue only below 100% actual. Completed status and completion remain separate source fields. No status-based overdue override is invented.
- Variance: full precision drives rules before display rounding. -25 pp and -15 pp cutoffs are strict. IEEE floating-point subtraction can put a decimal-looking boundary infinitesimally across the threshold; tests retain the full-precision workbook convention rather than rounding classification first.
- Due soon: 0–30 remaining days inclusive, actual strictly below 70%. KPI attention: objective KPI mean strictly below 80%. Missing KPI achievement does not become zero or a false below-target result.
- KPI values: missing actual/target and zero target are unavailable; finite negative values and ratios above 100% use raw division. There is no workbook direction field, so lower-is-better behavior is unsupported. History snapshot achievement follows the workbook's separate 0–300% validation; current KPI ratios have no arbitrary 300% cap.
- Means ignore unavailable values. When an entire group has no valid plan/variance, the app shows unavailable, not a fabricated healthy zero. A paired-variance test uses actuals 40% and 90%, with only the first having a 50% plan: the expected mean variance is -10 pp, not +15 pp.
- History averages every update record in each calendar month, including the reporting month. The reporting date changes the 12-month window and schedule calculations, not past actual reconstruction. Future-dated entries within that month follow the workbook's whole-month averaging convention.
- Parent helpers on historical records follow the objective's current classification, matching source INDEX/MATCH formulas. Editing or deleting snapshots does not rewind current facts; applying a snapshot is explicit.

## Export formula corrections

The KPI ratio formula now tests blank target, blank actual and zero target before division, preventing a blank actual from becoming zero achievement. Planned progress rejects missing/non-numeric or reversed schedules. Data Quality additionally requires numeric completion, numeric dates and integer ratings. All other documented thresholds/weights are retained. Date-dependent formulas reference BBC_ReportingDate, stored with the export; automatic full recalculation is requested. Changing that defined name to TODAY() in Excel restores native live-date behavior, and reimport recognizes the live selection.

The exporter regenerates all 14 objective, 9 KPI and 6 history helper calculated columns for active and prepared table rows. Native chart/summary caches remain untouched for fidelity and must be recalculated by Excel. Formula text and cached values passed structural/independent checks; **native Excel execution is Not Tested**.

## Original calculated-column formula appendix

The following expressions were extracted directly from the actual supplied table definitions. These are original reference formulas; exported KPI/date/data-quality guards have the documented corrections above.

### tblObjectiveUpdates

**Goal ID**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Goal ID],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Ministry**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Ministry],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Assigned Role**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Assigned Role],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Priority**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Priority],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Objective Status**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Objective Status],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Dashboard Include**

```excel
=IF(tblObjectiveUpdates[[#This Row],[Update ID]]="","",IFERROR(INDEX(tblObjectives[Dashboard Include],MATCH(tblObjectiveUpdates[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),0))
```

### tblKPI

**KPI Achievement %**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(tblKPI[[#This Row],[Actual]]/tblKPI[[#This Row],[Target]],""))
```

**KPI Status**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IF(tblKPI[[#This Row],[KPI Achievement %]]="","",IF(tblKPI[[#This Row],[KPI Achievement %]]>=1,"Met / Exceeded","Below Target")))
```

**Goal ID**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Goal ID],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Ministry**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Ministry],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Assigned Role**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Assigned Role],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Priority**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Priority],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Objective Status**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Objective Status],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Status Rating**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Status Rating],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),""))
```

**Dashboard Include**

```excel
=IF(tblKPI[[#This Row],[KPI ID]]="","",IFERROR(INDEX(tblObjectives[Dashboard Include],MATCH(tblKPI[[#This Row],[Objective ID]],tblObjectives[Objective ID],0)),0))
```

### tblObjectives

**Planned Completion %**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(OR(tblObjectives[[#This Row],[Start Date]]="",tblObjectives[[#This Row],[End Date]]=""),"",IF(TODAY()<tblObjectives[[#This Row],[Start Date]],0,IF(TODAY()>tblObjectives[[#This Row],[End Date]],1,IF(tblObjectives[[#This Row],[End Date]]=tblObjectives[[#This Row],[Start Date]],1,(TODAY()-tblObjectives[[#This Row],[Start Date]])/(tblObjectives[[#This Row],[End Date]]-tblObjectives[[#This Row],[Start Date]]))))))
```

**Variance %**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(OR(tblObjectives[[#This Row],[Actual Completion %]]="",tblObjectives[[#This Row],[Planned Completion %]]=""),"",tblObjectives[[#This Row],[Actual Completion %]]-tblObjectives[[#This Row],[Planned Completion %]]))
```

**Days Remaining**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(tblObjectives[[#This Row],[End Date]]="","",tblObjectives[[#This Row],[End Date]]-TODAY()))
```

**Overdue**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(OR(tblObjectives[[#This Row],[End Date]]="",tblObjectives[[#This Row],[Actual Completion %]]=""),"",IF(AND(TODAY()>tblObjectives[[#This Row],[End Date]],tblObjectives[[#This Row],[Actual Completion %]]<1),"Yes","No")))
```

**KPI Achievement %**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IFERROR(AVERAGEIF(tblKPI[Objective ID],tblObjectives[[#This Row],[Objective ID]],tblKPI[KPI Achievement %]),""))
```

**Data Quality Check**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(AND(COUNTIF(tblObjectives[Objective ID],tblObjectives[[#This Row],[Objective ID]])=1,tblObjectives[[#This Row],[Goal ID]]<>"",COUNTIF(tblGoals[Goal ID],tblObjectives[[#This Row],[Goal ID]])>0,tblObjectives[[#This Row],[Objective Description]]<>"",tblObjectives[[#This Row],[Ministry]]<>"",tblObjectives[[#This Row],[Assigned Role]]<>"",tblObjectives[[#This Row],[Accountable Person]]<>"",tblObjectives[[#This Row],[Status Rating]]>=1,tblObjectives[[#This Row],[Status Rating]]<=5,tblObjectives[[#This Row],[Start Date]]<>"",tblObjectives[[#This Row],[End Date]]<>"",tblObjectives[[#This Row],[End Date]]>=tblObjectives[[#This Row],[Start Date]],tblObjectives[[#This Row],[Actual Completion %]]>=0,tblObjectives[[#This Row],[Actual Completion %]]<=1,tblObjectives[[#This Row],[Objective Status]]<>"",tblObjectives[[#This Row],[Priority]]<>"",tblObjectives[[#This Row],[Last Update Date]]<>""),"OK",IF(COUNTIF(tblObjectives[Objective ID],tblObjectives[[#This Row],[Objective ID]])>1,"Duplicate Objective ID; ","")&IF(tblObjectives[[#This Row],[Goal ID]]="","Missing Goal ID; ",IF(COUNTIF(tblGoals[Goal ID],tblObjectives[[#This Row],[Goal ID]])=0,"Invalid Goal ID; ",""))&IF(tblObjectives[[#This Row],[Objective Description]]="","Missing Description; ","")&IF(tblObjectives[[#This Row],[Ministry]]="","Missing Ministry; ","")&IF(tblObjectives[[#This Row],[Assigned Role]]="","Missing Role; ","")&IF(tblObjectives[[#This Row],[Accountable Person]]="","Missing Accountable Person; ","")&IF(OR(tblObjectives[[#This Row],[Status Rating]]<1,tblObjectives[[#This Row],[Status Rating]]>5),"Invalid Status Rating; ","")&IF(tblObjectives[[#This Row],[Start Date]]="","Missing Start Date; ","")&IF(tblObjectives[[#This Row],[End Date]]="","Missing End Date; ","")&IF(AND(tblObjectives[[#This Row],[Start Date]]<>"",tblObjectives[[#This Row],[End Date]]<>"",tblObjectives[[#This Row],[End Date]]<tblObjectives[[#This Row],[Start Date]]),"End before Start; ","")&IF(OR(tblObjectives[[#This Row],[Actual Completion %]]<0,tblObjectives[[#This Row],[Actual Completion %]]>1),"Invalid Actual Completion; ","")&IF(tblObjectives[[#This Row],[Objective Status]]="","Missing Objective Status; ","")&IF(tblObjectives[[#This Row],[Priority]]="","Missing Priority; ","")&IF(tblObjectives[[#This Row],[Last Update Date]]="","Missing Last Update Date; ","")))
```

**Attention Flag**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(tblObjectives[[#This Row],[Data Quality Check]]<>"OK","Data Quality",IF(tblObjectives[[#This Row],[Overdue]]="Yes","Overdue",IF(tblObjectives[[#This Row],[Status Rating]]<=2,"Status Risk",IF(tblObjectives[[#This Row],[Variance %]]<-0.15,"Behind Plan",IF(AND(tblObjectives[[#This Row],[KPI Achievement %]]<>"",tblObjectives[[#This Row],[KPI Achievement %]]<0.8),"KPI Below Target",IF(AND(tblObjectives[[#This Row],[Days Remaining]]>=0,tblObjectives[[#This Row],[Days Remaining]]<=30,tblObjectives[[#This Row],[Actual Completion %]]<0.7),"Due Soon","")))))))
```

**Exception Score**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IF(tblObjectives[[#This Row],[Data Quality Check]]<>"OK",100,0)+IF(tblObjectives[[#This Row],[Overdue]]="Yes",40,0)+IF(tblObjectives[[#This Row],[Status Rating]]=1,35,IF(tblObjectives[[#This Row],[Status Rating]]=2,25,0))+IF(tblObjectives[[#This Row],[Variance %]]<-0.25,30,IF(tblObjectives[[#This Row],[Variance %]]<-0.15,20,0))+IF(AND(tblObjectives[[#This Row],[KPI Achievement %]]<>"",tblObjectives[[#This Row],[KPI Achievement %]]<0.8),20,0)+IF(AND(tblObjectives[[#This Row],[Days Remaining]]>=0,tblObjectives[[#This Row],[Days Remaining]]<=30,tblObjectives[[#This Row],[Actual Completion %]]<0.7),15,0))
```

**Dashboard Include**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",SUBTOTAL(103,tblObjectives[[#This Row],[Objective ID]]))
```

**Filtered Exception Key**

```excel
=IF(AND(tblObjectives[[#This Row],[Dashboard Include]]=1,tblObjectives[[#This Row],[Exception Score]]>0),tblObjectives[[#This Row],[Exception Score]]+ROW()/100000,"")
```

**Primary KPI ID**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",IFERROR(INDEX(tblKPI[KPI ID],MATCH(tblObjectives[[#This Row],[Objective ID]],tblKPI[Objective ID],0)),""))
```

**Dashboard Year**

```excel
=IF(tblObjectives[[#This Row],[Objective ID]]="","",YEAR(tblObjectives[[#This Row],[Last Update Date]]))
```

**Goal Description**

```excel
=IF(tblObjectives[[#This Row],[Goal ID]]="","",IFERROR(INDEX(tblGoals[BBC Strategic Goal],MATCH(tblObjectives[[#This Row],[Goal ID]],tblGoals[Goal ID],0)),""))
```

**Status Description**

```excel
=IF(tblObjectives[[#This Row],[Status Rating]]="","",CHOOSE(tblObjectives[[#This Row],[Status Rating]],"🔴 Red — Issue Realized","🟠 Amber — Issue Eminent","🟡 Yellow — Monitor","🟢 Light Green — On Track","🟩 Green — Exceed Expectations"))
```

