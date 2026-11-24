// Same-origin gateway to the existing C++ domain API. No JS replacement engine.
const paths=new Map([
 ['health',['GET']],['operator/auth',['GET']],['operator/refund',['POST']],['station',['GET']],['queue',['GET','POST']],
 ['operator/analytics',['GET']],['operator/reports',['GET']],['operator/credit',['POST']],
 ['plan',['POST']],['budget',['POST']],['queue/serve',['POST']],
 ['solar/simulate',['POST']],['emergency',['POST']],
 ...['A1','A2','B1','B2'].map(id=>['chargers/'+id,['GET']]),
]);
// The operator's Firebase ID token; the C++ API verifies it and checks the phone allowlist.
function operatorToken(req){const value=String(req.headers?.authorization||'');return /^Bearer [A-Za-z0-9._-]{20,4096}$/.test(value)?value:'';}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://gateway.local');
 const parameter=req.query?.path||url.searchParams.get('path');
 const path=Array.isArray(parameter)?parameter.join('/'):parameter||url.pathname.replace(/^\/api\//,'');
 // Resolving one fault report: the report ID is the only variable part of an operator path.
 const methods=paths.get(path)||(/^operator\/reports\/RP-[a-f0-9]{12}\/resolve$/.test(path)?['POST']:undefined);
 if(!methods)return res.status(404).json({ok:false,error:'Unknown operator route'});
 if(!methods.includes(req.method))return res.status(405).json({ok:false,error:'Method not allowed'});
 const origin=process.env.PLUGGO_CPP_ORIGIN;
 if(!origin)return res.status(503).json({ok:false,error:'C++ backend is not configured for this website. Browser simulation is available.'});
 try {
  const target=new URL(origin);
  if(target.protocol!=='https:'||target.username||target.password)throw new Error('Backend origin must be HTTPS');
  const body=req.method==='POST'?(typeof req.body==='string'?req.body:JSON.stringify(req.body||{})):undefined;
  if(body&&Buffer.byteLength(body)>16384)return res.status(413).json({ok:false,error:'Request too large'});
  const destination=new URL('/api/'+path,target);
  const days=url.searchParams.get('days');
  if(path==='operator/analytics'&&/^[0-9]{1,2}$/.test(days||''))destination.searchParams.set('days',days);
  const response=await fetch(destination,{method:req.method,headers:{'Content-Type':'application/json',...(process.env.PLUGGO_GATEWAY_KEY?{'X-Pluggo-Gateway-Key':process.env.PLUGGO_GATEWAY_KEY}:{}),...(operatorToken(req)?{'Authorization':operatorToken(req)}:{})},body,redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(!response.headers.get('content-type')?.includes('application/json'))return res.status(502).json({ok:false,error:'C++ backend returned an invalid response'});
  res.status(response.status).json(await response.json());
 }catch {res.status(503).json({ok:false,error:'C++ backend is unavailable. Check the configured host.'});}
}
