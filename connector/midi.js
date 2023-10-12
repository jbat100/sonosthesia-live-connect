const _ = require('lodash');
const JZZ = require('jzz');
const { AggregateException } = require('./utils')

class MIDIOutputPorts {

    constructor(...names) {
        if (!names.every(name => typeof name === 'string')) {
            throw new TypeError('All arguments must be strings.');
        }
        this.names = names;
        this.ports = {}
    }

    open() {
        // Ensure JZZ is ready
        const jzz = JZZ();

        const errors = [];

        // Iterate over the specified output names
        for (let name of this.names) {
            try {
                const output = JZZ().openMidiOut(name);

                // Check if the output port was successfully opened
                if (output) {
                    this.ports[name] = output;
                    console.log(`Opened MIDI output port: ${name}`);
                } else {
                    console.warn(`Failed to open MIDI output port: ${name}`);
                }
            } catch (error) {
                console.error(`Failed to open MIDI outout port: ${name}, error: ${error}, reason: ${error.message}`);
                errors.push(error);
            }
            
        }

        if (errors.length > 0) {
            throw new AggregateException(errors);
        }
    }

    selectAnyPort() {
        const keys = Object.keys(this.ports);
        return keys.length > 0 ? this.ports[keys[0]] : null;
    }
    
    selectPort(content = {}) {
        const portName = content.port;
        if (portName && this.ports[portName]) {
            return this.ports[portName];
        }
        return this.selectAnyPort();
    }

}

class MIDIUnpacker {

    constructor(ports, server) {
        this._ports = ports
        this._server = server

        this._setupServer()
    }

    _setupServer() {

        this._server.on('open', (handler) => {

            handler.state.midi = {
                notes : new Set()
            }
            
            // used to store note descriptions without velocity as strings in a Set
            const noteDesription = (content) => {
                return JSON.stringify(_.pick(content, ['port', 'channel', 'note']));
            }

            handler.on('close', () => {
                for (let note of handler.state.midi.notes) {
                    const content = JSON.parse(note);
                    this._ports.selectPort(content).noteOff(content.channel, content.note, 0);
                }
            });

            handler.envelopes.on('/midi/note/on', content => {
                handler.state.midi.notes.add(noteDesription(content));
                this._ports.selectPort(content).noteOn(content.channel, content.note, content.velocity);
            });

            handler.envelopes.on('/midi/note/off', content => {
                handler.state.midi.notes.delete(noteDesription(content));
                this._ports.selectPort(content).noteOff(content.channel, content.note, content.velocity);
            });

            handler.envelopes.on('/midi/note/aftertouch', content => {
                this._ports.selectPort(content).aftertouch(content.channel, content.note, content.value);
            });

            handler.envelopes.on('/midi/channel/control', content => {
                this._ports.selectPort(content).control(content.channel, content.number, content.value);
            });

            handler.envelopes.on('/midi/channel/aftertouch', content => {
                this._ports.selectPort(content).pressure(content.channel, content.value);
            });

            handler.envelopes.on('/midi/channel/bend', content => {
                this._ports.selectPort(content).pitchBendF(content.channel, content.value / 8192.0);
            });
        });
    }
}

module.exports = {
    MIDIOutputPorts,
    MIDIUnpacker
}