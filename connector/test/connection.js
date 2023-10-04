const WebSocket = require('ws')
const msgpack = require('@msgpack/msgpack')

const address = 'ws://127.0.0.1'

const ws = new WebSocket(address);

ws.on('error', console.error);

ws.on('open', function open() {
  ws.send(msgpack.encode({test:"hello"}));
});