/*
	To run the try-task do:
	cat operations.sql | node main.js
*/

var fs = require('fs')
var lex = require('./lexer')
var parse = require('./parser')
var { show_error } = require('./base')

function stdinReadSync() {
	var buf = Buffer.alloc(1024)
	var data = ''

	while (true) {
		var n = fs.readSync(process.stdin.fd, buf, 0, buf.length)
		if (!n) break
		data += buf.toString('utf8', 0, n)
	}
	return data
}

var src = stdinReadSync()
//var src = process.argv.slice(2).join(' ')) // to read from arguments

var t = lex('~/operations.sql', src)
/*
	First argument is a file name to be stored in context object (which is stored in every token).
*/

if (t == undefined) {
	console.log('Lexer returned empty result')
	return
}

//console.log('tokens:', t) // Uncomment to see the token list

try {
	var time = Date.now()
	var ast = parse(t)
	time = Date.now() - time
	var out = JSON.stringify(ast,0,'  ')
	if (out.length < 10000) {
		/*
			Only show output if smaller than X
		*/
		console.log('ast:', out)
		console.log('parse execution time:', time, 'ms')
	}
	else {
		/*
			Otherwise save the output, and show parse execution speed.
		*/
		fs.writeFileSync('out.ast', out)
		console.log(`Saved ${ (out.length/1e6).toFixed(2) }M characters to out.ast`)
		console.log('parse execution time:', time, 'ms, ', ((src.length / 1e6) / (time / 1000)).toFixed(1), 'mb/s' )
	}
}
catch (em) {
	if (em.token) {
		// Handle parser errors specifically
		show_error(em.token, em.message)
	}
	else {
		// Handle other errors
		console.log(em)
	}
}
