const nodeprocess = require('node:process');
const easymidi = require('easymidi');
const parser = require('args-parser');

const { WebSocketServer, WebSocketEnvelopeLogger } = require('./wss/wss');
const { LiveOSCServer, OSCToWSSPacker, BufferedOSCToWSSSource, SimpleOSCToWSSSource } = require('./live/live-osc');
const { MIDIOutputs } = require('./midi/midi-outputs');
const { ExplicitMIDISink } = require('./midi/explicit-midi');
const { RawMIDISource, RawMIDISink } = require('./midi/raw-midi');
const { getConfig, checkConfig } = require('./config/config');

let context = {}

function run() {

  const args = parser(process.argv);
  const config = getConfig(args.config);

  checkConfig(config);

  if (config.midiOutputPorts) {
    context.midiOutputs = new MIDIOutputs(config.midiOutputPorts);
  }

  // Which process is using port 80 (the only port which seems to work without extra config on macos):
  // sudo lsof -i -P | grep LISTEN | grep :80  # lists processes using  a port containing 80  
  // sudo lsof -i :80 # process using port 80 
  // sudo kill -9 PID # kill process with a given PID
  // sudo kill -9 $(sudo lsof -t -i :80) # one liner
  context.wss = new WebSocketServer(config.wsServerPort);

  if (config.oscServerPort) {
    let oscToWSSRelay = null;
    if (config.relayBufferInterval) {
      oscToWSSRelay = new BufferedOSCToWSSSource(context.wss, new OSCToWSSPacker(), config.relayBufferInterval);
      // no matter what we don't want midi messages to be squashed
      oscToWSSRelay.bypass('/midi/note');
      oscToWSSRelay.bypass('/midi/note/on');
      oscToWSSRelay.bypass('/midi/note/off');
      oscToWSSRelay.bypass('/midi/channel/control');
      oscToWSSRelay.bypass('/midi/channel/aftertouch');
      oscToWSSRelay.bypass('/midi/channel/bend');
    } else {
      oscToWSSRelay = new SimpleOSCToWSSSource(context.wss, new OSCToWSSPacker());
    }
    const los = new LiveOSCServer(config.oscServerPort, oscToWSSRelay, true); 
  }

  if (config.midiInputPorts) {
    for (let midiInputName of config.midiInputPorts) {
      const midiInput = new easymidi.Input(midiInputName); 
      const midiSource = new RawMIDISource(midiInput, context.wss, true);
    }
  }

  if (context.midiOutputs) {
    const midiSink = new RawMIDISink(context.midiOutputs, context.wss);
  }

  const midiSink = new ExplicitMIDISink(context.midiOutputs, context.wss);

  if (config.envelopeLogLevel == 1) {
    const envelopeLogger = new WebSocketEnvelopeLogger(context.wss, false);
  } else if (config.envelopeLogLevel == 2) {
    const envelopeLogger = new WebSocketEnvelopeLogger(context.wss, true);
  }
}

run();

nodeprocess.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
  context.wss.close();
});

nodeprocess.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});