import type { Request,Response,NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
declare global { namespace Express { interface Request { userId?:string; userRole?:"USER"|"ADMIN" } } }
export function requireAuth(req:Request,res:Response,next:NextFunction) {
 const token=req.cookies?.access_token as string|undefined;
 if(!token){res.status(401).json({error:"Authentication required"});return;}
 try { const p=jwt.verify(token,env.JWT_SECRET,{issuer:"banking-genai-api",audience:"banking-genai-web"});
  if(typeof p==="string"||!p.sub){res.status(401).json({error:"Invalid session"});return;}
  req.userId=p.sub;req.userRole=p.role==="ADMIN"?"ADMIN":"USER";next();
 } catch {res.status(401).json({error:"Invalid or expired session"});}
}
export function requireAdmin(req:Request,res:Response,next:NextFunction){if(!req.userId||req.userRole!=="ADMIN"){res.status(403).json({error:"Administrator access required"});return;}next();}
