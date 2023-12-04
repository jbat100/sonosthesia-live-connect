const _ = require('lodash');
const easymidi = require('easymidi');

class ExplicitMIDISink {

    constructor(ports, server) {
        this._ports = ports
        this._server = server
        this._server.on('open', (handler) => {

            let notes = new Set();
            
            // used to store note descriptions without velocity as strings in a Set
            const noteDesription = (content) => {
                return JSON.stringify(_.pick(content, ['port', 'channel', 'note']));
            }

            handler.on('close', () => {
                for (let note of notes) {
                    const content = JSON.parse(note);
                    this._ports.selectPortName(content.port).noteOff(content.channel, content.note, 0);
                }
                notes = null;
            });

            handler.envelopes.on('/midi/note/on', content => {
                notes.add(noteDesription(content));
                this._ports.selectPortName(content.port).send('noteon', _.pick(content, ['channel', 'note', 'velocity']));
            });

            handler.envelopes.on('/midi/note/off', content => {
                notes.delete(noteDesription(content));
                this._ports.selectPortName(content.port).send('noteoff', _.pick(content, ['channel', 'note', 'velocity']));
            });

            handler.envelopes.on('/midi/note/aftertouch', content => {
                this._ports.selectPortName(content.port).send('poly aftertouch', {
                    channel : content.channel, 
                    note : content.note, 
                    pressure : content.value
                });
            });

            handler.envelopes.on('/midi/channel/control', content => {
                this._ports.selectPortName(content.port).send('cc', {
                    channel : content.channel, 
                    controller : content.number, 
                    value : content.value
                });
            });

            handler.envelopes.on('/midi/channel/aftertouch', content => {
                this._ports.selectPortName(content.port).send('channel aftertouch', {
                    channel : content.channel, 
                    pressure : content.value
                });
            });

            handler.envelopes.on('/midi/channel/bend', content => {
                this._ports.selectPortName(content.port).send('pitch', _.pick(content, ['channel', 'value']));
            });
        });
    }
}

module.exports = {
    ExplicitMIDISink
}