require('dotenv').config()
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const toolPlugin = require('mineflayer-tool').plugin;
const { plugin: pvp } = require('mineflayer-pvp');
const customPVP = require('@nxg-org/mineflayer-custom-pvp')
const armorManager = require('mineflayer-armor-manager');
const plasmo = require('mineflayer-plasmovoice');
const movement = require('mineflayer-movement');
const elytrafly = require('mineflayer-elytrafly');
const axios = require('axios');
const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

const BOT_USERNAME = process.env.BOT_USERNAME
const BOT_PASSWORD = process.env.BOT_PASSWORD
const SERVER_IP = process.env.SERVER_IP
const SERVER_PORT = process.env.SERVER_PORT
const VERSION = process.env.VERSION

// Создание бота
const bot = mineflayer.createBot({
  host: SERVER_IP,
  port: SERVER_PORT,
  username: BOT_USERNAME,
  version: VERSION,
})

// Чёрный список игроков
const BLACKLIST = new Set(["SatiricCape3823", "Kissalin", "TheAlanMorn", "___ARTEMON___", "DangerZefer"])


// Функция для общения с локальным AI-сервером (aigen.py)
async function askGemini(prompt, type) {
    prompt = `${prompt} (тип: ${type})`;
    try {
        const response = await axios.post('http://127.0.0.1:4345/ask', {
            prompt: prompt
        });

        console.log("Ответ от нейросети: ", response.data.response);
        let response1 = response.data.response;
        eval(response1);
        return response1;
    } catch (err) {
        console.error("Чёт пошло не так. ", err.message);
    }
}
async function infoGemini(prompt) {
  try {
    const response = axios.post('http://127.0.0.1:4345/info', {
      prompt: prompt
    });
  } catch (err) {
    console.error("Чёт пошло не так. ", err.message);
  }
}

// Авторизация и приветствие
bot.on('login', () => {
  console.log(`Бот ${bot.username} подключился к серверу.`)
  bot.chat(`/login ${BOT_PASSWORD}`)

  // Функция для переподключения к серверу sleepcraft
  async function connectToServer() {
    console.log('Пытаюсь зайти!');
    await new Promise(resolve => setTimeout(resolve, 500));
    bot.chat('/server sleepcraft');
  }
  connectToServer(); // Автоматический вход на сервер после логина
})

bot.on('entitySpawn', (entity) => {
  if (entity.type === 'mob' && entity.kind === 'Hostile mobs') {
    const distance = bot.entity.position.distanceTo(entity.position)
    if (distance <= 8) {
      console.log(`Обнаружен враждебный моб: ${entity.name} на расстоянии ${distance.toFixed(2)} блоков`)
      // Ищем ближайшего игрока (не себя) для реакции, если нужно
      // const nearestPlayer = findNearestPlayer(10)
      // if (nearestPlayer) {
      //   bot.chat(`Обнаружен враждебный моб! Бегу к ${nearestPlayer.username}.`)
      //   // bot.pathfinder.setGoal(new GoalBlock(nearestPlayer.entity.position.x, nearestPlayer.entity.position.y, nearestPlayer.entity.position.z))
      // } else {
      //   bot.chat('Обнаружен враждебный моб! Атакую.')
      // }
      goAndAttackMob(entity)
    }
  }
})

// Движение к мобу и атака
function goAndAttackMob(mob) {
  if (!mob.position) return;
  // Если установлен pathfinder, используем его
  if (bot.pathfinder) {
    const { GoalNear } = require('mineflayer-pathfinder').goals;
    bot.pathfinder.setGoal(new GoalNear(mob.position.x, mob.position.y, mob.position.z, 1));
    bot.once('goal_reached', () => {
      attackMob(mob);
    });
  } else {
    // Если pathfinder не подключён, просто атакуем
    attackMob(mob);
  }
}

