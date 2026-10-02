import { db } from "./db.js";
import { activateCustomer, terminateCustomer } from "./mikrotik.js";

export async function expireSessions() {
  const sessions = await db.session.findMany({
    where:{status:"ACTIVE",expiresAt:{lte:new Date()}},
    include:{customer:true}
  });
  for (const s of sessions) {
    await terminateCustomer(s.customer,s);
    await db.session.update({where:{id:s.id},data:{status:"EXPIRED"}});
  }
  return sessions.length;
}

export async function activatePaidPayment(paymentId) {
  const p = await db.payment.findUnique({where:{id:paymentId},include:{customer:true,package:true}});
  if (!p || p.status !== "SUCCESS") return null;
  const now = new Date();
  const session = await db.session.create({
    data:{
      customerId:p.customerId,
      packageName:p.package.name,
      startedAt:now,
      expiresAt:new Date(now.getTime()+p.package.durationMinutes*60000),
      dataLimit:p.package.dataBytes,
      downloadMbps:p.package.downloadMbps,
      uploadMbps:p.package.uploadMbps
    }
  });
  const result = await activateCustomer(p.customer,session);
  await db.session.update({where:{id:session.id},data:{mikrotikRef:result.ref}});
  return session;
}
