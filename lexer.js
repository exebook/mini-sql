module.exports = lexer

/*
	SQL has a concept of a Reserved Word, i.e. you cannot use such a word as a column or a variable name:
	CREATE TABLE Use (Select integer);
*/

var Keywords = new Set(`USE SELECT INSERT DELETE FROM WHERE IS OR AND NOT NULL ORDER GROUP BY SORT INTO VALUES NAMES`.split(' '))

var ret = null

function new_token(pos, type, source, value) {
	/*
		Performance trick:
		To be monotonic inline cache friendly we want to create all tokens in a single place
	*/
	var x = {
		type,
		value,
		pos,
		context: undefined,
		source,
	}
	/*
		Hide context and source from console.log/JSON.stringify
	*/
	Object.defineProperty(x, 'context', { enumerable: false })
	Object.defineProperty(x, 'source', { enumerable: false })
	return x
}

/*
	Token routes
*/

function lex_number(str, i) {
	/*
		A very simplified floating point number parsing
	*/
	if (str[i] >= '0' && str[i] <= '9') {
		var i0 = i
		var num = str[i]
		var dots = 0
		i++
		while (str[i] >= '0' && str[i] <= '9' || str[i] == '.') {
			num += str[i]
			if (str[i] == '.') {
				dots++
				if (dots > 1) {
					break
				}
			}
			i++
		}
		ret = new_token(i0, 'number', str.substring(i0, i), parseFloat(num))
		return i
	}
}

function lex_string(str, i) {
	/*
		Note that your example used double quotes for a string literal, but SQL uses single quotes
		instead, because double quotes are reserved for relation names (column, table etc).
	*/
	var QUOTE = "'"
	if (str[i] == QUOTE) {
		var i0 = i
		i++
		var value = ''
		while (true) {
			if (i >= str.length) {
				throw 'Unterminated string at position ' + i
			}
			if (str[i] == QUOTE) {
				i++
				// Double tick is an escape sequence, i.e.  'Don''t worry, you''re right!'
				if (str[i] == QUOTE) {
					value += QUOTE
					i++
					continue
				}
				else {
					break
				}
			}
			else {
				value += str[i]
				i++
			}
		}
		ret = new_token(i0, 'string', str.substring(i0, i), value)
		return i
	}
}

function lex_quoted_id(str, i) {
	/*
		SQL supports identifiers enclosed in double quotes
	*/
	var QUOTE = '"'
	if (str[i] == QUOTE) {
		var i0 = i
		i++
		var value = ''
		while (true) {
			if (i >= str.length) {
				throw 'Unterminated quoted id at position ' + i
			}
			if (str[i] == QUOTE) {
				i++
				break
			}
			else {
				value += str[i]
				i++
			}
		}
		ret = new_token(i0, 'id', str.substring(i0, i), value)
		return i
	}
}

function lex_symbol(str, i) {
	/*
		Basic symbol handling
	*/
	var c = str[i]
	if(c=='+'||c=='-'||c=='*'||c=='/'||c=='='||c==';'||c==','||c=='('||c==')'||c=='.') {
		ret = new_token(i, 'symbol', c, c)
		return i + 1
	}
	else if (c == '>' || c == '<') {
		if (str[i + 1] == '=') {
			ret = new_token(i, 'symbol', c + '=', c + '=')
			return i + 2
		}
		else if (c == '<' && str[i + 1] == '>') {
			// SQL supports both != and <>
			ret = new_token(i, 'symbol', '<>', '!=')
			return i + 2
		}
		else {
			ret = new_token(i, 'symbol', c, c)
			return i + 1
		}
	}
}

function lex_id_or_keyword(str, i) {
	/*
		SQL identifiers are case insensitive, thus we a storing them normlized to UPPERCASE.
		They also can start with underscode and can contain numbers.
	*/
	var c = str[i]
	if (c == '_' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z') {
		var i0 = i
		var id = c
		i++
		while (true) {
			c = str[i]
			if (c == '_' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || (c >= '0' && c <= '9')) {
				id += c
				i++
			}
			else {
				break
			}
		}
		id = id.toUpperCase()
		if (Keywords.has(id)) {
			ret = new_token(i0, 'keyword', str.substring(i0, i), id)
		}
		else {
			ret = new_token(i0, 'id', str.substring(i0, i), id)
		}
		return i
	}
}

function lex_something(str, i) {

	/*
		Route by the first character
		Return whatever have matched first
	*/

	var n = lex_number(str, i)
	if (n) return n

	var n = lex_string(str, i)
	if (n) return n

	var n = lex_quoted_id(str, i)
	if (n) return n

	var n = lex_symbol(str, i)
	if (n) return n

	var n = lex_id_or_keyword(str, i)
	if (n) return n
}

function lexer(file_name, str) {

	function skip_spaces() {
		while (true) {
			if (str[i] && str[i] <= ' ') i++
			else break
		}
	}

	context = {
		file_name,
		source: str,
	}

	var tokens = []
	var i = 0

	while (true) {
		if (i == str.length) break
		skip_spaces()

		var n = lex_something(str, i)

		if (n != undefined) {
			/*
				Add context to every token
			*/
			ret.context = context
			tokens.push(ret)
			i = n
		}
		else {
			if (i == str.length) {
				break
			}
			else {
				console.log(i)
				throw 'Lexer error at: ' + str.substr(i)
			}
		}
	}

	return tokens.length ? tokens : undefined
}
