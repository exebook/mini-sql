# mini-sql

Mini pseudo SQL parser my test task for RIPS technologies

To see the test example AST in JSON format (the one original assignment has) click here: https://github.com/exebook/mini-sql/blob/master/example-ast-output.json.

This parser is written in JavaScript/Node.js, it requires Node.js fs module to read from STDIO.

Parser features error reporting, about 1mb/sec parsing speed on my notebook.

Parser type is manually written Recursive Descent + Shunting Yard binary expression parser.

Code is commented and uses a global variable as a secondary return variable.

Entry point is `main.js`

To execute do
```
cat operations | node main.js
```

