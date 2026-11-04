from pathlib import Path
import pymupdf as f
import qrcode
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
SRC=Path('/Users/Apple/Downloads/EV_Charging_Poster (1).pdf')
navy='#103969'; bg='#dbe5f3'; panel='#eef1f5'; teal='#247e83'
def rgb(h): return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
doc=f.open(); p=doc.new_page(width=1423,height=840)
p.draw_rect(p.rect,color=None,fill=rgb(bg))
def html(rect,s,size=12,color='#202b3a',align='left'):
 css=f'* {{font-family: sans-serif;}} body {{font-size:{size}pt;color:{color};margin:0;line-height:1.23;text-align:{align};}} p {{margin:0 0 9px;}} ul {{margin:0;padding-left:16px;}} li {{margin:0 0 9px;}} b {{font-weight:bold;}} table {{border-collapse:collapse;width:100%;}} td,th {{border:1px solid #aab8c9;padding:6px;text-align:left;vertical-align:top;}} th {{background:#d4deec;color:{navy};}}'
 spare,scale=p.insert_htmlbox(f.Rect(rect),s,css=css,scale_low=1)
 if spare<0: raise RuntimeError(f'Overflow {rect}: {s[:90]}')
def section(x,y,h,title):
 p.draw_rect(f.Rect(x,y,x+330,y+h),color=None,fill=rgb(panel))
 p.draw_rect(f.Rect(x,y,x+330,y+26),color=None,fill=rgb(navy))
 html((x+5,y+3,x+325,y+25),title,14,'#ffffff','center')
 return (x+11,y+37,x+319,y+h-10)
# Reuse the supplied institution logos without altering them.
old=f.open(SRC)
for xref,r in [(3,(30,32,124,110)),(4,(139,32,235,110)),(5,(1295,30,1387,113))]:
 p.insert_image(f.Rect(r),stream=old.extract_image(xref)['image'])
html((245,22,1178,70),'<b>DELHI TECHNICAL CAMPUS</b>',34,navy,'center')
html((245,72,1178,96),'<b>Affiliated to GGSIPU, New Delhi | NAAC-A++ | Greater Noida</b>',13,navy,'center')
html((245,97,1178,117),'Session 2026–27  •  OOPS USING C++',12,navy,'center')
html((230,124,1193,158),'<b>EV Charging Station Management System</b>',25,navy,'center')
html((235,159,1188,181),'C++17 Smart Queue &amp; Full-Stack Demonstration',13,navy,'center')
p.draw_line((0,187),(1423,187),color=rgb(navy),width=2)
x1,x2,x3,x4=30,374,718,1062
html(section(x1,202,238,'Introduction'),'''<p>EV charging requires decisions about vehicle range, waiting time, charging deadlines, budget and available power.</p><p>This project models these decisions using a modular <b>C++17 charging engine</b>, supported by a web interface and simulated charging updates.</p><p>The customer app, <b>Pluggo</b>, supports vehicle selection, station discovery, charging sessions and demo receipts.</p><p><b>Scope:</b> an educational simulation with no real charger control or live payment.</p>''',12)
html(section(x1,452,368,'Objectives'),'''<ul><li>Apply <b>encapsulation</b> through vehicle, user, charger, session and station classes.</li><li>Demonstrate default, parameterized and copy constructors, destructors and function overloading.</li><li>Build a reusable <b>SmartPriorityQueue&lt;T, ScorePolicy&gt;</b> with FIFO tie-breaking.</li><li>Plan charging within deadline, connector and budget constraints.</li><li>Simulate solar/grid allocation and emergency preemption with compensation.</li><li>Validate inputs using exceptions and demonstrate behavior through automated checks.</li></ul>''',12.5)
html(section(x2,202,256,'Feasibility Study and Tools Used'),'''<p><b>Technical:</b> C++17 domain logic with a Crow JSON API, browser UI and SQLite customer storage.</p><p><b>Economic:</b> open-source tools; no dedicated charging hardware needed.</p><p><b>Operational:</b> customer and operator interfaces support a classroom demonstration.</p><p><b>Core tools:</b> C++17, CMake, CTest, Crow/Asio, HTML/CSS/JavaScript and SQLite.</p><p><b>Supporting components:</b> Leaflet/OpenStreetMap, Python charging simulator, Flutter app and Docker.</p>''',11.8)
section(x2,470,350,'System Architecture')
# Native vector architecture flow.
for yy,title,sub in [(510,'CLIENT LAYER','Pluggo web app / Flutter app'),(578,'API LAYER','Crow REST / JSON endpoints'),(646,'C++ DOMAIN LAYER','Queue • pricing • charging rules')]:
 p.draw_rect(f.Rect(x2+19,yy,x2+311,yy+48),color=rgb('#a9bacd'),fill=(1,1,1))
 html((x2+24,yy+5,x2+306,yy+24),f'<b>{title}</b>',11,navy,'center')
 html((x2+24,yy+25,x2+306,yy+44),sub,11,'#202b3a','center')
 if yy<646:
  p.draw_line((x2+165,yy+49),(x2+165,yy+64),color=rgb(teal),width=1.6)
  p.draw_polyline([(x2+161,yy+60),(x2+165,yy+64),(x2+169,yy+60)],color=rgb(teal),width=1.6)
