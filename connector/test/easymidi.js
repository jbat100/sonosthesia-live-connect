var easymidi = require('easymidi');

var output = new easymidi.Output('IAC Driver Bus 1');

setTimeout(() => {
    output.send('noteon', {
        note: 64,
        velocity: 127,
        channel: 2
      });
}, 1000)



setTimeout(() => {
    output.send('noteoff', {
        note: 64,
        velocity: 127,
        channel: 2
      });
}, 2000)