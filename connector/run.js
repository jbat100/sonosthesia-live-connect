const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')
const msgpack = require('@msgpack/msgpack')
const process = require('node:process');

const { WebSocketServer } = require('./connection');
const { LiveOSCServer } = require('./live-osc')
const { MIDIOutputPorts, MIDIUnpacker } = require('./midi')



const MIDIPORT = "IAC Driver Bus 1"
const OSCPORT = 7006
const WSPORT = 8080


async function run() {

  const ports = new MIDIOutputPorts(MIDIPORT);

  try {
    await ports.open()
  } catch (error) {
    console.warning('did not open all required MIDI output ports, contiuing regardless...')
  }

  const los = new LiveOSCServer(OSCPORT);
  const wss = new WebSocketServer(WSPORT);

  const midiUnpacker = new MIDIUnpacker(ports, wss);

}


run().catch(error => console.error(error));


process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
  wss.close();
});