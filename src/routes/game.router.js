import { gameDataClient } from "../utils/prisma/index.js";
import express from "express";

const router = express.Router();


router.post("/item", async (req, res) => {
    const { item_code, item_name, item_stat, item_price } = req.body

    try {
        const newItem = await gameDataClient.item.create({
            data: {
                item_code,
                item_name,
                health: item_stat.health,
                power: item_stat.power,
                item_price,
            },
        });

        return res.status(201).json({ id: newItem.id });
    } catch (error) {
        console.error("아이템 생성 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "아이템 생성 중 오류가 발생했습니다." });
    }
});

router.put("/item/:id", async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    const { item_name, item_stat } = req.body

    try {
        const existingItem = await gameDataClient.item.findUnique({
            where: { id: itemId },
        });

        if (!existingItem) {
            return res
            .status(404)
            .json({ message: "해당 아이템을 찾을 수 없습니다." });
        }

        const updatedItem = await gameDataClient.item.update({
            where: { id: itemId },
            data: {
                item_name,
                health: item_stat.health,
                power: item_stat.power,
            },
        })

        return res
        .status(200)
        .json({ message: "아이템이 성공적으로 수정되었습니다.", updatedItem });
    } catch (error) {
        console.error("아이템 수정 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "아이템 수정 중 오류가 발생했습니다." });
    }
});

router.get("/items", async (req, res) => {
    try {
        const items = await gameDataClient.item.findMany({
            select: {
                item_code: true,
                item_name: true,
                item_price: true,
            },
        });

        return res.status(200).json(items);
    } catch (error) {
        console.error("아이템 목록 조회 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "아이템 목록 조회 중 오류가 발생했습니다." });
    }
});

router.get("/item/:itemCode", async (req, res) => {
    const itemCode = parseInt(req.params.itemCode, 10);

    try {
        const item = await gameDataClient.item.findUnique({
            where: { item_code: itemCode },
            select: {
                item_code: true,
                item_name: true,
                health: true,
                power: true,
                item_price: true,
            },
        });

        if (!item) {
            return res
            .status(404)
            .json({ message: "해당 아이템을 찾을 수 없습니다." });
        }

        const itemWithStats = {
            item_code: item.item_code,
            item_name: item.item_name,
            item_stat: { health: item.health, power: item.power },
            item_price: item.item_price,
        };

        return res.status(200).json(itemWithStats);
    } catch (error) {
        console.error("아이템 상세 조회 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "아이템 상세 조회 중 오류가 발생했습니다." });
    }
});

export default router;