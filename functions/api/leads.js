const json=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const allowed={property_type:["Casa","Apartamento","Comércio","Empresa","Outros"],bill_range:["Até R$ 150","R$ 150 a R$ 300","R$ 300 a R$ 600","Acima de R$ 600","Não pago energia","Tenho placa"],benefit:["Não participo","Sim, participo de tarifa social ou baixa renda"],ownership:["Próprio","Alugado"],bill_holder:["Sim.","Não, proprietário do imóvel.","Não, parente ou familiar."]};
const states="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const mimeExt={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
export async function onRequestPost({request,env}){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json(503,{error:"Conexão com Supabase não configurada"});
 let data;try{data=await request.json()}catch{return json(400,{error:"JSON inválido"})}
 if(data.website)return json(200,{ok:true});
 const name=String(data.name||"").trim().slice(0,120),phone=String(data.whatsapp||"").replace(/\D/g,""),state=String(data.state||"");
 if(name.length<2||!/^[0-9]{10,13}$/.test(phone)||!states.includes(state)||data.consent!==true||Object.entries(allowed).some(([k,v])=>!v.includes(data[k])))return json(400,{error:"Revise os dados e o consentimento"});
 const file=data.attachment;
 if(file&&(!mimeExt[file.type]||typeof file.base64!=="string"||file.base64.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)))return json(400,{error:"Fatura inválida. Envie foto ou PDF de até 4 MB"});
 let bytes;
 if(file){try{const binary=atob(file.base64);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length>4194304)return json(400,{error:"Fatura excede 4 MB"})}catch{return json(400,{error:"Arquivo inválido"})}}
 const base=env.SUPABASE_URL.replace(/\/$/,""),headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY};
 try{
  const insert=await fetch(base+"/rest/v1/energy_leads?select=id,protocol,created_at",{method:"POST",headers:{...headers,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({name,whatsapp:phone,state,property_type:data.property_type,ownership:data.ownership,bill_range:data.bill_range,benefit:data.benefit,bill_holder:data.bill_holder,consent:true,source:"projeto-2-cloudflare"})});
  if(!insert.ok){console.error("Falha no cadastro",insert.status);return json(500,{error:"Não foi possível registrar a solicitação"})}
  const [lead]=await insert.json();if(!lead)return json(500,{error:"Resposta inesperada do banco"});
  let bill_url=null;
  if(file){
   const path=lead.id+"/fatura."+mimeExt[file.type];
   const upload=await fetch(base+"/storage/v1/object/energy-bills/"+path,{method:"POST",headers:{...headers,"content-type":file.type,"x-upsert":"false"},body:bytes});
   if(!upload.ok){console.error("Falha no anexo",upload.status);return json(500,{error:"Cadastro registrado, mas não foi possível anexar a fatura. Protocolo: "+lead.protocol})}
   await fetch(base+"/rest/v1/energy_leads?id=eq."+encodeURIComponent(lead.id),{method:"PATCH",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({bill_path:path})});
   const signed=await fetch(base+"/storage/v1/object/sign/energy-bills/"+path,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({expiresIn:604800})});
   if(signed.ok){const item=await signed.json();bill_url=item.signedURL||item.signedUrl||null;if(bill_url&&bill_url.startsWith("/"))bill_url=base+"/storage/v1"+bill_url}
  }
  return json(201,{ok:true,id:lead.id,protocol:lead.protocol,bill_url,created_at:lead.created_at});
 }catch(e){console.error("Falha de rede na API",String(e));return json(500,{error:"Falha temporária ao registrar solicitação"})}
}
