import { createClient } from '@supabase/supabase-js';
const cors = {'Content-Type':'application/json','Cache-Control':'no-store'};
const response = (code, obj) => ({statusCode:code,headers:cors,body:JSON.stringify(obj)});
const values = {
  property_type:['Casa','Apartamento','Comércio','Empresa','Outros'],
  bill_range:['Até R$ 150','R$ 150 a R$ 300','R$ 300 a R$ 600','Acima de R$ 600','Não pago energia','Tenho placa'],
  benefit:['Não participo','Sim, participo de tarifa social ou baixa renda'],
  ownership:['Próprio','Alugado'],
  bill_holder:['Sim.','Não, proprietário do imóvel.','Não, parente ou familiar.']
};
export async function handler(event){
 if(event.httpMethod!=='POST') return response(405,{error:'Método não permitido'});
 if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response(503,{error:'API ainda não configurada'});
 let data; try { data=JSON.parse(event.body||'{}'); } catch {return response(400,{error:'JSON inválido'});}
 if(data.website) return response(200,{ok:true});
 const name=String(data.name||'').trim().slice(0,120);
 const phone=String(data.whatsapp||'').replace(/\D/g,'');
 const state=String(data.state||'');
 const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
 if(name.length<2 || !/^\d{10,13}$/.test(phone) || !states.includes(state) || Object.entries(values).some(([k,opts])=>!opts.includes(data[k])) || data.consent!==true) return response(400,{error:'Revise os campos obrigatórios e o consentimento.'});
 const attachment=data.attachment;
 if(attachment && (!['image/jpeg','image/png','image/webp','application/pdf'].includes(attachment.type)||typeof attachment.base64!=='string'||attachment.base64.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.base64))) return response(400,{error:'Arquivo inválido. Envie foto ou PDF de até 4 MB.'});
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:lead,error}=await client.from('energy_leads').insert({name,whatsapp:phone,state,property_type:data.property_type,ownership:data.ownership,bill_range:data.bill_range,benefit:data.benefit,bill_holder:data.bill_holder,consent:true,source:'projeto-2-netlify'}).select('id,created_at,protocol').single();
 if(error) {console.error('Erro ao registrar lead',error.code);return response(500,{error:'Não foi possível registrar. Tente novamente.'});}
 let bill_url=null;
 if(attachment){
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[attachment.type];
  const filePath=lead.id+'/fatura.'+ext;
  const bytes=Buffer.from(attachment.base64,'base64');
  if(bytes.length>4*1024*1024) return response(400,{error:'Arquivo excede 4 MB. O cadastro foi registrado, mas a fatura não foi anexada.'});
  const uploaded=await client.storage.from('energy-bills').upload(filePath,bytes,{contentType:attachment.type,upsert:false});
  if(uploaded.error){console.error('Erro no armazenamento da fatura',uploaded.error.message);return response(500,{error:'Cadastro registrado, mas houve erro ao anexar a fatura. Contate o atendimento.'});}
  await client.from('energy_leads').update({bill_path:filePath}).eq('id',lead.id);
  const signed=await client.storage.from('energy-bills').createSignedUrl(filePath,60*60*24*7);
  if(signed.error){console.error('Erro ao criar link da fatura');return response(500,{error:'Fatura salva, mas o link não pôde ser criado. Contate o atendimento.'});}
  bill_url=signed.data.signedUrl;
 }
 return response(201,{ok:true,id:lead.id,protocol:lead.protocol,bill_url,created_at:lead.created_at});
}
