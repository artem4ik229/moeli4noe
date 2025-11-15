const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Создаем папку public если ее нет
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Раздаем статические файлы
app.use(express.static(publicDir));

// HTML для веб-интерфейса
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Minecraft Bot Web GUI</title>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 20px;
        }
        
        .header {
            grid-column: 1 / -1;
            text-align: center;
            margin-bottom: 20px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        
        .controls {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        
        .status {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        
        .log-container {
            grid-column: 1 / -1;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            overflow: hidden;
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        
        h2 {
            margin-bottom: 15px;
            color: #4fc3f7;
        }
        
        h3 {
            margin: 15px 0 10px 0;
            color: #4fc3f7;
        }
        
        .control-group {
            margin-bottom: 20px;
        }
        
        .quick-commands {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        
        button {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            border: none;
            padding: 12px 15px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button.danger {
            background: linear-gradient(45deg, #f44336, #d32f2f);
        }
        
        .command-input {
            width: 100%;
            padding: 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .command-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .log {
            height: 400px;
            overflow-y: auto;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            background: rgba(0, 0, 0, 0.5);
        }
        
        .log-entry {
            margin-bottom: 5px;
            padding: 5px;
            border-radius: 4px;
            animation: fadeIn 0.3s ease;
        }
        
        .log-entry:nth-child(even) {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .status-info {
            display: grid;
            gap: 10px;
        }
        
        .status-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
        }
        
        .status-value {
            font-weight: bold;
            color: #4fc3f7;
        }
        
        .farming-active {
            color: #4CAF50;
            animation: pulse 1s infinite;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .connection-status {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .connected {
            background: #4CAF50;
            box-shadow: 0 0 10px #4CAF50;
        }
        
        .disconnected {
            background: #f44336;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎮 Minecraft Bot Controller</h1>
            <p>Управление ботом через веб-интерфейс</p>
        </div>
        
        <div class="controls">
            <h2>⚡ Быстрые команды</h2>
            
            <div class="control-group">
                <h3>🔧 Основные</h3>
                <div class="quick-commands">
                    <button onclick="sendCommand('лайт')">
                        <span>🚀</span> Lite режим
                    </button>
                    <button onclick="sendCommand('компас')">
                        <span>🎯</span> Компас
                    </button>
                    <button onclick="sendCommand('иди')">
                        <span>🚶</span> Идти
                    </button>
                    <button onclick="sendCommand('прыг')">
                        <span>🦘</span> Прыгнуть
                    </button>
                </div>
            </div>
            
            <div class="control-group">
                <h3>⛏️ Фарминг</h3>
                <div class="quick-commands">
                    <button onclick="sendCommand('фарм обсы')" id="farmingBtn">
                        <span>⛏️</span> Фарм обсидиана
                    </button>
                </div>
            </div>
            
            <div class="control-group">
                <h3>ℹ️ Информация</h3>
                <div class="quick-commands">
                    <button onclick="sendCommand('поз')">
                        <span>📍</span> Позиция
                    </button>
                    <button onclick="sendCommand('здоровье')">
                        <span>❤️</span> Здоровье
                    </button>
                </div>
            </div>
            
            <div class="control-group">
                <h3>🛑 Управление</h3>
                <div class="quick-commands">
                    <button onclick="sendCommand('выход')" class="danger">
                        <span>⏹️</span> Выход
                    </button>
                </div>
            </div>
            
            <div class="control-group">
                <h3>💬 Произвольная команда</h3>
                <input type="text" class="command-input" id="commandInput" 
                       placeholder="Введите команду или сообщение для чата...">
                <button onclick="sendCustomCommand()" style="width: 100%">
                    <span>📤</span> Отправить
                </button>
            </div>
        </div>
        
        <div class="status">
            <h2>📊 Статус бота</h2>
            <div class="status-info">
                <div class="status-item">
                    <span>Подключение:</span>
                    <span class="status-value" id="connectionStatus">
                        <span class="connection-status disconnected"></span>
                        Отключен
                    </span>
                </div>
                <div class="status-item">
                    <span>Здоровье:</span>
                    <span class="status-value" id="healthStatus">-</span>
                </div>
                <div class="status-item">
                    <span>Голод:</span>
                    <span class="status-value" id="foodStatus">-</span>
                </div>
                <div class="status-item">
                    <span>Позиция:</span>
                    <span class="status-value" id="positionStatus">-</span>
                </div>
                <div class="status-item">
                    <span>Фарминг:</span>
                    <span class="status-value" id="farmingStatus">Не активен</span>
                </div>
            </div>
        </div>
        
        <div class="log-container">
            <h2>📝 Лог действий</h2>
            <div class="log" id="log"></div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:3000/ws');
        const logElement = document.getElementById('log');
        
        // Элементы статуса
        const connectionStatus = document.getElementById('connectionStatus');
        const healthStatus = document.getElementById('healthStatus');
        const foodStatus = document.getElementById('foodStatus');
        const positionStatus = document.getElementById('positionStatus');
        const farmingStatus = document.getElementById('farmingStatus');
        const farmingBtn = document.getElementById('farmingBtn');

        function addLog(message, type) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            logElement.appendChild(entry);
            logElement.scrollTop = logElement.scrollHeight;
        }

        function sendCommand(command) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'command', data: command }));
                addLog('Отправлено: ' + command);
                document.getElementById('commandInput').value = '';
            } else {
                addLog('❌ WebSocket не подключен', 'error');
            }
        }

        function sendCustomCommand() {
            const input = document.getElementById('commandInput');
            const command = input.value.trim();
            if (command) {
                sendCommand(command);
            }
        }

        // Обработка Enter в поле ввода
        document.getElementById('commandInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendCustomCommand();
            }
        });

        // Обработка сообщений от сервера
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'log':
                        addLog(data.message);
                        break;
                    case 'status':
                        updateStatus(data.data);
                        break;
                    case 'connection':
                        updateConnectionStatus(data.connected);
                        break;
                }
            } catch (error) {
                addLog(event.data);
            }
        };

        function updateStatus(status) {
            if (status.health !== undefined) {
                healthStatus.textContent = status.health + ' ❤️';
            }
            if (status.food !== undefined) {
                foodStatus.textContent = status.food + ' 🍖';
            }
            if (status.position) {
                positionStatus.textContent = 'X:' + status.position.x + ' Y:' + status.position.y + ' Z:' + status.position.z;
            }
            if (status.farming !== undefined) {
                farmingStatus.textContent = status.farming ? 
                    'Активен' : 'Не активен';
                farmingStatus.className = status.farming ? 
                    'status-value farming-active' : 'status-value';
                farmingBtn.innerHTML = status.farming ? 
                    '<span>⛏️</span> Стоп фарм' : '<span>⛏️</span> Фарм обсидиана';
            }
        }

        function updateConnectionStatus(connected) {
            const statusElement = connectionStatus.querySelector('.connection-status');
            const textElement = connectionStatus.querySelector('span:last-child');
            
            if (connected) {
                statusElement.className = 'connection-status connected';
                textElement.textContent = 'Подключен';
            } else {
                statusElement.className = 'connection-status disconnected';
                textElement.textContent = 'Отключен';
            }
        }

        ws.onopen = function() {
            addLog('✅ Подключен к серверу управления ботом');
            updateConnectionStatus(true);
        };

        ws.onclose = function() {
            addLog('❌ Соединение с сервером закрыто');
            updateConnectionStatus(false);
        };

        ws.onerror = function(error) {
            addLog('❌ Ошибка WebSocket соединения');
        };

        // Автофокус на поле ввода
        document.getElementById('commandInput').focus();
        
        // Периодический запрос статуса
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'getStatus' }));
            }
        }, 2000);
    </script>
