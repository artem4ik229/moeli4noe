const mineflayer = require('mineflayer');
const readline = require('readline');

console.log('Minecraft Bot - Улучшенная версия');
console.log('==================================\n');

const config = {
    host: 'mc.holyworld.ru',
    port: 25565,
    username: 'masha_',
    version: '1.19.4',
    auth: 'offline',
    hideErrors: true,
    logErrors: false,
    checkTimeoutInterval: 60000,
    defaultChatPatterns: false
};

let bot = mineflayer.createBot(config);
let isPerformingAction = false;
let isFarmingObsidian = false;
let isCurrentlyDigging = false;
let currentDiggingBlock = null;
let farmingInterval = null;
let durabilityInterval = null;
let lastCheckTime = 0;
let wasStoppedByDurability = false;
let autoEatInterval = null;
let autoEatEnabled = false;
let farmPauseInterval = null; // Интервал для пауз в фарме
let farmStartTime = 0; // Время начала фарма

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

// Максимальная прочность инструментов
const MAX_DURABILITY = {
    'netherite_pickaxe': 2031,
    'diamond_pickaxe': 1561,
    'iron_pickaxe': 250,
    'stone_pickaxe': 131,
    'golden_pickaxe': 32,
    'wooden_pickaxe': 59,
    'netherite_boots': 481,
    'diamond_boots': 429,
    'iron_boots': 195,
    'golden_boots': 91,
    'chainmail_boots': 195,
    'leather_boots': 65
};

// Пороги прочности для остановки и возобновления
const DURABILITY_THRESHOLDS = {
    'netherite_pickaxe': {
        stop: 1015,
        resume: 1500
    },
    'diamond_pickaxe': {
        stop: 780,
        resume: 1200
    },
    'iron_pickaxe': {
        stop: 125,
        resume: 200
    },
    'stone_pickaxe': {
        stop: 65,
        resume: 100
    },
    'golden_pickaxe': {
        stop: 16,
        resume: 25
    },
    'wooden_pickaxe': {
        stop: 29,
        resume: 45
    },
    'netherite_boots': {
        stop: 240,
        resume: 360
    },
    'diamond_boots': {
        stop: 214,
        resume: 320
    },
    'iron_boots': {
        stop: 97,
        resume: 145
    },
    'golden_boots': {
        stop: 45,
        resume: 68
    },
    'chainmail_boots': {
        stop: 97,
        resume: 145
    },
    'leather_boots': {
        stop: 32,
        resume: 48
    }
};

// Функция для включения/выключения автоматической еды
function toggleAutoEat() {
    if (autoEatEnabled) {
        // Выключаем авто-еду
        if (autoEatInterval) {
            clearInterval(autoEatInterval);
            autoEatInterval = null;
        }
        autoEatEnabled = false;
        console.log('❌ Автоматическая еда отключена');
    } else {
        // Включаем авто-еду
        autoEatEnabled = true;
        console.log('✅ Автоматическая еда включена');
        console.log('🍖 Бот будет автоматически писать /feed каждые 30 секунд');
        
        // Немедленно выполняем первую команду
        bot.chat('/feed');
        console.log('🍽️ Выполнена команда /feed');
        
        // Устанавливаем интервал для повторения каждые 30 секунд
        autoEatInterval = setInterval(() => {
            if (autoEatEnabled) {
                bot.chat('/feed');
                console.log('🍽️ Автоматически выполнена команда /feed');
            }
        }, 30000); // 30 секунд
    }
}

// Функция для запуска системы пауз в фарме
function startFarmPauseSystem() {
    if (farmPauseInterval) {
        clearInterval(farmPauseInterval);
    }
    
    farmStartTime = Date.now();
    console.log('⏰ Система пауз запущена. Пауза каждые 10 минут на 1 минуту.');
    
    farmPauseInterval = setInterval(() => {
        if (isFarmingObsidian) {
            console.log('⏸️ Автоматическая пауза: фарм работал 10 минут. Отдых 1 минуту...');
            stopObsidianFarming();
            
            // Запускаем фарм через 1 минуту
            setTimeout(() => {
                if (!isFarmingObsidian) {
                    console.log('🔄 Возобновление фарма после паузы...');
                    startObsidianFarming();
                }
            }, 60000); // 1 минута
        }
    }, 600000); // 10 минут
}

// Функция для остановки системы пауз в фарме
function stopFarmPauseSystem() {
    if (farmPauseInterval) {
        clearInterval(farmPauseInterval);
        farmPauseInterval = null;
        console.log('⏰ Система пауз остановлена');
    }
}

// Функция для проверки, является ли предмет ботинками
function isBoots(itemName) {
    const bootsTypes = [
        'leather_boots', 'golden_boots', 'chainmail_boots', 
        'iron_boots', 'diamond_boots', 'netherite_boots'
    ];
    return bootsTypes.includes(itemName);
}

