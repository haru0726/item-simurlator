import jwt from "jsonwebtoken";
import { userDataClient } from "../utils/prisma/index.js";

export default async function (req, res, next) {
    try {
        const { authorization } = req.cookies;
        if (!authorization) throw new Error("토큰이 존재하지 않습니다.");
        
        const [tokenType, token] = authorization.split(" ");
        
        if (tokenType !== "Bearer") 
            throw new Error('토큰 타입이 일치하지 않습니다.');
        
        const decodedToken = jwt.verify(token, "jwt-secret");
        const userId = decodedToken.userId;
        
        const user = await userDataClient.account.findFirst({
            where: { id: +userId },
        });
        if (!user) {
            res.clearCokie("authorization");
            throw new Error("토큰 사용자가 존재하지 않습니다.");
        }
        
        req.user = user;
        
        next();
    } catch (error) {
        res.clearCokie("authorization");
        switch (error.name) {
            case "TokenExpiredError":
                return res.status(401).json({ message: "토큰이 만료되었습니다." });
            case "JsoneWebTokenError":
                return res.status(401).json({ message: "토큰이 조작되었습니다." });
            default:
                return res
                .status(401)
                .json({ message: error.message ?? "비정상적인 요청입니다." });
        }
    }
}
