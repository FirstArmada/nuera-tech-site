const fs = require('fs');

function test() {
  const code = fs.readFileSync('assets/js/app.js', 'utf8');
  if (code.includes('|| b.year - a.year') && code.includes('d.year = deviceYear(d.model)')) {
    console.log('Success: Pre-computed logic is present.');
  } else {
    console.log('Failure: Modifications missing.');
  }
}
test();
