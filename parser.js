var {
	parse_expr,
	parse_column,
} = require('./expression')

var {
	new_node,
	error,
	parse_list_commas,
} = require('./base')

module.exports = parse

function advance_token(tokens, i, type, sym, err_msg) {
	/*
		Utility to avoid some really stupid boiler plate.
		Check if a token is what we need and advance to the next token,
		otherwise throw.
	*/
	var a = tokens[i]
	if (!(a && a.type == type && a.value == sym)) {
		throw error(tokens, i, err_msg)
	}
	return i + 1
}

function parse_use(tokens, i) {
	/*
		USE <dbname>
	*/
	var i0 = i
	i++
	var a = tokens[i]
	if (a.type == 'id') {
		ret = new_node(tokens[i0], tokens[i], {
			type: 'use',
			database: a.value
		})
		return i + 1
	}
	else {
		throw error(tokens, i, `Unexpected ${ a.type }, USE requires a database name`)
	}
}

function parse_table_ref(tokens, i) {
	/*
		db.table
	*/
	var a = tokens[i]
	if (a && a.type == 'id') {
		var dot = tokens[i + 1]
		if (dot && dot.type == 'symbol' && dot.value == '.') {
			var b = tokens[i + 2]
			if (b && b.type == 'id') {
				ret = new_node(tokens[i], tokens[i + 2], {
					type: 'table_ref',
					db: a.value,
					table: b.value,
				})
				return i + 3
			}
			else {
				throw error(tokens, i + 2, `Table name expected`)
			}
		}
		else {
			ret = new_node(tokens[i], tokens[i], {
				type: 'table_ref',
				db: undefined,
				table: a.value,
			})
			return i + 1
		}
	}
}

function parse_from_clause(tokens, i) {
	var a = tokens[i]
	if (a && a.type == 'keyword' && a.value == 'FROM') {
		var i0 = i
		i = parse_list_commas(parse_table_ref, tokens, i + 1)

		if (!i) {
			throw error(tokens, i0 + 1, 'FROM requires table name')
		}

		ret = new_node(tokens[i0], tokens[i - 1], {
			type: 'from_clause',
			list: ret,
		})
		return i
	}
	return
}

function parse_where_clause(tokens, i) {
	var a = tokens[i]
	if (a && a.type == 'keyword' && a.value == 'WHERE') {
		var i0 = i
		i = parse_expr(tokens, i + 1)

		if (!i) {
			throw error(tokens, i0 + 1, 'WHERE requires expression')
		}

		ret = new_node(tokens[i0], tokens[i - 1], {
			type: 'where_clause',
			expr: ret,
		})
		return i
	}
}

function parse_order_by_clause(tokens, i) {
	var i0 = i
	var a = tokens[i]
	if (a && a.type == 'keyword' && a.value == 'ORDER') {
		var b = tokens[i + 1]
		if (b && b.type == 'keyword' && b.value == 'BY') {
			var i0 = i
			i = parse_list_commas(parse_column, tokens, i + 2)

			if (!i || ret.length == 0) {
				throw error(tokens, i0 + 2, 'ORDER BY requires a column reference')
			}

			ret = new_node(tokens[i0], tokens[i - 1], {
				type: 'order_by',
				expr: ret,
			})
			return i
		}
	}
}


function parse_table_expr(tokens, i) {
	/*
		Inspired by actual SQL EBNF
	*/
	var i0 = i

	var n = parse_from_clause(tokens, i)
	if (n) {
		var from = ret
		i = n
	}

	n = parse_where_clause(tokens, i)
	if (n) {
		var where = ret
		i = n
	}

	n = parse_order_by_clause(tokens, i)
	if (n) {
		var order_by = ret
		i = n
	}

	if (from == undefined && where == undefined) {
		return
	}

	ret = new_node(tokens[i0], tokens[i], {
		type: 'table_expr',
		from,
		where,
		order_by,
	})

	return i
}

function parse_select(tokens, i) {
	/*
		This does a little more than the examples require.
		For example SELECT 2+2;
	*/
	var i0 = i
	i = parse_list_commas(parse_expr, tokens, i + 1)
	if (i == undefined) {
		// SQL allows empty selects
		ret = new_node(tokens[i0], tokens[i0], {
			type: 'select',
			list: undefined,
			table_expr: undefined,
		})
		return i0 + 1
	}

	var list = ret

	var n = parse_table_expr(tokens, i)
	if (n) {
		i = n
		var table_expr = ret
	}

	ret = new_node(tokens[i0], tokens[i - 1], {
		type: 'select',
		list,
		table_expr,
	})
	return i
}

function parse_insert(tokens, i) {
	var i0 = i
	var a = tokens[i + 1]
	if (a && a.type == 'keyword' && a.value == 'INTO') {
		var n = parse_table_ref(tokens, i + 2)
		if (!n) {
			throw error(tokens, i + 1, 'INSERT requires a table reference')
		}
		i = n
		var into = ret

		i = advance_token(tokens, i, 'symbol', '(', '( expected')
		n = parse_list_commas(parse_column, tokens, i)
		if (!n || ret.length == 0) {
			throw error(tokens, i, 'Column specifier expected')
		}
		var columns = ret

		i = n
		i = advance_token(tokens, i, 'symbol', ')', ') expected')
		i = advance_token(tokens, i, 'keyword', 'VALUES', 'VALUES expected')
		i = advance_token(tokens, i, 'symbol', '(', '( expected')
		n = parse_list_commas(parse_expr, tokens, i)
		if (!n || ret.length == 0) {
			throw error(tokens, i, 'VALUES expects a list of expressions')
		}
		i = n
		var values = ret
		i = advance_token(tokens, i, 'symbol', ')', ') expected')
		ret = new_node(tokens[i0], tokens[i - 1], {
			type: 'insert',
			into,
			columns,
			values,
		})
		return i
	}
	else {
		throw error(tokens, i + 1, 'INTO expected')
	}
}

function parse_delete(tokens, i) {
	var i0 = i
	i++
	var n = parse_table_expr(tokens, i)
	if (n) {
		i = n
		var table_expr = ret
	}
	else {
		throw error(tokens, i, 'Table reference expected')
	}
	ret = new_node(tokens[i], tokens[n - 1], {
		type: 'delete',
		table_expr,
	})
	return n
}

function parse_statement(tokens, i) {
	var a = tokens[i]
	if (a && a.type == 'keyword') {
		/*
			Using simple if-chain here for clarity, in production you will carefully
			select between if/switch/map approaches depending on your parser programming language
			and parsed language to achieve fast routing.
		*/
		if (a.value == 'USE') {
			return parse_use(tokens, i)
		}
		else if (a.value == 'DELETE') {
			return parse_delete(tokens, i)
		}
		else if (a.value == 'SELECT') {
			return parse_select(tokens, i)
		}
		else if (a.value == 'INSERT') {
			return parse_insert(tokens, i)
		}
	}
	throw error(tokens, i, `Statement expected`)
}

function parse(tokens) {

	function skip_semicolons() {
		/*
			I am not sure about semantics of a semicolon in SQL, assume they are mere delimiters
		*/
		while (tokens[i] && tokens[i].type == 'symbol' && tokens[i].value == ';') i++
	}

	var i = 0
	var root = []
	while (true) {
		skip_semicolons()
		if (i == tokens.length) break
		i = parse_statement(tokens, i)
		if (i == undefined) break

		root.push(ret)
	}
	return root.length ? root : undefined
}