function findNearestPlayer(radius) {
  let nearest = null
  let nearestDistance = radius
  for (const player of Object.values(bot.players)) {
    if (player.username === bot.username) continue // Не учитывать самого себя
    if (player.entity) {
      const distance = bot.entity.position.distanceTo(player.entity.position)
      if (distance < nearestDistance) {
        nearest = player
        nearestDistance = distance
      }
    }
  }
  return nearest
}

function attackMob(mob) {
  const weapon = findBestWeapon()
  if (weapon) {
    bot.equip(weapon, 'hand', (err) => {
      if (err) bot.chat('Не удалось экипировать оружие.')
    })
  }
  bot.attack(mob)
}

function findBestWeapon() {
  const weapons = bot.inventory.slots.filter(item => item && (item.name.endsWith('sword') || item.name.endsWith('axe')))
  if (!weapons.length) return null
  const weaponPriority = { diamond_sword: 5, iron_sword: 4, stone_sword: 3, wooden_sword: 2 }
  return weapons.reduce((best, w) => (weaponPriority[w.name] > (weaponPriority[best?.name] || 0) ? w : best), null)
}

bot.on('windowOpen', (window) => {
  const forbiddenTypes = [
    'chest', 'container', 'shulkerBox', 'hopper', 'dropper', 'dispenser',
    'barrel', 'furnace', 'blastFurnace', 'smoker'
  ];
  if (forbiddenTypes.includes(window.type)) {
    // bot.chat('Я не беру предметы из хранилищ!')
    bot.closeWindow(window)
  }
})

bot.on('message', (jsonMsg, position) => {
  console.log(jsonMsg.toAnsi());
  let plainMessage = jsonMsg.toString();

  // if (plainMessage === "Your login session has been continued." || plainMessage === "Your connection to sleepcraft encountered a problem." || plainMessage === "You have successfully logged.") {
  //   connectToServer()
  // }

  if (plainMessage.includes(' › ') || plainMessage.startsWith('������ [ДС] ')) {
    let typeOfMessage = null
    if (plainMessage.includes('Вам] › ')) {
      // [vlkardakov -> Вам] › come
      message = plainMessage.split('Вам] › ')[1]
      username = plainMessage.split('[')[1].split(' ->')[0]
      typeOfMessage = 'direct message'

    } else if (plainMessage.startsWith('������ [ДС] ')) {
      // [ДС] vlkardakov: сообщение из дискорда
      plainMessage = plainMessage.replace('������ [ДС] ', '')
      message = plainMessage.split(': ')[1]
      username = plainMessage.split(': ')[0]
      typeOfMessage = 'global chat'
      // --- ОТВЕТ НА СООБЩЕНИЯ ОТ qber1x ИЗ ДИСКОРДА ---
      if (username === 'qber1x') {
        askGemini(plainMessage, typeOfMessage)
        return;
      }
      // --- конец блока ---


    } else if (plainMessage.includes(' › ')) {
      // vlkardakov › come
      message = plainMessage.split(' › ')[1]
      username = plainMessage.split(' › ')[0]

      player = Object.values(bot.entities).find(
          (e) => e.type === 'player' && e.username === username
      );

      if (player) typeOfMessage = 'local chat'
      else typeOfMessage = 'global chat'
    }

    // --- Глобальный чат: отвечать через ! ---
    if (typeOfMessage === 'global chat' && BOT_USERNAME === 'qber1x' && username !== BOT_USERNAME) {
      askGemini('!' + message, typeOfMessage)
    } else if (username !== BOT_USERNAME) {
      askGemini(plainMessage, typeOfMessage)
    } else if (username === BOT_USERNAME) {
      infoGemini(plainMessage);
    }

    // console.log(`username: '${username}', command: '${command}'`);
  }
  else {
    askGemini(plainMessage, 'system')
  }
});

bot.on('error', (err) => {
  console.error(`Ошибка: ${err.message}`)
})
bot.on('kicked', (reason) => {
  console.log(`Бот был кикнут. Причина: ${reason}`)
})

bot.on('resourcePack', (url, hash) => {
    // Сервер предложил пакет ресурсов. Принимаю.
    bot.acceptResourcePack();
});

// Подключение плагинов
