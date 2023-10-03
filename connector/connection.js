const WebSocket = require('ws')
const msgpack = require('@msgpack/msgpack')

class WebSocketServer {

    constructor(port) {
        this.server = new WebSocket.Server({ port });
        this.clients = [];
        this.callbacks = {}; 
        this.server.on('connection', (socket) => {
            const client = new WebSocketHandler(socket, this);
            this.clients.push(client);
            client.send('Hello client!');
        });
    }

    removeClient(client) {
        const index = this.clients.indexOf(client);
        if (index !== -1) {
            this.clients.splice(index, 1);
        }
    }

    broadcast(data) {
        for (let client of this.clients) {
            client.send(data);
        }
    }

    close() {
        this.server.close();
    }

    // Method to register a callback for an OSC-like address
    registerCallback(address, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        if (!this.callbacks[address]) {
            this.callbacks[address] = [];
        }
        this.callbacks[address].push(callback);
    }

    unregisterCallback(address, callback) {
        if (!this.callbacks[address]) {
            throw new Error(`No callbacks registered for address: ${address}`);
        }
        const index = this.callbacks[address].indexOf(callback);
        if (index === -1) {
            throw new Error('Callback not found for the given address');
        }
        this.callbacks[address].splice(index, 1);
        // If there are no more callbacks for this address, remove the address key
        if (this.callbacks[address].length === 0) {
            delete this.callbacks[address];
        }
    }

    onClientMessage(socket, data) {

        // we expect msgpack data 
        try {
            const wrapped = msgpack.decode(data);

            if (!wrapped) {
                console.warning("Client message data could not be unpacked");
                return;
            }

            if (!wrapped.address) {
                console.warning("Client message address is not specified");
                return;
            }

            if (!this.callbacks[wrapped.address]) {
                console.warning("Client message address is not handled");
                return;
            }

            if (!wrapped.content) {
                console.warning("Client message content is not specified");
                return;
            }

            const content = msgpack.decode(wrapped.content)

            for (const callback of this.callbacks[address]) {
                callback(socket, content);
            }

        } catch (error) {
            console.error(error);
        }

    }
}

class WebSocketHandler {

    constructor(socket, server) {
        this.socket = socket;
        this.server = server;
        this.isConnected = socket.readyState === WebSocket.OPEN;
        this.counter = 0;

        this.setupEventListeners();
        this.startCounter();
    }

    setupEventListeners() {
        this.socket.on('message', (data) => {
            console.log('Received:', data);
            this.server.onClientMessage(this.socket, data);
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket Error:', error);
        });

        this.socket.on('close', (code, reason) => {
            this.isConnected = false;
            console.log(`Connection closed. Code: ${code}, Reason: ${reason}`);
            this.stopCounter();
            this.server.removeClient(this);  // Notify the server to remove the disconnected client
        });
    }

    send(data) {
        if (this.isConnected) {
            this.socket.send(data);
        } else {
            console.error('Socket is not connected');
        }
    }

    startCounter() {
        this.intervalId = setInterval(() => {
            this.counter++;
            this.send(`Counter value: ${this.counter}`);
        }, 1000);  // every second
    }

    stopCounter() {
        clearInterval(this.intervalId);
    }
}


module.exports = {
    WebSocketHandler,
    WebSocketServer
};
