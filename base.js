/*
	Parsers/Lexers constantly need to return two variables:
		a parsed/lexed item and an updated position in a stream.

	Since JavaScript does not have an efficient way of returning two variables at once, I choose to return one of them as a global variable named 'ret'.
	This design is battle tested, and is much more performant than returning an array/object.
*/

ret = null

module.exports = {
	error,
	show_error,
	new_node,
	parse_list_commas,
}


function new_node(first_token, last_token, node) {
	/*
		Returns new AST node.
		Each node has first_token, last_token pointers as hidden properties.
		They are useful for error handling, for unparsing etc.
		This allows us to trace back the AST node to the source tokens/characters/files.
	*/
	node.first_token = first_token
	node.last_token = last_token
	Object.defineProperty(node, 'first_token', { enumerable: false })
	Object.defineProperty(node, 'last_token', { enumerable: false })
	return node
}

function error(tokens, pos, message) {
	/*
		The object we throw during parsing.
	*/
	var token = tokens[pos] ? tokens[pos] : tokens[tokens.length - 1]
	return {
		token,
		message,
	}
}

function show_error(token, message) {
	/*
		Nice error printer.
		Use context data in the tokens to show the error message with theline number,
		file name and the actual problem line.
	*/
	function find_line_and_column_by_position(str, pos) {
		var line = 0, line_pos = 0
		for(var i = 0; i < pos; i++) {
			if (str[i] == '\n') {
				line++
				line_pos = i + 1
			}
		}
		var column = pos - line_pos
		return { line_no: line, column }
	}

	function indent(column) {
		var s = ''
		while (s.length < column) s += ' '
		return s
	}

	var src = token.context.source
	var { line_no, column } = find_line_and_column_by_position(src, token.pos)
	var line = src.split('\n')[line_no]

	var s = 	'\n' + token.context.file_name
		+ ':' + line_no + '\n'
		+ line + '\n'
		+ indent(column) + '^\n'
		+ 'Parse error: ' + message
		'\n'
	console.log(s)
}

function parse_list_commas(parse_func, tokens, i) {
	/*
		This utility is used to parse list of something specified by a callback, separated by comma.
	*/
	i = parse_func(tokens, i)
	if (!i) {
		return
	}
	var list = [ret]

	while (true) {
		if (tokens[i] && tokens[i].type == 'symbol' && tokens[i].value == ',') {
			i++
		}
		else break

		var n = parse_func(tokens, i)
		if (!n) {
			throw error(tokens, i, parse_func.name + ' expected')
		}
		i = n
		list.push(ret)
	}
	ret = list
	return i
}

