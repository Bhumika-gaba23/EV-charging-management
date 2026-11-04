from pathlib import Path
from collections import Counter
import re
import pymupdf as f
out=Path(__file__).resolve().parent
source=Path('/Users/Apple/Downloads/Projectile_Motion_Calculator_PBL_Report.pdf')
ref=f.open('/Users/Apple/Downloads/reportwewe.pdf')
src=f.open(source)
original_text=[p.get_text() for p in src]
header=ref[0].get_pixmap(matrix=f.Matrix(4,4),clip=f.Rect(0,0,612,105),alpha=False).tobytes('png')
# Remove only the malformed cover image; all original text remains in place.
for im in src[0].get_images(full=True): src[0].delete_image(im[0])
dst=f.open()
for i,old in enumerate(src):
 w,h=old.rect.width,old.rect.height
 page=dst.new_page(width=w,height=h)
 if i==0:
  page.show_pdf_page(page.rect,src,i)
 else:
  clip=f.Rect(0,28,w,817)
  scale=.875
  ww,hh=w*scale,clip.height*scale
  left=(w-ww)/2
  page.show_pdf_page(f.Rect(left,120,left+ww,120+hh),src,i,clip=clip)
header_xref=0
for page in dst:
 w=page.rect.width
 header_xref=page.insert_image(f.Rect(0,0,w,w*105/612),stream=header,xref=header_xref)
dst.set_metadata({**src.metadata,'title':'Projectile Motion Calculator — PBL Report'})
target=out/'Projectile_Motion_Calculator_PBL_Report_With_Header.pdf'
dst.save(target,garbage=4,deflate=True)
saved=f.open(target)
assert len(saved)==len(src)
for i,page in enumerate(saved):
 before=Counter(re.findall(r'\S+',original_text[i]));after=Counter(re.findall(r'\S+',page.get_text()))
 missing=before-after
 assert not missing,(i+1,missing)
 # The header is a single high-resolution image shared by all pages.
 assert any(im[2]==2448 and im[3]==420 for im in page.get_images(full=True))
for i in (0,1,12): saved[i].get_pixmap(matrix=f.Matrix(1.3,1.3)).save(out/f'projectile-preview-{i+1:02}.png')
print(f'Created {target}\nVerified: all original text preserved on all {len(saved)} pages.')
