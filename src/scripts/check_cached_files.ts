import fs = require('fs');

const cheerio = require('cheerio');

function main() {
  const files = fs.readdirSync('.');
  console.log(files);
  files.filter((f) => f.includes('html')).forEach((filename) => {
    const data = fs.readFileSync(filename);
    try {
      const dom = cheerio.load(data);
      console.log(dom('#ebooksProductTitle').text());
      console.log(`success for ${filename}`);
    } catch (e) {
      console.log(e);
    }
  });
}

main();