// Функция для получения информации о ботинках (всегда актуальные данные)
function getBootsInfo() {
    try {
        // Правильные слоты экипировки в mineflayer:
        // 0: главная рука, 1: шлем, 2: нагрудник, 3: поножи, 4: ботинки, 5: вторая рука
        const BOOTS_SLOT_ID = 4; // Слот для ботинок
        
        // Всегда получаем актуальные данные из слота экипировки
        const boots = bot.inventory.slots[BOOTS_SLOT_ID + 36]; // 36 - это смещение для экипировки
        
        if (boots && isBoots(boots.name)) {
            const durability = getBootsDurability();
            const maxDurability = MAX_DURABILITY[boots.name] || getArmorMaxDurability(boots.name);
            return {
                item: boots,
                isEquipped: true,
                durability: durability,
                maxDurability: maxDurability,
                name: boots.name
            };
        }
        
        return null;
    } catch (error) {
        console.log('❌ Ошибка при получении информации о ботинках:', error.message);
        return null;
    }
}

// Функция для получения прочности ботинок (всегда актуальные данные)
function getBootsDurability() {
    try {
        const BOOTS_SLOT_ID = 4; // Слот для ботинок
        const boots = bot.inventory.slots[BOOTS_SLOT_ID + 36];
        
        if (!boots || !isBoots(boots.name)) {
            return 0; // Ботинки не надеты или отсутствуют
        }
        
        const maxDurability = MAX_DURABILITY[boots.name] || getArmorMaxDurability(boots.name);
        let damage = 0;
        
        // Получаем актуальный урон из NBT данных
        if (boots.nbt && boots.nbt.value && boots.nbt.value.Damage) {
            damage = boots.nbt.value.Damage.value;
        } else if (boots.durability !== undefined) {
            damage = boots.durability;
        } else if (boots.metadata && boots.metadata.damage !== undefined) {
            damage = boots.metadata.damage;
        }
        
        return Math.max(0, maxDurability - damage);
    } catch (error) {
        console.log('❌ Ошибка при получении прочности ботинок:', error.message);
        return 0;
    }
}

// Функция для проверки наличия кирки в инвентаре
function findPickaxe() {
    const pickaxes = [
        'netherite_pickaxe',
        'diamond_pickaxe', 
        'iron_pickaxe', 
        'stone_pickaxe', 
        'golden_pickaxe', 
        'wooden_pickaxe'
    ];
    
    // Сначала проверяем активный слот
    const activeSlot = bot.quickBarSlot;
    const activeItem = bot.inventory.slots[activeSlot + 36];
    
    if (activeItem && pickaxes.includes(activeItem.name)) {
        return { item: activeItem, slot: activeSlot, isActive: true };
    }
    
    // Затем ищем в горячих слотах
    for (let i = 0; i < 9; i++) {
        const item = bot.inventory.slots[i + 36];
        if (item && pickaxes.includes(item.name)) {
            return { item, slot: i, isActive: i === activeSlot };
        }
    }
    
    // Затем ищем во всем инвентаре
    for (let i = 9; i < 36; i++) {
        const item = bot.inventory.slots[i];
        if (item && pickaxes.includes(item.name)) {
            return { item, slot: i, isActive: false };
        }
    }
    
    return null;
}

// Функция для получения текущей прочности инструмента (абсолютное значение)
function getCurrentDurability(item) {
    if (!item) return 0;
    
    try {
        const maxDurability = MAX_DURABILITY[item.name] || getMaxDurability(item.name);
        let damage = 0;
        
        if (item.nbt?.value?.Damage) {
            damage = item.nbt.value.Damage.value;
        } else if (item.durability !== undefined) {
            damage = item.durability;
        }
        
        return Math.max(0, maxDurability - damage);
    } catch (error) {
        return 0;
    }
}

// Функция для получения порогов прочности для предмета
function getDurabilityThresholds(itemName) {
    // Для кирок
    if (itemName.includes('pickaxe')) {
        return DURABILITY_THRESHOLDS[itemName] || DURABILITY_THRESHOLDS['netherite_pickaxe'];
    }
    // Для ботинок
    if (isBoots(itemName)) {
        return DURABILITY_THRESHOLDS[itemName] || DURABILITY_THRESHOLDS['netherite_boots'];
    }
    return { stop: 0, resume: 0 };
}

// Функция для проверки прочности инструментов (всегда актуальные данные)
function checkToolDurability() {
    const pickaxe = findPickaxe();
    const bootsDurability = getBootsDurability(); // Всегда получаем актуальные данные
    
    let needsToStop = false;
    let reason = '';
    
    // Проверка кирки
    if (pickaxe) {
        const pickaxeDurability = getCurrentDurability(pickaxe.item);
        const threshold = getDurabilityThresholds(pickaxe.item.name);
        
        if (pickaxeDurability <= threshold.stop) {
            needsToStop = true;
            reason = `кирка (${pickaxeDurability}/${MAX_DURABILITY[pickaxe.item.name] || '?'})`;
        }
    } else {
        needsToStop = true;
        reason = 'кирка отсутствует';
    }
    
    // Проверка ботинок (всегда актуальные данные)
    const bootsInfo = getBootsInfo(); // Всегда получаем актуальные данные
    if (bootsInfo) {
        const threshold = getDurabilityThresholds(bootsInfo.name);
        if (bootsDurability <= threshold.stop) {
            needsToStop = true;
            reason = reason ? `${reason}, ботинки (${bootsDurability}/${bootsInfo.maxDurability})` : `ботинки (${bootsDurability}/${bootsInfo.maxDurability})`;
        }
    } else {
        needsToStop = true;
        reason = reason ? `${reason}, ботинки отсутствуют` : 'ботинки отсутствуют';
    }
    
    return { needsToStop, reason };
}

