const _ = require('lodash');
const easymidi = require('easymidi');


class EasyMIDIOutputPorts {

    constructor(...names) {
        if (!names.every(name => typeof name === 'string')) {
            throw new TypeError('All arguments must be strings.');
        }
        this.names = names;
        this.ports = {}
    }

    open() {
        const errors = [];

        // Iterate over the specified output names
        for (let name of this.names) {
            try {
                const output = new easymidi.Output(name);

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


class EasyMIDIUnpacker {

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
                this._ports.selectPort(content).send('noteon', _.pick(content, ['channel', 'note', 'velocity']));
            });

            handler.envelopes.on('/midi/note/off', content => {
                handler.state.midi.notes.delete(noteDesription(content));
                this._ports.selectPort(content).send('noteoff', _.pick(content, ['channel', 'note', 'velocity']));
            });

            handler.envelopes.on('/midi/note/aftertouch', content => {
                this._ports.selectPort(content).send('poly aftertouch', {
                    channel : content.channel, 
                    note : content.note, 
                    pressure : content.value
                });
            });

            handler.envelopes.on('/midi/channel/control', content => {
                this._ports.selectPort(content).send('cc', {
                    channel : content.channel, 
                    controller : content.number, 
                    value : content.value
                });
            });

            handler.envelopes.on('/midi/channel/aftertouch', content => {
                this._ports.selectPort(content).send('channel aftertouch', {
                    channel : content.channel, 
                    pressure : content.value
                });
            });

            handler.envelopes.on('/midi/channel/bend', content => {
                this._ports.selectPort(content).send('pitch', _.pick(content, ['channel', 'value']));
            });
        });
    }
}

module.exports = {
    EasyMIDIOutputPorts,
    EasyMIDIUnpacker
}