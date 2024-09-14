import { gameDataClient, userDataClient } from "../utils/prisma/index.js";
import authMiddleware from "../middlewares/auth.middleware.js";

import express from "express";
import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

// 회원가입 API
router.post("/sign-up", async (req, res) => {
    try {
        const { account, password, confirmPassword, name } = req.body;

        const isExistUser = await userDataClient.account.findUnique({
            where: { account },
        });

        if (isExistUser) {
            return res.status(409).json({ message: "이미 존재하는 아이디입니다." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const accountRegex = /^[a-z0-9]+$/;
        if (!accountRegex.test(account)) {
            return res
            .status(400)
            .json({ message: "아이디는 영어 소문자와 숫자의 조합이어야 합니다." });
        }

        if (password.length < 6) {
            return res
            .status(400)
            .json({ message: "비밀번호는 최소 6자 이상이어야 합니다." });
        }

        if (password !== confirmPassword) {
            return res
            .status(400)
            .json({ message: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });
        }

        const user = await userDataClient.account.create({
            data: {
                account,
                password: hashedPassword,
                name,
            },
        });

        return res.status(201).json({
            userId: user.id,
            account: user.account,
            name: user.name,
        });
    } catch (error) {
        console.error("회원가입 중 에러 발생.", error);
        return res
        .status(500)
        .json({ message: "회원가입 중 에러가 발생하였습니다." });
    }
});

// 로그인 API
router.post("/sign-in", async (req, res, next) => {
    try {
        const { account, password } = req.body;

        const user = await userDataClient.account.findFirst({ where: { account } });

        if (!user) 
            return res.status(401).json({ message: "존재하지 않는 아이디입니다." });
        else if (!(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ message: "비밀번호가 일치하지 않습니다."});
    
        const token = jwt.sign(
            { 
              userId: user.id, 
            },
            "jwt-secret"
        );

        res.cookie("authorization", `Bearer ${token}`);
        return res.status(200).json({ message: "로그인 성공" });
    } catch (error) {
        console.error("로그인 중 에러발생:", error);
        return res
        .status(500)
        .json({ message: "로그인 중 에러가 발생하였습니다." });
    }
});

// 캐릭터 생성 API
router.post("/character", authMiddleware, async (req, res) => {
    const { name } = req.body;
    const accountId = req.user.id

    try {
        const isExisCharacterName = await userDataClient.character.findUnique({
            where: { name },
        });

        if (isExisCharacterName) {
            return res
            .status(409)
            .json({ message: "이미 존재하는 캐릭터 명입니다." });
        }

        const newCharacter = await userDataClient.character.create({
            data: {
                name,
                accountId,
                health: 500,
                power: 100,
                money: 10000,
                characterInventory: {
                    create: [],
                },
                characterItem: {
                    create: [],
                },
            } ,
            include: {
                characterInventory: true,
                characterItem: true,
            },
        });

        return res.status(201).json({ id: newCharacter.id });
    } catch (error) {
        console.error("캐릭터 생성 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "캐릭터 생성 중 오류가 발생했습니다." });
    }
});

// 캐릭터 삭제 API
router.delete("/character/:id", authMiddleware, async (req, res) => {
    const characterId = parseInt(req.params.id, 10);
    const accountId = req.user.id;

    try {
        const character = await userDataClient.character.findUnique({
            where: { id: characterId },
            include: { account: true },
        });

        if (!character) {
            return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다." });
        }

        if (character.accountId !== accountId) {
            return res
            .status(403)
            .json({ message: "해당 캐릭터를 삭제할 권한이 없습니다." });
        }

        await userDataClient.character.delete({
            where: { id: characterId },
        });

        return res
        .status(200)
        .json({ message: "캐릭터가 성공적으로 삭제되었습니다." });
    } catch (error) {
        console.error("캐릭터 삭제 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "캐릭터 삭제 중 오류가 발생했습니다." });
    }
});

// 캐릭터 조회 API
router.get("/character/:id", authMiddleware, async (req, res) => {
    const characterId = parseInt(req.params.id, 10);
    const accountId = req.user.id;

    try {
        const character = await userDataClient.character.findUnique({
            where: { id: characterId },
            include: {
                account: true,
                characterInventory: true,
                characterItem: true,
            },
        });

        if (!character) {
            return res.status(404).json({ message: "캐릭터를 찾을 수 없습니다" });
        }

        const isOwner = character.accountId === accountId;

        const characterData = {
            name: character.name,
            health: character.health,
            power: character.power,
        };

        if (isOwner) {
            characterData.money = character.money;
        }

        return res.status(200).json(characterData);
    } catch (error) {
        console.error("캐릭터 조회 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "캐릭터 조회 중 오류가 발생했습니다." });
    }
});

router.post("/character/:characterId/purchase", authMiddleware, async (req, res) => {
    const characterId = parseInt(req.params.characterId, 10);
    const userId = req.user.id;
    const itemsToPurchase = req.body;

    try {
        const character = await userDataClient.character.findFirst({
            where: {
                id: characterId,
                accountId: userId,
            },
        });

        if (!character) {
            return res.status(403).json({ message: "내 캐릭터가 아닙니다." });
        }

        let totalCost = 0;
        for (const item of itemsToPurchase) {
            const { item_code, count } = item;
            const itemInfo = await gameDataClient.item.findUnique({
                where: { item_code },
                select: { item_price: true },
            });

            if (!itemInfo) {
                return res.status(404).json({ message: `아이템 코드 ${item_code}를 찾을 수 없습니다.` });
            }

            totalCost += itemInfo.item_price * count;
        }

        if (character.money < totalCost) {
            return res.status(400).json({ message: "게임 머니가 부족합니다." });
        }

        await userDataClient.$transaction(async (userDataClient) => {
            for (const item of itemsToPurchase) {
                const { item_code, count } = item;

                await userDataClient.characterInventory.createMany({
                    data: Array(count).fill({
                        characterId,
                        itemId: item_code,
                    }),
                });
            }

            await userDataClient.character.update({
                where: { id: characterId },
                data: { money: { decrement: totalCost } },
            });
        });

        const updatedCharacter = await userDataClient.character.findUnique({
            where: { id: characterId },
            select: { money: true },
        });

        return res.status(200).json({
            message: "아이템을 구매했습니다.",
            money: updatedCharacter.money,
        });
    } catch (error) {
        console.error("아이템 구입 중 에러 발생:", error);
        return res.status(500).json({ message: "아이템 구입 중 오류가 발생했습니다." });
    }
});

router.post("/character/:characterId/sell", authMiddleware, async (req, res) => {
    const characterId = parseInt(req.params.characterId, 10);
    const userId = req.user.id;
    const itemsToSell = req.body;

    try {
        const character = await userDataClient.character.findFirst({
            where: {
                id: characterId,
                accountId: userId,
            },
        });

        if (!character) {
            return res.status(403).json({ message: "내 캐릭터가 아닙니다." });
        }

        let totalRevenue = 0;

        for (const item of itemsToSell) {
            const { item_code } = item;

            const inventoryItem = await userDataClient.characterInventory.findFirst({
                where: { 
                    characterId,
                    itemId: item_code,
                },
            });

            if (!inventoryItem) {
                return res.status(400).json({ message: "인벤토리에 해당 아이템이 없습니다." });
            }

            const equippedItem = await userDataClient.characterItem.findFirst({
                where: {
                    characterId,
                    itemId: item_code,
                },
            });

            if (equippedItem) {
                return res.status(400).json({ message: "장착 중인 아이템은 판매할 수 없습니다." });
            }

            const itemInfo = await gameDataClient.item.findUnique({
                where: { item_code },
                select: { item_price: true },
            });

            if (!itemInfo) {
                return res.status(404).json({
                    message: `아이템 코드 ${item_code}를 찾을 수 없습니다.`,
                });
            }

            const salePrice = Math.floor(itemInfo.item_price * 0.6);
            totalRevenue += salePrice;

            // 단일 아이템 삭제
            await userDataClient.characterInventory.delete({
                where: {
                    id: inventoryItem.id,
                },
            });
        }

        await userDataClient.character.update({
            where: { id: characterId },
            data: { money: { increment: totalRevenue } },
        });

        const updatedCharacter = await userDataClient.character.findFirst({
            where: { id: characterId },
            select: { money: true },
        });

        return res.status(200).json({
            message: "아이템을 판매했습니다.",
            money: updatedCharacter.money,
        });

    } catch (error) {
        console.error("아이템 판매 중 에러 발생:", error);
        return res.status(500).json({ message: "아이템 판매 중 오류가 발생했습니다." });
    }
});

router.get("/character/:characterId/inventory", authMiddleware, async (req, res) => {
    const characterId = parseInt(req.params.characterId, 10);
    const userId = req.user.id;

    try {
        const character = await userDataClient.character.findFirst({
            where: {
                id: characterId,
                accountId: userId,
            },
        });

        if (!character) {
            return res.status(404).json({ message: "내 캐릭터가 아닙니다." });
        }

        const inventoryItems = await userDataClient.characterInventory.findMany({
            where: { characterId },
        });

        const itemCountMap = {};
        for (const inventoryItem of inventoryItems) {
            const { itemId } = inventoryItem;

            const itemInfo = await gameDataClient.item.findUnique({
                where: { item_code: itemId },
                select: { item_code: true, item_name: true },
            });

            if (itemInfo) {
                const { item_code, item_name } = itemInfo;

                if (!itemCountMap[item_code]) {
                    itemCountMap[item_code] = {
                    item_code,
                    item_name,
                    count: 0,
                };
            }
            itemCountMap[item_code].count +=1;
        }
    }
       
    const response = Object.values(itemCountMap);

    return res.status(200).json(response);
    } catch (error) {
        console.error("캐릭터 인벤토리 조회 중 에러 발생:", error);
        return res.status(500).json({ message: "캐릭터 인벤토리 조회 중 오류가 발생했습니다." });
    }
});

router.get("/character/:characterId/equipped", async (req, res) => {
    const characterId = parseInt(req.params.characterId, 10);

    try {
        const equippedItems = await userDataClient.characterItem.findMany({
            where: { characterId },
            select: { itemId: true },
        });


        const response = [];
        for (const equippedItem of equippedItems) {
            const itemInfo = await gameDataClient.item.findUnique({
                where: { item_code: equippedItem.itemId },
                select: { item_code: true, item_name: true },
            });

            if (itemInfo) {
                response.push(itemInfo);
            }
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error("장착 아이템 조회 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "장착 아이템 조회 중 오류가 발생했습니다." });
    }
});

// 아이템 장착 API
router.post("/character/:characterId/equip", 
    authMiddleware, 
    async (req, res) => {
        const characterId = parseInt(req.params.characterId, 10);
        const userId = req.user.id;
        const { item_code } = req.body;

    try {
        const character = await userDataClient.character.findFirst({
            where: { 
                id: characterId,  
                accountId: userId, 
            },
        });

        if (!character) {
            return res.status(403).json({ message: "내 캐릭터가 아닙니다." });
        }
        
        const inventoryItem = await userDataClient.characterInventory.findFirst({
            where: {
                characterId,
                itemId: item_code,
            },
        });

        if (!inventoryItem) {
            return res
            .status(400)
            .json({ message: "인벤토리에 해당 아이템이 없습니다." });  
        }

        const equippedItem = await userDataClient.characterItem.findFirst({
            where: { 
                characterId, 
                itemId: item_code
            },
        });

        if (equippedItem) {
            return res.status(400).json({ message: "이미 장착된 아이템입니다." });
        } 

        const itemInfo = await gameDataClient.item.findUnique({
            where: { item_code },
        });

        if (!itemInfo) {
            return res
            .status(404)
            .json({ message: "아이템 정보를 찾을 수 없습니다." });
        }

        await userDataClient.character.update({
            where: { id: characterId },  
            data: {
                health: { increment: itemInfo.health },
                power: { increment: itemInfo.power },
            },
        });
        
        await userDataClient.characterItem.create({
            data: {
                characterId, 
                itemId: item_code 
            },
        });

        await userDataClient.characterInventory.delete({  
            where: {
                id: inventoryItem.id,
            },
        });

        return res.status(200).json({ message: "아이템이 장착되었습니다." }); 
    } catch (error) {
        console.error("아이템 장착 중 에러 발생:", error);
        return res
        .status(500)
        .json({ message: "아이템 장착 중 오류가 발생했습니다." }); 
    }
});


// 아이템 탈착 API
router.post("/character/:characterId/unequip", 
    authMiddleware, 
    async (req, res) => {
        const characterId = parseInt(req.params.characterId, 10);
        const userId = req.user.id;
        const { item_code } = req.body;

        try {
            const character = await userDataClient.character.findFirst({
                where: { 
                    id: characterId,  
                    accountId: userId,
                },
            });

            if (!character) {
                return res.status(403).json({ message: "내 캐릭터가 아닙니다." });
            }
            
            const equippedItem = await userDataClient.characterItem.findFirst({
                where: { 
                    characterId, 
                    itemId: item_code,
                },
            });

            if (!equippedItem) { 
                return res
                .status(400)
                .json({ message: "장착되어 있지 않은 아이템입니다." });
            } 

            const itemInfo = await gameDataClient.item.findUnique({
                where: { item_code },
            });

            if (!itemInfo) {
                return res
                .status(404)
                .json({ message: "아이템 정보를 찾을 수 없습니다." });
            }

            await userDataClient.character.update({
                where: { id: characterId },  
                data: {
                    health: { decrement: itemInfo.health },
                    power: { decrement: itemInfo.power },
                },
            });

            await userDataClient.characterItem.delete({
                where: {
                    id: equippedItem.id,
                },
            });

            await userDataClient.characterInventory.create({ 
                data: { 
                    characterId, 
                    itemId: item_code 
                },
            });

            return res.status(200).json({ message: "아이템이 탈착되었습니다." });  
        } catch (error) {
            console.error("아이템 탈착 중 에러 발생:", error);
            return res
            .status(500)
            .json({ message: "아이템 탈착 중 오류가 발생했습니다." }); 
        }
    }
);

// 게임 머니를 버는 API
router.post("/character/:characterId/earn-money", 
    authMiddleware, 
    async (req, res) => {
        const characterId = parseInt(req.params.characterId, 10);
        const userId = req.user.id;

        try {
            // 캐릭터가 사용자에 속하는지 확인
            const character = await userDataClient.character.findFirst({
                where: { 
                    id: characterId, 
                    accountId: userId,
                },
            });

            if (!character) {
                return res.status(403).json({ message: "내 캐릭터가 아닙니다." });
            }

            await userDataClient.character.update({
                where: { id: characterId },
                data: { money: { increment: 100 } },
            });

            const updatedCharacter = await userDataClient.character.findUnique({
                where: { id: characterId },
                select: { money: true },
            });

            return res.status(200).json({
                message: "게임 머니를 100원 벌었습니다.",
                money: updatedCharacter.money,
            });
        } catch (error) {
            console.error("게임 머니를 버는 중 에러 발생:", error);
            return res
            .status(500)
            .json({ message: "게임 머니를 버는 중 오류가 발생했습니다." });
        }
    }
);


export default router;