html((x2+15,708,x2+315,808),'''<p><b>Storage:</b> SQLite persists customer vehicles, sessions and receipts. Legacy operator sessions remain in memory.</p><p><b>Simulation:</b> WebSocket / OCPP simulator supplies charging updates through the API boundary.</p>''',11.5)
html(section(x3,202,285,'Design: Components and Concepts Used'),'''<table><tr><th>Component</th><th>OOP / C++ concept</th></tr><tr><td>Vehicle, User, Charger, Session, Station</td><td>Encapsulation; constructors and destructors</td></tr><tr><td>SmartPriorityQueue&lt;T, ScorePolicy&gt;</td><td>Class template; score ordering; FIFO ties</td></tr><tr><td>PricingEngine:: calculateCost</td><td>Overloading: flat, time-of-use and solar pricing</td></tr><tr><td>logEvent&lt;T&gt;</td><td>Function template</td></tr><tr><td>Input validation</td><td>Exception handling</td></tr></table>''',10.8)
html(section(x3,499,321,'Implementation'),'''<p><b>Simulated charging workflow</b></p><p><b>1.</b> Select a vehicle and compatible station.</p><p><b>2.</b> Validate range, deadline and budget.</p><p><b>3.</b> Queue the request; allocate a compatible charger by priority.</p><p><b>4.</b> Simulate charging using solar power with grid fallback.</p><p><b>5.</b> Show battery state, energy, cost and session history.</p><p><b>Emergency handling:</b> pause an eligible normal session and compensate the affected user.</p><p><b>Additional features:</b> charger QR scanning, an India station directory, map search and directions.</p>''',12)
section(x4,202,343,'Result and Demonstration')
p.insert_image(f.Rect(x4+11,239,x4+319,431),filename=str(ROOT/'docs/ui-audit/backend-connected/desktop-home-viewport.png'),keep_proportion=True)
html((x4+11,434,x4+319,458),'Actual Pluggo customer interface • simulated data',9.6,navy,'center')
html((x4+11,461,x4+319,535),'''<b>Automated check coverage:</b> range boundaries; deadline feasibility; connector compatibility; pricing and budget caps; queue ordering and FIFO ties; solar fallback; emergency preemption and rejection.''',11.2)
html(section(x4,557,137,'Conclusion'),'''<p>C++ classes, templates and overloads connect charging decisions to an interactive application.</p><p><b>Future scope:</b> PostgreSQL integration, Keycloak JWT validation and an audited OCPP service. Current authentication and charger interaction are for demonstration.</p>''',11.4)
section(x4,706,114,'Submission by')
html((x4+10,740,x4+244,802),'''<b>BHUMIKA (00818015625)<br>ADITI RAJ (11318015625)<br>RONIT SHARMA (01018015625)<br>SARTHAK KUMAR (05318015625)</b><br>CSE-AIML | Submitted to: Ms. Kajal Kumari''',9.6)
url='https://github.com/Bhumika-gaba23/EV-charging-management'
qr=qrcode.make(url); qr.save(OUT/'repository-qr.png')
p.insert_image(f.Rect(x4+251,739,x4+318,806),filename=str(OUT/'repository-qr.png'))
p.insert_link({'kind':f.LINK_URI,'from':f.Rect(x4+251,739,x4+318,818),'uri':url})
html((x4+245,807,x4+324,819),'Scan: source code',7.8,navy,'center')
doc.set_metadata({'title':'EV Charging Station Management System — Project Poster','author':'Bhumika, Aditi Raj, Ronit Sharma, Sarthak Kumar','subject':'OOPS using C++ | Delhi Technical Campus'})
doc.save(OUT/'EV_Charging_Poster_Updated.pdf',deflate=True)
p.get_pixmap(matrix=f.Matrix(1.6,1.6)).save(OUT/'EV_Charging_Poster_Updated.png')
print(OUT/'EV_Charging_Poster_Updated.pdf')
