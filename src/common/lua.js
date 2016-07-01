/**
 * lua.js
 */

(function(root, factory){
    if(typeof define === "function" && define.amd) {
        define([], function(){
            return (root.luajs = factory());
        });
    } else if(typeof module === "object" && module.exports) {
        module.exports = (root.luajs = factory());
    } else {
        root.luajs = factory();
    }
}(this, function() {

    var modules = {
        lex: {},
        parser: {},
        codegen: {},

        types:{},
        index: {}
    };

    function require(x){
        return modules[/\.\/(\w*)\.js/.exec(x)[1]];
    }


    (function(exports){
        /**
 * Created by Yun on 2014/9/23.
 */

var tokens = [
    "<eof>",
    "and", "break", "do", "else", "elseif",
    "end", "false", "for", "function", "goto", "if",
    "in", "local", "nil", "not", "or", "repeat",
    "return", "then", "true", "until", "while",
    "..", "...", "==", ">=", "<=", "~=", "::", "<--orgion-eof>",
    "<number>", "<name>", "<string>",
    "__javascript", "__jsreturn"
];
exports.tokens = tokens;

var reserved = {
    "and":1,
    "break":2, "do":3, "else":4, "elseif":5,
    "end":6, "false":7, "for":8, "function":9, "goto":10, "if":11,
    "in":12, "local":13, "nil":14, "not":15, "or":16, "repeat":17,
    "return":18, "then":19, "true":20, "until":21, "while":22,

    "__javascript":34,
    "__js": 34,
    "__jsreturn": 35
}

var TK = {
    TK_EOS: 0,

    /* terminal symbols denoted by reserved words */
    TK_AND : 1,
    TK_BREAK : 2,
    TK_DO : 3,
    TK_ELSE : 4,
    TK_ELSEIF : 5,
    TK_END : 6,
    TK_FALSE : 7,
    TK_FOR : 8,
    TK_FUNCTION : 9,
    TK_GOTO : 10,
    TK_IF : 11,
    TK_IN : 12,
    TK_LOCAL : 13,
    TK_NIL : 14,
    TK_NOT : 15,
    TK_OR : 16,
    TK_REPEAT : 17,
    TK_RETURN : 18,
    TK_THEN : 19,
    TK_TRUE : 20,
    TK_UNTIL : 21,
    TK_WHILE : 22,
    /* other terminal symbols */
    TK_CONCAT : 23,
    TK_DOTS: 24,
    TK_EQ: 25,
    TK_GE: 26,
    TK_LE: 27,
    TK_NE: 28,
    TK_DBCOLON:29,

    TK_NUMBER:31,
    TK_NAME: 32,
    TK_STRING: 33,

    TK_JAVASCRIPT: 34,
    TK_JSRETURN: 35
};

exports.TK = TK;

var lalphaExp = /^[A-Za-z\_]$/;
function lislalpha(ch){
    return lalphaExp.test(ch);
}

var digitExp = /^[0-9]$/;
function lisdigit(ch){
    return digitExp.test(ch);
}

var lalnumExp = /^[0-9A-Za-z\_]$/;
function lislalnum(ch){
    return lalnumExp.test(ch);
}

function isNewLine(ch){
    return ch=='\n' || ch == '\r';
}

/*
 ** skip a sequence '[=*[' or ']=*]' and return its number of '='s or
 ** -1 if sequence is malformed
 */
function skip_sep(curr, next, save){
    var count = 0;
    var ch = curr();
    if (ch != '[' && ch != ']'){
        throw "Lexical internal error!";
    }
    if (save){
        save(ch);
    }
    next()
    while (curr() == '='){
        next();
        if (save){
            save(curr());
        }
        ++count;
    }
    return curr() == ch ? count : (-count - 1);
}

function inclinenumber(curr, next){
    var old = curr();
    next();
    if (isNewLine(curr()) && curr() != old){
        next();
    }
}

//TODO: avoid wasting space when read comments.
function read_long_string(curr, next, sep){
    var buff = [];
    function save(ch){
        buff.push(ch);
    }
    next();/* skip 2nd `[' */
    /* string starts with a newline? */
    if (isNewLine(curr())){
        inclinenumber(curr, next);
    }
    for (;;){
        var ch = curr();
        switch(ch){
            case null:
                throw "unfinished long string/comment";
            case ']':{
                if (skip_sep(curr, next, save) == sep){
                    /* skip 2nd `]' */
                    next();
                    buff.splice(-sep-1, sep+1);
                    return buff.join("");
                }
                break;
            }
            case '\n':case '\r':{
                inclinenumber(curr, next);
                save('\n');     /* avoid wasting space */
                break;
            }
            default:{
                save(ch);
                next();
            }
        }
    }
}

//TODO: support utf8 `\` escape.
function read_string(curr, next){
    var buff = [];
    var beginCh = curr();
    next();
    var currCh;
    while ((currCh = curr()) != beginCh){
        switch (currCh){
            case null:
                throw "unfinished string";
            case '\n':
            case '\r':
                throw "unfinished string";
            case '\\':{
                next();
                currCh = curr();
                switch (currCh){
//                    case 'a': buff.push('\a'); next(); break;
                    case 'b': buff.push('\b'); next(); break;
                    case 'f': buff.push('\f'); next(); break;
                    case 'n': buff.push('\n'); next(); break;
                    case 'r': buff.push('\r'); next(); break;
                    case 't': buff.push('\t'); next(); break;
                    case 'v': buff.push('\011'); next(); break;
                    case '\n': case '\r': {
                        buff.push('\n');
                        inclinenumber();
                        break;
                    }
                    case '\\': case '\"': case '\'':{
                        buff.push(currCh);
                        next();
                        break;
                    }
                    case null:
                        throw "unfinished string";

                    case 'z':{
                        next();
                        while (lisspace(curr())){
                            next();
                        }
                        break;
                    }

                    case 'x': throw "esacpe for char code not supported in lua.js yet.";
                    default:{
                        if (!lisdigit(currCh)){
                            throw "invalid escape sequence" + currCh;
                        }
                        throw "esacpe for char code not supported in lua.js yet.";
                    }
                }
                break;
            }
            default: {
                buff.push(currCh);
                next();
            }
        }
    }
    next();
    return buff.join("");
}

function read_numeral(curr, next){
    var first = curr();
    next();
    var hex = true;
    if (first == '0' && (curr() == 'x' || curr() == 'X')){   /* hexadecimal? */
        next();
        throw new Error("Hexadecimal numeric not supported in lua.js yet.");
    } else {
        var buff = [first];
        var ch = curr();
        var prev = first;
        while (lisdigit(ch) || ch == '.' || ch == 'e' || (prev == 'e' && ch == '-')){
            buff.push(ch);
            next();
            prev = ch;
            ch = curr();
        }

        //not TODO: use locale decimal point.
        return parseFloat(buff.join(""));
    }
}

function read_identifier_name(curr, next){
    var buff = [];
    while (lislalnum(curr())){
        buff.push(curr());
        next();
    }
    return buff.join("");
}

function is_reserved(name){
    return typeof(reserved[name]) == 'number' && reserved[name];
}

function llex(curr, next){
    for (;;){
        switch(curr()){
            case '\n': case '\r':
            case ' ': case '\f': case '\t': case '\011':next();break;
            case '-':{
                /* '-' or '--' (comment) */
                next();
                if (curr() != '-') {
                    return '-';
                }
                /* else is a comment */
                next();
                var ch = curr();
                if (ch == '[') {        /* long comment? */
                    var sep = skip_sep(curr, next);
                    if (sep >= 0){
                        read_long_string(curr, next, sep);    /* skip long comment */
                        break;
                    }
                }

                /* else short comment */
                while (ch && ch != "\n" && ch != "\r"){
                    /* skip until end of line (or end of file) */
                    next();
                    ch = curr();
                }
                break;
            }
            case '[':{
                /* long string or simply '[' */
                var sep = skip_sep(curr, next);
                if (sep >= 0){
                    return {
                        id: TK.TK_STRING,
                        val: read_long_string(curr, next, sep)
                    };
                } else if (sep == -1){
                    return '[';
                } else {
                    throw "invalid long string delimiter";
                }
            }
            case '=':{
                next();
                if (curr()!= '=') {
                    return '=';
                } else {
                    next();
                    return TK.TK_EQ;
                }
            }
            case '<':{
                next();
                if (curr()!= '=') {
                    return '<';
                } else {
                    next();
                    return TK.TK_LE;
                }
            }
            case '>':{
                next();
                if (curr()!= '=') {
                    return '>';
                } else {
                    next();
                    return TK.TK_GE;
                }
            }
            case '~':{
                next();
                if (curr()!= '=') {
                    return '~';
                } else {
                    next();
                    return TK.TK_NE;
                }
            }
            case ':': {
                next();
                if (curr() != ':'){
                    return ':';
                } else {
                    next(ls);
                    return TK.TK_DBCOLON;
                }
            }
            case '"': case '\'': {  /* short literal strings */
                return {
                    id: TK.TK_STRING,
                    val: read_string(curr, next)
                };
            }
            case '.': {  /* '.', '..', '...', or number */
                next();
                if (curr() == ".") {
                    next();
                    if (curr() ==  ".")
                    {
                        next();
                        return TK.TK_DOTS;/* '...' */
                    }
                    else return TK.TK_CONCAT;   /* '..' */
                }
                else if (!lisdigit(curr())) return '.';
                /* else go through */
            }
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
            {
                return {
                    id: TK.TK_NUMBER,
                    val: read_numeral(curr, next)
                };
            }
            case null:{
                return TK.TK_EOS;
            }
            default:{
                if (lislalpha(curr())){
                    var str = read_identifier_name(curr, next);
                    var reserved = is_reserved(str);
                    if (reserved){
                        return reserved;
                    }
                    return {
                        id: TK.TK_NAME,
                        val: str
                    };
                } else {
                    /* single-char tokens (+ - / ...) */
                    var ret = curr();
                    next();
                    return ret;
                }
            }
        }
    }
}

function generator(s){
    var cur = 0;
    function curr(){
        if (cur < s.length){
            return s.charAt(cur);
        }
        return null;
    }
    function next(){
        if (cur < s.length){
            ++cur;
        }
    }

    return function(){
        return llex(curr, next);
    }
}
exports.generator = generator;

function lex(s){
    var gen = generator(s);
    var curr = gen();
    var next = gen();
    return {
        curr: function(){
            return curr;
        },
        lookAhead: function(){
            return next;
        },
        next: function(){
            curr = next;
            next = gen();
        }
    }
}
exports.lex = lex;

    })(modules.lex);

    (function(exports){
        /**
 * Created by Yun on 2014/9/23.
 */

var liblex = require("./lex.js");
var lex = liblex.lex;
var TK = liblex.TK;
var tokenNames = liblex.tokens;

function tokentype(sym){
    switch (typeof(sym)) {
        case 'string':
        case 'number':
            return sym;
        case 'object':
            return sym.id;
    }
}

function tokenName(sym){
    if (typeof(sym) == 'number'){
        return tokenNames[sym];
    } else if (typeof(sym) == 'object') {
        return tokenNames[sym.id];
    } else {
        return sym;
    }
}

function singlevar(s){
    check(s, TK.TK_NAME);
    var ret = s.curr().val;
    s.next();
    return {
        type: "variable",
        val: ret
    };
}

function primaryexp(s){
    var t = tokentype(s.curr())
    switch(t){
        case '(':{
            s.next();
            var exp = expr(s);
            checknext(s, ')');
            return {
                type: "expr.brackets",
                "expr": exp
            };
        }
        case TK.TK_NAME:{
            return singlevar(s);
        }
        case TK.TK_JAVASCRIPT:{
            s.next();
            return {
                type: "expr.javascript",
                "args": funcargs(s)
            }
        }
        default:{
            throw new Error("unexpected symbol " + (tokenNames[t] || t));
        }
    }
}

function testnext(s, expected){
    if (tokentype(s.curr()) == expected){
        s.next();
        return true;
    }
    //return false;
}

function check(s, expected){
    if (tokentype(s.curr()) != expected){
        throw new Error("symbol "+tokenName(expected)+" expected!");
    }
}

function checknext(s, val){
    check(s, val);
    s.next();
}

function str_checkname(s){
    check(s, TK.TK_NAME);
    var ret = s.curr().val;
    s.next();
    return ret;
}

function checkname(s){
    return {
        type: "const.string",
        val: str_checkname(s)
    };
}

function codestring(s){
    check(s, TK.TK_STRING);
    var ret = s.curr().val;
    s.next();
    return {
        type: "const.string",
        val: ret
    };
}

function yindex(s){
    s.next(); /* skip the '[' */
    var exp = expr(s);
    checknext(s, ']');
    return exp;
}

function funcargs(s){
    switch (tokentype(s.curr())){
        case '(':{
            s.next();
            if (s.curr() == ')') {  /* arg list is empty? */
                s.next();
                return [];
            } else {
                var args = explist(s);
                checknext(s, ')');
                return args;
            }
        }
        case '{':{
            return [constructor(s)];
        }
        case TK.TK_STRING:{
            return [codestring(s)];
        }
        default:{
            throw new Error("function arguments expected, got "+ tokenName(s.curr()));
        }
    }
}

function suffixedexp(s){
    var primary = primaryexp(s);
    for (;;) {
        switch(tokentype(s.curr())){
            case '.':{
                s.next();
                var key = checkname(s);
                primary = {
                    "type": "expr.index",
                    "self": primary,
                    "key": key
                };
                break;
            }
            case '[':{
                var key = yindex(s);
                primary = {
                    "type": "expr.index",
                    "self": primary,
                    "key": key
                };
                break;
            }
            case ':':{
                s.next();
                var key = checkname(s);
                var args = funcargs(s);
                primary = {
                    "type": "expr.callMethod",
                    "self": primary,
                    "key": key,
                    "args": args
                }
                break;
            }
            case '(': case '{':case TK.TK_STRING:{
                var args = funcargs(s);
                primary =  {
                    "type": "expr.call",
                    "func": primary,
                    "args": args
                }
                break;
            }
            default:
                return primary;
        }
    }
}

function getunopr(s){
    switch (s.curr()){
        case TK.TK_NOT: return "uop.not";
        case '-': return "uop.minus";
        case '#': return "uop.len";
//        default: return null;
    }
}

function getbinopr(s){
    switch (s.curr()){
        case '+': return 1;
        case '-': return 2;
        case '*': return 3;
        case '/': return 4;
        case '%': return 5;
        case '^': return 6;
        case TK.TK_CONCAT: return 7;
        case TK.TK_EQ: return 8;
        case '<': return 9;
        case TK.TK_LE: return 10;
        case TK.TK_NE: return 11;
        case '>': return 12;
        case TK.TK_GE: return 13;
        case TK.TK_AND: return 14;
        case TK.TK_OR: return 15;
//        default: return null;
    }
}

function simpleexp(s){
    switch (tokentype(s.curr())){
        case TK.TK_NUMBER:{
            var val = s.curr().val;
            s.next();
            return {
                type: "const.number",
                val: val
            }
        }
        case TK.TK_STRING:{
            return codestring(s);
        }
        case TK.TK_NIL: {
            s.next();
            return {
                type: "const.nil"
            }
        }
        case TK.TK_TRUE:{
            s.next();
            return {
                type: "const.boolean",
                val: true
            }
        }
        case TK.TK_FALSE:{
            s.next();
            return {
                type: "const.boolean",
                val: false
            }
        }
        case TK.TK_DOTS: { /* vararg */
            s.next();
            return {
                type: "vararg"
            }
        }
        case '{': {
            return constructor(s);
        }
        case TK.TK_FUNCTION:{
            s.next();
            return body(s);
        }
        default: {
            return suffixedexp(s);
        }
    }
}

var priority = [
    null,
    [6, 6], [6, 6], [7, 7], [7, 7], [7, 7],  /* `+' `-' `*' `/' `%' */
    [10, 9], [5, 4],                 /* ^, .. (right associative) */
    [3, 3], [3, 3], [3, 3],          /* ==, <, <= */
    [3, 3], [3, 3], [3, 3],          /* ~=, >, >= */
    [2, 2], [1, 1]                   /* and, or */
];

var opname = [
    null,
    "op.add", "op.minus", "op.mul", "op.div", "op.mod",
    "op.pow", "op.concat",
    "op.equal", "op.less", "op.lessequal",
    "op.notequal", "op.great", "op.greatequal",
    "op.and", "op.or"
]

exports.opname = opname;

var UNARY_PRIORITY = 8;

function subexpr(s, limit){
    var ret;
    var uop = getunopr(s);
    if (uop) {
        s.next();
        ret = subexpr(s, UNARY_PRIORITY);
        ret = {
            type: 'expr.uop',
            op: uop,
            operand: ret
        }
    } else {
        ret = simpleexp(s);
    }
    var op = getbinopr(s);
    while (op && priority[op][0] > limit){
        s.next();
        var e2 = subexpr(s, priority[op][1]);
        ret = {
            type: 'expr.op',
            op: opname[op],
            left: ret,
            right: e2
        }

        op = getbinopr(s);
    }
    return ret;
}

function expr(s){
    return subexpr(s, 0);
}

function explist(s){
    var exps = [];
    exps.push(expr(s));
    while (testnext(s, ',')){
        exps.push(expr(s));
    }
    return exps;
}

function assignment(s, lefts){
    while (testnext(s, ',')){
        lefts.push(suffixedexp(s));
    }
    checknext(s, '=');
    return {
        type: "stat.assignment",
        lefts: lefts,
        right: explist(s)
    }
}

function exprstat(s){
    var exp1 = suffixedexp(s);
    if (s.curr() == '=' || s.curr() == ',') {
        return assignment(s, [exp1]);
    } else {
        if (exp1.type != "expr.call" && exp1.type != "expr.callMethod" && exp1.type != "expr.javascript"){
            throw new Error("syntax error, unexpected expr type "+exp1.type);
        }
        return {
            "type": "stat.expr",
            "expr": exp1
        };
    }
}

function listfield(s){
    return {
        "type": "field.list",
        "val": expr(s)
    }
}

function recfield(s){
    var key;
    if (tokentype(s.curr()) == TK.TK_NAME){
        key = checkname(s);
    } else {
        key = yindex(s);
    }

    checknext(s, '=');
    return {
        "type": "field.rec",
        "key": key,
        "val": expr(s)
    }
}

function field(s){
    var curr = s.curr();
    switch (tokentype(curr)){
        case TK.TK_NAME:{
            if (s.lookAhead() != '=') {
                return listfield(s);
            } else {
                return recfield(s);
            }
        }
        case '[': {
            return recfield(s);
        }
        default: {
            return listfield(s);
        }
    }
}

function constructor(s){
    checknext(s, '{');

    var fields = [];

    do {
        if (s.curr() == '}') break;
        var fi = field(s);
        if (fi){
            fields.push(fi);
        }
    } while (testnext(s, ',') || testnext(s, ';'));

    checknext(s, '}');

    return {
        "type": "expr.constructor",
        "fields": fields
    }
}

function test_then_block(s, target){
    target.cond = expr(s);
    checknext(s, TK.TK_THEN);
    target.tblock = block(s);
}

function ifstat(s){
    var root = {
        type: "stat.if"
    }
    var current = root;

    s.next(); //skip if
    test_then_block(s, current);
    while (testnext(s, TK.TK_ELSEIF)) {     /*elseif */
        current.fblock = {
            type: "block",
            stats: [
                {
                    type: "stat.if"
                }
            ]
        }
        current = current.fblock.stats[0];
        test_then_block(s, current);
    }
    if (testnext(s, TK.TK_ELSE)){
        current.fblock = block(s);
    }
    checknext(s, TK.TK_END);
    return root;
}

function whilestat(s){
    s.next(); // skip while
    var cond = expr(s);
    checknext(s, TK.TK_DO);
    var blk = block(s);
    checknext(s, TK.TK_END);
    return {
        type: "stat.while",
        cond: cond,
        block: blk
    }
}

function fornum(s, varname){
    s.next(); //skip '='
    var from = expr(s);
    checknext(s, ',');
    var to = expr(s);
    var step;
    if (testnext(s, ',')) {
        step = expr(s);
    }

    return {
        type: "stat.fornum",
        varname: varname,
        from: from,
        to: to,
        step: step
    }
}

function forlist(s, varnames){
    while (testnext(s, ',')){
        varnames.push(str_checkname(s));
    }
    checknext(s, TK.TK_IN);
    return {
        type: "stat.forlist",
        varnames: varnames,
        explist: explist(s)
    }
}

function forstat(s){
    s.next(); // skip for;
    var varname = str_checkname(s);

    var ret;

    switch (s.curr()){
        case '=':
            ret = fornum(s, varname);
            break;
        case ',':
        case TK.TK_IN:
            ret = forlist(s, [varname]);
            break;
        default:
            throw "`=` or `in` expected"
    }
    checknext(s, TK.TK_DO);  // skip do
    ret.block = block(s);
    checknext(s, TK.TK_END);
    return ret;
}

function repeatstat(s){
    s.next();
    var b = block(s);
    checknext(s, TK.TK_UNTIL);
    return {
        type: "stat.repeat",
        until: expr(s),
        block: b
    }
}

function funcname(s){
    var ret = singlevar(s);
    while (testnext(s, '.')){
        var key = checkname(s);
        ret = {
            type: "expr.index",
            self: ret,
            key: key
        }
    }
    if (testnext(s, ':')) {
        var key = checkname(s);
        return {
            type: "stat.method",
            self: ret,
            key: key
        }
    } else {
        return {
            type: "stat.function",
            left: ret
        }
    }
}

function funcstat(s){
    s.next();
    var f = funcname(s);
    f.func = body(s);
    return f;
}

function localfunc(s){
    var name = str_checkname(s);
    return {
        type: "stat.localfunction",
        name: name,
        func: body(s)
    }
}

function localstat(s){
    var names = [];
    do{
        names.push(str_checkname(s));
    } while (testnext(s, ','));

    var right;
    if (testnext(s, '=')){
        right = explist(s);
    }
    return {
        type: "stat.local",
        names: names,
        right: right
    }
}

function retstat(s, isJSReturn){
    var ret = {
        type: isJSReturn ? 'stat.jsreturn' : "stat.return",
        nret: []
    };
    s.next();
    if (block_follow(s) || s.curr() == ';'){
    } else {
        ret.nret = explist(s);
    }

    //skip all ';' after return
    while (testnext(s, ';')){
    }

    return ret;
}

function statement(s){
    var curr = s.curr();
    switch(curr){
        case ';': { /* stat -> ';' (empty statement) */
            s.next();   /* skip ';' */
            break;
        }
        //TODO:
        case TK.TK_IF:
            return ifstat(s);
        case TK.TK_WHILE:
            return whilestat(s);
        case TK.TK_DO:{
            s.next();
            var ret = block(s);
            checknext(s, TK.TK_END);
            return ret;
        }
        case TK.TK_FOR:
            return forstat(s);
        case TK.TK_REPEAT:
            return repeatstat(s);
        case TK.TK_FUNCTION:
            return funcstat(s);
        case TK.TK_LOCAL:{
            s.next();
            if (testnext(s, TK.TK_FUNCTION)){
                return localfunc(s);
            } else {
                return localstat(s);
            }
        }
        case TK.TK_RETURN: {
            return retstat(s);
        }
        case TK.TK_JSRETURN:{
            return retstat(s, true);
        }
        case TK.TK_BREAK: {
            s.next()
            return {
                type:"stat.break"
            }
        }

//        case TK.TK_DBCOLON:
//        case TK.TK_GOTO:

        default:{
            return exprstat(s);
        }
    }
}

function block_follow(s){
    switch (s.curr()){
        case TK.TK_ELSE:
        case TK.TK_ELSEIF:
        case TK.TK_END:
        case TK.TK_EOS:
        case TK.TK_UNTIL:
            return true;
        default:
            return 0;
    }
}

function statlist(s){
    var ret = [];
    while (!block_follow(s)){
        if (s.curr() == TK.TK_RETURN || s.curr() == TK.TK_JSRETURN){
            ret.push(statement(s));
            break;
        }
        var stat = statement(s);
        if (stat) {
            ret.push(stat);
        }
    }
    return ret;
}

function block(s){
    return {
        type: 'block',
        stats: statlist(s)
    }
}

function parlist(s){
    var ret = [];
    if (s.curr() != ')'){
        do {
            switch (tokentype(s.curr())){
                case TK.TK_NAME:{
                    ret.push(str_checkname(s));
                    break;
                }
                case TK.TK_DOTS:{
                    ret.push(TK.TK_DOTS);
                    s.next();
                    break;
                }
                default:
                    throw "<name> or `...` expected";
            }
        } while(testnext(s ,','));
    }
    return ret;
}

function body(s){
    checknext(s, '(');
    var args = parlist(s);
    var varargs = false;
    if (args.length > 0 && args[args.length - 1] == TK.TK_DOTS) {
        args.pop();
        varargs = true;
    }
    checknext(s, ')');
    var body = block(s);
    checknext(s, TK.TK_END);
    return {
        type: 'function',
        args: args,
        varargs: varargs,
        block: body
    }
}

function main(s){
    var ret = {
        type: "function",
        args: [],
        varargs: true,
        block: block(s)
    };
    check(s, TK.TK_EOS);
    return ret;
}
exports.main = main;

function parse(s){
    return exports.main(lex(s));
}
exports.parse = parse;

    })(modules.parser);

    (function(exports){
        /**
 * Created by Yun on 2014/9/24.
 */

var PRETTY = true;

var gens = {};

var indent, pushIndent, popIndent;

if (PRETTY) {
    indent = "\n";

    pushIndent = function () {
        indent = indent + "    ";
    }
    popIndent= function (){
        indent = indent.substr(0, indent.length - 4);
    }
} else {
    indent = "";
    pushIndent = function (){}
    popIndent = function (){}
}

gens["function"] = function(ast){
    return "l._f(function(" + ast.args.join(',')+")" + codegen(ast.block)+")";
}

gens["block"] = function(ast){
    var codes = [];
    pushIndent();
    for (var i = 0; i < ast.stats.length; i++){
        codes.push(codegen(ast.stats[i]));
    }
    popIndent();
    return indent + "{" +  codes.join("") +  indent + "}";
}

gens["stat.getvaargs"] = function(ast){
    return indent + "var __VA_ARG = Array.prototype.slice.call(arguments, " + ast.argCount +");";
}

gens["stat.expr"] = function(ast){
    return indent + codegen(ast.expr) + ";";
}

gens["stat.local"] = function(ast){
    if (!ast.right){
        return indent + "var " + ast.names.join(',') + ";"
    } else if (ast.names.length == 1){
        // a = exp
        return indent + "var " + ast.names[0] + " = " + codegenSimpleVar(ast.right[0]) + ";";
    } else {
        // var list = explist
        var names = [];
        for (var i = 0; i < ast.names.length; i++){
            names.push(ast.names[i] + " = t[" + i + "]");
        }
        //TODO: use a generated template varaiable name.
        return indent + "var t =" + codegenVarList(ast.right)+ "," +
            indent + names.join(",") + ";";
    }
}

gens["stat.if"] = function(ast){
    var base = indent + "if (" + codegenSimpleVar(ast.cond) + ")" + codegen(ast.tblock);

    if (ast.fblock && ast.fblock.stats.length > 0){
        if (ast.fblock.stats.length == 1 && ast.fblock.stats[0].type == "stat.if") {
            //try generate better code for elseif.
            return base + "else" + codegen(ast.fblock.stats[0]);
        } else {
            return base + "else" + codegen(ast.fblock);
        }
    }
    return base;
}

function codegenChecknumber(ast){
    if (ast.type == "const.number"){
        return codegen(ast);
    }
    return "l.__checknumber("+codegenSimpleVar(ast)+")";
}

gens["stat.fornum"] = function(ast){
    if (!ast.step){
        return indent + "for (var "+ast.varname+", " +
            ast.$var + " = " + codegenChecknumber(ast.from) + ", " +
            ast.$limit + " = " + codegenChecknumber(ast.to) + ";" +
            "("+ast.varname+"="+ast.$var+")<="+ast.$limit+";++" + ast.$var +")" +
            codegen(ast.block);
    } else {
        pushIndent();
        var block =
            indent + ast.varname + " = " + ast.$var + ";" +
            codegen(ast.block) +
            indent + ast.$var + " += " + ast.$step;
        popIndent();
        return indent + "var " +
            ast.$var + " = " + codegenChecknumber(ast.from) + ", " +
            ast.$limit + " = " + codegenChecknumber(ast.to) + ", " +
            ast.$step + " = " + codegenChecknumber(ast.step) + "," +
            ast.varname + ";" +
            indent + "while ((" + ast.$step + ">0 && " + ast.$var + "<=" + ast.$limit + ") || " +
            "(" + ast.$step + "<0 && " + ast.$var + ">=" + ast.$limit + ")){" +
            block +
            indent + "}";
    }
}

gens["stat.forlist"] = function(ast){
    pushIndent();
    var st = ast.$st;

    var ret = [];

    ret.push(indent + "var t = " + st+"[0]("+st+"[1],"+st+"[2]);");
    for (var i = 0; i < ast.varnames.length; ++i){
        ret.push(indent + "var " +ast.varnames[i] + " = t[" + i + "];");
    }
    ret.push(indent + "if ("+ ast.varnames[0]+" == null) break;");
    ret.push(indent + st+ "[2] = " + ast.varnames[0] + ";");
    ret.push(codegen(ast.block));
    popIndent();

    return indent + "var " + st + " = " + codegenVarList(ast.explist)+";" +
        indent + "for (;;)" +
        indent + "{" +
        ret.join("") +
        indent + "}"
}

gens["stat.while"] = function(ast){
    return indent + "while ("+ codegenSimpleVar(ast.cond)+")" + codegen(ast.block);
}

gens["stat.repeat"] = function(ast){
    return indent + "do " + codegen(ast.block) + "while (!(" + codegenSimpleVar(ast.until)+"));";
}

gens["stat.break"] = function(ast){
    return indent + "break;"
}

function isVarExpr(exp){
    if (exp.type == "vararg" || exp.type == "expr.call" || exp.type == "expr.callMethod") {
        return true;
    }
}

function isVarlist(explist){
    if (!explist.length){
        return false;
    }
    return isVarExpr(explist[explist.length - 1]);
}

function codegenSimpleVar(exp){
    if (isVarExpr(exp)) {
        return ('('+codegen(exp)+')' + "[0]");
    } else {
        return (codegen(exp));
    }
}

function codegenVarList(explist){
    if (isVarlist(explist)){
        if (explist.length == 1){
            return codegen(explist[0]);
        }
        var pres = [];
        for (var i = 0; i < explist.length-1; i++){
            pres.push(codegenSimpleVar(explist[i]));
        }
        return "[" + pres.join(',')+"].concat(" + codegen(explist[explist.length - 1]) + ")";
    } else {
        var pres = [];
        for (var i = 0; i < explist.length; i++){
            pres.push(codegenSimpleVar(explist[i]));
        }
        return "[" + pres.join(',')+"]";
    }
}

gens["vararg"] = function(ast){
    //TODO: throw a error when use __VA_ARG not in a va_arg function.
    return "__VA_ARG";
}

gens["stat.return"] = function(ast){
    if (isVarlist(ast.nret)){
        return indent + "return " + codegenVarList(ast.nret);
    } else {
        var nrets = [];
        for (var i = 0; i < ast.nret.length; i++){
            nrets.push(codegenSimpleVar(ast.nret[i]));
        }
        return indent + "return [" + nrets + "];";
    }
}

gens["stat.jsreturn"] = function(ast){
    return indent + "return " + codegenSimpleVar(ast.nret);
}

gens["stat.assignment"] = function(ast){
    if (ast.lefts.length == 1){
        //variable = explist
        var right = ast.right.length == 1 ? codegenSimpleVar(ast.right[0]) : (codegenVarList(ast.right) + "[0]");
        // single assignment
        if (ast.lefts[0].type == "expr.index") {
            //a[key] = value
            var tar = ast.lefts[0];
            return indent + "l.__set(" + codegenSimpleVar(tar.self)+", " +codegen(tar.key) + ", " + right + ");";
        }
        return indent + codegen(ast.lefts[0]) + " = " + right + ";";
    } else {
        // list = explist
        var ret = [];

        ret.push(indent + "var t = " + codegenVarList(ast.right) +";");
        for (var i = 0; i < ast.lefts.length; ++i){
            if (ast.lefts[i].type == "expr.index") {
                var tar = ast.lefts[i];
                ret.push(indent + "l.__set(" + codegenSimpleVar(tar.self) + "," + codegen(tar.key) + ",t[" +i+"]);");
            } else {
                ret.push(indent + codegen(ast.lefts[i]) + " = t[" + i + "];");
            }
        }
        return ret.join("");
    }
}

gens["expr.index"] = function(ast){
    return "l.__get(" + codegenSimpleVar(ast.self) + "," + codegen(ast.key)+")";
}

gens["expr.op"] = function(ast){
    var func;
    var op;
    switch(ast.op){
        case "op.add":
            func = "l.__add";
            break;
        case "op.minus":
            func = "l.__sub";
            break;
        case "op.mul":
            func = "l.__mul";
            break;
        case "op.div":
            func = "l.__div";
            break;
        case "op.mod":
            func = "l.__mod";
            break;
        case "op.pow":
            func = "l.__pow";
            break;
        case "op.concat":
            func = "l.__concat";
            break;
        case "op.equal":
            func = "l.__eq";
            break;
        case "op.less":
            func = "l.__lt";
            break;
        case "op.lessequal":
            func = "l.__le";
            break;
        case "op.notequal":
            func = "l.__neq";
            break;
        case "op.great":
            func = "l.__gt";
            break;
        case "op.greatequal":
            func = "l.__ge";
            break;
        case "op.and":
            op = "&&";
            break;
        case "op.or":
            op = "||";
            break;
        default:
            throw new Error(ast.op + " is not implemented yet.");
    }

    if (op){
        return codegenSimpleVar(ast.left) + op + codegenSimpleVar(ast.right);
    } else if (func){
        return func +"(" + codegenSimpleVar(ast.left) + "," + codegenSimpleVar(ast.right) + ")";
    }
}

gens["expr.uop"] = function(ast){
    switch (ast.op){
        case "uop.minus":
            return "l.__unm(" + codegenSimpleVar(ast.operand)+")";
        case "uop.not":
            return "!("+codegenSimpleVar(ast.operand)+")";
        case "uop.len":
            return "l.__len("+codegenSimpleVar(ast.operand) +")";
        default:
            throw new Error(ast.op + " is not implemented yet.");
    }
}

gens["expr.call"] = function(ast){
    var func = codegenSimpleVar(ast.func);
    return "l.__call("+func+","+ codegenVarList(ast.args) +")";
}

gens["expr.callMethod"] = function(ast){
    return "l.__callMethod(" + codegenSimpleVar(ast.self) + "," + codegenSimpleVar(ast.key) + "," + codegenVarList(ast.args) +")";
}

gens["expr.brackets"] = function(ast){
    if (isVarExpr(ast.expr)) {
        return codegenSimpleVar(ast.expr);
    } else {
        return '(' + codegen(ast.expr)+ ")";
    }
}

gens["expr.constructor"] = function(ast){
    if (!ast.fields.length){
        return "l.__newTable()";
    }
    var fields = [];
    for (var i = 0; i < ast.fields.length; i++){
        var f = ast.fields[i];
        if (f.type == "field.list"){
            if (isVarExpr(f.val) && i == ast.fields.length - 1){
                fields.push("[2, " + codegen(f.val) + "]");
            } else {
                fields.push("[0, " + codegenSimpleVar(f.val) + "]");
            }
        } else if (f.type == "field.rec"){
            fields.push("[1, " + codegen(f.key) + "," + codegenSimpleVar(f.val) + "]");
        } else {
            throw new Error("Invalid field type "+ f.type);
        }
    }
    return "l.__newTable([" + fields.join(",")+ "])";
}

gens["variable"] = function(ast){
    return ast.val;
}

gens["const.string"] = function(ast){
    return ast.val ? JSON.stringify(ast.val) : "l.ds";
}
gens["const.number"] = function(ast){
    return ast.val ? JSON.stringify(ast.val) : "l.d0";
}
gens["const.boolean"] = function(ast){
    return JSON.stringify(ast.val);
}

gens["const.nil"] = function(ast){
    return "null";
}

gens["expr.javascript"] = function(ast){
    if (ast.args.length != 1){
        throw new Error("__javascript should have exactly one arguments.");
    }
    if (ast.args[0].type == "const.string") {
        return '(' + ast.args[0].val + ")";
    } else {
        return 'eval(' + codegenSimpleVar(ast.args[0]) +")";
    }
}

function codegen(ast){
    if (gens[ast.type]){
        return gens[ast.type](ast);
    }
    throw new Error("Unsupported ast type " + ast.type);
}

var childfields = {
    "expr.uop": ["operand"],
    "expr.op": ["left", "right"],
    "stat.assignment":["lefts", "right"],
    "stat.expr": ["expr"],
    "field.list": ["val"],
    "field.rec": ["key", "val"],
    "expr.constructor": ["fields", "recs", "list"],
    "stat.if": ["cond", "tblock", "fblock"],
    "stat.fornum": ["from", "to", "step", "block"],
    "stat.forlist": ["explist", "block"],
    "stat.while": ["cond", "block"],
    "stat.repeat": ["until", "block"],
    "expr.index": ["self", "key"],
    "expr.callMethod": ["self", "key", "args"],
    "expr.call": ["func", "args"],
    "expr.brackets": ["expr"],
    "stat.method": ["self", "key", "func"],
    "stat.function": ["left", "func"],
    "stat.localfunction": ["func"],
    "stat.local": ["right"],
    "stat.return": ["nret"],
    "function": ["block"],
    "block": ["stats"]
}

function traverse(func, out){
    return function (ast) {
        function work(curr, parent) {
            if (curr && curr.constructor == Array) {
                for (var i = 0; i < curr.length; i++) {
                    curr[i] = work(curr[i], parent);
                }
                return curr;
            } else if (curr && curr.type) {
                var ret = func(curr, parent) || curr;
                var fields = childfields[ret.type];
                if (fields) {
                    for (var i = 0; i < fields.length; i++) {
                        ret[fields[i]] = work(ret[fields[i]], ret);
                    }
                }

                if (out){
                    ret = out(ret, parent) || ret;
                }

                return ret;
            }
        }
        return work(ast);
    }
}
exports.traverse = traverse;

exports.phases = [];

exports.postphases = [];

exports.run = function(ast){
//    console.log("\n");
    for (var i= 0; i < exports.phases.length; i++){
//        console.log(require("jsonf")(JSON.stringify(ast)));
        ast = exports.phases[i](ast);
//        console.log("\n");
    }
    //console.log(require("jsonf")(JSON.stringify(ast)));
    var ret =  codegen(ast);
//    var ret = "";
    for (var i= 0; i < exports.postphases.length; i++){
//        console.log(ret);
        ret = exports.postphases[i](ret);
    }
//    console.log(ret);
    return ret;
};

// process stat.localfunc & stat.local
(function(){
    exports.phases.push(traverse(function(ast){
        switch (ast.type ) {
            case 'function':{
                if (ast.varargs){
                    ast.block.stats.unshift({
                        type: "stat.getvaargs",
                        argCount: ast.args.length
                    });
                }

                // add return for function that does not return a value.
                var stats = ast.block.stats;
                if (stats.length == 0 || stats[stats.length-1].type != "stat.return"){
                    stats.push({
                        type: 'stat.return',
                        nret: []
                    });
                }
                break;
            }
            case "block":{
                var out = [];
                for (var i= 0; i < ast.stats.length; i++){
                    var curr = ast.stats[i];
                    switch (curr.type){
                        case 'stat.localfunction':{
                            // local function a  -> local a = function()
                            out.push({
                                type: 'stat.local',
                                names: [curr.name]
                            });
                            out.push({
                                type: 'stat.assignment',
                                lefts: [{
                                    type: "variable",
                                    val: curr.name
                                }],
                                right: [curr.func]
                            })
                            break;
                        }

                        case 'stat.function':{
                            out.push({
                                type: 'stat.assignment',
                                lefts: [curr.left],
                                right: [curr.func]
                            });
                            break;
                        }

                        case 'stat.method':{
                            curr.func.args.unshift("self");
                            out.push({
                                type: 'stat.assignment',
                                lefts: [{
                                    type: "expr.index",
                                    self: curr.self,
                                    key: curr.key
                                }],
                                right: [curr.func]
                            });
                            break;
                        }

                        default:
                            out.push(ast.stats[i]);
                    }
                }
                ast.stats = out;
            }
        }
    }));
})();

//phase: check global variable;
//TODO: mark local variables with extra tag.
(function(){
    exports.phases.push(function(ast){
        var blocklevel = [];
        var top;
        var varNames = {};
        var varId = 0;
        ast = traverse(function(curr){
            var names;
            switch(curr.type){
                case 'block':{
                    names = [];
                    break;
                }
                case 'function':{
                    names = curr.args;
                    break;
                }
                case 'stat.fornum':{
                    names = [curr.varname, "$var", "$limit", "$step"];
                    break;
                }
                case 'stat.forlist':{
                    names = curr.varnames;
                    names.push("$st");
                    break;
                }
                case 'variable':{
                    if (varNames[curr.val]) {
                        var ref;
                        var stack = varNames[curr.val];
                        if (top.curr.type == "fornum" || top.curr.type == "forlist"){
                            // defining for head.
                            // body will in another block;

                            //check whether there's another define.
                            if (stack[stack.length-1] != top.curr){
                                ref = stack[stack.length - 1];
                            } else if (stack.length > 1){
                                ref = stack[stack.length - 2];
                            }
                        } else {
                            ref = stack[stack.length - 1];
                        }
                        if (ref){
                            curr.val = curr.val + "$" + ref.id;
                            return ;
                        }
                    }
                    if (curr.val == '_ENV'){
                        return ;
                    }
                    // global variable. use _ENV[name]
                    return {
                        "type": "expr.index",
                        "self": {
                            "type": "variable",
                            "val": "_ENV"
                        },
                        "key": {
                            "type": "const.string",
                            "val": curr.val
                        }
                    }
                }
            }
            if (names){
                if (top) {
                    blocklevel.push(top);
                }
                top = {
                    curr: curr,
                    names: names.slice(0)
                };
                for (var i= 0; i < names.length; i++){
                    var name = names[i];
                    varNames[name] = varNames[name] || [];
                    var id = ++varId;
                    names[i] = name + "$" + id;
                    varNames[name].push({
                        id: id,
                        curr: curr
                    });
                }

                if (curr.type == 'stat.fornum'){
                    curr.varname = names[0];
                    curr.$var = names[1];
                    curr.$limit = names[2];
                    curr.$step = names[3];
                } else if (curr.type == "stat.forlist") {
                    curr.$st = names.pop();
                }
            }
        }, function(curr){
            if (top && top.curr == curr) {
                for (var i = 0; i < top.names.length; i++){
                    var name = top.names[i];
                    varNames[name].pop();//assert == blocklevel
                    if (varNames[name].length == 0){
                        delete varNames[name];
                    }
                }
                top = blocklevel.pop();
            } else if (curr.type == 'stat.local') {
                //Define local variables in current block.
                // define when out of this statement to avoid effecting initialize list.
                //add to current block;
                for (var i= 0; i < curr.names.length; i++){
                    var name = curr.names[i];
                    varNames[name] = varNames[name] || [];
                    var stack = varNames[name];
                    if (stack.length > 0 && stack[stack.length-1] === top){
                        // variable redefined.
                        var id = stack[stack.length - 1].id = ++varId;
                        curr.names[i] = name + "$" + id;
                        continue;
                    }
                    var id = ++varId;
                    curr.names[i] = name + "$" + id;
                    stack.push({
                        id: id,
                        curr: top.curr
                    });
                    top.names.push(name);
                }
            }
        })(ast);
        return ast;
    });
})();

// Fix issue #2
(function(){
    exports.phases.push(function(ast) {
        var stack = [];
        ast = traverse(function(curr){
            switch(curr.type){
                case 'function':
                {
                    if (stack.length > 0){
                        var top = stack[stack.length-1];
                        for (var i= 0; i < top.length; i++){
                            top[i].has_closure = true;
                        }
                    }
                    stack.push([]);
                    break;
                }
                case 'stat.fornum':
                case 'stat.forlist':
                case 'stat.repeat':
                case 'stat.while':
                {
                    stack[stack.length-1].push(curr);
                }
            }
        }, function(curr){
            switch(curr.type){
                case 'function':
                {
                    stack.pop();
                    break;
                }
                case 'stat.fornum':
                case 'stat.forlist':
                {
                    if (curr.has_closure){
                        var block = curr.block;

                        /*
                            for (var i= 0; i < 100; i++){
                                function(i){
                                }(i)
                            }
                        */

                        var newBlock = {
                            "type": "block",
                            "stats": [
                                {
                                    "type": "stat.expr",
                                    "expr": {
                                        "type": "expr.call",
                                        "func": {
                                            "type": "function",
                                            "args": [
                                                curr.varname
                                            ],
                                            "varargs": false,
                                            block: block
                                        },
                                        "args": [
                                            {
                                                "type" : "variable",
                                                "val": curr.varname
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                        curr.block = newBlock;
                    }
                    break;
                }
                case 'stat.repeat':
                case 'stat.while':
                {
                    var block = curr.block;

                    /*
                     for (var i= 0; i < 100; i++){
                     function(i){
                     }(i)
                     }
                     */

                    var newBlock = {
                        "type": "block",
                        "stats": [
                            {
                                "type": "stat.expr",
                                "expr": {
                                    "type": "expr.call",
                                    "func": {
                                        "type": "function",
                                        "args": [
                                        ],
                                        "varargs": false,
                                        block: block
                                    },
                                    "args": [
                                    ]
                                }
                            }
                        ]
                    }
                    curr.block = newBlock;
                    break;
                }
            }
        })(ast);
        return ast;
    });
})();

var sign = "/*lua.js generated code*/";
exports.sign = sign;
//Post-Phase: add _ENV upvalue for whole scope.
(function() {
    exports.postphases.push(function(code){
        code = sign + 'return '+code+';';
        return code;
    });
})();

    })(modules.codegen);

    (function(exports){
        /**
 * Created by Yun on 2014/9/23.
 */

var dummy0 = {
    _hashKey: -1,
    valueOf:function(){return 0;},
    toString:function(){return "0";}
};
function dstype(){
    this._hashKey = -2;
    this.toString = function(){return "";}
}
dstype.prototype = String.prototype;
var dummyStr = new dstype();

exports.dummy0 = dummy0;
exports.dummyStr = dummyStr;

var _hashKeyId = 0;

function LuaTable(fields){
    this.stringMap = {};
    this.array = [];
    this.hashMap = {};
    this.metatable = null;

    this._hashKey = ++ _hashKeyId;

    if (fields){
        for (var i = 0 ;i < fields.length; i++){
            var v = fields[i];
            if (v[0] == 0){
                this.array.push(v[1]);
            } else if (v[0] == 1) {
                this.set(v[1],v[2]);
            } else {
                for (var j = 0; j < v[1].length; j++){
                    this.array.push(v[1][j]);
                }
            }
        }
    }
}
exports.LuaTable = LuaTable;

exports.newHashKey = function(){
    return ++ _hashKeyId;
}
LuaTable.prototype = {};

LuaTable.prototype.constructor = LuaTable;

LuaTable.prototype.get = function(k){
    switch(typeof(k)){
        case 'number':
            return this.array[k-1];
        case 'string':
            return this.stringMap[k];
        case 'object':
            if (k === dummy0){
                return this.array[-1];
            }
            if (k === dummyStr){
                return this.stringMap[k];
            }
            if (k === null){
                throw new Error("table index is nil");
            }
        case 'function':{
            if (!k._hashKey) {
                //throw new Error("get with a invalid object" + k);
                k._hashKey = ++ _hashKeyId;
            }
            var rec = this.hashMap[k._hashKey];
            return rec && rec[1];
        }
        default:{
            throw new Error("get with a invalid argument" + k);
        }
    }
}

LuaTable.prototype.set = function(k, v){
    if (k == null){
        throw new Error("table index is nil");
    }
    if (v == null){
        switch(typeof(k)){
            case 'number':
                if (k == this.array.length){
                    this.array.pop();
                } else {
                    delete this.array[k-1];
                }
                break;
            case 'string':
                delete this.stringMap[k];
                break;
            case 'object':case 'function':{
                if (!k._hashKey) {
                    // ignore object that is not a key.
                    return;
                }
                delete this.hashMap[k._hashKey];
                break;
            }
            default:{
                throw new Error("set with a invalid argument" + k);
            }
        }
        return;
    }
    switch(typeof(k)){
        case 'number':
            this.array[k-1] = v;
            break;
        case 'string':
            this.stringMap[k] = v;
            break;
        case 'object':case 'function':{
            if (!k._hashKey) {
                k._hashKey = ++ _hashKeyId;
                //throw new Error("set with a invalid object" + k);
            }
            this.hashMap[k._hashKey] = [k, v];
            break;
        }
        default:{
            throw new Error("set with a invalid argument" + k);
        }
    }
}

LuaTable.prototype.length = function(){
    var len = this.array.length;
    for (; len > 0 && this.array[len-1] == null; --len){}
    if (len != this.array.length){
        this.array.length = len;
    }

    return this.array.length;
}

LuaTable.prototype.toString = function(){
    return ("table " + this._hashKey);
}

    })(modules.types);

    (function(exports){
        /**
 * Created by Yun on 2014/9/23.
 */

// Compile
var parser = require("./parser.js");
exports.parser = parser;
var codegen = require("./codegen.js");
exports.codegen = codegen;
var sign = codegen.sign;

function compile(s){
    if (s.substr(0, sign.length) != sign) {
        return codegen.run(parser.parse(s));
    } else {
        return s;
    }
}
exports.compile = compile;

var types = require("./types.js");
exports.types = types;

var dummy0 = types.dummy0;
var dummyStr = types.dummyStr;

function LuaContext(){
    if (!(this instanceof  LuaContext)){
        return new LuaContext();
    }
    // Globals for lua usage.
    var _G = new types.LuaTable();
    this._G = _G;
    _G.set("_G", _G);
    _G.set("_VERSION", "Lua 5.2");
    _G.set("_LUAJS", "Lua.js 0.1");

    var helpers = {};

    helpers.d0 = dummy0;
    helpers.ds = dummyStr;

    helpers.__getmetatable = function(t){
        if (!t){
            return null;
        }
        switch(typeof(t)){
            case 'object':
                return t.metatable || ((t instanceof types.LuaTable) ? null : helpers.jsObjMT);
            case 'string':
                return helpers.stringMT;
            case 'function':
                if (!f.__lua_function){
                    return helpers.jsFuncMT;
                }
            default:
                return null;
        }
    }

    helpers._f = function(f){
        f.__lua_function = true;
        return f;
    }

    function getMTMethod(t, e){
        var mt = helpers.__getmetatable(t);
        return mt && mt.stringMap && mt.stringMap[e];
    }

    //getter & setter
    helpers.__get = function(s, k){
        var h;
        if (s instanceof types.LuaTable){
            var v = s.get(k);
            if (v){
                return v;
            }
            h = getMTMethod(s, "__index")
            if (!h){
                return null;
            }
        } else if (typeof(s) == 'object' || (typeof(s) == 'function' && !s.__lua_function)) {
            if (typeof(s) == 'function' && s.__beforeBind){
                s = s.__beforeBind;
            }
            var ret = typeof(k)=='number'?s[k-1]:s[k];
            if (typeof(ret) == 'function'){
                var ret1 = ret.bind(s);
                ret1.__beforeBind = ret;
                return ret1;
            } else if (!ret && k == "new") {
                var dummy = function(){}
                dummy.prototype = s.prototype;
                return function(){
                    var ret = new dummy();
                    t.apply(ret, arguments);
                    return ret;
                }
            }
            return ret;
        } else {
            h = getMTMethod(s, "__index")
            if (!h){
                throw new Error("attempt to index a "+helpers.__type(s)+" value.");
            }
        }
        if (typeof(h) == "function"){
            return helpers.__call(h, [s, k])[0];
        }
        return helpers.__get(h, k);
    }
    helpers.__set = function(s, k, v){
        var h;
        if (s instanceof types.LuaTable){
            var oldv = s.get(k);
            if (oldv){
                s.set(k, v);
                return;
            }
            h = getMTMethod(s, "__newindex");
            if (!h){
                s.set(k, v);
                return
            }
        } else if (typeof(s) == 'object' || (typeof(s) == 'function' && !s.__lua_function)) {
            s[k] = v;
            return;
        } else {
            h = getMTMethod(s, "__newindex")
            if (!h){
                throw new Error("attempt to index a "+helpers.__type(s)+" value.");
            }
        }
        if (typeof(h) == "function"){
            helpers.__call(h, [s,k,v]);
        } else {
            helpers.__set(h, k, v);
        }
    };

    // operators:
//    function defineNumberOper(name, opf){
//        helpers[name] = function(a, b){
//            if (typeof(a) == 'number' && typeof(b) == 'number'){
//                return opf(a, b)||dummy0;
//            }
//            var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
//            if (o1 && o2) {
//                return opf(o1, o2)||dummy0;
//            }
//            var h = getMTMethod(a, name) || getMTMethod(b, name)
//            if (h){
//                return helpers.__call(h, [a, b])[0];
//            }
//            throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
//        }
//    }
    helpers.__add = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (a+b)||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (a+b)||dummy0;
        }
        var h = getMTMethod(a, "__add") || getMTMethod(b, "__add")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }
    helpers.__sub = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (a-b)||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (a-b)||dummy0;
        }
        var h = getMTMethod(a, "__sub") || getMTMethod(b, "__sub")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }
    helpers.__mul = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (a*b)||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (a*b)||dummy0;
        }
        var h = getMTMethod(a, "__mul") || getMTMethod(b, "__mul")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }
    helpers.__div = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (a/b)||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (a/b)||dummy0;
        }
        var h = getMTMethod(a, "__div") || getMTMethod(b, "__div")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }
    helpers.__mod = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (a%b)||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (a%b)||dummy0;
        }
        var h = getMTMethod(a, "__mod") || getMTMethod(b, "__mod")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }
    helpers.__pow = function(a, b){
        if (typeof(a) == 'number' && typeof(b) == 'number'){
            return (Math.pow(a,b))||dummy0;
        }
        var o1 = helpers.__tonumber(a), o2 = helpers.__tonumber(b);
        if (o1 && o2) {
            return (Math.pow(a,b))||dummy0;
        }
        var h = getMTMethod(a, "__pow") || getMTMethod(b, "__pow")
        if (h){
            return helpers.__call(h, [a, b])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }


//
//    defineNumberOper("__add", function(a,b){return a+b;});
//    defineNumberOper("__mul", function(a,b){return a*b;});
//    defineNumberOper("__sub", function(a,b){return a-b;});
//    defineNumberOper("__div", function(a,b){return a/b;});
//    defineNumberOper("__mod", function(a,b){return a%b;});
//    defineNumberOper("__pow", function(a,b){return Math.pow(a,b);});

    helpers.__unm = function(a){
        var o = helpers.__tonumber(a);
        if (o) {
            return -o;
        }
        var h = getMTMethod(a).__unm
        if (h) {
            return helpers.__call(h, [a])[0];
        }
        throw new Error("attempt to perform arithmetic on a " + helpers.__type(a)+" value");
    }

    helpers.__eq = function(a, b){
        return !helpers.__neq(a, b);
    }

    helpers.__neq = function(a,b){
        if (a===b){
            return false
        }
        var ta = helpers.__type(a);
        var tb = helpers.__type(b);
        if (ta != tb || (ta != 'table' && ta !="userdata")){
            return true;
        }
        var h1 = getMTMethod(a, "__eq");
        var h2 = getMTMethod(b, "__eq");
        if (!h1 || h1 != h2){
            return true;
        }
        return !(helpers.__call(h1, [a, b])[0]);
    }

    helpers.__gt = function(a, b){
        return helpers.__lt(b, a);
    }

    helpers.__ge = function(a, b){
        return helpers.__le(b, a);
    }

    helpers.__lt = function(a, b){
        var ta = helpers.__type(a);
        var tb = helpers.__type(b);
        if ((ta=="number" && tb == "number") ||
            (ta == "string" && tb == "string"))  {
            return a < b;
        } else {
            var h = getMTMethod(a, "__lt") || getMTMethod(a, "__lt");
            if (h){
                return !!(helpers.__call(h1, [a, b])[0]);
            }
            throw new Error("attempt to compare " + helpers.__type(a)+" with " + helpers.__type(b));
        }
    }

    helpers.__le = function(a, b){
        var ta = helpers.__type(a);
        var tb = helpers.__type(b);
        if ((ta=="number" && tb == "number") ||
            (ta == "string" && tb == "string"))  {
            return a <= b;
        } else {
            var h = getMTMethod(a, "__le") || getMTMethod(a, "__le");
            if (h){
                return !!(helpers.__call(h1, [a, b])[0]);
            }
            h = getMTMethod(a, "__lt") || getMTMethod(a, "__lt");
            if (h){
                return !(helpers.__call(h1, [a, b])[0]);
            }
            throw new Error("attempt to compare " + helpers.__type(a)+" with " + helpers.__type(b));
        }
    }

    helpers.__concat = function(a, b){
        var ta = helpers.__type(a);
        var tb = helpers.__type(b);
        if ((ta == 'number' || ta == 'string') &&
            (tb == 'number' || tb == 'string')){
            return (""+a+b) || dummyStr;
        }
        var h = getMTMethod(a, "__concat") || getMTMethod(b, "__concat")
        if (h){
            return helpers.__call(h1, [a, b])[0];
        }
        throw new Error("attempt to concatenate a " + helpers.__type(a)+" value");
    }

    // other functions
    helpers.__newTable = function(fields){
        var ret = new types.LuaTable(fields);
        return ret;
    }

    helpers.__len = function(c){
        switch(typeof(c)){
            case 'string':
                return c.length;
        }
        var h = getMTMethod(c, "__len");
        if (h){
            return helpers.__call(h, [a])[0];
        }
        if (c instanceof types.LuaTable) {
            return c.length();
        }
        if (typeof(c) ==  'object' && c.length){
            return c.length;
        }
        throw new Error("attempt to get length of a " + helpers.__type(c)+" value");
    }

    helpers.__tonumber = function(c){
        switch(typeof(c)){
            case 'number':
                return c;
            case 'string':
                return parseInt(s) || dummy0;
            default:
                if (c == dummy0){
                    return c;
                }
        }

        return null;
    }

    helpers.__checknumber = function(c){
        switch(typeof(c)){
            case 'number':
                return c;
            case 'string':
                return parseInt(s);
        }
        if (c == dummy0){
            return c;
        }
        throw new Error("Not a number.");
    }

    helpers.__tostring = function(c){
        if (c == null){
            return "nil";
        }
        switch(typeof(c)){
            case 'number':case 'boolean':
                return c.toString();
            case 'string':
                return c;
            case 'function':
                c._hashKey = c._hashKey || types.newHashKey();
                return 'function('+ c._hashKey+")";
            case 'object':
                if (c == dummy0){
                    return "0";
                }
                if (c == dummyStr){
                    return dummyStr;
                }
                var h = getMTMethod(c, "__tostring");
                if (h){
                    return helpers.__call(h, [c])[0];
                }

                if (c.toString) {
                    return c.toString();
                }
            default:
                return "userdata("+ c + ")";
        }
    }

    helpers.__type = function(c){
        if (c == null){
            return "nil";
        }
        var t = typeof(c);
        switch(t){
            case 'number':case 'boolean':case 'string':case 'function':
                return t;
            case 'object':
                if (c == dummy0){
                    return "number";
                }
                if (c == dummyStr){
                    return dummyStr;
                }
                if (c instanceof types.LuaTable) {
                    return "table";
                }
            default:
                return "userdata";
        }
    }

    helpers.__call = function(f, args){
        if (typeof(f) == 'function'){
            if (f.__lua_function) {
                return f.apply(null, args);
            } else {
                return [f.apply(null, args)];
            }
        }
        var h = getMTMethod(f, "__call");
        if (h){
            args.unshift(h);
            return helpers.__call(h, args);
        }
        throw new Error("attempt to call a " + helpers.__type(f)+" value");
    }

    helpers.__callMethod = function(s, k, args){
        args.unshift(s);
        //helpers.__get(s, k).apply(null, args);
        return helpers.__call(helpers.__get(s, k), args);
    }

    helpers.__dump = function(f){
        if (typeof(f) != "function"){
            throw new Error("bad argument #1 to `dump` (function expected, got " + helpers.__type(f) + ")");
        }
        return codegen.sign + "return "+ f.toString()+";"
    }

    this.loadString = helpers.__loadString = function(s, env){
        s = compile(s);
        //TODO; add extra info for s
        return new Function('_ENV', 'l', s)(env || _G, helpers);
    }

    this.loadStdLib = function(){
        if (!exports.stdlib){
            var fs = require("fs");
            var path = require("path");
            var code = fs.readFileSync(path.join(path.dirname(module.filename), "./stdlib.lua"), {encoding:'utf-8'});
            exports.stdlib = new Function('_ENV', 'l', exports.compile(code));
        }
        exports.stdlib(_G, helpers)();
    }
    this.__helpers = helpers;
}

LuaContext.prototype = {}

exports.LuaContext = exports.newContext = LuaContext;

    })(modules.index);

    modules.index.stdlib = (function(_ENV, l){
        /*lua.js generated code*/return l._f(function()
{
    var __VA_ARG = Array.prototype.slice.call(arguments, 0);
    l.__set(_ENV, "assert", l._f(function(v$1,msg$2)
    {
        if ((!(v$1)))
        {
            l.__call(l.__get(_ENV,"error"),[msg$2||"Assertion failed!"]);
        }
        return [];
    }));
    l.__set(_ENV, "collectgarbage", l._f(function()
    {
        return [];
    }));
    var notImplemented$3;
    notImplemented$3 = l._f(function(fn$4)
    {
        l.__call(l.__get(_ENV,"error"),["Not implemented"]);
        return [];
    });
    l.__set(_ENV, "dofile", notImplemented$3);
    l.__set(_ENV, "error", ( 
function(val){
    if (typeof(val) =='string')
        throw new Error(val);
    throw val;
}
));
    l.__set(_ENV, "getmetatable", ( 
function(val){
    return val && val.metatable;
}
));
    l.__set(_ENV, "ipairs", l._f(function(t$5)
    {
        return [l._f(function(t$6,i$7)
        {
            if ((l.__ge(i$7,l.__len(t$6))))
            {
                return [];
            }
            return [l.__add(i$7,1),l.__get(t$6,l.__add(i$7,1))];
        }),t$5,l.d0];
    }));
    l.__set(_ENV, "loadString", (function(str, env){
    return l.__loadString(str, env);
}
));
    l.__set(_ENV, "load", l._f(function(ld$8,source$9,mod$10,env$11)
    {
        if ((l.__eq((l.__call(l.__get(_ENV,"type"),[ld$8]))[0],"function")))
        {
            var chunks$12 = l.__newTable();
            var $st$14 = [ld$8];
            for (;;)
            {
                var t = $st$14[0]($st$14[1],$st$14[2]);
                var v$13 = t[0];
                if (v$13 == null) break;
                $st$14[2] = v$13;
                {
                    l.__call(l.__get(l.__get(_ENV,"table"),"insert"),[l.__get(_ENV,"chunk"),v$13]);
                }
            }
            ld$8 = (l.__call(l.__get(l.__get(_ENV,"table"),"concat"),[chunks$12]))[0];
        }
        return l.__call(l.__get(_ENV,"loadString"),[ld$8,env$11])
    }));
    l.__set(_ENV, "loadfile", notImplemented$3);
    l.__set(_ENV, "next", notImplemented$3);
    l.__set(_ENV, "pairs", notImplemented$3);
    l.__set(_ENV, "pcall", (l._f(function (f){
    var args = Array.prototype.slice.call(arguments, 1);
    try{
        var ret = l.__call(f, args);
        ret.unshift(true);
        return ret;
    } catch(e){
        return [false, e];
    }
})
));
    l.__set(_ENV, "print", l._f(function()
    {
        var __VA_ARG = Array.prototype.slice.call(arguments, 0);
        var args$15 = l.__newTable([[2, __VA_ARG]]);
        for (var i$16, $var$17 = 1, $limit$18 = l.__checknumber(l.__len(args$15));(i$16=$var$17)<=$limit$18;++$var$17)
        {
            l.__set(args$15, i$16, (l.__call(l.__get(_ENV,"tostring"),[l.__get(args$15,i$16)]))[0]);
        }
        l.__call(l.__get(l.__get(_ENV,"io"),"write"),l.__call(l.__get(l.__get(_ENV,"table"),"concat"),[args$15," "]));
        l.__call(l.__get(l.__get(_ENV,"io"),"write"),["\n"]);
        return [];
    }));
    l.__set(_ENV, "rawequal", (function (a, b){
    return a === b;
}
));
    l.__set(_ENV, "rawget", (function (t, k){
    var tp = l.__type(t);
    if (tp != 'table') {
        throw Error("rawget called with type " + tp);
    }
    return t.get(k);
}
));
    l.__set(_ENV, "rawlen", (function (t){
    var tp = l.__type(t);
    if (tp != 'table') {
        throw Error("rawlen called with type " + tp);
    }
    return t.length();
}
));
    l.__set(_ENV, "rawset", (function (t, k, v){
    var tp = l.__type(t);
    if (tp != 'table') {
        throw Error("rawget called with type " + tp);
    }
    t.set(k, v);
    return t;
}
));
    l.__set(_ENV, "select", (function (index){
    if (index == '#') {
        return arguments.length;
    }
    return arguments[index];
}
));
    l.__set(_ENV, "setmetatable", ( 
function(val, mt){
    if (typeof(val) != "object") {
        throw new Error("Cannot set metatable to non-object values.");
    }
    val.metatable = mt;
    return val;
}
));
    l.__set(_ENV, "tonumber", (l.__tonumber));
    l.__set(_ENV, "tostring", (l.__tostring));
    l.__set(_ENV, "type", (l.__type));
    l.__set(_ENV, "xpcall", (function (f, msgh){
    var args = Array.prototype.slice.call(arguments, 2);
    try{
        return l.__call(f, args);
    } catch(e){
        return l.__call(msgh, [e]);
    }
}
));
    l.__set(_ENV, "package", l.__newTable());
    l.__set(l.__get(_ENV,"package"), "loaded", l.__newTable());
    l.__set(l.__get(_ENV,"package"), "preload", l.__newTable());
    l.__set(_ENV, "require", l._f(function(modname$20)
    {
        var mod$21 = l.__get(l.__get(l.__get(_ENV,"package"),"loaded"),modname$20);
        if ((mod$21))
        {
            return [mod$21];
        }
        var func$22,extra$23;
        var $st$26 = l.__call(l.__get(_ENV,"ipairs"),[l.__get(l.__get(_ENV,"package"),"searchers")]);
        for (;;)
        {
            var t = $st$26[0]($st$26[1],$st$26[2]);
            var i$24 = t[0];
            var v$25 = t[1];
            if (i$24 == null) break;
            $st$26[2] = i$24;
            {
                var t = l.__call(v$25,[modname$20]);
                func$22 = t[0];
                extra$23 = t[1];
                if ((func$22))
                {
                    break;
                }
            }
        }
        var ret$27 = (l.__call(func$22,[modname$20,extra$23]))[0];
        l.__set(l.__get(l.__get(_ENV,"package"),"loaded"), modname$20, l.__get(l.__get(l.__get(_ENV,"package"),"loaded"),modname$20)||ret$27);
        return [l.__get(l.__get(l.__get(_ENV,"package"),"loaded"),modname$20)];
    }));
    l.__set(_ENV, "string", l.__newTable());
    (l.stringMT) = l.__get(_ENV,"string");
    l.__set(l.__get(_ENV,"string"), "byte", (l._f(function (s, i, j){
    if (typeof(s) != 'string'){
        s = l.__tostring(s);
        if (s == l.ds){
            // Empty string.
            return [];
        }
    }
    i = i || 1;
    j = j || i;
    if (i < 0){
        i = s.length + i;
    } else {
        i--;
    }
    if (j < 0){
        j = s.length + j + 1;
    }
    var ret = []; 
    for (; i<j; ++i){
        var c = s.charCodeAt(i);
        if (c){
            ret.push(c);
        }
    }
    return ret;
})
));
    l.__set(l.__get(_ENV,"string"), "dump", (l.__dump));
    l.__set(l.__get(_ENV,"string"), "find", (function (s, pattern, init, plain){
    if (plain){
        return s.indexOf(pattern, init && (init-1))+1
    }
    throw new Error("Not implemented.")
}
));
    l.__set(l.__get(_ENV,"string"), "len", (function (s){
    if (typeof(s) != 'string' && s != l.ds){
        s = l.__tostring(s);
    }
    if (s == l.ds){
        // Empty string.
        return 0;
    }
    return s.length;
}
));
    l.__set(l.__get(_ENV,"string"), "lower", (function (s){
    if (typeof(s) != 'string' && s != l.ds){
        s = l.__tostring(s);
    }
    if (s == l.ds){
        // Empty string.
        return s;
    }
    return s.toLowerCase();
}
));
    l.__set(l.__get(_ENV,"string"), "upper", (function (s){
    if (typeof(s) != 'string' && s != l.ds){
        s = l.__tostring(s);
    }
    if (s == l.ds){
        // Empty string.
        return s;
    }
    return s.toUpperCase();
}
));
    l.__set(l.__get(_ENV,"string"), "rep", (function (s, n, sep){
    if (sep){
        return new Array(n).join(s+sep) + s;
    } else {
        return new Array(n+1).join(s);
    }
}
));
    l.__set(l.__get(_ENV,"string"), "reverse", (function (s){
    if (typeof(s) != 'string' && s != l.ds){
        s = l.__tostring(s);
    }
    if (s == l.ds){
        // Empty string.
        return s;
    }        
    return s.split("").reverse().join("")
}
));
    l.__set(l.__get(_ENV,"string"), "sub", (function (s, i, j){
    if (typeof(s) != 'string' && s != l.ds){
        s = l.__tostring(s);
    }
    if (s == l.ds){
        // Empty string.
        return [s];
    }        
    j = j || s.length;
    if (i < 0){
        i = s.length + i;
    } else {
        i--;
    }
    if (j < 0){
        j = s.length + j + 1;
    }
    return s.substring(s, i, j);
}
));
    l.__set(_ENV, "table", l.__newTable());
    l.__set(l.__get(_ENV,"table"), "concat", (function (list, sep, i, j){
    list = list.array;
    if (i){
        if (j){
            list = list.slice(i-1, j-1);
        } else {
            list = list.slice(i-1);
        }
    }
    return list.join(sep || "")
}
));
    l.__set(l.__get(_ENV,"table"), "insert", (function (t, pos, value){
    if (pos){
        t.array.splice(pos-1, 0, value);
    } else {
        t.array.push(value);
    }
}
));
    l.__set(l.__get(_ENV,"table"), "pack", l._f(function()
    {
        var __VA_ARG = Array.prototype.slice.call(arguments, 0);
        return [l.__newTable([[2, __VA_ARG]])];
    }));
    l.__set(_ENV, "pack", l.__get(l.__get(_ENV,"table"),"pack"));
    l.__set(l.__get(_ENV,"table"), "remove", (l._f(function (t, pos){
    if (pos){
        return t.array.splice(pos-1, 1);
    } else {
        return [t.array.pop()];
    }
})
));
    l.__set(l.__get(_ENV,"table"), "sort", (function (t, comp){
    if (comp){
        t.array.sort(function(){
            if (comp(a, b)[0]){
                return -1;
            } else if (comp(b, a)[0]){
                return 1;
            }
            return 0;
        })
    } else {
        t.array.sort(function(a, b){
            if (l.__lt(a, b)){
                return -1;
            } else if (l.__lt(b, a)){
                return 1;
            }
            return 0;
        });
    }
}
));
    l.__set(l.__get(_ENV,"table"), "unpack", (l._f(function (t){
    return t.array;
})
));
    l.__set(_ENV, "math", l.__newTable());
    l.__set(l.__get(_ENV,"math"), "abs", (Math.abs));
    l.__set(l.__get(_ENV,"math"), "acos", (Math.acos));
    l.__set(l.__get(_ENV,"math"), "asin", (Math.asin));
    l.__set(l.__get(_ENV,"math"), "atan", (Math.atan));
    l.__set(l.__get(_ENV,"math"), "atan2", (Math.atan2));
    l.__set(l.__get(_ENV,"math"), "ceil", (Math.ceil));
    l.__set(l.__get(_ENV,"math"), "cos", (Math.cos));
    l.__set(l.__get(_ENV,"math"), "cosh", (Math.cosh));
    l.__set(l.__get(_ENV,"math"), "deg", (Math.deg));
    l.__set(l.__get(_ENV,"math"), "exp", (Math.exp));
    l.__set(l.__get(_ENV,"math"), "floor", (Math.floor));
    l.__set(l.__get(_ENV,"math"), "pow", (Math.pow));
    l.__set(l.__get(_ENV,"math"), "sin", (Math.sin));
    l.__set(l.__get(_ENV,"math"), "sinh", (Math.sinh));
    l.__set(l.__get(_ENV,"math"), "sqrt", (Math.sqrt));
    l.__set(l.__get(_ENV,"math"), "tan", (Math.tan));
    l.__set(l.__get(_ENV,"math"), "tanh", (Math.tanh));
    l.__set(l.__get(_ENV,"math"), "pi", (Math.PI));
    l.__set(l.__get(_ENV,"math"), "log", (function (v, base){
    return base ? Math.log(v)/Math.log(base) : Math.log(v);
}
));
    l.__set(l.__get(_ENV,"math"), "max", (function (){
    return Math.max.apply(null, arguments);
}
));
    l.__set(l.__get(_ENV,"math"), "min", (function (v){
    return Math.min.apply(null, arguments);
}
));
    l.__set(l.__get(_ENV,"math"), "rad", (    function (v){
        return [v*Math.PI/180];
    }
));
    l.__set(l.__get(_ENV,"math"), "random", (    function  (m, n){
        if (m){
            if (!n){
                return [Math.floor(Math.random()*m)+1]
            }
            return [Math.floor(Math.random()*(n-m+1))+m]
        }
        return [Math.random()];
    }
));
    l.__set(_ENV, "bit32", l.__newTable());
    l.__set(l.__get(_ENV,"bit32"), "arshift", (    function (x, disp){
        return x<<disp;
    }
));
    l.__set(l.__get(_ENV,"bit32"), "band", (    function (x){
        for (var i= 1; i < arguments.length; i++){
            x &= arguments[i];
        }
        return x;
    }
));
    l.__set(l.__get(_ENV,"bit32"), "bnot", (    function (x){
        return ~x;
    }
));
    l.__set(l.__get(_ENV,"bit32"), "bor", (    function (x){
        for (var i= 1; i < arguments.length; i++){
            x |= arguments[i];
        }
        return x;
    }
));
    l.__set(l.__get(_ENV,"bit32"), "btest", (    function (x){
        for (var i= 1; i < arguments.length; i++){
            x &= arguments[i];
        }
        return x != 0;
    }
));
    l.__set(l.__get(_ENV,"bit32"), "bxor", (    function (x){
        for (var i= 1; i < arguments.length; i++){
            x ^= arguments[i];
        }
        return x != 0;
    }
));
    l.__set(_ENV, "io", l.__newTable());
    l.__set(l.__get(_ENV,"io"), "write", (function (v){
    if (v != "\n"){
        console.log(v)
    }
}
));
    l.__set(l.__get(_ENV,"io"), "flush", l._f(function()
    {
        return [];
    }));
    l.__set(_ENV, "os", l.__newTable());
    l.__set(l.__get(_ENV,"os"), "clock", (    (function(){
        var start = Date.now();
        return function(){
            return (Date.now() - start)/1000;
        }
    })()
));
    l.__set(l.__get(_ENV,"os"), "difftime", l._f(function(t2$28,t1$29)
    {
        return [l.__sub(t2$28,t1$29)];
    }));
    l.__set(l.__get(_ENV,"os"), "time", (function(){
    return Date.now()/1000;
}
));
    return [];
});
    });

    if (typeof window !== 'undefined') {
        (function(){
            var luajs = modules.index;
            /**
 * Created by Yun on 2014/11/7.
 */

var L = luajs.newContext();

L.loadStdLib();

L._G.metatable = new luajs.types.LuaTable([[1, "__index", window]]);

function httpGet(url, cb){
    var request = (window.XMLHttpRequest) ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"); ;
    request.addEventListener("readystatechange", function(){
        if (request.readyState == 4){
            if (request.status != 200 && request.status != 0){
                throw new Error("HTTP " + request.status + ": " + url);
            }
            console.info("Loaded: ", url);
            cb(request.responseText);
        }
    });
    request.open("GET", url, true);// 异步处理返回
    request.send();
}

function execute(luas, i){
    i = i || 0;
    if (i>=luas.length){
        return;
    }
    var cur = luas[i];
    if (cur.code){
        L.loadString(cur.code)("embedded");
        execute(luas, i+1);
    } else {
        httpGet(cur.src, function(content){
            L.loadString(content)(cur.src);
            execute(luas, i+1);
        })
    }
}

function runScripts(){
    var scripts = window.document.getElementsByTagName("script");
    var luas = [];
    var works = 0;
    for (var i=0;i<scripts.length; i++){
        var sc = scripts[i];
        if (sc.type == "text/lua" || sc.type == "application/x-lua"){
            if (sc.src){
                luas.push({
                    src: sc.src
                });
            } else {
                luas.push({
                    code: sc.innerHTML
                })
            }
        }
    }
    execute(luas);
}

if (window.addEventListener){
    window.addEventListener("DOMContentLoaded", runScripts, false);
} else {
    window.attachEvent("onload", runScripts);
}

        })();
    }

    return modules.index;
}));
