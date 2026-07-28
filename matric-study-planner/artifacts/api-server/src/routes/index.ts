import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain";
import practiceRouter from "./practice";
import scheduleRouter from "./schedule";
import tutorRouter from "./tutor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(practiceRouter);
router.use(scheduleRouter);
router.use(tutorRouter);

export default router;