// Функция для проверки, можно ли возобновить фарм (всегда актуальные данные)
function canResumeFarming() {
    const pickaxe = findPickaxe();
    const bootsDurability = getBootsDurability(); // Всегда получаем актуальные данные
    
    let canResume = true;
    let reason = '';
    
    // Проверка кирки
    if (pickaxe) {
        const pickaxeDurability = getCurrentDurability(pickaxe.item);
        const threshold = getDurabilityThresholds(pickaxe.item.name);
        
        if (pickaxeDurability < threshold.resume) {
            canResume = false;
            reason = `кирка (${pickaxeDurability}/${MAX_DURABILITY[pickaxe.item.name] || '?'})`;
        }
    } else {
        canResume = false;
        reason = 'кирка отсутствует';
    }
    
    // Проверка ботинок (всегда актуальные данные)
    const bootsInfo = getBootsInfo(); // Всегда получаем актуальные данные
    if (bootsInfo) {
        const threshold = getDurabilityThresholds(bootsInfo.name);
        if (bootsDurability < threshold.resume) {
            canResume = false;
            reason = reason ? `${reason}, ботинки (${bootsDurability}/${bootsInfo.maxDurability})` : `ботинки (${bootsDurability}/${bootsInfo.maxDurability})`;
        }
    } else {
        canResume = false;
        reason = reason ? `${reason}, ботинки отсутствуют` : 'ботинки отсутствуют';
    }
    
    return { canResume, reason };
}

// Функция для вывода информации о прочности (всегда актуальные данные)
function logDurabilityInfo() {
    if (!isFarmingObsidian) return;
    
    const pickaxe = findPickaxe();
    const bootsInfo = getBootsInfo(); // Всегда получаем актуальные данные
    
    if (pickaxe) {
        const pickaxeDurability = getCurrentDurability(pickaxe.item);
        const maxPickaxe = MAX_DURABILITY[pickaxe.item.name] || '?';
        
        if (bootsInfo) {
            console.log(`⚒️ Прочность: Кирка ${pickaxeDurability}/${maxPickaxe} | Ботинки ${bootsInfo.durability}/${bootsInfo.maxDurability}`);
        } else {
            console.log(`⚒️ Прочность: Кирка ${pickaxeDurability}/${maxPickaxe} | Ботинки отсутствуют`);
        }
    } else {
        if (bootsInfo) {
            console.log(`⚒️ Прочность: Кирка отсутствует | Ботинки ${bootsInfo.durability}/${bootsInfo.maxDurability}`);
        } else {
            console.log(`⚒️ Прочность: Кирка отсутствует | Ботинки отсутствуют`);
        }
    }
}

// Функция для получения максимальной прочности инструмента (для совместимости)
function getMaxDurability(toolName) {
    const durabilityMap = {
        'wooden_pickaxe': 59,
        'stone_pickaxe': 131,
        'iron_pickaxe': 250,
        'golden_pickaxe': 32,
        'diamond_pickaxe': 1561,
        'netherite_pickaxe': 2031
    };
    return durabilityMap[toolName] || 0;
}

// Функция для получения максимальной прочности брони (для совместимости)
function getArmorMaxDurability(armorName) {
    const armorDurability = {
        'leather_helmet': 55, 'leather_chestplate': 80, 'leather_leggings': 75, 'leather_boots': 65,
        'golden_helmet': 77, 'golden_chestplate': 112, 'golden_leggings': 105, 'golden_boots': 91,
        'chainmail_helmet': 165, 'chainmail_chestplate': 240, 'chainmail_leggings': 225, 'chainmail_boots': 195,
        'iron_helmet': 165, 'iron_chestplate': 240, 'iron_leggings': 225, 'iron_boots': 195,
        'diamond_helmet': 363, 'diamond_chestplate': 528, 'diamond_leggings': 495, 'diamond_boots': 429,
        'netherite_helmet': 407, 'netherite_chestplate': 592, 'netherite_leggings': 555, 'netherite_boots': 481
    };
    return armorDurability[armorName] || 0;
}

// Функция для проверки состояния бота
function shouldStopFarming() {
    // Проверка здоровья (3 сердца = 6 здоровья)
    if (bot.health <= 6) {
        console.log('🚑 Останавливаю фарм: мало здоровья!');
        return true;
    }
    
    // Проверка сытости
    if (bot.food <= 6) {
        console.log('🍖 Останавливаю фарм: низкий уровень сытости!');
        return true;
    }
    
    // Проверка прочности инструментов
    const durabilityCheck = checkToolDurability();
    if (durabilityCheck.needsToStop) {
        console.log(`🛑 Останавливаю фарм: ${durabilityCheck.reason}!`);
        wasStoppedByDurability = true;
        return true;
    }
    
    return false;
}

