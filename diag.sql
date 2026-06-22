SELECT w.id, w."userId", w."operatorId", w.balance, w."escrowBalance",
       u.email, op."companyName"
FROM wallets w
LEFT JOIN users u ON u.id = w."userId"
LEFT JOIN operator_profiles op ON op.id = w."operatorId"
ORDER BY w."escrowBalance" DESC;
