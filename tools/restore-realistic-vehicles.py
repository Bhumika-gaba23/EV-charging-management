"""Restore detailed source models from a preserved build and apply white finishes.
Usage: python3 tools/restore-realistic-vehicles.py <source-model-directory>
"""
import json, struct, sys, io
from pathlib import Path
from PIL import Image
source=Path(sys.argv[1]);target=Path('frontend/assets/models')
for name in ['scooter','bike']:
 b=(source/f'{name}.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0]
 j=json.loads(b[20:20+n]);binary=bytearray(b[28+n:])
 if name=='scooter':
  for m in j['materials']:
   if m.get('name') in ['Original teal enamel paint','Original warm white outdoor paint']:
    m['pbrMetallicRoughness'].update(baseColorFactor=[.95,.95,.93,1],metallicFactor=.12,roughnessFactor=.28)
 else:
  # Preserve dark tires and atlas details while bringing the painted highlights to white.
  tex=j['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
  image_index=j['textures'][tex].get('extensions',{}).get('EXT_texture_webp',{}).get('source',j['textures'][tex].get('source'))
  im=j['images'][image_index];view=j['bufferViews'][im['bufferView']];off=view.get('byteOffset',0)
  image=Image.open(io.BytesIO(binary[off:off+view['byteLength']])).convert('RGB')
  image=image.point(lambda x: min(255,int(x*1.32)) if x>85 else x)
  out=io.BytesIO();image.save(out,format='WEBP',quality=92);data=out.getvalue()
  while len(binary)%4:binary.append(0)
  im['bufferView']=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data)
  while len(binary)%4:binary.append(0)
  j['buffers'][0]['byteLength']=len(binary)
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 binary+=b'\0'*((-len(binary))%4)
 (target/f'{name}.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
