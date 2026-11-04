// Same-origin gateway to the existing C++ domain API. No JS replacement engine.
const paths=new Map([
 ['health',['GET']],['station',['GET']],['queue',['GET','POST']],
 ['plan',['POST']],['budget',['POST']],['queue/serve',['POST']],
 ['solar/simulate',['POST']],['emergency',['POST']],
 ...['A1','A2','B1','B2'].map(id=>['chargers/'+id,['GET']]),
]);
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://gateway.local');
 const parameter=req.query?.path||url.searchParams.get('path');
 const path=Array.isArray(parameter)?parameter.join('/'):parameter||url.pathname.replace(/^\/api\//,'');
 const methods=paths.get(path);
 if(!methods)return res.status(404).json({ok:false,error:'Unknown operator route'});
 if(!methods.includes(req.method))return res.status(405).json({ok:false,error:'Method not allowed'});
 const origin=process.env.PLUGGO_CPP_ORIGIN;
 if(!origin)return res.status(503).json({ok:false,error:'C++ backend is not configured for this website. Browser simulation is available.'});
 try {
  const target=new URL(origin);
  if(target.protocol!=='https:'||target.username||target.password)throw new Error('Backend origin must be HTTPS');
  const body=req.method==='POST'?(typeof req.body==='string'?req.body:JSON.stringify(req.body||{})):undefined;
  if(body&&Buffer.byteLength(body)>16384)return res.status(413).json({ok:false,error:'Request too large'});
  const response=await fetch(new URL('/api/'+path,target),{method:req.method,headers:{'Content-Type':'application/json',...(process.env.PLUGGO_GATEWAY_KEY?{'X-Pluggo-Gateway-Key':process.env.PLUGGO_GATEWAY_KEY}:{})},body,redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(!response.headers.get('content-type')?.includes('application/json'))return res.status(502).json({ok:false,error:'C++ backend returned an invalid response'});
  res.status(response.status).json(await response.json());
 }catch {res.status(503).json({ok:false,error:'C++ backend is unavailable. Check the configured host.'});}
}
