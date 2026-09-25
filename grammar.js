/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  assign: 1,
  range: 2,
  or: 3,
  and: 4,
  bit_or: 5,
  bit_xor: 6,
  bit_and: 7,
  equal: 8,
  compare: 9,
  shift: 10,
  add: 11,
  mul: 12,
  unary: 13,
  postfix: 14,
  call: 15,
};

const sep1 = (rule, sep) => seq(rule, repeat(seq(sep, rule)));
const commaSep1 = (rule) => sep1(rule, ",");
const commaSep = (rule) => optional(commaSep1(rule));

module.exports = grammar({
  name: "fun",

  extras: ($) => [/\s/, $.comment],

  word: ($) => $.identifier,

  supertypes: ($) => [$._expression, $._statement, $._type, $._declaration],

  conflicts: ($) => [
    [$.if_statement],
    [$._statement, $.else_clause],
    [$.if_statement, $._expression],
    [$.variant_pattern, $._expression],
    [$._statement, $.fit_arm],
    [$._pattern, $.parenthesized_expression],
    [$._pattern, $.tuple_expression],
    [$.variant_pattern, $.enum_shorthand_expression],
    [$._type_name, $.qualified_type, $.variant_pattern, $._expression],
    [$.binary_expression, $.generic_call_expression],
    [$.destructure_names, $._expression],
    [$.receive_expression, $.binary_expression, $.generic_call_expression],
    [$.fork_expression, $.binary_expression, $.generic_call_expression],
    [$.await_expression, $.binary_expression, $.generic_call_expression],
    [$.unary_expression, $.binary_expression, $.generic_call_expression],
    [$._expression, $.field_initializer],
    [$.block, $.compound_expression],
    [$.enum_shorthand_expression],
    [$._type_name, $.qualified_type, $._expression],
    [$._type_name, $._expression],
    [$.qualified_type, $.field_expression],
    [$.generic_type, $.binary_expression],
    [$.generic_type, $.generic_call_expression],
    [$.generic_type, $.compound_expression],
    [$.pointer_type, $.binary_expression],
    [$.array_type, $.index_expression],
    [$.tuple_type, $.tuple_expression],
    [$.tuple_type, $.parenthesized_expression],
    [$.tuple_pattern, $.tuple_expression],
    [$.tuple_pattern, $.parenthesized_expression],
    [$._pattern, $._expression],
    [$.fit_arm],
    [$.function_type, $._expression],
    [$.variable_declaration, $._expression],
    [$._type, $._expression],
  ],

  rules: {
    source_file: ($) => repeat($._item),

    _item: ($) => choice($._declaration, $._statement),

    comment: () =>
      token(
        choice(seq("//", /[^\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),

    // ---------- declarations ----------

    _declaration: ($) =>
      choice(
        $.use_declaration,
        $.function_declaration,
        $.compound_declaration,
        $.enum_declaration,
        $.quirk_declaration,
        $.impl_declaration,
        $.alias_declaration,
        $.test_declaration,
        $.fuzz_declaration,
      ),

    visibility: () => "pub",

    use_declaration: ($) =>
      seq(
        optional($.visibility),
        "use",
        $.module_path,
        optional(seq("as", field("alias", $.identifier))),
        ";",
      ),

    module_path: ($) =>
      seq(repeat(".."), sep1(alias($.identifier, $.module), ".")),

    function_declaration: ($) =>
      seq(
        optional($.visibility),
        optional("async"),
        "fun",
        field("name", $.identifier),
        optional(field("type_parameters", $.type_parameters)),
        field("parameters", $.parameters),
        optional(field("return_type", $._type)),
        choice(field("body", $.block), ";"),
      ),

    method_declaration: ($) =>
      seq(
        optional($.visibility),
        optional("async"),
        field("name", $.identifier),
        optional(field("type_parameters", $.type_parameters)),
        field("parameters", $.parameters),
        optional(field("return_type", $._type)),
        choice(field("body", $.block), ";"),
      ),

    type_parameters: ($) => seq("<", commaSep1($.type_parameter), ">"),

    type_parameter: ($) =>
      seq(
        choice(
          alias($.identifier, $.type_identifier),
          seq("(", alias($.identifier, $.type_identifier), ")"),
        ),
        optional(seq(":", sep1($._type, "|"))),
        optional(seq("=", $._type)),
      ),

    parameters: ($) =>
      seq(
        "(",
        optional(
          seq(
            commaSep1(choice($.parameter, $.variadic)),
            optional(","),
          ),
        ),
        ")",
      ),

    parameter: ($) =>
      seq(
        field("type", $._type),
        field("name", $.identifier),
        optional(seq("=", field("default", $._expression))),
      ),

    variadic: () => "...",

    compound_declaration: ($) =>
      seq(
        optional($.visibility),
        "compound",
        field("name", alias($.identifier, $.type_identifier)),
        optional(field("type_parameters", $.type_parameters)),
        field("body", $.field_list),
      ),

    field_list: ($) => seq("{", repeat($.field_declaration), "}"),

    field_declaration: ($) =>
      seq(
        field("type", $._type),
        field("name", $.identifier),
        optional(seq("=", $._expression)),
        ";",
      ),

    enum_declaration: ($) =>
      seq(
        optional($.visibility),
        "enum",
        field("name", alias($.identifier, $.type_identifier)),
        optional(field("type_parameters", $.type_parameters)),
        field("body", $.enum_body),
      ),

    enum_body: ($) =>
      seq("{", optional(seq(commaSep1($.enum_variant), optional(","))), "}"),

    enum_variant: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq("(", commaSep1($._type), ")")),
        optional(seq("=", field("value", $._expression))),
      ),

    quirk_declaration: ($) =>
      seq(
        optional($.visibility),
        "quirk",
        field("name", alias($.identifier, $.type_identifier)),
        optional(field("type_parameters", $.type_parameters)),
        field("body", $.quirk_body),
      ),

    quirk_body: ($) => seq("{", repeat($.method_declaration), "}"),

    impl_declaration: ($) =>
      seq(
        optional($.visibility),
        "impl",
        field("type", $.impl_type),
        optional(seq("as", field("quirk", $._type))),
        field("body", $.impl_body),
      ),

    impl_type: ($) =>
      seq(
        choice($._type_name, $.qualified_type),
        optional($.type_parameters),
      ),

    impl_body: ($) => seq("{", repeat($.method_declaration), "}"),

    alias_declaration: ($) =>
      seq(
        optional($.visibility),
        "als",
        field("name", alias($.identifier, $.type_identifier)),
        optional(field("type_parameters", $.type_parameters)),
        "=",
        sep1(field("value", $._type), "|"),
        ";",
      ),

    test_declaration: ($) =>
      seq(
        optional("sequential"),
        "test",
        field("name", $.string_literal),
        field("body", $.block),
      ),

    fuzz_declaration: ($) =>
      seq(
        "fuzz",
        field("name", $.string_literal),
        field("parameters", $.parameters),
        field("body", $.block),
      ),

    // ---------- types ----------

    _type: ($) =>
      choice(
        $.primitive_type,
        $._type_name,
        $.qualified_type,
        $.generic_type,
        $.pointer_type,
        $.array_type,
        $.tuple_type,
        $.function_type,
      ),

    primitive_type: () =>
      token(
        choice(
          "void",
          "raw",
          "num",
          "dec",
          "str",
          "flag",
          "chr",
          "f32",
          "f64",
        ),
      ),

    _type_name: ($) => alias($.identifier, $.type_identifier),

    qualified_type: ($) =>
      seq(
        field("module", $.identifier),
        ".",
        field("name", alias($.identifier, $.type_identifier)),
      ),

    generic_type: ($) =>
      prec.dynamic(
        1,
        seq(
          field("type", choice($._type_name, $.qualified_type)),
          field("arguments", $.type_arguments),
        ),
      ),

    type_arguments: ($) => seq("<", commaSep1($._type), ">"),

    pointer_type: ($) => prec.left(seq($._type, "*")),

    array_type: ($) =>
      prec.left(
        seq($._type, "[", optional(field("length", $._expression)), "]"),
      ),

    tuple_type: ($) => seq("(", $._type, ",", commaSep1($._type), ")"),

    function_type: ($) =>
      prec.right(
        seq(
          "fun",
          "(",
          commaSep($._type),
          ")",
          optional(field("return_type", $._type)),
        ),
      ),

    // ---------- statements ----------

    block: ($) => seq("{", repeat($._item), "}"),

    _statement: ($) =>
      choice(
        $.variable_declaration,
        $.let_declaration,
        $.const_declaration,
        $.destructure_declaration,
        $.expression_statement,
        $.if_statement,
        $.for_statement,
        $.fit_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
        $.defer_statement,
        $.assert_statement,
        $.panic_statement,
        $.warning_control,
        $.asm_statement,
        $.block,
        $.empty_statement,
      ),

    empty_statement: () => ";",

    variable_declaration: ($) =>
      prec.dynamic(
        1,
        seq(
          optional($.visibility),
          field("type", $._type),
          field("name", $.identifier),
          optional(seq("=", field("value", $._expression))),
          ";",
        ),
      ),

    let_declaration: ($) =>
      seq(
        optional($.visibility),
        "let",
        field("name", $.identifier),
        "=",
        field("value", $._expression),
        ";",
      ),

    const_declaration: ($) =>
      seq(
        optional($.visibility),
        "const",
        optional(field("type", $._type)),
        field("name", $.identifier),
        "=",
        field("value", $._expression),
        ";",
      ),

    destructure_declaration: ($) =>
      seq(
        choice("let", field("type", $.tuple_type)),
        $.destructure_names,
        "=",
        field("value", $._expression),
        ";",
      ),

    destructure_names: ($) => seq("(", commaSep1($.identifier), ")"),

    expression_statement: ($) => seq($._expression, ";"),

    if_statement: ($) =>
      choice(
        seq(
          "if",
          field("condition", $._expression),
          field("consequence", $.block),
          repeat($.elif_clause),
          optional($.else_clause),
        ),
        prec.dynamic(
          -1,
          seq(
            "if",
            field("condition", $.parenthesized_expression),
            field("consequence", $._statement),
            optional($.else_clause),
          ),
        ),
      ),

    elif_clause: ($) =>
      seq(
        "elif",
        field("condition", $._expression),
        field("consequence", $.block),
      ),

    else_clause: ($) => seq("else", field("body", choice($.block, $.if_statement, $._statement))),

    for_statement: ($) =>
      choice(
        seq("for", field("body", $.block)),
        seq("for", field("condition", $._expression), field("body", $.block)),
        seq(
          "for",
          field("item", choice($.identifier, $.destructure_names)),
          ":",
          field("iterable", $._expression),
          field("body", $.block),
        ),
        seq(
          "for",
          field("index", $.identifier),
          ",",
          field("item", $.identifier),
          "::",
          field("iterable", $._expression),
          field("body", $.block),
        ),
      ),

    fit_statement: ($) =>
      seq(
        "fit",
        field("subject", $._expression),
        "{",
        repeat($.fit_arm),
        "}",
      ),

    fit_arm: ($) =>
      seq(
        commaSep1($._pattern),
        "->",
        choice($.block, seq($._statement)),
        optional(","),
      ),

    _pattern: ($) =>
      choice(
        $.wildcard_pattern,
        $.variant_pattern,
        $.tuple_pattern,
        $._expression,
      ),

    wildcard_pattern: () => "_",

    variant_pattern: ($) =>
      prec.dynamic(
        1,
        seq(
          optional(field("enum", $.identifier)),
          ".",
          field("variant", $.identifier),
          optional(seq("(", commaSep1(choice($.identifier, "_")), ")")),
        ),
      ),

    tuple_pattern: ($) => seq("(", commaSep1($._pattern), ")"),

    return_statement: ($) => seq("ret", optional($._expression), ";"),
    break_statement: () => seq("break", ";"),
    continue_statement: () => seq("continue", ";"),

    defer_statement: ($) =>
      seq("defer", choice($.block, seq($._expression, ";"))),

    assert_statement: ($) =>
      seq(
        "assert",
        field("condition", $._expression),
        optional(seq(",", field("message", $._expression))),
        ";",
      ),

    panic_statement: ($) => seq("panic", $._expression, ";"),

    warning_control: ($) =>
      seq(
        choice("allow", "expect"),
        field("id", $.identifier),
        ",",
        field("reason", $.string_literal),
        ";",
      ),

    asm_statement: ($) =>
      seq(
        "asm",
        optional("volatile"),
        optional(seq("arch", field("arch", $.identifier))),
        optional($.asm_operands),
        choice($.asm_body, $.string_literal),
        ";",
      ),

    asm_operands: ($) =>
      seq("(", repeat(choice($._asm_operand, ";")), ")"),

    _asm_operand: ($) =>
      choice(
        seq(
          choice("out", "in"),
          $.identifier,
          ":",
          $.string_literal,
          "=",
          $._expression,
        ),
        seq("clobber", $.string_literal),
      ),

    asm_body: () => token(seq("{", /[^}]*/, "}")),

    // ---------- expressions ----------

    _expression: ($) =>
      choice(
        $.identifier,
        $.number_literal,
        $.string_literal,
        $.raw_string_literal,
        $.char_literal,
        $.boolean_literal,
        $.nil_literal,
        $.parenthesized_expression,
        $.tuple_expression,
        $.array_expression,
        $.enum_shorthand_expression,
        $.compound_expression,
        $.unary_expression,
        $.binary_expression,
        $.assignment_expression,
        $.send_expression,
        $.call_expression,
        $.generic_call_expression,
        $.field_expression,
        $.index_expression,
        $.propagate_expression,
        $.sizeof_expression,
        $.await_expression,
        $.fork_expression,
        $.receive_expression,
      ),

    number_literal: () =>
      token(
        choice(
          /0[xX][0-9a-fA-F_]+/,
          /0[bB][01_]+/,
          /[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][+-]?[0-9]+)?/,
        ),
      ),

    string_literal: ($) =>
      seq(
        '"',
        repeat(choice($.escape_sequence, $.string_content)),
        '"',
      ),

    string_content: () => token.immediate(prec(1, /[^"\\\n]+/)),

    escape_sequence: () => token.immediate(seq("\\", /[^\n]/)),

    char_literal: () => token(seq("'", choice(/[^'\\\n]/, seq("\\", /[^\n]/)), "'")),

    raw_string_literal: () =>
      token(
        choice(
          /`([^`\n]|``)*(`|(\n[ \t]*`([^`\n]|``)*)+`?)/,
        ),
      ),

    boolean_literal: () => choice("true", "false"),
    nil_literal: () => "nil",

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    tuple_expression: ($) =>
      seq("(", $._expression, ",", commaSep1($._expression), optional(","), ")"),

    array_expression: ($) =>
      seq("[", optional(seq(commaSep1($._expression), optional(","))), "]"),

    enum_shorthand_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          ".",
          field("variant", $.identifier),
          optional(field("arguments", $.arguments)),
        ),
      ),

    compound_expression: ($) =>
      seq(
        optional(field("type", choice($._type_name, $.generic_type, $.qualified_type))),
        choice(
          seq("{", optional(seq(commaSep1($.field_initializer), optional(","))), "}"),
          seq(".", "{", optional(seq(commaSep1($.field_initializer), optional(","))), "}"),
        ),
      ),

    field_initializer: ($) =>
      seq(field("name", $.identifier), "=", field("value", $._expression)),

    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(choice("-", "!", "~", "&", "*", "++", "--"), $._expression),
      ),

    await_expression: ($) => prec(PREC.unary, seq("await", $._expression)),

    fork_expression: ($) => prec(PREC.unary, seq("fork", $._expression)),

    receive_expression: ($) => prec(PREC.unary, seq("<-", $._expression)),

    binary_expression: ($) => {
      const table = [
        [PREC.range, ".."],
        [PREC.or, "||"],
        [PREC.and, "&&"],
        [PREC.bit_or, "|"],
        [PREC.bit_xor, "^"],
        [PREC.bit_and, "&"],
        [PREC.equal, choice("==", "!=")],
        [PREC.compare, choice("<", "<=", ">", ">=")],
        [PREC.shift, choice("<<", ">>")],
        [PREC.add, choice("+", "-")],
        [PREC.mul, choice("*", "/", "%")],
      ];
      return choice(
        ...table.map(([p, op]) =>
          prec.left(
            p,
            seq(
              field("left", $._expression),
              field("operator", op),
              field("right", $._expression),
            ),
          ),
        ),
      );
    },

    assignment_expression: ($) =>
      prec.right(
        PREC.assign,
        seq(
          field("left", $._expression),
          field(
            "operator",
            choice("=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="),
          ),
          field("right", $._expression),
        ),
      ),

    send_expression: ($) =>
      prec.right(
        PREC.assign,
        seq(field("channel", $._expression), "<-", field("value", $._expression)),
      ),

    call_expression: ($) =>
      prec(
        PREC.call,
        seq(field("function", $._expression), field("arguments", $.arguments)),
      ),

    generic_call_expression: ($) =>
      prec.dynamic(
        1,
        prec(
          PREC.call,
          seq(
            field("function", $._expression),
            field("type_arguments", $.type_arguments),
            field("arguments", $.arguments),
          ),
        ),
      ),

    arguments: ($) =>
      seq("(", optional(seq(commaSep1($._expression), optional(","))), ")"),

    field_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("value", $._expression),
          ".",
          field("field", choice($.identifier, $.tuple_index)),
        ),
      ),

    tuple_index: () => token.immediate(/[0-9]+/),

    index_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field("value", $._expression), "[", field("index", $._expression), "]"),
      ),

    propagate_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("value", $._expression),
          choice(
            "?",
            "!",
            "!?",
            seq("?!", "(", $._expression, ")"),
          ),
        ),
      ),

    sizeof_expression: ($) => seq("sizeof", "(", $._type, ")"),

    identifier: () => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});
