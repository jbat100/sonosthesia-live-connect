const msgpack = require('@msgpack/msgpack');
const easymidi = require('easymidi');
const prettyjson = require('prettyjson');
const { MIDIOutputs } = require('./midi-outputs');
const { assertType, assertArrayType } = require('../config/config');

/** 
 * Listens to MIDI messages on a given input, packs bytes and broadcasts them to server clients
 */ 
class RawMIDISource {

    /**
     * Create a RawMIDISource instance.
     * @param {midiInput} midiInput - An easymidi Input to monitor
     * @param {server} midiInput - a WebSocketServer to broadcast packed data, TODO : abstract interface to allow other transports
     * @param {log} log - if true, logs forwarded traffic
     */
    constructor(midiInput, server, logLevel) {

        this._logLevel = logLevel;
        this._server = server;
        this._cumulativeTime = 0;
        this._midiInput = midiInput;
        // access underlying https://www.npmjs.com/package/@julusian/midi
        this._midiInput._input.on('message', (deltaTime, message) => {
            this._process(deltaTime, message);
        });
    }

    _process(deltaTime, message) {

        this._cumulativeTime += deltaTime;

        if (this._logLevel) {
            const messageHex = message.map(byte => byte.toString(16)).join(' ');
            console.log(`RawMIDISource l: ${message.length} m: ${messageHex} d: ${deltaTime}`);
        }

        let address = '/midi/source';
        let content = {
            port : this._midiInput.name,
            deltaTime : deltaTime,
            cumulativeTime : this._cumulativeTime
        };

        if (message.length == 1) {
            content.b0 = message[0];
            address += '/single';
        }
        if (message.length == 2) {
            content.b0 = message[0];
            content.b1 = message[1];
            address += '/double';
        }
        if (message.length == 3) {
            content.b0 = message[0];
            content.b1 = message[1];
            content.b2 = message[2];
            address += '/tripple';
        }

        this._server.broadcast(msgpack.encode({
            address : address,
            content : msgpack.encode(content)
        }));
    }

}

/**
 * Listens to MIDI messages from wss server clients, unpacks bytes and broadcasts MIDI to specified port
 */ 
class RawMIDISink {

    /**
     * Create a RawMIDISink instance.
     * @param {midiOutputs} midiOutputs - MIDIOutputs used to forward network data to midi
     * @param {server} - a WebSocketServer to listen to packed data, TODO : abstract interface to allow other transports
     * @param {log} - if true, logs forwarded traffic
     */
    constructor(midiOutputs, server, logLevel) {
        this._midiOutputs = midiOutputs;
        this._server = server;
        this._logLevel = logLevel;
        this._server.on('open', (handler) => {

            const isNoteOn = (byte) => {
                return byte >> 4 == 0x09;
            }
            const isNoteOff = (byte) => {
                return byte >> 4 == 0x08;
            }
            const noteDesription = (content) => {
                return JSON.stringify({ port : content.port, channel : content.b0 & 0xF, note : content.b1 });
            };

            let notes = new Set();

            handler.on('close', () => {
                for (let description of notes) {
                    const note = JSON.parse(description);
                    const port = this._midiOutputs.selectPortName(note.port);
                    if (port) {
                        port.send('noteoff', {
                            note: note.note,
                            velocity: 0,
                            channel: note.channel
                        });
                        console.log(`End ongoing note from disconnected client :\n${prettyjson.render(note)}`);
                    } else {
                        console.warning(`Could not end note ${prettyjson.render(note)}`);
                    }
                }
                notes = null;
            });

            // access underlying https://www.npmjs.com/package/@julusian/midi _output

            handler.envelopes.on('/midi/sink/single', content => {
                this._midiOutputs.selectPortName(content.port)._output.sendMessage([content.b0]);
            });
            handler.envelopes.on('/midi/sink/double', content => {
                this._midiOutputs.selectPortName(content.port)._output.sendMessage([content.b0, content.b1]);
            });
            handler.envelopes.on('/midi/sink/tripple', content => {
                const port = this._midiOutputs.selectPortName(content.port)
                port._output.sendMessage([content.b0, content.b1, content.b2]);
                if (isNoteOn(content.b0)) {
                    const description = noteDesription(content);
                    notes.add(description);
                    //console.log(`Register note ${description}`);
                } else if (isNoteOff(content.b0)) {
                    const description = noteDesription(content);
                    notes.delete(description);
                    //console.log(`Unregister note ${description}`);
                } 
            });
        });
    }
}

function midiSinkFromConfig(config, wss) {

    assertArrayType('ports', config, 'string', true);
    assertType('logLevel', config, 'number');

    const outputs = new MIDIOutputs(config.ports);
    const midiSink = new RawMIDISink(outputs, wss);

    return midiSink;
}

function midiSourcesFromConfig(config, wss) {

    assertArrayType('ports', config, 'string', true);
    assertType('logLevel', config, 'number');

    const sources = [];

    for (let midiInputName of config.ports) {
        const midiInput = new easymidi.Input(midiInputName); 
        const source = new RawMIDISource(midiInput, wss, config.logLevel);
        sources.push(source);
    }

    return sources;
}

module.exports = {
    midiSinkFromConfig,
    midiSourcesFromConfig,
    RawMIDISource,
    RawMIDISink
}