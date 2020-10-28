var fs = require('fs');

var cheerio = require('cheerio');

function main() {
	var files = fs.readdirSync('.');
	console.log(files);
	files.filter(f => f.includes('html')).forEach(function(filename) {
		var data = fs.readFileSync(filename);
		try {
			var dom = cheerio.load(data);
			console.log(dom('#ebooksProductTitle').text());
			console.log('success for ' + filename);
		} catch (e) {
			console.log(e)
		}
	});
}


main();