// Функция для получения блока перед ботом
function getBlockInFront() {
    return bot.blockAtCursor(3);
}

// Функция для копания с await
async function digBlock() {
    if (isCurrentlyDigging) return;
    
    try {
        const block = getBlockInFront();
        
        if (block && block.name !== 'air' && block.name !== 'bedrock' && block.name !== 'water' && block.name !== 'lava') {
            console.log(`⛏️ Начинаю копать блок: ${block.name}`);
            isCurrentlyDigging = true;
            currentDiggingBlock = block;
            
            await bot.dig(block);
            
            console.log(`✅ Успешно разрушен блок: ${block.name}`);
        }
    } catch (error) {
        // Игнорируем ошибки прерывания копания
        if (error.message !== 'Digging aborted' && !error.message.includes('digging')) {
            console.error('Ошибка при разрушении блока:', error.message);
        }
    } finally {
        isCurrentlyDigging = false;
        currentDiggingBlock = null;
    }
}

// Функция для запуска фарма обсидиана
function startObsidianFarming() {
    if (isFarmingObsidian) {
        console.log('❌ Фарм обсидиана уже запущен');
        return;
    }
    
    // Проверяем наличие кирки
    const pickaxe = findPickaxe();
    if (!pickaxe) {
        console.log('❌ Кирок не найдено в инвентаре!');
        console.log('💡 Нужна кирка: незеритовая, алмазная, железная, каменная, золотая или деревянная');
        return;
    }
    
    // Проверяем наличие ботинок
    const bootsInfo = getBootsInfo();
    if (!bootsInfo) {
        console.log('❌ Ботинки не надеты!');
        console.log('💡 Наденьте ботинки в слот брони (обычно это слот 40 в инвентаре)');
        
        // Показываем, что есть в инвентаре
        console.log('🔍 Поиск ботинок в инвентаре...');
        let foundBoots = false;
        for (let i = 0; i < bot.inventory.slots.length; i++) {
            const item = bot.inventory.slots[i];
            if (item && isBoots(item.name)) {
                console.log(`✅ Ботинки найдены в слоте ${i}: ${item.name}`);
                foundBoots = true;
                
                // Пытаемся надеть ботинки
                console.log('🔄 Пытаюсь надеть ботинки...');
                try {
                    console.log('💡 Чтобы надеть ботинки:');
                    console.log('   1. Откройте инвентарь (E)');
                    console.log('   2. Перетащите ботинки в слот для брони (нижний левый угол)');
                    console.log('   3. Закройте инвентарь');
                    break;
                } catch (error) {
                    console.log('❌ Не удалось надеть ботинки автоматически');
                }
            }
        }
        
        if (!foundBoots) {
            console.log('❌ Ботинки не найдены в инвентаре!');
        }
        
        return;
    }

    console.log(`✅ Найдена кирка: ${pickaxe.item.name} в слоте ${pickaxe.slot} (${pickaxe.isActive ? 'в руках' : 'в инвентаре'})`);
    console.log(`✅ Надеты ботинки: ${bootsInfo.name} (прочность: ${bootsInfo.durability}/${bootsInfo.maxDurability})`);
    
    // Если кирка не в активном слоте, выбираем ее
    if (!pickaxe.isActive && pickaxe.slot < 9) {
        bot.setQuickBarSlot(pickaxe.slot);
        console.log(`🔄 Выбрал кирку в слот ${pickaxe.slot}`);
    }
    
    const pickaxeThreshold = getDurabilityThresholds(pickaxe.item.name);
    const bootsThreshold = getDurabilityThresholds(bootsInfo.name);
    
    console.log('⛏️ Запускаю фарм обсидиана с мониторингом прочности...');
    console.log(`💡 Бот автоматически остановится при прочности: кирка<${pickaxeThreshold.stop}, ботинки<${bootsThreshold.stop}`);
    console.log(`💡 Бот автоматически возобновит при прочности: кирка>${pickaxeThreshold.resume}, ботинки>${bootsThreshold.resume}`);
    console.log('⏰ Автоматические паузы: каждые 10 минут на 1 минуту');
    console.log('📝 Для остановки введите: фарм обсы');
    
    isFarmingObsidian = true;
    isCurrentlyDigging = false;
    wasStoppedByDurability = false;
    
    // Запускаем систему пауз
    startFarmPauseSystem();
    
    // Постоянно прыгаем
    bot.setControlState('jump', true);
    
    // Интервал для вывода прочности каждые 5 секунд
    durabilityInterval = setInterval(() => {
        if (isFarmingObsidian) {
            logDurabilityInfo();
            
            // Проверяем прочность каждые 5 секунд
            const durabilityCheck = checkToolDurability();
            if (durabilityCheck.needsToStop) {
                console.log(`🛑 Авто-остановка: ${durabilityCheck.reason}!`);
                wasStoppedByDurability = true;
                stopObsidianFarming();
                return;
            }
        }
    }, 5000);
    
    // Интервал для автоматического возобновления фарма
    const resumeInterval = setInterval(() => {
        if (!isFarmingObsidian && wasStoppedByDurability) {
            const resumeCheck = canResumeFarming();
            if (resumeCheck.canResume) {
                console.log('✅ Прочность восстановлена! Автоматически возобновляю фарм...');
                wasStoppedByDurability = false;
                startObsidianFarming();
            } else {
                console.log(`⏳ Ожидаю восстановления прочности: ${resumeCheck.reason}`);
            }
        }
        
        // Если фарм не активен и не был остановлен из-за прочности, очищаем интервал
        if (!isFarmingObsidian && !wasStoppedByDurability) {
            clearInterval(resumeInterval);
        }
    }, 10000); // Проверяем каждые 10 секунд
    
    // Интервал для непрерывного копания
    farmingInterval = setInterval(async () => {
        if (!isFarmingObsidian) return;
        
        // Проверяем состояние каждые 3 секунды
        const now = Date.now();
        if (now - lastCheckTime > 3000) {
            if (shouldStopFarming()) {
                stopObsidianFarming();
                return;
            }
            lastCheckTime = now;
        }
        
        // Если не копаем в данный момент, начинаем копать
        if (!isCurrentlyDigging) {
            await digBlock();
        }
    }, 100);
}

