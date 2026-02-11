// bot.js - Рабочий бот для ВКонтакте (без ошибок)
const { VK } = require('vk-io');
const fs = require('fs');
const path = require('path');

// ⚠️ УКАЖИТЕ СВОЙ ТОКЕН ЗДЕСЬ (обязательно!) ⚠️
const VK_TOKEN = 'ТОКЕН ГРУППЫ';  // ТОКЕН ГРУППЫ ТОЛЬКО СЮДА

// Проверка токена перед инициализацией
if (VK_TOKEN === 'ВАШ_ТОКЕН_ГРУППЫ' || !VK_TOKEN || VK_TOKEN.length < 30) {
    console.error('❌ ОШИБКА: Не указан токен группы!');
    console.error('   Как получить токен:');
    console.error('   1. Создайте группу ВКонтакте');
    console.error('   2. Настройки → "Работа с API" → "Создать ключ"');
    console.error('   3. Выберите права: "Сообщения" и "Управление сообществом"');
    console.error('   4. Скопируйте токен и вставьте его в файл bot.js (строка 7)');
    process.exit(1);
}

// Инициализация бота
const vk = new VK({
    token: VK_TOKEN,
    apiVersion: '5.131'
});
const { updates } = vk;

// Создание папки данных при первом запуске
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

// Загрузка баз данных
const loadData = (file) => {
    try {
        const filePath = path.join(__dirname, 'data', file);
        if (!fs.existsSync(filePath)) {
            console.log(`Создана новая база: ${file}`);
            if (file === 'users.json') return { nextId: 1, users: {} };
            if (file === 'config.json') return { groupUrl: 'https://vk.com/666', stateTreasury: 0, adminIds: [588184018] };
            return {};
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Ошибка загрузки ${file}:`, e.message);
        if (file === 'users.json') return { nextId: 1, users: {} };
        if (file === 'config.json') return { groupUrl: 'https://vk.com/666', stateTreasury: 0, adminIds: [588184018] };
        return {};
    }
};

const saveData = (file, data) => {
    try {
        const filePath = path.join(__dirname, 'data', file);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Ошибка сохранения ${file}:`, e.message);
    }
};

// Инициализация баз
let db = {
    users: loadData('users.json'),
    referrals: loadData('referrals.json'),
    config: loadData('config.json')
};

// Регистрация нового пользователя
const registerUser = async (userId) => {
    try {
        const userData = await vk.api.users.get({ user_ids: userId });
        const userVK = userData[0];
        const id = db.users.nextId++;
        const username = `${userVK.first_name} ${userVK.last_name}`;
        
        db.users.users[id] = {
            id: userId,
            username,
            balance: 100000000,
            bank: 0,
            bitcoin: 0,
            rubies: 0,
            level: 0,
            exp: 0,
            expToNext: 50,
            rating: 0,
            job: null,
            jobExp: 0,
            lastWork: 0,
            lastCase: 0,
            lastGift: 0,
            lastTransfer: 0,
            lastDaily: 0,
            dailyStreak: 0,
            referrals: 0,
            marriedTo: null,
            createdAt: new Date().toISOString(),
            messages: 0,
            banned: false,
            mute: false,
            customNick: null,      // Добавлено для кастомного ника
            lastNickChange: 0,      // Добавлено для кулдауна смены ника
			lastReport: 0 // ← Кулдаун репорта
        };
        
        saveData('users.json', db.users);
        return { id, username };
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        throw error;
    }
};

// Получение ID пользователя в системе
const getUserId = (vkId) => {
    for (const [id, user] of Object.entries(db.users.users || {})) {
        if (user?.id === vkId) return parseInt(id);
    }
    return null;
};

