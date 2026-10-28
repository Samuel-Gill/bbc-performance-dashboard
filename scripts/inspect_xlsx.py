"""Read-only independent XLSX verification. Does not modify the workbook.

Usage: python scripts/inspect_xlsx.py exported.xlsx --expected expected.json
"""
import argparse
import datetime as dt
import hashlib
import json
import posixpath
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

P=argparse.ArgumentParser();P.add_argument('workbook');P.add_argument('--expected');P.add_argument('--output');args=P.parse_args()
S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
z=zipfile.ZipFile(args.workbook)
assert z.testzip() is None,'ZIP CRC failed'
xml_parts=0
for part in z.namelist():
    if part.endswith(('.xml','.rels')):
        # Stream the 52 MB dashboard and clear cells as they are checked.
        with z.open(part) as source:
            for _,node in ET.iterparse(source,events=['end']):node.clear()
        xml_parts+=1
rels={e.get('Id'):e.get('Target') for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
wb=ET.fromstring(z.read('xl/workbook.xml'))
paths={e.get('name'):(rels[e.get(R)].lstrip('/') if rels[e.get(R)].startswith('/') else posixpath.normpath('xl/'+rels[e.get(R)])) for e in wb.findall(S+'sheets/'+S+'sheet')}
shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
    shared=[''.join(t.text or '' for t in si.iter(S+'t')) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
def records(name):
    doc=ET.fromstring(z.read(paths[name]));rows=[]
    for row in doc.findall(S+'sheetData/'+S+'row'):
        values={}
        for cell in row.findall(S+'c'):
            ref=cell.get('r');key=''.join(c for c in ref if c.isalpha());v=cell.find(S+'v');value=v.text if v is not None else None
            if cell.get('t')=='inlineStr':value=''.join(t.text or '' for t in cell.iter(S+'t'))
            elif cell.get('t')=='s' and value is not None:value=shared[int(value)]
            elif cell.get('t') not in ['str','e'] and value is not None:value=float(value)
            values[key]=value
        if row.get('r')=='1':header=values
        elif values.get('A') not in [None,'']:rows.append({header[k]:v for k,v in values.items() if k in header})
    return rows
data={key:records(sheet) for key,sheet in [('goals','Goals'),('objectives','Objective Entry'),('kpis','KPI Tracking'),('updates','Objective Updates')]}
for key,rows in data.items():
    primary={'goals':'Goal ID','objectives':'Objective ID','kpis':'KPI ID','updates':'Update ID'}[key]
    ids=[row[primary].upper() for row in rows];assert len(ids)==len(set(ids)),f'Duplicate {key} ID'
gs={r['Goal ID'] for r in data['goals']};os={r['Objective ID'] for r in data['objectives']}
assert all(r['Goal ID'] in gs for r in data['objectives'])
assert all(r['Objective ID'] in os for r in data['kpis']+data['updates'])
tables=[]
for part in z.namelist():
    if part.startswith('xl/tables/') and part.endswith('.xml'):
        table=ET.fromstring(z.read(part));tables.append({'name':table.get('name'),'ref':table.get('ref'),'calculatedColumns':len(table.findall('.//'+S+'calculatedColumnFormula'))})
date1904=wb.find(S+'workbookPr') is not None and wb.find(S+'workbookPr').get('date1904') in ['1','true']
def date(v):
    if v in [None,'']:return ''
    if not isinstance(v,(int,float)):return v
    return ((dt.date(1904,1,1) if date1904 else dt.date(1899,12,30))+dt.timedelta(days=int(v))).isoformat()
matched=0
if args.expected:
    expected=json.loads(Path(args.expected).read_text())
    fields={
      'goals':dict(id='Goal ID',title='BBC Strategic Goal',owner='Accountable Person',description='Goal Description',active='Active'),
      'objectives':dict(id='Objective ID',goalId='Goal ID',description='Objective Description',ministry='Ministry',role='Assigned Role',owner='Accountable Person',rating='Status Rating',startDate='Start Date',endDate='End Date',actual='Actual Completion %',status='Objective Status',priority='Priority',comments='Comments',lastUpdateDate='Last Update Date',updatedBy='Last Updated By'),
      'kpis':dict(id='KPI ID',objectiveId='Objective ID',name='KPI Name',description='KPI Description',unit='Unit',target='Target',actual='Actual',measurementDate='Measurement Date',comment='Comment'),
      'updates':dict(id='Update ID',objectiveId='Objective ID',date='Update Date',actual='Actual Completion %',rating='Status Rating',achievement='KPI Achievement %',comment='Update Comment')}
    for key,columns in fields.items():
        assert len(data[key])==len(expected['data'][key]),f'{key} count changed'
        for actual,wanted in zip(data[key],expected['data'][key]):
            for field,column in columns.items():
                a=actual.get(column);e=wanted[field]
                if field in ['startDate','endDate','lastUpdateDate','measurementDate','date']:a=date(a)
                elif e=='':a=a or ''
                assert a==e,f'{key} {wanted["id"]} field {field} differs'
                matched+=1
    assert len(data['goals'])==expected['counts']['goals']
derived_checks=0
name=next((n for n in wb.findall(S+'definedNames/'+S+'definedName') if n.get('name')=='BBC_ReportingDate'),None)
if name is not None:
    now=float(name.text)
    for r in data['objectives']:
        start,end,actual=r.get('Start Date'),r.get('End Date'),r.get('Actual Completion %')
        planned=0 if now<start else 1 if now>=end else (now-start)/(end-start)
        variance=actual-planned;days=end-now;overdue=days<0 and actual<1
        ratios=[k['Actual']/k['Target'] for k in data['kpis'] if k['Objective ID']==r['Objective ID'] and k.get('Actual') is not None and k.get('Target') not in [None,0]]
        achievement=sum(ratios)/len(ratios) if ratios else None
        due=0<=days<=30 and actual<.7
        score=(40 if overdue else 0)+({1:35,2:25}.get(r['Status Rating'],0))+(30 if variance<-.25 else 20 if variance<-.15 else 0)+(20 if achievement is not None and achievement<.8 else 0)+(15 if due else 0)
        flag='Overdue' if overdue else 'Status Risk' if r['Status Rating']<=2 else 'Behind Plan' if variance<-.15 else 'KPI Below Target' if achievement is not None and achievement<.8 else 'Due Soon' if due else None
        for column,value in {'Planned Completion %':planned,'Variance %':variance,'Days Remaining':days,'Overdue':'Yes' if overdue else 'No','KPI Achievement %':achievement,'Exception Score':score,'Attention Flag':flag}.items():
            cached=r.get(column)
            assert (abs(cached-value)<1e-12 if isinstance(value,(int,float)) else cached==value),f'Derived cache differs: {r["Objective ID"]} {column}'
            derived_checks+=1
report={'status':'Passed','zipCRC':'Passed','wellFormedXMLParts':xml_parts,'sheets':list(paths),'counts':{k:len(v) for k,v in data.items()},'relationships':'Passed','uniqueIDs':'Passed','matchedEditableFields':matched,'independentDerivedCacheChecks':derived_checks,'tables':tables,'charts':sum(p.startswith('xl/charts/chart') and p.endswith('.xml') for p in z.namelist()),'slicerCaches':sum(p.startswith('xl/slicerCaches/') and p.endswith('.xml') for p in z.namelist()),'calcChainRemoved':'xl/calcChain.xml' not in z.namelist(),'sha256':hashlib.sha256(Path(args.workbook).read_bytes()).hexdigest(),'nativeExcelRecalculation':'Not Tested'}
if args.output:Path(args.output).write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