// Функция для остановки фарма обсидиана
function stopObsidianFarming() {
    if (!isFarmingObsidian) {
        return;
    }
    
    console.log('🛑 Останавливаю фарм обсидиана...');
    isFarmingObsidian = false;
    isCurrentlyDigging = false;
    
    // Останавливаем систему пауз
    stopFarmPauseSystem();
    
    // Перестаем прыгать
    bot.setControlState('jump', false);
    
    // Останавливаем текущее копание
    try {
        if (currentDiggingBlock) {
            bot.stopDigging();
        }
    } catch (error) {
        // Игнорируем ошибки остановки
    }
    
    // Очищаем интервалы
    if (farmingInterval) {
        clearInterval(farmingInterval);
        farmingInterval = null;
    }
    
    if (durabilityInterval) {
        clearInterval(durabilityInterval);
        durabilityInterval = null;
    }
    
    currentDiggingBlock = null;
    
    if (!wasStoppedByDurability) {
        console.log('✅ Фарм обсидиана остановлен');
    } else {
        const pickaxe = findPickaxe();
        const bootsInfo = getBootsInfo();
        
        if (pickaxe && bootsInfo) {
            const pickaxeThreshold = getDurabilityThresholds(pickaxe.item.name);
            const bootsThreshold = getDurabilityThresholds(bootsInfo.name);
            console.log(`⏳ Фарм приостановлен из-за низкой прочности. Автоматически возобновится при прочности: кирка>${pickaxeThreshold.resume}, ботинки>${bootsThreshold.resume}`);
        }
    }
}

// Улучшенная функция для безопасного клика
async function clickSlot(slot) {
    return new Promise((resolve, reject) => {
        if (!bot.currentWindow) {
            reject(new Error('Нет открытого меню'));
            return;
        }
        
        if (slot < 0 || slot >= bot.currentWindow.slots.length) {
            reject(new Error(`Слот ${slot} не существует`));
            return;
        }
        
        console.log(`🖱️ Кликаю по слоту ${slot}...`);
        
        try {
            bot.clickWindow(slot, 0, 0, (err) => {
                if (err) {
                    console.log(`❌ Ошибка при клике по слоту ${slot}: ${err.message}`);
                    reject(err);
                } else {
                    console.log(`✅ Успешно кликнул по слоту ${slot}`);
                    setTimeout(resolve, 500);
                }
            });
        } catch (error) {
            console.log(`❌ Исключение при клике: ${error.message}`);
            reject(error);
        }
    });
}

