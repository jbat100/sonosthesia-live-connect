const msgpack = require('@msgpack/msgpack');

// listens to MIDI messages on a given input, packs bytes and broadcasts them to clients
class RawMIDISource {

    constructor(midiInput, server, log) {
        this._log = log;
        this._server = server;
        this._cumulativeTime = 0;
        midiInput.on('message', (deltaTime, message) => {
            // The message is an array of numbers corresponding to the MIDI bytes:
            //   [status, data1, data2]
            // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
            // information interpreting the messages.
            this._process(deltaTime, message);
        });
    }

    _process(deltaTime, message) {

        this._cumulativeTime += deltaTime;

        if (this._log) {
            const messageHex = message.map(byte => byte.toString(16)).join(' ');
            console.log(`RawMIDISource l: ${message.length} m: ${messageHex} d: ${deltaTime}`);
        }

        let address = '/midi/source';
        let content = {
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

class RawMIDISink {

    constructor(midiOutput, server) {
        this._midiOutput = midiOutput;
        this._server = server;
        this._setupServer();
    }

    _setupServer() {
        this._server.on('open', (handler) => {
            handler.on('close', () => {
                // all notes off message to ensure we don't have hanging notes on disconnect
                // TODO : store note ons and off only ongoing 
                this._midiOutput.sendMessage([123, 0]);
            });
            handler.envelopes.on('/midi/sink/single', content => {
                this._midiOutput.sendMessage([content.b0]);
            });
            handler.envelopes.on('/midi/sink/double', content => {
                this._midiOutput.sendMessage([content.b0, content.b1]);
            });
            handler.envelopes.on('/midi/sink/tripple', content => {
                this._midiOutput.sendMessage([content.b0, content.b1, content.b2]);
            });
        });
    }

}

module.exports = {
    RawMIDISource,
    RawMIDISink
}