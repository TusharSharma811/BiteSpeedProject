import { Router } from "express";
import { identify } from "../services/identifyService.js";
import type { IdentifyRequest } from "../types/identifyServiceTypes.js";
import type { Request, Response, NextFunction } from 'express';

const router = Router();

    
router.post(
  "/identify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body: IdentifyRequest = req.body;

      if (!body.email && !body.phoneNumber) {
        res.status(400).json({
          error: "At least one of email or phoneNumber must be provided.",
        });
        return;
      }

      const result = await identify(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
