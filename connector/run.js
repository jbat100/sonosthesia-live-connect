const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')
const msgpack = require('@msgpack/msgpack')
const process = require('node:process');

const { WebSocketServer, WebSocketEnvelopeLogger } = require('./connection');
const { LiveOSCServer } = require('./live-osc')
const { MIDIOutputPorts, MIDIUnpacker } = require('./midi')

const MIDIPORT = "IAC Driver Bus 1"
const OSCPORT = 7006
const WSPORT = 80

let context = {}

async function run() {

  const ports = new MIDIOutputPorts(MIDIPORT);

  try {
    ports.open()
  } catch (error) {
    console.warning('Did not open all required MIDI output ports, contiuing regardless...')
  }

  const los = new LiveOSCServer(OSCPORT);
  const wss = new WebSocketServer(WSPORT);

  context.wss = wss;

  const midiUnpacker = new MIDIUnpacker(ports, wss);
  const envelopeLogger = new WebSocketEnvelopeLogger(wss, true);

}

run().catch(error => console.error(error));

process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
  context.wss.close();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});