</body>
</html>`;

// Записываем HTML в файл
fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);

const server = app.listen(port, () => {
    console.log('🌐 Web GUI running at http://localhost:' + port);
});

const wss = new WebSocket.Server({ server });

// Простой класс для управления ботом без запуска старого bot.js
class SimpleBotManager {
    constructor() {
        this.isConnected = false;
        this.logListeners = [];
        this.statusListeners = [];
    }

    log(message) {
        console.log(message);
        this.logListeners.forEach(listener => listener(message));
    }

    onLog(listener) {
        this.logListeners.push(listener);
    }

    onStatusUpdate(listener) {
        this.statusListeners.push(listener);
    }

    sendCommand(command) {
        this.log('❌ Бот не запущен. Запустите бот вручную через: node bot.js');
        return false;
    }

    updateStatus() {
        const status = {
            health: 0,
            food: 0,
            position: { x: 0, y: 0, z: 0 },
            farming: false
        };
        this.statusListeners.forEach(listener => listener(status));
    }
}

// Используем простой менеджер вместо бота
const bot = new SimpleBotManager();

// Настраиваем обработчики событий бота
bot.onLog((message) => {
    // Отправляем логи всем подключенным клиентам
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'log', message: message }));
        }
    });
});

bot.onStatusUpdate((status) => {
    // Отправляем статус всем подключенным клиентам
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'status', data: status }));
        }
    });
});

// Обработка WebSocket соединений
wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ 
        type: 'log', 
        message: '✅ Подключен к Web GUI. Для запуска бота используйте: node bot.js' 
    }));
    
    // Отправляем начальный статус
    ws.send(JSON.stringify({ 
        type: 'connection', 
        connected: false 
    }));

    // Обработка команд от клиента
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'command') {
                bot.sendCommand(data.data);
            } else if (data.type === 'getStatus') {
                bot.updateStatus();
            }
        } catch (error) {
            // Если сообщение не JSON, обрабатываем как простую команду
            bot.sendCommand(message.toString());
        }
    });
});

// Обработка завершения процесса
process.on('SIGINT', () => {
    console.log('Завершение работы...');
    process.exit(0);
});