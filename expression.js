var {
	new_node,
	error,
	parse_list_commas,
} = require('./base')

module.exports = {
	parse_expr,
	parse_primary,
	parse_column,
}

var Operators = new Set(`+ - * / = != < > >= <= AND OR IS`.split(' '))

function parse_primary(tokens, i) {
	/*
		SQL have it's own expression grammar, I did not have time to study it,
		Here I just do things in a very straightforward manner.
		Primary is whatever can be located on both sides of the binary expression.
	*/
	var n

	n = parse_prefix(tokens, i)
	if (n) return n

	n = parse_function_call(tokens, i)
	if (n) return n

	n = parse_column(tokens, i)
	if (n) return n

	n = parse_number(tokens, i)
	if (n) return n

	n = parse_string_literal(tokens, i)
	if (n) return n

	n = parse_bool_literal(tokens, i)
	if (n) return n

	n = parse_null_literal(tokens, i)
	if (n) return n
}

function parse_function_call(tokens, i) {
	/*
		We assume a call is an id followed by a list of expressions in parenthesis.
		I did not study SQL function call syntax, take it with a grain of salt.
	*/
	var a = tokens[i]
	if (a && a.type == 'id') {
		var i0 = i
		var func_name = a.value
		i++
		a = tokens[i]
		if (a && a.type == 'symbol' && a.value == '(') {
			i++
			var n = parse_list_commas(parse_expr, tokens, i)
			if (n) {
				i = n
				var args = ret
			}
			a = tokens[i]
			if (!(a && a.type == 'symbol' && a.value == ')')) {
				throw error(tokens, i, ') expected')
			}
			ret = new_node(tokens[i0], tokens[i], {
				type: 'call',
				func_name,
				args,
			})
			i++
			return i
		}
	}
}

function parse_column(tokens, i) {
	/*
		table.column
		Some SQL implementations may support db.table.column as well
	*/
	var a = tokens[i]
	if (a && a.type == 'id') {
		var dot = tokens[i + 1]
		if (dot && dot.type == 'symbol' && dot.value == '.') {
			var b = tokens[i + 2]
			if (b && b.type == 'id') {
				ret = new_node(tokens[i], tokens[i + 2], {
					type: 'column',
					table: a.value,
					column: b.value,
				})
				return i + 3
			}
			else {
				throw error(tokens, i + 2, `Column name expected`)
			}
		}
		else {
			ret = new_node(tokens[i], tokens[i], {
				type: 'column',
				table: undefined,
				column: a.value,
			})
			return i + 1
		}
	}
}

function parse_prefix(tokens, i) {
	/*
		Only NOT at the moment can be a prefix operator, although
		you may want negation at least.
	*/
	var a = tokens[i]
	if (a && a.type == 'keyword') {
		if (a.value == 'NOT') {
			var n = parse_primary(tokens, i + 1)
			if (n) {
				ret = new_node(tokens[i], tokens[n], {
					type: 'not',
					value: ret,
				})
				return n
			}
			else {
				throw error(tokens, i, 'Value expected after NOT')
			}
		}
	}
}

function parse_number(tokens, i) {
	/*
		Just store whatever lexer gave us.
	*/
	var a = tokens[i]
	if (a && a.type == 'number') {
		ret = new_node(tokens[i], tokens[i], {
			type: 'number',
			number: a.value,
		})
		return i + 1
	}
}

function parse_string_literal(tokens, i) {
	/*
		At this point string literal is already unescaped.
	*/
	var a = tokens[i]
	if (a && a.type == 'string') {
		ret = new_node(tokens[i], tokens[i], {
			type: 'string',
			number: a.value,
		})
		return i + 1
	}
}

function parse_bool_literal(tokens, i) {
	var a = tokens[i]
	if (a && a.type == 'keyword' && (a.value == 'TRUE' || a.value == 'FALSE')) {
		ret = new_node(tokens[i], tokens[i], {
			type: 'bool',
			value: a.value,
		})
		return i + 1
	}
}

function parse_null_literal(tokens, i) {
	var a = tokens[i]
	if (a && a.type == 'keyword' && (a.value == 'NULL')) {
		ret = new_node(tokens[i], tokens[i], {
			type: 'null',
		})
		return i + 1
	}
}

function parse_operator(tokens, i) {
	/*
		Using 'Operators' Set.has() for a fast lookup.
		Although with so little operators the if-chain might be actually faster.
	*/
	var a = tokens[i]
	if (a && (a.type == 'symbol' || a.type == 'keyword') && Operators.has(a.value)) {
		ret = new_node(tokens[i], tokens[i], {
			type: 'operator',
			operator: a.value,
		})
		return i + 1
	}
}

function parse_expr(tokens, i) {
	i = parse_primary(tokens, i)
	if (i) {
		return parse_expr_cont(tokens, i, [ret])
	}
}

function parse_expr_cont(tokens, i, code) {

	/*
		Parse expression using the Dijkstra's shunting yard algorithm.
		The result is stored as a stack of operatons.
	*/

	function get_precedence(op) {
		/*
			This is not real SQL precedence table (it is a stripped down JS precedence table)
			But should be OK most of the time.
		*/
		if (op == '*' || op == '/') return 14
		if (op == '+' || op == '-') return 13
		if (op == '<=' || op == '>=' || op == '>' || op == '<') return 11
		if (op == '=' || op == '!=') return 10
		if (op == 'AND') return 6
		if (op == 'OR') return 5
		return 0
	}

	var i0 = i
	var stack = []

	while (true) {
		var n = i
		i = parse_operator(tokens, i)
		if (i == undefined) break
		var op = ret

		i = parse_primary(tokens, i)
		if (i == undefined) break
		var next = ret

		var precedence = get_precedence(op.operator)

		while (stack.length > 0 && get_precedence(stack[stack.length - 1].operator) >= precedence) {
			code.push(stack.pop())
		}
		stack.push(op)
		code.push(next)
	}

	while(stack.length > 0) {
		code.push(stack.pop())
	}
	ret = new_node(tokens[i0], tokens[i], {
		type: 'expr',
		stack: code,
	})
	return n
}





