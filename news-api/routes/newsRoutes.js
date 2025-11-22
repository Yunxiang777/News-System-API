import express from "express";
import { NewsController } from "../controllers/newsController.js";

const router = express.Router();

router.get("/", NewsController.getAll);
router.get("/:id", NewsController.getOne);
router.post("/", NewsController.create);
router.put("/:id", NewsController.update);
router.delete("/:id", NewsController.remove);

export default router;