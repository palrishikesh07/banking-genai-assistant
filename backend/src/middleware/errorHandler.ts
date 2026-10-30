import type { ErrorRequestHandler,RequestHandler } from "express";
export const notFoundHandler:RequestHandler=(_req,res)=>{res.status(404).json({error:"Route not found"});};
export const errorHandler:ErrorRequestHandler=(err,_req,res,_next)=>{console.error("request_failed",err instanceof Error?err.message:"unknown");if(!res.headersSent)res.status(500).json({error:"Internal server error"});};
