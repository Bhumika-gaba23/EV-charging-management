from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from copy import deepcopy
from lxml import etree as E
import re
OUT=Path(__file__).resolve().parent
SRC=Path('/Users/Apple/Downloads/Chargeflow EV charging management system.pptx')
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
A='{'+NS['a']+'}';P='{'+NS['p']+'}'
updates={
(1,'12'):'Pluggo',
(1,'21'):'GROUP MEMBERS\nBHUMIKA GABA (00818015625)\nADITI RAJ (11318015625)\nRONIT SHARMA (01018015625)\nSARTHAK KUMAR (05318015625)',
(3,''):'',
(5,'23'):'CMake / clang++ or GCC; CTest for domain checks.',
(5,'27'):'Pluggo customer app and separate operator dashboard',
(5,'30'):'Crow JSON API, validation and simulated charging',
(5,'33'):'C++ domain logic; SQLite customer persistence',
(5,'35'):'Pluggo connects to the C++ Crow API and SQLite. A Python WebSocket simulator supplies charging updates; operator routes remain separate.',
(9,'28'):'Check the session’s emergency flag (demo authorization).',
(9,'37'):'Return an INR 50 credit; automatic resumption is future work.',
(10,'9'):'PLUGGO / ILLUSTRATIVE STATION OVERVIEW',
(10,'22'):'APPLICATION MODULES',
(10,'24'):'Customer: stations, vehicles and charging sessions',
(10,'26'):'Customer: history and INR 0 demo receipts',
(10,'28'):'Operator: planner, queue, solar and emergency',
(10,'44'):'VERIFIED OUTPUT: ALL EV FEATURE CHECKS PASSED',
(10,'45'):'Customer API integration checks passed. Overview figures above are illustrative simulation values.',
(11,'18'):'Emergency access with a paused session and credit.',
(11,'23'):'Customer: SQLite; legacy operator: in-memory sessions.',
(11,'25'):'Visitor cookies only; no production account login.',
(11,'27'):'Solar behavior, tariffs and meter events are simulated.',
(11,'29'):'No physical charger control or real payments.',
(11,'34'):'Integrate PostgreSQL and Keycloak JWT validation.',
(11,'36'):'Add bookings, account recovery and real payments.',
(11,'38'):'Use live tariffs and renewable-energy telemetry.',
(11,'40'):'Audit OCPP connectivity; persist emergency credits and resumption.',
(12,'4'):'Pluggo combines a C++ charging engine, deadline and budget planning, priority queues and solar/grid simulation with a connected customer app and SQLite storage.'
}
def set_text(sp,text):
 body=sp.find('p:txBody',NS);paras=body.findall('a:p',NS)
 proto=paras[0]; pr=proto.find('a:pPr',NS)
 run=proto.find('a:r',NS);rp=run.find('a:rPr',NS) if run is not None else None
 for q in paras:body.remove(q)
 for line in text.split('\n'):
  para=E.SubElement(body,A+'p')
  if pr is not None:para.append(deepcopy(pr))
  r=E.SubElement(para,A+'r')
  if rp is not None:r.append(deepcopy(rp))
  E.SubElement(r,A+'t').text=line

def colorize(root):
 for node in list(root.iter()):
  if node.tag in [A+'srgbClr',A+'schemeClr',A+'sysClr',A+'prstClr']:
   parents=list(node.iterancestors());tags=[q.tag for q in parents]
   if any(t in tags for t in [A+'rPr',A+'defRPr',A+'endParaRPr']):val='000000'
   elif P+'bg' in tags:val='FFFFFF'
   elif A+'ln' in tags:val='B0B0B0'
   else:
    old=node.get('val','FFFFFF');
    if len(old)==6 and all(c in '0123456789ABCDEFabcdef' for c in old):
     avg=sum(int(old[i:i+2],16) for i in (0,2,4))/3
     val='FFFFFF' if avg>235 else 'F2F2F2' if avg>180 else 'E6E6E6'
    else:val='FFFFFF'
   node.tag=A+'srgbClr';node.attrib.clear();node.set('val',val)
 for pr in root.xpath('//a:rPr|//a:defRPr|//a:endParaRPr',namespaces=NS):
  for old in pr.findall('a:solidFill',NS):pr.remove(old)
  sf=E.Element(A+'solidFill');E.SubElement(sf,A+'srgbClr',val='000000');pr.insert(0,sf)
 # Use an editable monochrome display effect; keep original image bytes.
 for blip in root.findall('.//a:blip',NS):
  if blip.find('a:grayscl',NS) is None:E.SubElement(blip,A+'grayscl')