// Функция для ожидания
function wait(seconds) {
    console.log(`⏳ Жду ${seconds} секунд...`);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Улучшенный скрипт захода на лайт
async function liteMacro() {
    if (isPerformingAction) {
        console.log('❌ Бот уже выполняет действие');
        return;
    }
    
    isPerformingAction = true;
    console.log('🚀 Запускаю исправленный макрос "лайт"...');
    
    try {
        // Шаг 1: ПКМ компас
        console.log('🎯 Использую компас (ПКМ)...');
        bot.setQuickBarSlot(0);
        await wait(2);
        
        const compass = bot.inventory.items().find(item => item.name === 'compass');
        if (!compass) {
            throw new Error('Компас не найден в инвентаре!');
        }
        
        bot.activateItem();
        
        // Шаг 2: Ждем открытия меню
        await wait(5);
        
        if (!bot.currentWindow) {
            console.log('⚠️ Меню не открылось, пробую еще раз...');
            bot.activateItem();
            await wait(3);
        }
        
        if (!bot.currentWindow) {
            throw new Error('Меню не открылось после использования компаса');
        }
        
        console.log(`✅ Меню открыто: "${removeColorCodes(bot.currentWindow.title)}"`);
        
        // Шаг 3: Клик по слоту 12
        await clickSlot(12);
        await wait(4);
        
        if (!bot.currentWindow) {
            throw new Error('Новое меню не открылось после клика на слот 12');
        }
        
        console.log(`✅ Новое меню открыло: "${removeColorCodes(bot.currentWindow.title)}"`);
        
        // Шаг 5: Клик по слоту 0
        await clickSlot(0);
        await wait(4);
        
        if (!bot.currentWindow) {
            throw new Error('Новое меню не открылось после клика на слот 0');
        }
        
        console.log(`✅ Новое меню открыто: "${removeColorCodes(bot.currentWindow.title)}"`);
        
        // Шаг 7: Клик по слоту 20
        await clickSlot(20);
        await wait(3);
        
        console.log('🎉 Бот успешно зашел на анархию!');
        
    } catch (error) {
        console.log(`❌ Ошибка в макросе: ${error.message}`);
        console.log('💡 Советы:');
        console.log('   - Убедитесь что компас в первом слоте');
        console.log('   - Попробуйте выполнить шаги вручную');
    } finally {
        isPerformingAction = false;
    }
}

// Функция для ходьбы вперед
async function walkForward(seconds) {
    if (isPerformingAction) {
        console.log('❌ Бот уже выполняет действие');
        return;
    }
    
    isPerformingAction = true;
    console.log(`🚶 Иду вперед ${seconds} секунд...`);
    bot.setControlState('forward', true);
    await wait(seconds);
    bot.setControlState('forward', false);
    isPerformingAction = false;
}

// Функция для удаления цветовых кодов и обработки объектов
function removeColorCodes(str) {
    if (typeof str !== 'string') {
        if (str && typeof str === 'object') {
            if (str.text) return removeColorCodes(str.text);
            if (str.translate) return removeColorCodes(str.translate);
            if (str.extra && Array.isArray(str.extra)) {
                return str.extra.map(extra => removeColorCodes(extra)).join('');
            }
            if (str.toString && str.toString() !== '[object Object]') {
                return str.toString();
            }
            return 'Меню';
        }
        return String(str);
    }
    return str.replace(/§[0-9a-fk-or]/g, '');
}

// Функция для отладки экипировки
function debugEquipment() {
    console.log('🔍 Отладка экипировки:');
    
    // Проверяем все слоты экипировки
    for (let i = 36; i <= 41; i++) {
        const item = bot.inventory.slots[i];
        if (item) {
            console.log(`  Слот ${i}: ${item.name}`);
            
            // Пытаемся получить прочность
            let damage = 0;
            if (item.nbt && item.nbt.value && item.nbt.value.Damage) {
                damage = item.nbt.value.Damage.value;
            }
            console.log(`    Урон: ${damage}`);
        }
    }
    
    // Альтернативный способ через bot.armor (если доступен)
    if (bot.armor) {
        console.log('🔍 Броня через bot.armor:');
        for (let i = 0; i < bot.armor.length; i++) {
            const item = bot.armor[i];
            if (item) {
                console.log(`  ${i}: ${item.name}`);
            }
        }
    }
}

// Улучшенная обработка ошибок
bot.on('error', (err) => {
    if (err.message.includes('partial packet') || 
        err.message.includes('Chunk size') ||
        err.message.includes('PartialReadError') ||
        err.message.includes('array size is abnormally large') ||
        err.message.includes('internal error') ||
        err.message.includes('timed out') ||
        err.code === 'ECONNREFUSED') {
        console.log('🔧 Игнорируемая техническая ошибка');
        return;
    }
    console.log('❌ Критическая ошибка:', err.message);
});

bot.on('login', () => {
    console.log('✅ Успешно подключился к серверу! (офлайн-режим)');
});

bot.on('spawn', () => {
    console.log('🎉 Бот зашел в мир!');
    console.log(`📍 Позиция: x:${Math.round(bot.entity.position.x)}, y:${Math.round(bot.entity.position.y)}, z:${Math.round(bot.entity.position.z)}`);
    console.log('❤️ Здоровье:', bot.health, '| 🍖 Голод:', bot.food);
    
    // Проверяем компас
    const compass = bot.inventory.items().find(item => item.name === 'compass');
    if (compass) {
        console.log('✅ Компас найден в инвентаре');
        if (bot.quickBarSlot !== 0) {
            bot.setQuickBarSlot(0);
        }
    } else {
        console.log('❌ Компас не найден! Получите компас для работы макроса.');
    }
    
    // Проверяем наличие кирок
    const pickaxe = findPickaxe();
    if (pickaxe) {
        console.log(`✅ Кирка найдена: ${pickaxe.item.name} (в ${pickaxe.isActive ? 'руках' : 'инвентаре'})`);
    } else {
        console.log('❌ Кирок не найдено! Для фарма обсидиана нужна кирка.');
    }
    
    // Проверяем наличие ботинок
    const bootsInfo = getBootsInfo();
    if (bootsInfo) {
        console.log(`✅ Ботинки надеты: ${bootsInfo.name} (прочность: ${bootsInfo.durability}/${bootsInfo.maxDurability})`);
    } else {
        console.log('❌ Ботинки не надеты! Для фарма обсидиана нужны ботинки.');
    }
    
    console.log('\n📝 Доступные команды:');
    console.log('  лайт - макрос: автовыбор режима Lite');
    console.log('  фарм обсы - начать/остановить фарм обсидиана');
    console.log('  иди - пройти вперед 3 секунды');
    console.log('  прыг - прыгнуть');
    console.log('  присядь - присесть/встать');
    console.log('  компас - использовать компас (ПКМ)');
    console.log('  меню - показать информацию о текущем меню');
    console.log('  клик X - кликнуть по слоту X');
    console.log('  слот X - выбрать слот быстрой панели (0-8)');
    console.log('  чат сообщение - отправить сообщение в чат');
    console.log('  поз - показать позицию');
    console.log('  здоровье - показать здоровье');
    console.log('  прочность - показать текущую прочность инструментов');
    console.log('  инвентарь - показать содержимое инвентаря');
    console.log('  отладка - показать отладочную информацию об экипировке');
    console.log('  автоеда - включить/выключить автоматическую еду (/feed каждые 30 секунд)');
    console.log('  выход - выйти\n');
    
    rl.prompt();
});

// Отслеживаем открытие окон
bot.on('windowOpen', (window) => {
    const title = removeColorCodes(window.title);
    console.log(`📂 Открыто меню: "${title}"`);
});

bot.on('windowClose', () => {
    console.log('📂 Меню закрыто');
});

bot.on('end', (reason) => {
    console.log('🔌 Отключился от сервера');
    stopObsidianFarming();
    // Останавливаем авто-еду при отключении
    if (autoEatInterval) {
        clearInterval(autoEatInterval);
        autoEatInterval = null;
    }
    autoEatEnabled = false;
    rl.close();
});

bot.on('kicked', (reason) => {
    const reasonText = removeColorCodes(reason);
    console.log('🚫 Кикнут:', reasonText);
    stopObsidianFarming();
    // Останавливаем авто-еду при кике
    if (autoEatInterval) {
        clearInterval(autoEatInterval);
        autoEatInterval = null;
    }
    autoEatEnabled = false;
    rl.close();
});

// Показываем сообщения из чата
bot.on('message', (message) => {
    const text = removeColorCodes(message.toString()).trim();
    if (text.length > 0 && 
        !text.includes('joined the game') && 
        !text.includes('left the game') &&
        !text.includes('masha_') &&
        text.length < 100) {
        process.stdout.write('\r\x1b[K');
        console.log('💬 Чат:', text);
        rl.prompt(true);
    }
});

// Обработчик команд
rl.on('line', async (input) => {
    const command = input.trim();
    
    if (command === '') {
        rl.prompt();
        return;
    }

    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();

    try {
        switch (cmd) {
            case 'чат':
                const message = parts.slice(1).join(' ');
                if (message) {
                    bot.chat(message);
                    console.log('📤 Отправлено:', message);
                }
                break;

            case 'фарм':
                if (parts[1] && parts[1].toLowerCase() === 'обсы') {
                    if (isFarmingObsidian) {
                        stopObsidianFarming();
                    } else {
                        startObsidianFarming();
                    }
                } else {
                    console.log('❌ Используйте: фарм обсы');
                }
                break;

            case 'слот':
                const slot = parseInt(parts[1]);
                if (slot >= 0 && slot <= 8) {
                    bot.setQuickBarSlot(slot);
                    console.log(`✅ Выбран слот ${slot}`);
                } else {
                    console.log('❌ Используйте слот 0-8');
                }
                break;

            case 'клик':
                const clickSlotNum = parseInt(parts[1]);
                if (!isNaN(clickSlotNum)) {
                    try {
                        await clickSlot(clickSlotNum);
                    } catch (error) {
                        console.log(`❌ Ошибка: ${error.message}`);
                    }
                } else {
                    console.log('❌ Укажите номер слота');
                }
                break;

            case 'меню':
                if (bot.currentWindow) {
                    const title = removeColorCodes(bot.currentWindow.title);
                    console.log(`\n📂 Текущее меню: "${title}"`);
                    console.log(`📊 Слотов: ${bot.currentWindow.slots.length}`);
                    
                    const nonEmptySlots = [];
                    for (let i = 0; i < bot.currentWindow.slots.length; i++) {
                        const item = bot.currentWindow.slots[i];
                        if (item) {
                            let itemInfo = `${item.name}`;
                            if (item.customName) {
                                const customName = removeColorCodes(item.customName);
                                itemInfo += ` | "${customName}"`;
                            }
                            nonEmptySlots.push(`   ${i}: ${itemInfo}`);
                        }
                    }
                    
                    if (nonEmptySlots.length > 0) {
                        console.log('📦 Непустые слоты:');
                        console.log(nonEmptySlots.join('\n'));
                    } else {
                        console.log('📦 Все слоты пусты');
                    }
                } else {
                    console.log('❌ Нет открытого меню');
                }
                break;

            case 'компас':
                if (isPerformingAction) {
                    console.log('❌ Бот уже выполняет действие');
                    break;
                }
                isPerformingAction = true;
                bot.setQuickBarSlot(0);
                await wait(1);
                bot.activateItem();
                console.log('✅ Компас использован');
                isPerformingAction = false;
                break;

            case 'лайт':
                await liteMacro();
                break;

            case 'иди':
                await walkForward(3);
                break;

            case 'прыг':
                if (isPerformingAction) {
                    console.log('❌ Бот уже выполняет действие');
                    break;
                }
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 300);
                console.log('🦘 Прыжок!');
                break;

            case 'присядь':
                if (isPerformingAction) {
                    console.log('❌ Бот уже выполняет действие');
                    break;
                }
                const isSneaking = bot.getControlState('sneak');
                bot.setControlState('sneak', !isSneaking);
                console.log(isSneaking ? '✅ Встал' : '🧘 Присел');
                break;

            case 'поз':
                const pos = bot.entity.position;
                console.log(`📍 x:${Math.round(pos.x)}, y:${Math.round(pos.y)}, z:${Math.round(pos.z)}`);
                break;

            case 'здоровье':
                console.log(`❤️ ${bot.health} | 🍖 ${bot.food}`);
                break;

            case 'прочность':
                const pickaxe = findPickaxe();
                const bootsInfo = getBootsInfo(); // Всегда получаем актуальные данные
                
                if (pickaxe) {
                    const pickaxeDurability = getCurrentDurability(pickaxe.item);
                    const maxPickaxe = MAX_DURABILITY[pickaxe.item.name] || '?';
                    
                    if (bootsInfo) {
                        console.log(`⚒️ Текущая прочность: Кирка ${pickaxeDurability}/${maxPickaxe} | Ботинки ${bootsInfo.durability}/${bootsInfo.maxDurability}`);
                    } else {
                        console.log(`⚒️ Текущая прочность: Кирка ${pickaxeDurability}/${maxPickaxe} | Ботинки отсутствуют`);
                    }
                } else {
                    if (bootsInfo) {
                        console.log(`⚒️ Текущая прочность: Кирка отсутствует | Ботинки ${bootsInfo.durability}/${bootsInfo.maxDurability}`);
                    } else {
                        console.log(`⚒️ Текущая прочность: Кирка отсутствует | Ботинки отсутствуют`);
                    }
                }
                break;

            case 'инвентарь':
                console.log('🎒 Содержимое инвентаря:');
                console.log('📦 Горячие слоты (0-8):');
                for (let i = 36; i < 45; i++) {
                    const item = bot.inventory.slots[i];
                    if (item) {
                        console.log(`  ${i-36}: ${item.name} x${item.count}`);
                    }
                }
                
                console.log('🛡️ Слоты экипировки:');
                const equipmentSlots = [
                    { id: 36, name: 'Главная рука' },
                    { id: 37, name: 'Шлем' },
                    { id: 38, name: 'Нагрудник' },
                    { id: 39, name: 'Поножи' },
                    { id: 40, name: 'Ботинки' },
                    { id: 41, name: 'Вторая рука' }
                ];
                
                for (const slot of equipmentSlots) {
                    const item = bot.inventory.slots[slot.id];
                    if (item) {
                        console.log(`  ${slot.id}: ${slot.name} - ${item.name}`);
                    } else {
                        console.log(`  ${slot.id}: ${slot.name} - пусто`);
                    }
                }
                
                const bootsDebug = getBootsInfo();
                if (bootsDebug) {
                    console.log(`✅ Ботинки: ${bootsDebug.name} (прочность: ${bootsDebug.durability}/${bootsDebug.maxDurability})`);
                } else {
                    console.log('❌ Ботинки: не надеты');
                }
                break;

            case 'отладка':
                debugEquipment();
                break;

            case 'автоеда':
                toggleAutoEat();
                break;

            case 'выход':
                console.log('🛑 Выход...');
                stopObsidianFarming();
                // Останавливаем авто-еду при выходе
                if (autoEatInterval) {
                    clearInterval(autoEatInterval);
                    autoEatInterval = null;
                }
                bot.quit();
                rl.close();
                process.exit(0);
                break;

            default:
                console.log('❌ Неизвестная команда');
        }
    } catch (error) {
        console.log(`❌ Ошибка: ${error.message}`);
        isPerformingAction = false;
    }

    rl.prompt();
});

// Обработка Ctrl+C
rl.on('SIGINT', () => {
    console.log('\n🛑 Выход...');
    stopObsidianFarming();
    // Останавливаем авто-еду при выходе
    if (autoEatInterval) {
        clearInterval(autoEatInterval);
        autoEatInterval = null;
    }
    bot.quit();
    rl.close();
    process.exit(0);
});

// Улучшенная обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    if (!error.message.includes('read ECONNRESET') && 
        !error.message.includes('Digging aborted')) {
        console.log('❌ Необработанная ошибка:', error.message);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    if (!reason.message || 
        (!reason.message.includes('ECONNRESET') && 
         !reason.message.includes('Digging aborted'))) {
        console.log('❌ Необработанный промис:', reason.message || reason);
    }
});