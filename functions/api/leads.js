const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const choices={property_type:["Casa","Apartamento","Comércio","Empresa","Outros"],ownership:["Próprio","Alugado"],bill_range:["Até R$ 150","R$ 150 a R$ 300","R$ 300 a R$ 600","Acima de R$ 600","Não pago energia","Tenho placa"],benefit:["Não participo","Sim, participo de tarifa social ou baixa renda"],bill_holder:["Sim.","Não, proprietário do imóvel.","Não, parente ou familiar."]};
const states="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export async function onRequestPost({request,env}){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json(503,{error:"Servidor não configurado"});
 if(Number(request.headers.get("content-length")||0)>6000000)return json(413,{error:"Arquivo muito grande"});
 let d;try{d=await request.json()}catch{return json(400,{error:"JSON inválido"})}
 if(d.website)return json(400,{error:"Solicitação inválida"});
 const name=String(d.name||"").trim().slice(0,120),whatsapp=String(d.whatsapp||"").replace(/[^0-9]/g,"");
 if(name.length<2||whatsapp.length<10||whatsapp.length>13||!states.includes(d.state)||d.consent!==true||Object.entries(choices).some(([key,opts])=>!opts.includes(d[key])))return json(400,{error:"Dados obrigatórios inválidos"});
 let bytes,ext;
 if(d.attachment){
  const a=d.attachment;ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"})[a.type];
  if(!ext||typeof a.base64!=="string"||a.base64.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(a.base64))return json(400,{error:"Formato de fatura inválido"});
  try{bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0))}catch{return json(400,{error:"Fatura inválida"})}
  if(bytes.length>4194304)return json(413,{error:"Fatura acima de 4 MB"});
  const h=bytes.slice(0,12),tag=(start,end)=>String.fromCharCode(...h.slice(start,end));
  const valid=ext==="pdf"?tag(0,5)==="%PDF-":ext==="png"?h[0]===137&&tag(1,4)==="PNG":ext==="jpg"?h[0]===255&&h[1]===216&&h[2]===255:tag(0,4)==="RIFF"&&tag(8,12)==="WEBP";
  if(!valid)return json(400,{error:"Conteúdo do arquivo inválido"});
 }
 const base=env.SUPABASE_URL.replace(/\/$/,""),auth={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY};
 let lead;
 try{
  const r=await fetch(base+"/rest/v1/energy_leads?select=id,protocol,created_at",{method:"POST",headers:{...auth,"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({name,whatsapp,state:d.state,property_type:d.property_type,ownership:d.ownership,bill_range:d.bill_range,benefit:d.benefit,bill_holder:d.bill_holder,consent:true,source:"projeto-2-cloudflare"})});
  if(!r.ok){console.error("Lead insert",r.status);return json(502,{error:"Não foi possível salvar a solicitação"})}
  lead=(await r.json())[0];if(!lead?.id)throw Error("Missing ID");
 }catch(e){console.error("Lead request failed",String(e));return json(502,{error:"Falha ao registrar"})}
 let bill_url=null;
 if(bytes){
  const path=lead.id+"/fatura."+ext;
  try{
   const up=await fetch(base+"/storage/v1/object/energy-bills/"+path,{method:"POST",headers:{...auth,"content-type":d.attachment.type,"x-upsert":"false"},body:bytes});
   if(!up.ok){console.error("Bill upload",up.status);return json(502,{error:"Cadastro salvo, mas não foi possível anexar a fatura"})}
   await fetch(base+"/rest/v1/energy_leads?id=eq."+encodeURIComponent(lead.id),{method:"PATCH",headers:{...auth,"content-type":"application/json"},body:JSON.stringify({bill_path:path})});
   const sign=await fetch(base+"/storage/v1/object/sign/energy-bills/"+path,{method:"POST",headers:{...auth,"content-type":"application/json"},body:JSON.stringify({expiresIn:604800})});
   if(sign.ok){const result=await sign.json();const url=result.signedURL||result.signedUrl;if(url)bill_url=base+"/storage/v1"+url}
  }catch(e){console.error("Bill request",String(e));return json(502,{error:"Cadastro salvo, mas ocorreu falha ao anexar a fatura"})}
 }
 return json(201,{ok:true,id:lead.id,protocol:lead.protocol,bill_url,created_at:lead.created_at});
}
export async function onRequestGet(){return json(405,{error:"Método não permitido"})}
