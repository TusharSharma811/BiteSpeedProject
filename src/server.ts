import express from 'express' ;
import dotenv from 'dotenv' ;
import type { Request, Response, NextFunction } from 'express';
import identifyRouter from './routes/identifyRoute.js';
dotenv.config() ;

const app = express() ;
app.use(express.json()) ;


const PORT = process.env.PORT ;

app.get("/", (req:Request, res:Response) => {
  res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});


app.use("/", identifyRouter);

app.listen(PORT , ()=>{
    console.log("Server live on :" , PORT);
    
})