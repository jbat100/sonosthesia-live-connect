const process = require('node:process');
const easymidi = require('easymidi');

const { WebSocketServer, WebSocketEnvelopeLogger } = require('./ws-connection');
const { LiveOSCServer, OSCToWSSPacker, BufferedOSCToWSSRelay } = require('./live-osc');
const { EasyMIDIOutputPorts, EasyMIDIUnpacker } = require('./easymidi-relay');
const { RawMIDISource, RawMIDISink } = require('./rawmidi-relay');


const OSC_PORT = 7006;
const WSS_PORT = 80;
const RELAY_INTERVAL = 10;

let context = {}

async function run() {

  const rawMidiInputNames = [
    "IAC Driver Bus 1"
  ];

  const rawMidiOutputNames = [
    "IAC Driver Bus 1"
  ];

  const ports = new EasyMIDIOutputPorts("IAC Driver Bus 1", "IAC Driver U2L 1", "IAC Driver U2L 2");

  try {
    ports.open()
  } catch (error) {
    console.warn('Did not open all required MIDI output ports, contiuing regardless...')
  }

  // Which process is using port 80:
  // sudo lsof -i -P | grep LISTEN | grep :80  # lists processes using  a port containing 80  
  // sudo lsof -i :80 # process using port 80 
  // sudo kill -9 PID # kill process with a given PID
  // sudo kill -9 $(sudo lsof -t -i :80) # one liner
  const wss = new WebSocketServer(WSS_PORT);

  context.wss = wss;

  const oscToWSSPacker = new OSCToWSSPacker();

  const oscToWSSRelay = new BufferedOSCToWSSRelay(wss, oscToWSSPacker, RELAY_INTERVAL);
  oscToWSSRelay.bypass('/midi/note');
  oscToWSSRelay.bypass('/midi/note/on');
  oscToWSSRelay.bypass('/midi/note/off');
  oscToWSSRelay.bypass('/midi/channel/control');
  oscToWSSRelay.bypass('/midi/channel/aftertouch');
  oscToWSSRelay.bypass('/midi/channel/bend');
  
  const los = new LiveOSCServer(OSC_PORT, oscToWSSRelay, true); 

  const midiUnpacker = new EasyMIDIUnpacker(ports, wss);
  const envelopeLogger = new WebSocketEnvelopeLogger(wss, true);

  for (let midiInputName of rawMidiInputNames) {
    const midiInput = new easymidi.Input(midiInputName); 
    const midiSource = new RawMIDISource(midiInput._input, wss, true);
  }

  for (let midiOutputName of rawMidiOutputNames) {
    const midiOutput = new easymidi.Output(midiOutputName); 
    const midiSink = new RawMIDISink(midiOutput._output, wss);
  }
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