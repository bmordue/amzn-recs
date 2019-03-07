var fs = require('fs');
var HtmlParser = require('node-html-parser');

var cheerio = require('cheerio');

function main() {
	var files = fs.readdirSync('.'); //['B002RI9O4G_dump.html'];
	console.log(files);
	files.filter(f => f.includes('html')).forEach(function(filename) {
		var data = fs.readFileSync(filename);
		try {
	//		HtmlParser.parse(data);
			var dom = cheerio.load(data);
			console.log(dom('#ebooksProductTitle').text());
			console.log('success for ' + filename);
		} catch (e) {
			console.log(e)
		}
	});
}


main();
