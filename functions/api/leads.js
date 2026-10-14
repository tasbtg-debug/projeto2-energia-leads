import { createClient } from '@supabase/supabase-js';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const choices={
 property_type:['Casa','Apartamento','Comércio','Empresa','Outros'],
 ownership:['Próprio','Alugado'],
 bill_range:['Até R$ 150','R$ 150 a R$ 300','R$ 300 a R$ 600','Acima de R$ 600','Não pago energia','Tenho placa'],
 benefit:['Não participo','Sim, participo de tarifa social ou baixa renda'],
 bill_holder:['Sim.','Não, proprietário do imóvel.','Não, parente ou familiar.']
};
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const mime={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
export async function onRequest({request,env}){
 if(request.method!=='POST')return json(405,{error:'Método não permitido'});
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json(503,{error:'API não configurada'});
 if(Number(request.headers.get('content-length')||0)>6000000)return json(413,{error:'Arquivo muito grande'});
 let data;
 try{data=await request.json();}catch{return json(400,{error:'JSON inválido'});}
 if(!data||typeof data!=='object')return json(400,{error:'Dados inválidos'});
 if(data.website)return json(200,{ok:true});
 const name=String(data.name||'').trim().slice(0,120);
 const phone=String(data.whatsapp||'').replace(/\D/g,'');
 const state=String(data.state||'');
 if(name.length<2||!/^\d{10,13}$/.test(phone)||!states.has(state)||data.consent!==true||Object.entries(choices).some(([key,allowed])=>!allowed.includes(data[key])))return json(400,{error:'Revise os campos obrigatórios e o consentimento'});
 let bytes=null,type=null;
 if(data.attachment){
  type=data.attachment.type;
  const b64=data.attachment.base64;
  if(!mime[type]||typeof b64!=='string'||b64.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))return json(400,{error:'Anexo inválido'});
  const raw=atob(b64);
  if(raw.length>4194304)return json(413,{error:'O anexo deve ter até 4 MB'});
  bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 }
 const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:lead,error}=await client.from('energy_leads').insert({name,whatsapp:phone,state,property_type:data.property_type,ownership:data.ownership,bill_range:data.bill_range,benefit:data.benefit,bill_holder:data.bill_holder,consent:true,source:'projeto-2-cloudflare'}).select('id,created_at,protocol').single();
 if(error){console.error('Erro no cadastro',error.code);return json(500,{error:'Não foi possível registrar a análise'});}
 let bill_url=null;
 if(bytes){
  const path=lead.id+'/fatura.'+mime[type];
  const uploaded=await client.storage.from('energy-bills').upload(path,bytes,{contentType:type,upsert:false});
  if(uploaded.error){console.error('Falha no upload',uploaded.error.message);return json(500,{error:'Análise registrada, mas a fatura não foi anexada. Contate o atendimento e informe o protocolo '+lead.protocol});}
  const updated=await client.from('energy_leads').update({bill_path:path}).eq('id',lead.id);
  if(updated.error)console.error('Falha ao salvar caminho',updated.error.code);
  const signed=await client.storage.from('energy-bills').createSignedUrl(path,60*60*24*7);
  if(signed.error)return json(500,{error:'Análise e fatura registradas, mas o link não pôde ser criado. Informe o protocolo '+lead.protocol});
  bill_url=signed.data.signedUrl;
 }
 return json(201,{ok:true,id:lead.id,protocol:lead.protocol,bill_url,created_at:lead.created_at});
}
