import { Router, type IRouter } from "express";
import healthRouter from "./health";
import practiceRouter from "./practice";
import scheduleRouter from "./schedule";
import tutorRouter from "./tutor";
import { aiRateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRateLimit);
router.use(practiceRouter);
router.use(scheduleRouter);
router.use(tutorRouter);

export default router;
