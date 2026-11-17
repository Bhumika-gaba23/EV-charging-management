from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from copy import deepcopy
from lxml import etree as E
import re,subprocess
import pymupdf as fitz
OUT=Path(__file__).resolve().parent
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
A='{'+NS['a']+'}';P='{'+NS['p']+'}';R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}';PK='{http://schemas.openxmlformats.org/package/2006/relationships}'
def emu(v):return str(round(v*914400))
def textshape(id,x,y,w,h,text,size,bold=False):
 sp=E.Element(P+'sp');nv=E.SubElement(sp,P+'nvSpPr');E.SubElement(nv,P+'cNvPr',id=str(id),name='College header text');E.SubElement(nv,P+'cNvSpPr',txBox='1');E.SubElement(nv,P+'nvPr')
 pr=E.SubElement(sp,P+'spPr');xf=E.SubElement(pr,A+'xfrm');E.SubElement(xf,A+'off',x=emu(x),y=emu(y));E.SubElement(xf,A+'ext',cx=emu(w),cy=emu(h));E.SubElement(pr,A+'noFill')
 body=E.SubElement(sp,P+'txBody');E.SubElement(body,A+'bodyPr',wrap='none',lIns='0',rIns='0',tIns='0',bIns='0');E.SubElement(body,A+'lstStyle');pa=E.SubElement(body,A+'p');E.SubElement(pa,A+'pPr',algn='ctr');r=E.SubElement(pa,A+'r');rp=E.SubElement(r,A+'rPr',sz=str(size*100),b='1' if bold else '0');sf=E.SubElement(rp,A+'solidFill');E.SubElement(sf,A+'srgbClr',val='000000');E.SubElement(rp,A+'latin',typeface='Montserrat');E.SubElement(r,A+'t').text=text
 return sp

def picshape(id,rid,x,y,w,h):
 pic=E.Element(P+'pic');nv=E.SubElement(pic,P+'nvPicPr');E.SubElement(nv,P+'cNvPr',id=str(id),name='College logo');E.SubElement(nv,P+'cNvPicPr');E.SubElement(nv,P+'nvPr');bf=E.SubElement(pic,P+'blipFill');E.SubElement(bf,A+'blip',{R+'embed':rid});st=E.SubElement(bf,A+'stretch');E.SubElement(st,A+'fillRect');sp=E.SubElement(pic,P+'spPr');xf=E.SubElement(sp,A+'xfrm');E.SubElement(xf,A+'off',x=emu(x),y=emu(y));E.SubElement(xf,A+'ext',cx=emu(w),cy=emu(h));geo=E.SubElement(sp,A+'prstGeom',prst='rect');E.SubElement(geo,A+'avLst');return pic
with ZipFile(OUT/'Pluggo_EV_Charging_Management_Black_White.pptx') as z:data={n:z.read(n) for n in z.namelist()}
# Original college insignia, extracted at their native resolution.
pdf=fitz.open('/Users/Apple/Downloads/EV_Charging_Poster (1).pdf')
for label,xref in [('dtc',3),('nba',4),('ggsipu',5)]:data[f'ppt/media/clean-{label}.png']=pdf.extract_image(xref)['image']
clean=fitz.open('/Users/Apple/Downloads/reportwewe.pdf')
for label,xref,mask in [('dtc',11,12),('ggsipu',8,10)]:
 data[f'ppt/media/clean-{label}.png']=fitz.Pixmap(fitz.Pixmap(clean,xref),fitz.Pixmap(clean,mask)).tobytes('png')
data['ppt/media/hero-colour.jpg']=(OUT/'assets/ev-charging-colour.jpg').read_bytes()
ct=E.fromstring(data['[Content_Types].xml']);ctns='{http://schemas.openxmlformats.org/package/2006/content-types}'
if not any(e.get('Extension')=='jpg' for e in ct):E.SubElement(ct,ctns+'Default',Extension='jpg',ContentType='image/jpeg')
data['[Content_Types].xml']=E.tostring(ct)
for name in list(data):
 if not name.startswith('ppt/') or not name.endswith('.xml'):continue
 root=E.fromstring(data[name])
 for tag in ['latin','ea','cs']:
  for e in root.findall('.//a:'+tag,NS):e.set('typeface','Montserrat')
 for e in root.findall('.//a:grayscl',NS):e.getparent().remove(e)
 m=re.fullmatch(r'ppt/slides/slide(\d+)\.xml',name)
 if m:
  i=int(m[1]);tree=root.find('p:cSld/p:spTree',NS)
  for pic in list(tree.findall('p:pic',NS)):
   ext=pic.find('p:spPr/a:xfrm/a:ext',NS)
   if ext is not None and int(ext.get('cy'))<1300000 and int(ext.get('cx'))>10000000:tree.remove(pic)
  relname=f'ppt/slides/_rels/slide{i}.xml.rels';rels=E.fromstring(data[relname])
  for label in ['dtc','nba','ggsipu']:
   E.SubElement(rels,PK+'Relationship',Id='rIdClean'+label,Type=R[1:-1]+'/image',Target=f'../media/clean-{label}.png')
  tree.append(picshape(801,'rIdCleandtc',.38,.18,.85,.71))
  # Two high-resolution original institutional logos keep the header clean.
  tree.append(picshape(803,'rIdCleanggsipu',12.12,.14,.83,.72))
  tree.append(textshape(804,2.55,.21,9.15,.34,'DELHI TECHNICAL CAMPUS',20,True))
  tree.append(textshape(805,2.55,.60,9.15,.20,'GREATER NOIDA',10,True))
  tree.append(textshape(806,2.55,.85,9.15,.19,'Affiliated to GGSIPU and Approved by AICTE & COA',9))
  if i==1:
   for pic in tree.findall('p:pic',NS):
    ext=pic.find('p:spPr/a:xfrm/a:ext',NS)
    if ext is not None and int(ext.get('cy'))>4000000:
     bf=pic.find('p:blipFill',NS);bf.find('a:blip',NS).set(R+'embed','rIdColourHero')
     # Fill the existing portrait frame without stretching the photograph.
     sr=bf.find('a:srcRect',NS)
     if sr is None:sr=E.Element(A+'srcRect');bf.insert(1,sr)
     sr.set('l','32000');sr.set('r','2400')
   E.SubElement(rels,PK+'Relationship',Id='rIdColourHero',Type=R[1:-1]+'/image',Target='../media/hero-colour.jpg')
   for sp in tree.findall('p:sp',NS):
    sid=sp.find('p:nvSpPr/p:cNvPr',NS).get('id')
    if sid=='14':
     ext=sp.find('p:spPr/a:xfrm/a:ext',NS);ext.set('cx',emu(5.8));ext.set('cy',emu(.65))
     for rp in sp.findall('.//a:rPr',NS):rp.set('sz','1600')
    if sid=='21':
     for rp in sp.findall('.//a:rPr',NS):rp.set('sz','1100')
  # A restrained neutral palette: sharper rules, soft cards and no heavy decoration.
  for sp in tree.findall('p:sp',NS):
   pr=sp.find('p:spPr',NS)
   if pr is not None:
    geom=pr.find('a:prstGeom',NS)
    if geom is not None and geom.get('prst')=='roundRect':
     av=geom.find('a:avLst',NS)
     if av is not None:
      for child in list(av):av.remove(child)
      E.SubElement(av,A+'gd',name='adj',fmla='val 3500')
  data[relname]=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
 data[name]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
# Credit is in speaker notes/source file, without adding a slide.
(OUT/'assets/IMAGE_CREDIT.txt').write_text('Cover photograph: Unsplash image photo-1593941707882-a5bba14938c7\nhttps://images.unsplash.com/photo-1593941707882-a5bba14938c7\nCollege logos: original supplied college poster.\nMontserrat: Google Fonts, SIL Open Font License.\n')
target=OUT/'Pluggo_EV_Charging_Management_Polished.pptx'
with ZipFile(target,'w',ZIP_DEFLATED) as z:
 for n,b in data.items():z.writestr(n,b)
print(target)
subprocess.run(['qlmanage','-t','-s','1600','-o','/tmp',str(target)],capture_output=True,check=True)