with ZipFile(SRC) as z:
 data={name:z.read(name) for name in z.namelist()}
 for name,raw in list(data.items()):
  if not name.startswith('ppt/') or not name.endswith('.xml'):continue
  r=E.fromstring(raw)
  for t in r.findall('.//a:t',NS):
   if t.text:
    t.text=t.text.replace('CHARGEFLOW','PLUGGO').replace('ChargeFlow','Pluggo').replace('Chargeflow','Pluggo')
  colorize(r)
  m=re.fullmatch(r'ppt/slides/slide(\d+)\.xml',name)
  if m:
   slide=int(m[1])
   # Explicit white background on every slide.
   cs=r.find('p:cSld',NS);bg=cs.find('p:bg',NS)
   if bg is not None:cs.remove(bg)
   bg=E.Element(P+'bg');bpr=E.SubElement(bg,P+'bgPr');fill=E.SubElement(bpr,A+'solidFill');E.SubElement(fill,A+'srgbClr',val='FFFFFF');E.SubElement(bpr,A+'effectLst');cs.insert(0,bg)
   for sp in r.findall('.//p:sp',NS):
    sid=sp.find('p:nvSpPr/p:cNvPr',NS).get('id')
    text=''.join(sp.xpath('.//a:t/text()',namespaces=NS))
    if (slide,sid) in updates:set_text(sp,updates[slide,sid])
    elif slide==2 and 'Why ' in text:set_text(sp,'Why Pluggo?')
    if slide==1 and sid=='21':
     for rp in sp.xpath('.//a:rPr|.//a:defRPr',namespaces=NS):rp.set('sz','1050')
     for pp in sp.findall('.//a:pPr',NS):pp.set('algn','l')
    if slide==3 and 'preventing regular-user starvation' in text:
     set_text(sp,'Demonstrate emergency preemption and compensation.')
   # Prevent edited text from expanding the established shape geometry.
   for bp in r.findall('.//a:bodyPr',NS):
    for tag in ['spAutoFit','noAutofit','normAutofit']:
     for e in bp.findall('a:'+tag,NS):bp.remove(e)
    E.SubElement(bp,A+'normAutofit')
  data[name]=E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True)
 target=OUT/'Pluggo_EV_Charging_Management_Black_White.pptx'
 with ZipFile(target,'w',ZIP_DEFLATED) as z:
  for name,raw in data.items():z.writestr(name,raw)
print(target)
# Structural validation: retain slide count and all original shape geometry.
with ZipFile(SRC) as a,ZipFile(target) as b:
 slides=[n for n in a.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
 assert len(slides)==12
 for n in slides:
  old,new=E.fromstring(a.read(n)),E.fromstring(b.read(n))
  assert len(old.findall('.//p:sp',NS))==len(new.findall('.//p:sp',NS))
  assert old.xpath('//a:xfrm/a:off/@x|//a:xfrm/a:off/@y|//a:xfrm/a:ext/@cx|//a:xfrm/a:ext/@cy',namespaces=NS)==new.xpath('//a:xfrm/a:off/@x|//a:xfrm/a:off/@y|//a:xfrm/a:ext/@cx|//a:xfrm/a:ext/@cy',namespaces=NS)
  assert new.find('p:cSld/p:bg/p:bgPr/a:solidFill/a:srgbClr',NS).get('val')=='FFFFFF'
  for c in new.findall('.//a:srgbClr',NS):
   v=c.get('val');assert v[:2]==v[2:4]==v[4:]
  text=' '.join(new.xpath('//a:t/text()',namespaces=NS));assert 'ChargeFlow' not in text and 'CHARGEFLOW' not in text
 print('Verified: 12 slides, original geometry, white backgrounds and monochrome slide colors.')