// Форматирование чисел (1 000 000)
const formatNumber = (num) => {
    if (typeof num !== 'number') num = parseInt(num) || 0;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Ежедневный бонус
const dailyBonus = {
    days: [
        { money: 50000, rubies: 0, exp: 5 },
        { money: 75000, rubies: 0, exp: 7 },
        { money: 100000, rubies: 1, exp: 10 },
        { money: 150000, rubies: 2, exp: 15 },
        { money: 200000, rubies: 3, exp: 20 },
        { money: 250000, rubies: 4, exp: 25 },
        { money: 500000, rubies: 10, exp: 50 }
    ],
    getReward(day) {
        const index = Math.min(day - 1, 6);
        return { ...this.days[index], day: index + 1 };
    }
};

// Обработка сообщений
updates.on('message_new', async (context) => {
    try {
        if (context.isOutbox || !context.text) return;
        
        const userId = context.senderId;
        let systemId = getUserId(userId);
        
        // Регистрация нового пользователя
        if (!systemId) {
            try {
                const { id, username } = await registerUser(userId);
                systemId = id;
                
                await context.send(`
👴 Добро пожаловать, ${username}!
💰 Стартовый баланс: 100 000 000$
📊 Уровень: 0
🌟 Опыт: 0/50

🎁 Не забудь получить ежедневный бонус: "бонус"

📝 Основные команды:
• профиль - ваш профиль
• банк - банковский счёт
• работы - устроиться на работу
• казино [ставка] - поиграть
• помощь - полный список команд

👀 Подпишитесь на нашу группу: ${db.config.groupUrl || 'https://vk.com/666'}
                `);
                return;
            } catch (error) {
                console.error('Ошибка регистрации:', error);
                await context.send('⚠ Произошла ошибка при регистрации. Попробуйте позже.');
                return;
            }
        }
        
        // Получение данных пользователя
        const user = db.users.users[systemId];
        if (!user) {
            await context.send('⚠ Произошла ошибка с вашим аккаунтом. Обратитесь к администратору.');
            return;
        }
        
        // Проверка бана
        if (user.banned) {
            await context.send('🚫 Ваш аккаунт заблокирован');
            return;
        }
        
        // Обновление статистики
        user.messages = (user.messages || 0) + 1;
        
        // Обработка команд (регистронезависимо)
        const text = context.text.toLowerCase().trim();
        
        // Команда помощи
        if (['помощь', 'начать'].includes(text)) {
            await context.send(`
👨‍💻 Команды бота:

💻 Профиль - ваш профиль
💻 Профиль [ID] - профиль игрока

📯 Ник [имя] - изменить ник 
💰 Баланс - ваш баланс
🏦 Банк - банковский счёт
💳 Карта - банковская карточка
   • положить [сумма]
   • снять [сумма]

🤝 Передать [ID] [сумма] - передать деньги
🤝 Бпередать [ID] [сумма] - передать биткоины
🤝 Перевести [ID] [сумма] - перевести из банка

👑 Топ - топ по рейтингу
👑 Купить рейтинг [кол-во] - купить рейтинг
👑 Продать рейтинг [кол-во] - продать рейтинг

🌍 Пожертвовать [сумма] - в казну штата

🎫 Курс - курс обмена
💻 Трейд [кол-во] - обменять рубины на $

🎁 Бонус - ежедневный бонус
🎁 Кейс - бесплатный кейс
💎 Подарок - новогодний подарок

👫 Свадьба [ID] - пожениться
👫 Развод - развестись

📝 Работы - список работ
📝 Работать [номер] - устроиться
🏢 Работать - получить зарплату

🎲 Игры - список игр
🏃 Развлекательные - развлекательные команды

🆘 Репорт [текст] - связь с администрацией
👥 Состав - список администраторов
👪 Ринфо - реферальная система

❗ Все команды пишутся строчными буквами
            `);
            return;
        }
        
        // Ежедневный бонус
        if (['бонус', 'ежедневный', 'дэйли', 'ежедневка'].includes(text)) {
            const now = Date.now();
            const lastDaily = user.lastDaily || 0;
            const hoursSinceLast = (now - lastDaily) / (1000 * 60 * 60);
            
            if (hoursSinceLast < 24) {
                const hoursLeft = Math.ceil(24 - hoursSinceLast);
                await context.send(`⏳ Ежедневный бонус можно получить раз в 24 часа.\n⏱ Осталось: ${hoursLeft} ч.`);
                return;
            }
            
            let streak = user.dailyStreak || 0;
            const wasYesterday = hoursSinceLast < 48 && hoursSinceLast >= 24;
            
            if (wasYesterday) {
                streak = Math.min(streak + 1, 7);
            } else {
                streak = 1;
            }
            
            const reward = dailyBonus.getReward(streak);
            user.balance += reward.money;
            user.rubies += reward.rubies;
            user.exp += reward.exp;
            user.lastDaily = now;
            user.dailyStreak = streak;
            
            // Повышение уровня
            while (user.exp >= user.expToNext) {
                user.level++;
                user.exp -= user.expToNext;
                user.expToNext = 50 + user.level * 10;
            }
            
            saveData('users.json', db.users);
            
            let message = `🎁 Ежедневный бонус!\n📅 День подряд: ${streak}/7\n\n`;
            message += `💵 Деньги: +${formatNumber(reward.money)}$\n`;
            if (reward.rubies > 0) message += `💎 Рубины: +${reward.rubies}\n`;
            message += `🌟 Опыт: +${reward.exp}\n`;
            
            if (streak === 7) {
                message += `\n🔥 Поздравляем! Вы получили МАКСИМАЛЬНЫЙ бонус 7 дней подряд!\n🔄 Завтра серия начнётся с 1 дня`;
            } else {
                const nextReward = dailyBonus.getReward(streak + 1);
                message += `\n➡ Завтра: ${formatNumber(nextReward.money)}$`;
                if (nextReward.rubies > 0) message += ` + ${nextReward.rubies}💎`;
            }
            
            await context.send(message);
            return;
        }
        
        // Профиль
        const profileMatch = text.match(/^профиль(?:\s+(\d+))?$/);
        if (profileMatch) {
            const targetId = profileMatch[1] ? parseInt(profileMatch[1]) : systemId;
            
            if (!db.users.users[targetId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            
            const target = db.users.users[targetId];
            const vkUser = await vk.api.users.get({ user_ids: target.id });
            const displayName = user.customNick || vkUser[0].first_name;
            
            // Статус бонуса
            const now = Date.now();
            const lastDaily = target.lastDaily || 0;
            const hoursSinceLast = (now - lastDaily) / (1000 * 60 * 60);
            const bonusStatus = hoursSinceLast < 24 ? 
                `⏳ Бонус через: ${Math.ceil(24 - hoursSinceLast)} ч.` : 
                `🎁 Бонус доступен!`;
            
            await context.send(`
📕 Профиль ${displayName} (ID ${targetId}):

💵 Баланс: ${formatNumber(target.balance)}$
🏦 В банке: ${formatNumber(target.bank)}$
💎 Рубины: ${formatNumber(target.rubies)}
₿ Биткоины: ${formatNumber(target.bitcoin)}
👑 Рейтинг: ${formatNumber(target.rating)}

📊 Уровень: ${target.level}
🌟 Опыт: ${target.exp}/${target.expToNext}

${target.marriedTo ? `💖 В браке с ID ${target.marriedTo}` : '💔 Не в браке'}
${target.job ? `💼 Работа: ${target.job}` : '📭 Безработный'}

🎁 ${bonusStatus}
🔥 Серия бонусов: ${target.dailyStreak || 0} дней
📨 Сообщений: ${target.messages || 0}
            `);
            return;
        }
        
        // Банк
        if (text === 'банк') {
            await context.send(`
🏦 Банк:

💵 На счету: ${formatNumber(user.bank)}$
💳 Положить [сумма] - положить деньги
💵 Снять [сумма] - снять деньги

⚠ Совет: храните деньги в банке для безопасности!
            `);
            return;
        }
        
        // Карта (синоним банка)
        if (text === 'карта') {
            await context.send(`
💳 Банковская карта:

💵 Баланс: ${formatNumber(user.bank)}$
🏦 Банк - подробная информация

💡 Используйте команды:
• положить [сумма]
• снять [сумма]
            `);
            return;
        }
        
        // Положить в банк
        const depositMatch = text.match(/^положить\s+(\d+)$/);
        if (depositMatch) {
            const amount = parseInt(depositMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Сумма должна быть положительным числом');
                return;
            }
            if (amount > user.balance) {
                await context.send('⚠ Недостаточно денег на руках');
                return;
            }
            
            user.balance -= amount;
            user.bank += amount;
            saveData('users.json', db.users);
            await context.send(`✅ Вы положили ${formatNumber(amount)}$ в банк`);
            return;
        }
        
        // Снять с банка
        const withdrawMatch = text.match(/^снять\s+(\d+)$/);
        if (withdrawMatch) {
            const amount = parseInt(withdrawMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Сумма должна быть положительным числом');
                return;
            }
            if (amount > user.bank) {
                await context.send('⚠ Недостаточно денег в банке');
                return;
            }
            
            user.bank -= amount;
            user.balance += amount;
            saveData('users.json', db.users);
            await context.send(`✅ Вы сняли ${formatNumber(amount)}$ с банка`);
            return;
        }
        
        // Передача денег
        const transferMatch = text.match(/^передать\s+(\d+)\s+(\d+)$/);
        if (transferMatch) {
            const targetId = parseInt(transferMatch[1]);
            const amount = parseInt(transferMatch[2]);
            
            if (isNaN(targetId) || isNaN(amount)) {
                await context.send('⚠ Неверный формат команды');
                return;
            }
            if (!db.users.users[targetId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            if (targetId === systemId) {
                await context.send('⚠ Нельзя передать деньги самому себе');
                return;
            }
            if (amount <= 0) {
                await context.send('⚠ Сумма должна быть положительной');
                return;
            }
            if (amount > user.balance) {
                await context.send('⚠ Недостаточно денег');
                return;
            }
            
            // Ограничение на передачу (1 раз в 10 минут)
            const now = Date.now();
            if (user.lastTransfer && now - user.lastTransfer < 600000) {
                const remaining = Math.ceil((600000 - (now - user.lastTransfer)) / 60000);
                await context.send(`⏳ Передавать деньги можно раз в 10 минут. Подождите ${remaining} мин.`);
                return;
            }
            
            user.balance -= amount;
            db.users.users[targetId].balance += amount;
            user.lastTransfer = now;
            saveData('users.json', db.users);
            await context.send(`✅ Вы передали ${formatNumber(amount)}$ игроку ID ${targetId}`);
            return;
        }
        
        // Передача биткоинов
        const btcTransferMatch = text.match(/^бпередать\s+(\d+)\s+(\d+)$/);
        if (btcTransferMatch) {
            const targetId = parseInt(btcTransferMatch[1]);
            const amount = parseInt(btcTransferMatch[2]);
            
            if (isNaN(targetId) || isNaN(amount)) {
                await context.send('⚠ Неверный формат команды');
                return;
            }
            if (!db.users.users[targetId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            if (amount <= 0) {
                await context.send('⚠ Сумма должна быть положительной');
                return;
            }
            if (amount > user.bitcoin) {
                await context.send('⚠ Недостаточно биткоинов');
                return;
            }
            
            user.bitcoin -= amount;
            db.users.users[targetId].bitcoin += amount;
            saveData('users.json', db.users);
            await context.send(`✅ Вы передали ${formatNumber(amount)}₿ игроку ID ${targetId}`);
            return;
        }
        
        // Перевод из банка
        const transferBankMatch = text.match(/^перевести\s+(\d+)\s+(\d+)$/);
        if (transferBankMatch) {
            const targetId = parseInt(transferBankMatch[1]);
            const amount = parseInt(transferBankMatch[2]);
            
            if (isNaN(targetId) || isNaN(amount)) {
                await context.send('⚠ Неверный формат команды');
                return;
            }
            if (!db.users.users[targetId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            if (targetId === systemId) {
                await context.send('⚠ Нельзя перевести деньги самому себе');
                return;
            }
            if (amount <= 0) {
                await context.send('⚠ Сумма должна быть положительной');
                return;
            }
            if (amount > user.bank) {
                await context.send('⚠ Недостаточно денег в банке');
                return;
            }
            
            user.bank -= amount;
            db.users.users[targetId].bank = (db.users.users[targetId].bank || 0) + amount;
            saveData('users.json', db.users);
            await context.send(`✅ Вы перевели ${formatNumber(amount)}$ из банка игроку ID ${targetId}`);
            return;
        }
        
        // Работы
        if (text === 'работы') {
            await context.send(`
👷 Доступные работы:

1. Шахтёр - 1 000$/час (требуется уровень 0)
2. Электрик - 5 000$/час (требуется уровень 10)
3. Торговец - 10 000$/час (требуется уровень 20)
4. Дальнобойщик - 15 000$/час (требуется уровень 30)
5. Бизнесмен - 20 000$/час (требуется уровень 40)

📝 Чтобы устроиться: "работать [номер]"
            `);
            return;
        }
        
        // Устроиться на работу
        const jobMatch = text.match(/^работать\s+(\d+)$/);
        if (jobMatch) {
            const jobId = parseInt(jobMatch[1]);
            
            const jobs = [
                null,
                { name: 'Шахтёр', salary: 1000, level: 0 },
                { name: 'Электрик', salary: 5000, level: 10 },
                { name: 'Торговец', salary: 10000, level: 20 },
                { name: 'Дальнобойщик', salary: 15000, level: 30 },
                { name: 'Бизнесмен', salary: 20000, level: 40 }
            ];
            
            if (!jobs[jobId]) {
                await context.send('⚠ Такой работы не существует');
                return;
            }
            if (user.level < jobs[jobId].level) {
                await context.send(`⚠ Требуется уровень ${jobs[jobId].level} для этой работы`);
                return;
            }
            
            user.job = jobs[jobId].name;
            user.jobSalary = jobs[jobId].salary;
            user.jobExp = (user.jobExp || 0) + 1;
            saveData('users.json', db.users);
            await context.send(`✅ Вы устроились на работу "${jobs[jobId].name}"`);
            return;
        }
        
        // Получить зарплату
        if (text === 'работать') {
            if (!user.job) {
                await context.send('⚠ У вас нет работы. Устройтесь командой "работы [номер]"');
                return;
            }
            
            const now = Date.now();
            if (user.lastWork && now - user.lastWork < 3600000) {
                const remaining = Math.ceil((3600000 - (now - user.lastWork)) / 60000);
                await context.send(`⏳ Работать можно раз в час. Подождите ${remaining} мин.`);
                return;
            }
            
            const salary = user.jobSalary || 1000;
            user.balance += salary;
            user.jobExp = (user.jobExp || 0) + 1;
            user.lastWork = now;
            
            // Повышение уровня за стаж
            if (user.jobExp % 10 === 0) {
                user.exp = (user.exp || 0) + 10;
                while (user.exp >= user.expToNext) {
                    user.level++;
                    user.exp -= user.expToNext;
                    user.expToNext = 50 + user.level * 10;
                }
            }
            
            saveData('users.json', db.users);
            await context.send(`✅ Вы отработали час и получили ${formatNumber(salary)}$`);
            return;
        }
        
        // Казино
        const casinoMatch = text.match(/^казино\s+(\d+)$/);
        if (casinoMatch) {
            const amount = parseInt(casinoMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Ставка должна быть положительным числом');
                return;
            }
            if (amount > user.balance) {
                await context.send('⚠ Недостаточно денег');
                return;
            }
            if (amount > 500000) {
                await context.send('⚠ Максимальная ставка: 500 000$');
                return;
            }
            
            const win = Math.random() > 0.6; // 40% шанс выигрыша
            
            if (win) {
                const winAmount = amount * 2;
                user.balance += winAmount - amount;
                user.exp = (user.exp || 0) + 2;
                
                // Проверка уровня
                while (user.exp >= user.expToNext) {
                    user.level++;
                    user.exp -= user.expToNext;
                    user.expToNext = 50 + user.level * 10;
                }
                
                await context.send(`
🎰 Казино:
✅ Вы выиграли ${formatNumber(winAmount)}$!
🌟 +2 опыта | Уровень: ${user.level}
                `);
            } else {
                user.balance -= amount;
                await context.send(`
🎰 Казино:
❌ Вы проиграли ${formatNumber(amount)}$!
                `);
            }
            
            saveData('users.json', db.users);
            return;
        }
		
// Смена ника
const nickMatch = text.match(/^ник\s+(.+)$/);
if (nickMatch) {
    const newNick = nickMatch[1].trim();
    
    // Проверки ника
    if (newNick.length < 3) {
        await context.send('⚠ Ник должен содержать минимум 3 символа');
        return;
    }
    
    if (newNick.length > 20) {
        await context.send('⚠ Ник не должен превышать 20 символов');
        return;
    }
    
    // Запрет на спецсимволы (оставляем только буквы, цифры, пробелы и базовые знаки)
    if (!/^[\p{L}\p{N}\s._-]+$/u.test(newNick)) {
        await context.send('⚠ Ник может содержать только буквы, цифры, пробелы, точки, дефисы и подчёркивания');
        return;
    }
    
    // Проверка на цензуру (простой фильтр)
    const badWords = ['хуй', 'пизд', 'ебать', 'сука', 'блядь', 'гандон', 'дроч', 'залуп', 'пидор', 'педик'];
    if (badWords.some(word => newNick.toLowerCase().includes(word))) {
        await context.send('⚠ Ник содержит запрещённые слова');
        return;
    }
    
    // Проверка на стоимость смены ника (1 000 000$)
    const nickCost = 1000000;
    if (user.balance < nickCost) {
        await context.send(`⚠ Для смены ника нужно ${formatNumber(nickCost)}$\nВаш баланс: ${formatNumber(user.balance)}$`);
        return;
    }
    
    // Проверка на кулдаун (раз в 7 дней)
    const now = Date.now();
    if (user.lastNickChange && now - user.lastNickChange < 604800000) { // 7 дней в мс
        const daysLeft = Math.ceil((604800000 - (now - user.lastNickChange)) / 86400000);
        await context.send(`⏳ Менять ник можно раз в 7 дней. Подождите ${daysLeft} дн.`);
        return;
    }
    
    // Сохранение старого ника для истории
    const oldNick = user.customNick || user.username;
    
    // Применение нового ника
    user.customNick = newNick;
    user.balance -= nickCost;
    user.lastNickChange = now;
    
    saveData('users.json', db.users);
    
    await context.send(`
✅ Ник успешно изменён!

Предыдущий ник: ${oldNick}
Новый ник: ${newNick}

Стоимость: ${formatNumber(nickCost)}$
Остаток на счету: ${formatNumber(user.balance)}$

⚠ Следующая смена доступна через 7 дней
    `);
    return;
}
        
        // Топ по рейтингу
        if (text === 'топ') {
            const topUsers = Object.entries(db.users.users || {})
                .filter(([id, user]) => user?.rating > 0)
                .sort((a, b) => (b[1].rating || 0) - (a[1].rating || 0))
                .slice(0, 10);
            
            if (topUsers.length === 0) {
                await context.send('📭 Пока нет игроков с рейтингом');
                return;
            }
            
            let msg = '🏆 Топ 10 по рейтингу:\n\n';
            topUsers.forEach(([id, user], index) => {
                msg += `${index + 1}. ID ${id} - ${formatNumber(user.rating)}👑\n`;
            });
            
            await context.send(msg);
            return;
        }
        
        // Покупка рейтинга
        const buyRatingMatch = text.match(/^купить рейтинг\s+(\d+)$/);
        if (buyRatingMatch) {
            const amount = parseInt(buyRatingMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Сумма должна быть положительным числом');
                return;
            }
            const cost = amount * 500000;
            
            if (user.balance < cost) {
                await context.send(`⚠ Недостаточно денег. Нужно ${formatNumber(cost)}$`);
                return;
            }
            
            user.balance -= cost;
            user.rating = (user.rating || 0) + amount;
            saveData('users.json', db.users);
            await context.send(`✅ Куплено ${amount}👑 за ${formatNumber(cost)}$`);
            return;
        }
        
        // Продажа рейтинга
        const sellRatingMatch = text.match(/^продать рейтинг\s+(\d+)$/);
        if (sellRatingMatch) {
            const amount = parseInt(sellRatingMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Сумма должна быть положительным числом');
                return;
            }
            if ((user.rating || 0) < amount) {
                await context.send('⚠ Недостаточно рейтинга');
                return;
            }
            
            const profit = amount * 200000;
            user.rating -= amount;
            user.balance += profit;
            saveData('users.json', db.users);
            await context.send(`✅ Продано ${amount}👑 за ${formatNumber(profit)}$`);
            return;
        }
        
        // Пожертвование в казну
        const donateMatch = text.match(/^пожертвовать\s+(\d+)$/);
        if (donateMatch) {
            const amount = parseInt(donateMatch[1]);
            
            if (isNaN(amount) || amount < 100000000) {
                await context.send('⚠ Минимальная сумма пожертвования: 100 000 000$');
                return;
            }
            if (user.balance < amount) {
                await context.send('⚠ Недостаточно денег');
                return;
            }
            
            user.balance -= amount;
            db.config.stateTreasury = (db.config.stateTreasury || 0) + amount;
            
            // Рассылка новости админам
            db.config.adminIds?.forEach(adminId => {
                vk.api.messages.send({
                    user_id: adminId,
                    message: `🌍 Игрок ID ${systemId} пожертвовал ${formatNumber(amount)}$ в казну штата!`
                }).catch(() => {});
            });
            
            saveData('users.json', db.users);
            saveData('config.json', db.config);
            await context.send(`✅ Вы пожертвовали ${formatNumber(amount)}$ в казну штата!`);
            return;
        }
        
        // Курс обмена
        if (text === 'курс') {
            await context.send(`
📊 Курс обмена:

💎 Рубины: 40 000$ за 1 рубин
💰 Биткоины: 50 000$ за 1 биткоин

🔄 Обмен:
• Трейд [кол-во] - обменять рубины на $
• Биткоин продать [кол-во] - продать биткоины
            `);
            return;
        }
        
        // Трейд (обмен рубинов)
        const tradeMatch = text.match(/^трейд\s+(\d+)$/);
        if (tradeMatch) {
            const amount = parseInt(tradeMatch[1]);
            
            if (isNaN(amount) || amount <= 0) {
                await context.send('⚠ Сумма должна быть положительным числом');
                return;
            }
            if (user.rubies < amount) {
                await context.send('⚠ Недостаточно рубинов');
                return;
            }
            
            const profit = amount * 40000;
            user.rubies -= amount;
            user.balance += profit;
            saveData('users.json', db.users);
            await context.send(`✅ Обменяно ${amount}💎 на ${formatNumber(profit)}$`);
            return;
        }
        
        // Бесплатный кейс
        if (text === 'кейс') {
            const now = Date.now();
            
            if (user.lastCase && now - user.lastCase < 86400000) {
                const hours = Math.ceil((86400000 - (now - user.lastCase)) / 3600000);
                await context.send(`⏳ Кейс можно открыть раз в 24 часа. Подождите ${hours} ч.`);
                return;
            }
            
            // Выбор случайного приза
            const rand = Math.random() * 100;
            let prize;
            
            if (rand < 70) {
                prize = { type: 'money', amount: Math.floor(Math.random() * 10001) + 15000 };
            } else if (rand < 90) {
                prize = { type: 'rubies', amount: 1 };
            } else {
                prize = { type: 'exp', amount: Math.floor(Math.random() * 6) + 5 };
            }
            
            let message = '🎁 Вы открыли кейс и получили:\n';
            
            if (prize.type === 'money') {
                user.balance += prize.amount;
                message += `💵 ${formatNumber(prize.amount)}$`;
            } else if (prize.type === 'rubies') {
                user.rubies += prize.amount;
                message += `💎 ${prize.amount} рубин`;
            } else if (prize.type === 'exp') {
                user.exp += prize.amount;
                message += `🌟 ${prize.amount} опыта`;
                
                // Проверка уровня
                while (user.exp >= user.expToNext) {
                    user.level++;
                    user.exp -= user.expToNext;
                    user.expToNext = 50 + user.level * 10;
                }
                
                if (prize.amount > 5) {
                    message += `\n📈 Уровень повышен до ${user.level}!`;
                }
            }
            
            user.lastCase = now;
            saveData('users.json', db.users);
            
            await context.send(message);
            return;
        }
        
        // Подарок (новогодний)
        if (text === 'подарок') {
            const now = Date.now();
            
            if (user.lastGift && now - user.lastGift < 604800000) { // Раз в неделю
                const days = Math.ceil((604800000 - (now - user.lastGift)) / 86400000);
                await context.send(`⏳ Подарок можно получить раз в неделю. Подождите ${days} дн.`);
                return;
            }
            
            // Новогодний подарок
            const giftMoney = Math.floor(Math.random() * 50001) + 50000;
            const giftRubies = Math.floor(Math.random() * 3) + 1;
            
            user.balance += giftMoney;
            user.rubies += giftRubies;
            user.lastGift = now;
            
            saveData('users.json', db.users);
            await context.send(`
🎄 Новогодний подарок!

💵 Деньги: ${formatNumber(giftMoney)}$
💎 Рубины: ${giftRubies}

🎁 Приходите за следующим подарком через неделю!
            `);
            return;
        }
        
        // Свадьба
        const marryMatch = text.match(/^свадьба\s+(\d+)$/);
        if (marryMatch) {
            const targetId = parseInt(marryMatch[1]);
            
            if (isNaN(targetId)) {
                await context.send('⚠ Неверный ID игрока');
                return;
            }
            if (!db.users.users[targetId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            if (targetId === systemId) {
                await context.send('⚠ Нельзя жениться на себе');
                return;
            }
            if (user.marriedTo) {
                await context.send('⚠ Вы уже в браке');
                return;
            }
            if (db.users.users[targetId].marriedTo) {
                await context.send('⚠ Этот игрок уже в браке');
                return;
            }
            
            user.marriedTo = targetId;
            db.users.users[targetId].marriedTo = systemId;
            saveData('users.json', db.users);
            await context.send(`💒 Поздравляем! Вы поженились с игроком ID ${targetId}!`);
            return;
        }
        
        // Развод
        if (text === 'развод') {
            if (!user.marriedTo) {
                await context.send('⚠ Вы не в браке');
                return;
            }
            
            const spouseId = user.marriedTo;
            user.marriedTo = null;
            db.users.users[spouseId].marriedTo = null;
            saveData('users.json', db.users);
            await context.send(`💔 Вы развелись с игроком ID ${spouseId}`);
            return;
        }
        
// Репорт
const reportMatch = text.match(/^репорт\s+(.+)$/i);
if (reportMatch) {
    const reportText = reportMatch[1].trim();
    
    // Проверка длины жалобы
    if (reportText.length < 5) {
        await context.send('⚠ Жалоба должна содержать минимум 5 символов');
        return;
    }
    
    // Проверка кулдауна (60 секунд)
    const now = Date.now();
    const lastReport = user.lastReport || 0;
    if (lastReport && now - lastReport < 60000) {
        const secondsLeft = Math.ceil((60000 - (now - lastReport)) / 1000);
        await context.send(`⏳ Отправлять репорт можно раз в минуту. Подождите ${secondsLeft} сек.`);
        return;
    }
    
    // Отправка всем администраторам из конфига
    const adminIds = db.config.adminIds || [];
    if (adminIds.length === 0) {
        await context.send('⚠ Администраторы не настроены. Обратитесь к владельцу бота.');
        return;
    }
    
    // Формируем сообщение для админов
    const adminMessage = `🚨 РЕПОРТ от игрока ID ${systemId} (@id${user.id}):\n💬 "${reportText}"`;
    
    // Отправляем всем админам параллельно с обязательным random_id
    const sendPromises = adminIds.map(adminId => 
        vk.api.messages.send({
            user_id: adminId,
            message: adminMessage,
            random_id: Math.floor(Math.random() * 1000000000) // Обязательный параметр!
        }).catch(err => {
            console.error(`Ошибка отправки репорта админу ${adminId}:`, err.message);
        })
    );
    
    await Promise.all(sendPromises);
    
    // Сохраняем время последнего репорта
    user.lastReport = now;
    saveData('users.json', db.users);
    
    await context.send('✅ Ваша жалоба отправлена администрации!\n⏳ Ожидайте ответа в личные сообщения.');
    return;
}
        
        // Состав админов
        if (text === 'состав') {
            let message = '👑 Администрация проекта:\n\n';
            
            const admins = Object.entries(db.users.users || {})
                .filter(([id, user]) => (user?.adminLevel || 0) > 0)
                .sort((a, b) => (b[1].adminLevel || 0) - (a[1].adminLevel || 0));
            
            if (admins.length === 0) {
                message += '📭 Администраторы отсутствуют';
            } else {
                const levels = ['VIP', 'Модератор', 'Администратор', 'Гл.Админ', 'Разработчик'];
                admins.forEach(([id, user]) => {
                    const levelText = levels[(user.adminLevel || 1) - 1] || 'Админ';
                    message += `🔹 ${levelText}: ID ${id}\n`;
                });
            }
            
            await context.send(message);
            return;
        }
        
        // Ринфо (реферальная система)
        if (text === 'ринфо') {
            await context.send(`
👪 Реферальная система:

Ваша реферальная ссылка:
👉 реф ${systemId}

🎁 Награды за приглашённых:
• 1-й друг: 50 000 000$ + 10 рубинов
• Каждый последующий: 10 000 000$ + 5 рубинов

📊 Приглашено: ${user.referrals || 0} друзей
            `);
            return;
        }
        
        // Реферальный код
        const refMatch = text.match(/^реф\s+(\d+)$/);
        if (refMatch) {
            const refId = parseInt(refMatch[1]);
            
            if (refId === systemId) {
                await context.send('⚠ Нельзя указать свой ID');
                return;
            }
            if (!db.users.users[refId]) {
                await context.send('⚠ Игрок не найден');
                return;
            }
            if (user.referredBy) {
                await context.send('⚠ Вы уже использовали реферальную ссылку');
                return;
            }
            
            // Награда
            const isFirstRef = (db.users.users[refId].referrals || 0) === 0;
            const reward = isFirstRef ? { money: 50000000, rubies: 10 } : { money: 10000000, rubies: 5 };
            
            user.balance += reward.money;
            user.rubies += reward.rubies;
            user.referredBy = refId;
            
            db.users.users[refId].referrals = (db.users.users[refId].referrals || 0) + 1;
            db.users.users[refId].balance += reward.money;
            db.users.users[refId].rubies += reward.rubies;
            
            saveData('users.json', db.users);
            
            await context.send(`
✅ Реферальная ссылка активирована!
💰 Вы получили: ${formatNumber(reward.money)}$ + ${reward.rubies}💎
🎁 Игрок ID ${refId} также получил награду
            `);
            return;
        }
        
        // Баланс
        if (text === 'баланс') {
            await context.send(`
💰 Ваш баланс:

💵 Деньги: ${formatNumber(user.balance)}$
🏦 В банке: ${formatNumber(user.bank)}$
💎 Рубины: ${formatNumber(user.rubies)}
₿ Биткоины: ${formatNumber(user.bitcoin)}

👑 Рейтинг: ${formatNumber(user.rating)}
📊 Уровень: ${user.level}
            `);
            return;
        }
        
        // Игры
        if (['игры', 'игры'].includes(text)) {
            await context.send(`
🎲 Игры и заработок:

🎰 Казино [ставка] - казино (40% шанс выиграть)
🎁 Кейс - бесплатный кейс (раз в 24ч)
🎄 Подарок - новогодний подарок (раз в неделю)
💎 Бонус - ежедневный бонус

📈 Работать - получить зарплату
👥 Реф [ID] - пригласить друга

⚠ Ставки ограничены 500 000$ для безопасности
            `);
            return;
        }
        
        // Развлекательные
        if (text === 'развлекательные') {
            await context.send(`
🏃 Развлекательные команды:

👑 Топ - топ игроков по рейтингу
👫 Свадьба [ID] - пожениться
👫 Развод - развестись
📯 Ник [имя] - изменить ник (через ВК)

💬 Пишите в ЛС группы для общения!
            `);
            return;
        }
        
        // Информация о бонусе
        if (['бонус инфо', 'инфо бонус', 'когда бонус'].includes(text)) {
            const now = Date.now();
            const lastDaily = user.lastDaily || 0;
            const hoursSinceLast = (now - lastDaily) / (1000 * 60 * 60);
            
            let message = `📊 Информация о ежедневном бонусе:\n\n`;
            
            if (user.lastDaily) {
                const streak = user.dailyStreak || 0;
                message += `✅ Последний бонус: ${new Date(user.lastDaily).toLocaleDateString('ru-RU')}\n`;
                message += `🔥 Серия дней: ${streak}\n\n`;
                
                if (hoursSinceLast < 24) {
                    const hoursLeft = Math.ceil(24 - hoursSinceLast);
                    message += `⏳ Следующий бонус через: ${hoursLeft} ч.\n`;
                } else {
                    message += `🎁 Бонус доступен прямо сейчас! Напиши "бонус"\n`;
                }
            } else {
                message += `❌ Бонус ещё не получался\n`;
                message += `🎁 Напиши "бонус" чтобы получить первый!\n\n`;
            }
            
            message += `📅 Награды за серию дней:\n`;
            dailyBonus.days.forEach((reward, index) => {
                message += `${index + 1}. ${formatNumber(reward.money)}$`;
                if (reward.rubies > 0) message += ` + ${reward.rubies}💎`;
                message += ` + ${reward.exp}🌟\n`;
            });
            
            await context.send(message);
            return;
        }
        
        // Неизвестная команда
        if (text) {
            await context.send('⚠ Неизвестная команда. Напишите "помощь" для списка команд.');
        }
        
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
        try {
            await context.send('⚠ Произошла внутренняя ошибка. Попробуйте позже.');
        } catch (e) {}
    }
});

// Автосохранение базы каждые 5 минут
setInterval(() => {
    saveData('users.json', db.users);
    saveData('referrals.json', db.referrals);
    saveData('config.json', db.config);
    console.log(`💾 [${new Date().toLocaleTimeString()}] Автосохранение выполнено`);
}, 300000);

// Обработка завершения работы
process.on('SIGINT', () => {
    console.log('\n💾 Сохранение данных перед выходом...');
    saveData('users.json', db.users);
    saveData('referrals.json', db.referrals);
    saveData('config.json', db.config);
    console.log('✅ Данные сохранены. Выход...');
    process.exit(0);
});

// Запуск бота
async function startBot() {
    try {
        await updates.startPolling();
        console.log('✅ Бот успешно запущен!');
        console.log(`📊 Игроков в базе: ${Object.keys(db.users.users || {}).length}`);
        console.log(`🔗 Группа: ${db.config.groupUrl || 'https://vk.com/'}`);
        console.log(`\n💡 Совет: напишите "помощь" в группе для списка команд\n`);
    } catch (error) {
        console.error('❌ Ошибка запуска бота:', error.message);
        
        if (error.message.includes('access_token')) {
            console.error('❗ Укажите корректный токен группы в коде (строка 7)');
        }
        if (error.message.includes('Callback') || error.message.includes('Long Poll')) {
            console.error('❗ Включите "Сообщения сообщества" в настройках вашей группы ВК:');
            console.error('   1. Зайдите в управление группой');
            console.error('   2. "Работа с сообщениями" → Включить');
            console.error('   3. "Long Poll API" → Включить');
        }
    }
}

startBot();