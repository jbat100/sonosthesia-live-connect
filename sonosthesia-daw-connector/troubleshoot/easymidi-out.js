var easymidi = require('easymidi');

const OUTPUT_NAME = 'IAC Driver Bus 1';

function run() {
  const output = new easymidi.Output(OUTPUT_NAME);
  setTimeout(() => {
      output.send('noteon', {
          note: 64,
          velocity: 127,
          channel: 2
        });
  }, 1000);
  setTimeout(() => {
      output.send('noteoff', {
          note: 64,
          velocity: 127,
          channel: 2
        });
  }, 2000);
}

run()
