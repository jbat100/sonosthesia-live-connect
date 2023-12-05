const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const EventEmitter = require('eventemitter3');
const { assertType } = require('../config/config');

class WebSocketServer {

    constructor(port) {
        this.server = new WebSocket.Server({ port : port });
        console.log(`WebSocketServer launched on port ${port}`)

        // used to store WebSocketHandler instances created on each connection
        this._handlers = new Set();
        this._emitter = new EventEmitter();
        this._setupServer();

    }

    on(eventName, listener) {
        this._emitter.on(eventName, listener);
    }

    _setupServer() {
        this.server.on('connection', (socket) => {
            const handler = new WebSocketHandler(socket, this);
            this._handlers.add(handler);
            this._emitter.emit('open', handler); 
            socket.on('close', () => {
                this._handlers.delete(handler);
            });
        });
        this.server.on('error', (error) => {
            console.error(`WebSocketServer error ${error}`)
        });
        this.server.on('close', () => {
            console.log(`WebSocketServer close`)
            this._emitter.emit('close')
        });
        this.server.on('listening', () => {
            console.log(`WebSocketServer listening`)
        });
    }

    broadcast(data) {
        if (this._handlers.size > 0) {
            console.log(`WebSocketServer broadcasting data to ${this._handlers.size} clients`);
        }
        for (let client of this._handlers) {
            client.send(data);
        }
    }

    close() {
        this.server.close();
    }

}

class WebSocketHandler {

    constructor(socket, server) {
        this.socket = socket;
        this.server = server;
        this.envelopes = new AddressedEventEmitter();
        this._emitter = new EventEmitter();
        this.state = {
            counter : 0
        } // used by external observers to attach state to the handler 
        this.isConnected = socket.readyState === WebSocket.OPEN;

        this._setupEventListeners();
        this._startCounter();
    }

    on(eventName, listener) {
        this._emitter.on(eventName, listener);
    }

    _setupEventListeners() {
        this.socket.on('message', (data) => {
            this._emitter.emit('message', data);
            this._processEnvelope(data);
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket Error:', error);
            // this doesn't necessarily close the socket, do cleanup on close if it actually happened
        });

        this.socket.on('close', (code, reason) => {
            this.isConnected = false;
            console.log(`Connection closed. Code: ${code}, Reason: ${reason}`);
            this._stopCounter();
            this._emitter.emit('close', code, reason);
        });
    }

    send(data) {
        if (this.isConnected) {
            this.socket.send(data);
        } else {
            console.error('Socket is not connected');
        }
    }

    _startCounter() {
        this.intervalId = setInterval(() => {
            this.state.counter++;
            //this.send(`Counter value: ${this.state.counter}`);
        }, 1000);  // every second
    }

    _stopCounter() {
        clearInterval(this.intervalId);
    }

    _processEnvelope(data) {

        try {
            const wrapped = msgpack.decode(data);

            if (!wrapped) {
                console.warn("Client message data could not be unpacked");
                return;
            }

            if (!wrapped.address) {
                console.warn("Client message address is not specified");
                return;
            }

            if (!wrapped.content) {
                console.warn("Client message content is not specified");
                return;
            }

            const content = msgpack.decode(wrapped.content)

            this._emitter.emit('envelope', wrapped.address, content);
            this.envelopes._emit(wrapped.address, content);

        } catch (error) {
            console.error(error);
        }

    }
}

class AddressedEventEmitter {

    constructor() {
        this._emitter = new EventEmitter();
    }

    _emit(address, content) {
        this._emitter.emit(address, content);
    }

    on(eventName, listener) {
        this._emitter.on(eventName, listener);
    }

}

class WebSocketEnvelopeLogger {
    constructor(wss, content) {
        wss.on('open', handler => {
            handler.on('envelope', (address, content) => {
                if (!content) {
                    console.log(`Received envelope to address : ${address}`);
                } else {
                    console.log(`Received envelope to address : ${address} : ${JSON.stringify(content)}`);
                }
                
            });
        });
    }
}

function serverFromConfig(config) {

    assertType('port', config, 'number', true);
    assertType('logLevel', config, 'number');

    const server = new WebSocketServer(config.port);

    if (config.logLevel === 1) {
        const logger = new WebSocketEnvelopeLogger(server, false);
    } else if (config.logLevel === 2) {
        const logger = new WebSocketEnvelopeLogger(server, true);
    }
    
    return server;
}

module.exports = {
    serverFromConfig,
    WebSocketHandler,
    WebSocketServer,
    WebSocketEnvelopeLogger
};
